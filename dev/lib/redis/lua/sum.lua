-- sum.lua
local pattern = ARGV[1]
local fieldPatterns = cjson.decode(ARGV[2])
local keys = redis.call('KEYS', pattern)
local sums = {}

-- Initialize sums for each field pattern
for _, fieldPattern in ipairs(fieldPatterns) do
    sums[fieldPattern] = 0
end

-- Helper function to convert wildcard pattern to Lua pattern
local function wildcard_to_pattern(wildcard)
    -- Escape all special pattern characters except *
    local escaped = wildcard:gsub("[%(%)%.%%%+%-%?%[%]%^%$]", "%%%1")
    -- Convert * to .*
    local pattern = escaped:gsub("%*", ".*")
    return "^" .. pattern .. "$"
end

-- Process each key
for _, key in ipairs(keys) do
    -- Get all hash fields for the current key
    local cursor = "0"
    repeat
        local result = redis.call('HSCAN', key, cursor)
        cursor = result[1]
        local pairs = result[2]
        
        -- Process field-value pairs
        for i = 1, #pairs, 2 do
            local field = pairs[i]
            local value = pairs[i + 1]
            
            -- Check each field pattern
            for _, fieldPattern in ipairs(fieldPatterns) do
                if string.match(field, wildcard_to_pattern(fieldPattern)) then
                    local num = tonumber(value)
                    if num then
                        sums[fieldPattern] = sums[fieldPattern] + num
                    end
                end
            end
        end
    until cursor == "0"
end

-- Format result for return
local result = {}
for fieldPattern, sum in pairs(sums) do
    table.insert(result, {fieldPattern, sum})
end

return result