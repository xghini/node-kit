// redis.log(redis.LOG_NOTICE, 'captchaValue: ' .. tostring(captchaValue)) -- 打印调试日志

export default {
  signin: `
-- sess:admin@xship.top:6 <兼容多用户登录,所以逻辑稍微复杂>
-- 根据 pattern 获取所有相关的 session keys
local pattern = 'sess:'..KEYS[1] .. ':*'
local keys = redis.call('KEYS', pattern)

-- 创建一个表来存储所有 key 及其空闲时间
local key_idles = {}

-- 获取每个 key 的空闲时间
for _, key in ipairs(keys) do
  local idle_time = redis.call('OBJECT', 'IDLETIME', key)
  table.insert(key_idles, {
    key = key,
    idle = idle_time
  })
end

-- 按空闲时间排序（空闲时间越长，越靠后）
table.sort(key_idles, function(a, b)
  return a.idle < b.idle
end)

-- 如果现有 key 数量超过限制，删除最久未使用的 key
-- KEYS[2] 是允许的最大 session 数量
if #key_idles >= tonumber(KEYS[2]) then
  for i = tonumber(KEYS[2]), #key_idles do
    redis.call('DEL', key_idles[i].key)
  end
end

-- 生成新的 key
-- 获取当前时间戳作为新 key 的后缀
local timestamp = redis.call('TIME')[1]
local new_key = KEYS[1] .. ':' .. timestamp

-- 设置新的 session 数据
redis.call('HSET', 'sess:'..new_key, unpack(ARGV))

-- 设置 TTL (3888000 秒，约 45 天)
redis.call('EXPIRE', 'sess:'..new_key, 3888000)
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
