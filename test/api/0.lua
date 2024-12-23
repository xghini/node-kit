local pattern = ARGV[1] .. "*"
local keys = redis.call("KEYS", pattern)
local number_keys = {} -- 存储数字结尾的key及其数字
local non_number_keys = {} -- 存储非数字结尾的key
-- 遍历所有键，分离数字结尾和非数字结尾的key
for _, key in ipairs(keys) do
  local match = key:match("(%d+)$")
  if match then
    local number = tonumber(match)
    table.insert(number_keys, {
      key = key,
      number = number
    })
  else
    table.insert(non_number_keys, key)
  end
end
-- 按数字大小排序
table.sort(number_keys, function(a, b)
  return a.number > b.number
end)
-- 删除所有非数字结尾的key
for _, key in ipairs(non_number_keys) do
  redis.call("DEL", key)
end
-- 删除多余的数字key，只保留最大的ARGV[3]个, 因为还有新增的key，所以从第ARGV[3]个开始删除
for i = ARGV[3], #number_keys do
  redis.call("DEL", number_keys[i].key)
end
local new_number = 1
if #number_keys > 0 then
  new_number = number_keys[1].number + 1
end
local new_key = ARGV[1] .. new_number
redis.call("SET", new_key, ARGV[2])
return new_key
