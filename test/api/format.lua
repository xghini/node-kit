local pattern = 'plan:*:' .. KEYS[1]
local cursor = "0"
local keys = {}
repeat
  local result = redis.call('SCAN', cursor, 'MATCH', pattern)
  cursor = result[1]
  for _, key in ipairs(result[2]) do
    table.insert(keys, key)
  end
until cursor == "0"
if #keys == 0 then
  return false
end
local result = redis.call('hgetall', keys[1])
return result
