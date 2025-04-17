-- hsql.lua
-- 高级Hash查询，支持通过复杂表达式进行过滤
-- 表达式格式示例: "(stop<>1&&remain=null)||remain>0"

-- 获取参数
local pattern = ARGV[1]  -- 键模式，如 'plan:*'
local expression = ARGV[2] or '' -- 表达式条件
local sort_spec = ARGV[3] or '' -- 排序规格
local limit = tonumber(ARGV[4]) or 0 -- 限制结果数量
local fields_spec = ARGV[5] or '' -- 要返回的字段列表，用逗号分隔

-- 解析要返回的字段
local field_list = {}
if fields_spec ~= '' then
  for field in string.gmatch(fields_spec, '[^,]+') do
    table.insert(field_list, field)
  end
end

-- 解析排序规格
local sort_field = ''
local sort_order = 'asc'

if sort_spec ~= '' then
  local parts = {}
  for part in string.gmatch(sort_spec, "%S+") do
    table.insert(parts, part)
  end

  if #parts == 1 then
    -- 如果只有一个部分
    if parts[1] == 'asc' or parts[1] == 'desc' then
      -- 如果是排序方向，对key排序
      sort_order = parts[1]
    else
      -- 否则作为排序字段，默认asc
      sort_field = parts[1]
    end
  elseif #parts == 2 then
    -- 如果有两个部分
    sort_field = parts[1]
    if parts[2] == 'desc' then
      sort_order = 'desc'
    end
  end
end

-- 辅助函数：安全的数值转换
local function safe_tonumber(str)
  if not str then
    return nil
  end
  -- 检查是否是特殊值
  if str == "inf" or str == "+inf" then
    return math.huge
  elseif str == "-inf" then
    return -math.huge
  end

  -- 尝试转换为数字
  local num = tonumber(str)
  if not num then
    return nil
  end

  -- 检查是否超出Lua的数字范围
  if num > 2 ^ 53 or num < -2 ^ 53 then
    -- 对于大数，保持字符串比较
    return str
  end
  return num
end

-- 辅助函数：安全的比较
local function safe_compare(value, val, op)
  -- 处理NULL值比较
  local is_val_null = val == "NULL" or val == "null"
  
  -- 特殊处理字段不存在的情况 (value == nil)
  if value == nil or value == cjson.null then
    if op == "=" and is_val_null then
      return true
    elseif op == "<>" and not is_val_null then
      -- 不等于操作符特殊处理：字段不存在且比较值不是NULL，视为条件满足
      return true
    else
      -- 其他操作符对于NULL值都返回false
      return false
    end
  end
  
  -- 处理值存在但与NULL比较的情况
  if is_val_null then
    if op == "=" then
      return false  -- 字段存在但值不是NULL，=NULL返回false
    elseif op == "<>" then
      return true   -- 字段存在但值不是NULL，<>NULL返回true
    end
  end

  if val == nil then
    return false
  end

  -- 确保都是字符串类型
  value = tostring(value)
  val = tostring(val)

  -- 尝试数值转换
  local num_value = safe_tonumber(value)
  local num_val = safe_tonumber(val)

  -- 如果两个值都能转为数字，进行数值比较
  if num_value and num_val then
    if op == "=" then
      return num_value == num_val
    elseif op == ">" then
      return num_value > num_val
    elseif op == "<" then
      return num_value < num_val
    elseif op == ">=" then
      return num_value >= num_val
    elseif op == "<=" then
      return num_value <= num_val
    elseif op == "<>" then
      return num_value ~= num_val
    end
  else
    -- 如果有任何一个值不能转为数字，进行字符串比较
    if op == "=" then
      return value == val
    elseif op == ">" then
      return value > val
    elseif op == "<" then
      return value < val
    elseif op == ">=" then
      return value >= val
    elseif op == "<=" then
      return value <= val
    elseif op == "<>" then
      return value ~= val
    end
  end
  return false
end

-- 评估单个条件
local function eval_condition(key, condition)
  -- 提取字段名、操作符和值
  local field, op, val
  
  -- 清理前后空格
  condition = string.gsub(condition, "^%s*(.-)%s*$", "%1")
  
  -- 检测不同的操作符（顺序很重要，要先检查较长的操作符）
  if string.match(condition, ">=") then
    field, val = string.match(condition, "(.-)%s*>=%s*(.*)")
    op = ">="
  elseif string.match(condition, "<=") then
    field, val = string.match(condition, "(.-)%s*<=%s*(.*)")
    op = "<="
  elseif string.match(condition, "<>") then
    field, val = string.match(condition, "(.-)%s*<>%s*(.*)")
    op = "<>"
  elseif string.match(condition, ">") then
    field, val = string.match(condition, "(.-)%s*>%s*(.*)")
    op = ">"
  elseif string.match(condition, "<") then
    field, val = string.match(condition, "(.-)%s*<%s*(.*)")
    op = "<"
  elseif string.match(condition, "=") then
    field, val = string.match(condition, "(.-)%s*=%s*(.*)")
    op = "="
  else
    -- 无法解析的条件
    return false
  end
  
  -- 清理字段名和值前后的空格
  if field then field = string.gsub(field, "^%s*(.-)%s*$", "%1") end
  if val then val = string.gsub(val, "^%s*(.-)%s*$", "%1") end
  
  -- 检查是否成功提取了字段名和值
  if not field or not val then
    return false
  end
  
  -- 检查是否是NULL值比较（不区分大小写）
  local is_null_check = string.lower(val) == "null"
  
  -- 检查字段是否存在
  local exists = redis.call("HEXISTS", key, field) == 1
  local value = nil
  
  if exists then
    value = redis.call("HGET", key, field)
  end
  
  -- 特殊处理NULL值比较，确保与hquery行为一致
  if is_null_check then
    if op == "=" then
      return not exists or value == cjson.null
    elseif op == "<>" then
      return exists and value ~= cjson.null
    end
  elseif not exists and op == "<>" then
    -- 特殊情况：字段不存在，操作为<>，且比较值不为NULL，返回true
    return true
  elseif not exists then
    -- 字段不存在，其他操作返回false
    return false
  end
  
  -- 执行普通比较
  return safe_compare(value, val, op)
end

-- 简单版本的表达式计算器，非递归实现
local function evaluate_simple_expr(key, expr)
  -- 移除表达式前后空格
  expr = string.gsub(expr, "^%s*(.-)%s*$", "%1")
  
  -- 检查是否是空表达式
  if expr == "" then
    return true
  end
  
  -- 移除最外层括号（如果有）
  if string.sub(expr, 1, 1) == "(" and string.sub(expr, -1) == ")" then
    local balanced = true
    local level = 0
    
    for i = 1, #expr - 1 do
      local char = string.sub(expr, i, i)
      if char == "(" then level = level + 1
      elseif char == ")" then
        level = level - 1
        if level < 0 then balanced = false; break; end
      end
    end
    
    if balanced and level == 0 then
      expr = string.sub(expr, 2, #expr - 1)
    end
  end
  
  -- 检查是否包含OR逻辑 (||)
  if string.find(expr, "||") then
    -- 简单分割OR条件，不处理嵌套
    for or_part in string.gmatch(expr, "[^|]+") do
      or_part = string.gsub(or_part, "|", "") -- 移除可能的残留|符号
      or_part = string.gsub(or_part, "^%s*(.-)%s*$", "%1") -- 去除前后空格
      
      if or_part ~= "" and evaluate_simple_expr(key, or_part) then
        return true -- 任一OR条件为真，整个表达式为真
      end
    end
    return false -- 所有OR条件都为假
  end
  
  -- 检查是否包含AND逻辑 (&&)
  if string.find(expr, "&&") then
    -- 简单分割AND条件，不处理嵌套
    for and_part in string.gmatch(expr, "[^&]+") do
      and_part = string.gsub(and_part, "&", "") -- 移除可能的残留&符号
      and_part = string.gsub(and_part, "^%s*(.-)%s*$", "%1") -- 去除前后空格
      
      if and_part ~= "" and not evaluate_simple_expr(key, and_part) then
        return false -- 任一AND条件为假，整个表达式为假
      end
    end
    return true -- 所有AND条件都为真
  end
  
  -- 若无复合逻辑，则作为单一条件处理
  return eval_condition(key, expr)
end

-- 查询匹配的键
local results = {}
local cursor = "0"
repeat
  local res = redis.call("SCAN", cursor, "MATCH", pattern, "COUNT", 100)
  cursor = res[1]
  local keys = res[2]

  for _, key in ipairs(keys) do
    -- 跳过非hash类型的键
    if redis.call("TYPE", key).ok == "hash" then
      -- 评估表达式
      if evaluate_simple_expr(key, expression) then
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

-- 根据排序规格排序结果
if sort_spec ~= '' then
  if sort_field == '' then
    -- 如果没有指定排序字段但指定了排序方向，按key排序
    table.sort(results, function(a, b)
      local a_val = type(a) == "table" and a[1] or a
      local b_val = type(b) == "table" and b[1] or b
      if sort_order == 'desc' then
        return a_val > b_val
      else
        return a_val < b_val
      end
    end)
  elseif #field_list > 0 then
    -- 如果指定了排序字段且有返回字段，寻找排序字段索引
    local sort_index = 1
    for i, field in ipairs(field_list) do
      if field == sort_field then
        sort_index = i + 1 -- +1 because first element is key
        break
      end
    end

    table.sort(results, function(a, b)
      local a_raw = a[sort_index]
      local b_raw = b[sort_index]

      -- 处理nil或null值
      if a_raw == nil or a_raw == cjson.null then
        a_raw = ""
      end
      if b_raw == nil or b_raw == cjson.null then
        b_raw = ""
      end

      -- 转换为字符串后再尝试转为数字
      local a_val = safe_tonumber(tostring(a_raw)) or tostring(a_raw)
      local b_val = safe_tonumber(tostring(b_raw)) or tostring(b_raw)
      if sort_order == 'desc' then
        return a_val > b_val
      else
        return a_val < b_val
      end
    end)
  end
end

-- 应用结果限制
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