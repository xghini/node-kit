-- query.lua
-- Get parameters
local pattern = ARGV[1]
local sort_field = ARGV[2]
local sort_order = ARGV[3]
local limit = tonumber(ARGV[4]) or 0
local fields = ARGV[5]
local filter_count = tonumber(ARGV[6])

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

-- Parse fields if provided
local field_list = {}
if fields ~= '' then
    for field in string.gmatch(fields, '[^,]+') do
        table.insert(field_list, field)
    end
end

-- Parse filters with validation
local filters = {}
local i = 7
while i <= 6 + filter_count * 3 do
    local key = ARGV[i]
    local op = ARGV[i + 1]
    local value = ARGV[i + 2]
    
    -- 确保在索引范围内
    if i > #ARGV or i + 1 > #ARGV or i + 2 > #ARGV then
        break
    end
    
    -- 验证操作符是否合法
    if op ~= "=" and op ~= ">" and op ~= "<" and op ~= ">=" and op ~= "<=" and op ~= "IN" then
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
                
                if value == nil or value == cjson.null then
                    match = false
                    break
                end

                if op == "IN" then
                    local success, values = pcall(cjson.decode, val)
                    if not success then
                        return redis.error_reply("Invalid JSON in IN operator")
                    end
                    
                    local matched = false
                    for _, test_value in ipairs(values) do
                        if type(test_value) == "string" and string.find(test_value, "*", 1, true) then
                            -- 通配符匹配
                            local pattern = string.gsub(test_value, "%*", ".*")
                            if string.match(value, "^" .. pattern .. "$") then
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

-- Sort results if sort field is specified and fields are selected
if sort_field ~= '' and #field_list > 0 then
    local sort_index = 1
    for i, field in ipairs(field_list) do
        if field == sort_field then
            sort_index = i + 1  -- +1 because first element is key
            break
        end
    end

    table.sort(results, function(a, b)
        local a_val = safe_tonumber(a[sort_index]) or a[sort_index]
        local b_val = safe_tonumber(b[sort_index]) or b[sort_index]
        if sort_order == 'desc' then
            return a_val > b_val
        else
            return a_val < b_val
        end
    end)
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