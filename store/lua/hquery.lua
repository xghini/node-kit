-- query.lua
-- Get parameters
local pattern = ARGV[1]
local sort_field = ARGV[2]
local sort_order = ARGV[3]
local limit = tonumber(ARGV[4]) or 0
local fields = ARGV[5]
local filter_count = tonumber(ARGV[6])
-- Parse fields if provided
local field_list = {}
if fields ~= '' then
    for field in string.gmatch(fields, '[^,]+') do
        table.insert(field_list, field)
    end
end
-- Parse filters
local filters = {}
local i = 7
while i <= 6 + filter_count do
    local key = ARGV[i]
    local op = ARGV[i + 1]
    local value = ARGV[i + 2]
    filters[#filters + 1] = {key, op, value}
    i = i + 3
end
-- Scan keys matching pattern
local results = {}
local cursor = "0"
repeat
    local res = redis.call("SCAN", cursor, "MATCH", pattern)
    cursor = res[1]
    local keys = res[2]

    for _, key in ipairs(keys) do
        -- Skip non-hash keys
        if redis.call("TYPE", key).ok == "hash" then
            local match = true
            
            -- 检查所有过滤器，无论是否指定了 fields
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
                    local values = cjson.decode(val)
                    local matched = false
                    for _, test_value in ipairs(values) do
                        if string.find(test_value, "*", 1, true) then
                            -- 通配符匹配
                            local pattern = string.gsub(test_value, "%*", ".*")
                            if string.match(value, pattern) then
                                matched = true
                                break
                            end
                        else
                            -- 精确匹配
                            if value == test_value then
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
                    if tonumber(value) then value = tonumber(value) end
                    if tonumber(val) then val = tonumber(val) end

                    if op == "=" and value ~= val then
                        match = false
                        break
                    elseif op == ">" and value <= val then
                        match = false
                        break
                    elseif op == "<" and value >= val then
                        match = false
                        break
                    elseif op == ">=" and value < val then
                        match = false
                        break
                    elseif op == "<=" and value > val then
                        match = false
                        break
                    end
                end
            end

            if match then
                if #field_list == 0 then
                    -- 如果没有指定字段，只返回key
                    table.insert(results, key)
                else
                    -- 如果指定了字段，返回key和字段值
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
        local a_val = tonumber(a[sort_index]) or a[sort_index]
        local b_val = tonumber(b[sort_index]) or b[sort_index]
        if sort_order == 'desc' then
            return a_val > b_val
        else
            return a_val < b_val
        end
    end)
end
-- Apply limit
if limit > 0 and #results > limit then
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