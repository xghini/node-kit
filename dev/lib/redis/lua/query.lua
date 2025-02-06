-- query.lua
local pattern = ARGV[1]
local conditions = cjson.decode(ARGV[2])
local target_type = ARGV[3]
local keys = redis.call('KEYS', pattern)
local result = {}

local function check_range(value, range_conditions)
    local num_value = tonumber(value)
    if not num_value then return false end
    
    for i = 1, #range_conditions, 2 do
        local op = range_conditions[i]
        local compare_value = tonumber(range_conditions[i + 1])
        
        if op == ">" and not (num_value > compare_value) then
            return false
        elseif op == ">=" and not (num_value >= compare_value) then
            return false
        elseif op == "<" and not (num_value < compare_value) then
            return false
        elseif op == "<=" and not (num_value <= compare_value) then
            return false
        end
    end
    return true
end

local function check_condition(value, condition)
    if type(condition) == 'table' then
        return check_range(value, condition)
    elseif type(condition) == 'string' and string.find(condition, "*", 1, true) then
        local pattern = string.gsub(condition, "*", ".*")
        return string.match(value, pattern) ~= nil
    else
        local val1 = tonumber(value)
        local val2 = tonumber(condition)
        if val1 and val2 then
            return val1 == val2
        end
        return tostring(value) == tostring(condition)
    end
end

local function get_key_data(key, key_type)
    local data = {}
    
    if key_type == 'hash' then
        local hash = redis.call('HGETALL', key)
        for j = 1, #hash, 2 do
            data[hash[j]] = hash[j + 1]
        end
    elseif key_type == 'string' then
        data['value'] = redis.call('GET', key)
    elseif key_type == 'set' then
        data['members'] = redis.call('SMEMBERS', key)
    elseif key_type == 'zset' then
        data['values'] = redis.call('ZRANGE', key, 0, -1, 'WITHSCORES')
    elseif key_type == 'list' then
        data['values'] = redis.call('LRANGE', key, 0, -1)
    end
    
    return data
end

for _, key in ipairs(keys) do
    local key_type = redis.call('TYPE', key).ok
    
    -- 如果指定了类型且不匹配，跳过该键
    if target_type and target_type ~= '' and key_type ~= target_type then
        -- Skip this key
    else
        local data = get_key_data(key, key_type)
        local matches = true
        
        -- 根据类型和条件检查
        for field, condition in pairs(conditions) do
            local value
            
            if key_type == 'hash' then
                value = data[field]
            elseif key_type == 'string' and field == 'value' then
                value = data['value']
            elseif key_type == 'set' and field == 'members' then
                value = data['members']
            elseif key_type == 'zset' and field == 'values' then
                value = data['values']
            elseif key_type == 'list' and field == 'values' then
                value = data['values']
            end
            
            if value == nil then
                matches = false
                break
            end
            
            if not check_condition(value, condition) then
                matches = false
                break
            end
        end
        
        if matches then
            table.insert(result, key)
        end
    end
end

return result