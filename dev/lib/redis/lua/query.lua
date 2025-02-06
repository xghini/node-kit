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
            if #field_list == 0 then
                -- If no fields specified, just collect keys
                table.insert(results, key)
            else
                local row = {key}
                local match = true
                
                -- Get values and check filters
                for _, field in ipairs(field_list) do
                    local value = redis.call("HGET", key, field)
                    table.insert(row, value or cjson.null)
                    
                    -- Check filters for this field
                    for _, filter in ipairs(filters) do
                        if filter[1] == field then
                            local op, val = filter[2], filter[3]
                            
                            -- Convert to number if possible
                            if value == nil or value == cjson.null then
                                match = false
                                break
                            end
                            
                            if tonumber(value) then value = tonumber(value) end
                            if tonumber(val) then val = tonumber(val) end
                            
                            if op == "=" and value ~= val then
                                match = false
                            elseif op == ">" and value <= val then
                                match = false
                            elseif op == "<" and value >= val then
                                match = false
                            elseif op == ">=" and value < val then
                                match = false
                            elseif op == "<=" and value > val then
                                match = false
                            end
                        end
                    end
                    if not match then
                        break
                    end
                end
                
                if match then
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

return cjson.encode(results)