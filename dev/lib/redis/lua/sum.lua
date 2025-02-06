-- sum.lua
local pattern = ARGV[1]
local fields = cjson.decode(ARGV[2])
local keys = redis.call('KEYS', pattern)
local sums = {}

for _, field in ipairs(fields) do
  sums[field] = 0
end

for _, key in ipairs(keys) do
  for _, field in ipairs(fields) do
    local value = redis.call('HGET', key, field)
    if value then
      local num = tonumber(value)
      if num then
        sums[field] = sums[field] + num
      end
    end
  end
end

local result = {}
for field, sum in pairs(sums) do
  table.insert(result, {field, sum})
end

return result
