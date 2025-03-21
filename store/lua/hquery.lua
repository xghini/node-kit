-- query.lua
-- Get parameters
local pattern = ARGV[1]
local sort_spec = ARGV[2] or ''
local limit = tonumber(ARGV[3]) or 0
local fields = ARGV[4]
local filter_count = tonumber(ARGV[5])

-- Parse sort specification
local sort_field = ''
local sort_order = 'asc'

if sort_spec ~= '' then
    local parts = {}
    for part in string.gmatch(sort_spec, "%S+") do
        table.insert(parts, part)
    end
    
    if #parts == 1 then
        -- 如果只有一个部分
        if parts[1] == 'asc' or parts[1] == 'desc' then
            -- 如果是排序方向，对key排序
            sort_order = parts[1]
        else
            -- 否则作为排序字段，默认asc
            sort_field = parts[1]
        end
    elseif #parts == 2 then
        -- 如果有两个部分
        sort_field = parts[1]
        if parts[2] == 'desc' then
            sort_order = 'desc'
        end
    end
end

-- 辅助函数：安全的数值转换
local function safe_tonumber(str)
    if not str then return nil end
    -- 检查是否是特殊值
    if str == "inf" or str == "+inf" then return math.huge
    elseif str == "-inf" then return -math.huge end
    
    -- 尝试转换为数字
    local num = tonumber(str)
    if not num then return nil end
    
    -- 检查是否超出Lua的数字范围
    if num > 2^53 or num < -2^53 then
        -- 对于大数，保持字符串比较
        return str
    end
    return num
end

-- 辅助函数：安全的比较
local function safe_compare(value, val, op)
    if value == nil then return false end
    if val == nil then return false end
    
    -- 确保都是字符串类型
    value = tostring(value)
    val = tostring(val)
    
    -- 尝试数值转换
    local num_value = safe_tonumber(value)
    local num_val = safe_tonumber(val)
    
    -- 如果两个值都能转为数字，进行数值比较
    if num_value and num_val then
        if op == "=" then return num_value == num_val
        elseif op == ">" then return num_value > num_val
        elseif op == "<" then return num_value < num_val
        elseif op == ">=" then return num_value >= num_val
        elseif op == "<=" then return num_value <= num_val
        end
    else
        -- 如果有任何一个值不能转为数字，进行字符串比较
        if op == "=" then return value == val
        elseif op == ">" then return value > val
        elseif op == "<" then return value < val
        elseif op == ">=" then return value >= val
        elseif op == "<=" then return value <= val
        end
    end
    return false
end

-- 通配符匹配辅助函数
local function pattern_match(str, pattern)
    if not str or not pattern then return false end
    
    -- 转义特殊字符
    local lua_pattern = string.gsub(pattern, "([%%%^%$%(%)%.%[%]%*%+%-%?])", function(c)
        if c == "*" then
            return ".*"  -- 将*转换为Lua的通配符.*
        else
            return "%" .. c  -- 转义其他特殊字符
        end
    end)
    
    -- 使用Lua模式匹配
    return string.match(str, "^" .. lua_pattern .. "$") ~= nil
end

-- Parse fields if provided
local field_list = {}
if fields ~= '' then
    for field in string.gmatch(fields, '[^,]+') do
        table.insert(field_list, field)
    end
end

-- Parse filters with validation
local filters = {}
local i = 6
while i <= 5 + filter_count * 3 do
    -- 确保在索引范围内
    if i > #ARGV or i + 1 > #ARGV or i + 2 > #ARGV then
        break
    end

    local key = ARGV[i]
    local op = ARGV[i + 1]
    local value = ARGV[i + 2]
    
    -- 验证操作符是否合法
    if op ~= "=" and op ~= ">" and op ~= "<" and op ~= ">=" and op ~= "<=" and op ~= "IN" and op ~= "LIKE" then
        -- 非法操作符时跳过此过滤器
        break
    end
    
    filters[#filters + 1] = {key, op, value}
    i = i + 3
end

-- Scan keys matching pattern
local results = {}
local cursor = "0"
repeat
    local res = redis.call("SCAN", cursor, "MATCH", pattern, "COUNT", 100)
    cursor = res[1]
    local keys = res[2]

    for _, key in ipairs(keys) do
        -- Skip non-hash keys
        if redis.call("TYPE", key).ok == "hash" then
            local match = true
            
            for _, filter in ipairs(filters) do
                local field = filter[1]
                local op = filter[2]
                local val = filter[3]
                local value = redis.call("HGET", key, field)
                
                -- 如果字段不存在，就跳过这个key
                if value == nil or value == cjson.null then
                    match = false
                    break
                end

                -- 确保value是字符串类型
                value = tostring(value)

                if op == "IN" then
                    local success, values = pcall(cjson.decode, val)
                    if not success then
                        return redis.error_reply("Invalid JSON in IN operator")
                    end
                    
                    local matched = false
                    for _, test_value in ipairs(values) do
                        if type(test_value) == "string" and string.find(test_value, "*", 1, true) then
                            -- 通配符匹配
                            if pattern_match(value, test_value) then
                                matched = true
                                break
                            end
                        else
                            -- 精确匹配
                            if value == tostring(test_value) then
                                matched = true
                                break
                            end
                        end
                    end
                    if not matched then
                        match = false
                        break
                    end
                elseif op == "LIKE" then
                    -- 使用新添加的LIKE操作符进行通配符匹配
                    if not pattern_match(value, val) then
                        match = false
                        break
                    end
                else
                    if not safe_compare(value, val, op) then
                        match = false
                        break
                    end
                end
            end

            if match then
                if #field_list == 0 then
                    table.insert(results, key)
                else
                    local row = {key}
                    for _, field in ipairs(field_list) do
                        local value = redis.call("HGET", key, field)
                        table.insert(row, value or cjson.null)
                    end
                    table.insert(results, row)
                end
            end
        end
    end
until cursor == "0"

-- Sort results based on sort specification
if sort_spec ~= '' then
    if sort_field == '' then
        -- 如果没有指定排序字段但指定了排序方向，按key排序
        table.sort(results, function(a, b)
            local a_val = type(a) == "table" and a[1] or a
            local b_val = type(b) == "table" and b[1] or b
            if sort_order == 'desc' then
                return a_val > b_val
            else
                return a_val < b_val
            end
        end)
    elseif #field_list > 0 then
        -- 如果指定了排序字段且有返回字段，寻找排序字段索引
        local sort_index = 1
        for i, field in ipairs(field_list) do
            if field == sort_field then
                sort_index = i + 1  -- +1 because first element is key
                break
            end
        end

        table.sort(results, function(a, b)
            local a_raw = a[sort_index]
            local b_raw = b[sort_index]
            
            -- 处理nil或null值
            if a_raw == nil or a_raw == cjson.null then a_raw = "" end
            if b_raw == nil or b_raw == cjson.null then b_raw = "" end
            
            -- 转换为字符串后再尝试转为数字
            local a_val = safe_tonumber(tostring(a_raw)) or tostring(a_raw)
            local b_val = safe_tonumber(tostring(b_raw)) or tostring(b_raw)
            if sort_order == 'desc' then
                return a_val > b_val
            else
                return a_val < b_val
            end
        end)
    end
end

-- Apply limit with validation
if limit > 0 and limit < #results then
    local limited = {}
    for i = 1, limit do
        limited[i] = results[i]
    end
    results = limited
end

-- 确保空结果返回为数组
if #results == 0 then
    return "[]"
end

return cjson.encode(results)