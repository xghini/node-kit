// redis.log(redis.LOG_NOTICE, 'captchaValue: ' .. tostring(captchaValue)) -- 打印调试日志

export default {
  signin: `
local pattern = 'sess:'..KEYS[1] .. ':*'
local keys = redis.call('KEYS', pattern)
local number_keys = {} -- 存储数字结尾的key及其数字
local non_number_keys = {} -- 存储非数字结尾的key
-- 遍历所有键，分离数字结尾和非数字结尾的key
for _, key in ipairs(keys) do
  local match = key:match('(%d+)$')
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
  redis.call('DEL', key)
end
-- 删除多余的数字key，只保留最大的KEYS[2]个, 因为还有新增的key，所以从第KEYS[2]个开始删除
for i = KEYS[2], #number_keys do
  redis.call('DEL', number_keys[i].key)
end
local new_number = 1
if #number_keys > 0 then
  new_number = number_keys[1].number + 1
end
local new_key = KEYS[1] ..':'.. new_number
redis.call('HSET', 'sess:'..new_key, unpack(ARGV))
return new_key
  `,
  signout: `
local key='sess:'..KEYS[1]
local token = redis.call('HGET', key, 'token')
if token == KEYS[2] then
  redis.call('DEL', key)
  return true
end
return nil
  `,
  signoutall: `
local key='sess:'..KEYS[1]
local token = redis.call('HGET', key, 'token')
if token == KEYS[2] then
  key=string.gsub(key, ':[^:]*$', ':*')
  local keys = redis.call('KEYS', key)
  redis.call('DEL', unpack(keys))
  return #keys
end
return nil
  `,
  profile: `
local token = redis.call('HGET', 'sess:'..KEYS[1], 'token')
if token == KEYS[2] then
  local user = string.gsub(KEYS[1], ':[^:]*$', '')
  local user_data = redis.call('HGETALL', 'user:' .. user)
  local result = {}
  for i = 1, #user_data, 2 do
    result[user_data[i]] = user_data[i + 1]
  end
  result['pwd'] = nil
  local plans = redis.call('KEYS', 'plan:' .. user .. ':*')
  local plan_list = {}
  for _, plan_key in ipairs(plans) do
    local plan_data = redis.call('HGETALL', plan_key)
    local plan_result = {}
    for i = 1, #plan_data, 2 do
      plan_result[plan_data[i]] = plan_data[i + 1]
    end
    table.insert(plan_list, plan_result)
  end
  result['plans'] = plan_list
  return cjson.encode(result)
end
return nil
  `,
  orderplan:`
  local key=KEYS[1]
  local email=KEYS[2]
  redis.call('HSET', key, unpack(ARGV))
  redis.call('HSET','user:'..email,'subscribe',key)
  return nil
  `,
  emailverify:`
local userExists = redis.call('EXISTS', 'user:' .. ARGV[1])
local message
if userExists==tonumber(ARGV[2]) then
  if userExists == 1 then
      message = '邮箱已注册'
  else
      message = '邮箱未注册'
  end
  return {false, message}
end
local captchaValue = redis.call('GET', 'captcha:' .. ARGV[3])
if captchaValue == false then
    return {false, '验证码已过期'}
end
if captchaValue ~= ARGV[4] then
    return {false, '验证码错误'}
end
redis.call('DEL', 'captcha:' .. ARGV[3])
return {true, '校验成功'}
  `,
  signup:`
local userExists = redis.call('EXISTS', 'user:' .. KEYS[1])
if userExists==1 then
  return {false, '邮箱已注册,请直接登录'}
end
local verify = redis.call('GET', 'verify:' .. KEYS[1])
if verify == false then
  return {false,'验证码已过期,请重新发送'}
elseif verify ~= KEYS[2] then
  return {false,'验证码错误'}
end
redis.call('DEL', 'verify:'..KEYS[1])
redis.call('HSET', 'user:'..KEYS[1], unpack(ARGV))
return {true, '注册成功'}
  `,
  reset:`
local verify = redis.call('GET', 'verify:' .. KEYS[1])
if verify == false then
  return {false,'验证码已过期,请重新发送'}
elseif verify ~= KEYS[2] then
  return {false,'验证码错误'}
end
redis.call('DEL', 'verify:'..KEYS[1])
redis.call('HSET', 'user:'..KEYS[1], unpack(ARGV))
return {true, '密码重置成功'}
    `,
  dels: `
local keys = redis.call('KEYS', KEYS[1]..'*')
if #keys > 0 then
  return redis.call('DEL', unpack(keys))
else
  return 0
end
  `,
};
