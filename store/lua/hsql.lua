-- hsql.lua
-- 基于表达式的Redis Hash查询脚本
-- 支持复杂条件表达式如 "(stop<>1&&remain=null)||remain>0"

-- 获取参数
local pattern = ARGV[1]         -- 键模式，如 "plan:*"
local expression = ARGV[2]      -- 表达式条件，如 "(stop<>1&&remain=null)||remain>0"
local sort_spec = ARGV[3] or "" -- 排序规格，如 "upload desc"
local limit = tonumber(ARGV[4]) or 0 -- 限制返回的结果数量
local fields_str = ARGV[5] or "" -- 要返回的字段列表，以逗号分隔

-- 解析排序规格
local sort_field = ""
local sort_order = "asc"

if sort_spec ~= "" then
  local parts = {}
  for part in string.gmatch(sort_spec, "%S+") do
    table.insert(parts, part)
  end

  if #parts == 1 then
    -- 如果只有一个部分
    if parts[1] == "asc" or parts[1] == "desc" then
      -- 如果是排序方向，对key排序
      sort_order = parts[1]
    else
      -- 否则作为排序字段，默认asc
      sort_field = parts[1]
    end
  elseif #parts == 2 then
    -- 如果有两个部分
    sort_field = parts[1]
    if parts[2] == "desc" then
      sort_order = "desc"
    end
  end
end

-- 解析字段列表
local field_list = {}
if fields_str ~= "" then
  for field in string.gmatch(fields_str, "[^,]+") do
    table.insert(field_list, field)
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
  -- 处理NULL值比较 (不区分大小写)
  local is_val_null = string.lower(val) == "null"
  
  -- 特殊处理字段不存在的情况 (value == nil)
  if value == nil or value == cjson.null then
    if op == "=" and is_val_null then
      return true  -- 字段为NULL且比较值为NULL，返回true
    elseif op == "<>" and not is_val_null then
      -- 不等于操作符特殊处理：字段不存在且比较值不是NULL，视为条件满足
      return true
    elseif op == "<>" and is_val_null then
      return false -- 字段为NULL且比较值为NULL的<>操作，返回false
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
    else
      return false  -- 其他操作符与NULL比较都返回false
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

-- 检查字段条件
local function check_field_condition(key, field, op, val)
  -- 清理字段名和值前后的空格
  field = string.gsub(field, "^%s*(.-)%s*$", "%1")
  val = string.gsub(val, "^%s*(.-)%s*$", "%1")
  
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

-- 分离表达式的操作符和操作数
local function extract_condition(condition)
  -- 清理前后空格
  condition = string.gsub(condition, "^%s*(.-)%s*$", "%1")
  
  -- 检测各种操作符
  local field, op, val
  
  if string.find(condition, ">=") then
    field, val = string.match(condition, "(.-)%s*>=%s*(.*)")
    op = ">="
  elseif string.find(condition, "<=") then
    field, val = string.match(condition, "(.-)%s*<=%s*(.*)")
    op = "<="
  elseif string.find(condition, "<>") then
    field, val = string.match(condition, "(.-)%s*<>%s*(.*)")
    op = "<>"
  elseif string.find(condition, ">") then
    field, val = string.match(condition, "(.-)%s*>%s*(.*)")
    op = ">"
  elseif string.find(condition, "<") then
    field, val = string.match(condition, "(.-)%s*<%s*(.*)")
    op = "<"
  elseif string.find(condition, "=") then
    field, val = string.match(condition, "(.-)%s*=%s*(.*)")
    op = "="
  end
  
  return field, op, val
end

-- 判断是否是复合表达式
local function is_compound_expr(expr)
  -- 去除所有空格
  local clean_expr = string.gsub(expr, "%s+", "")
  
  -- 检查是否包含&&或||，不在括号内
  local level = 0
  for i = 1, #clean_expr do
    local char = string.sub(clean_expr, i, i)
    if char == "(" then
      level = level + 1
    elseif char == ")" then
      level = level - 1
    elseif level == 0 then
      if char == "&" and string.sub(clean_expr, i+1, i+1) == "&" then
        return true
      elseif char == "|" and string.sub(clean_expr, i+1, i+1) == "|" then
        return true
      end
    end
  end
  
  return false
end

-- 解析复合表达式中的每个部分
local function parse_parts(expr, delimiter)
  local result = {}
  local level = 0
  local start = 1
  local i = 1
  
  while i <= #expr do
    local c = string.sub(expr, i, i)
    local next_c = i < #expr and string.sub(expr, i+1, i+1) or ""
    
    if c == "(" then
      level = level + 1
    elseif c == ")" then
      level = level - 1
    elseif level == 0 and c == delimiter:sub(1,1) and next_c == delimiter:sub(2,2) then
      local part = string.sub(expr, start, i-1)
      table.insert(result, part)
      start = i + 2  -- 跳过分隔符
      i = i + 1      -- 额外跳过第二个字符
    end
    
    i = i + 1
  end
  
  if start <= #expr then
    table.insert(result, string.sub(expr, start))
  end
  
  return result
end

-- 处理单一条件
local function evaluate_simple_condition(key, expr)
  local field, op, val = extract_condition(expr)
  if field and op and val then
    return check_field_condition(key, field, op, val)
  end
  return false
end

-- 获取括号层级的边界
local function find_matching_parenthesis(expr, start_pos)
  local level = 1
  for i = start_pos, #expr do
    local char = string.sub(expr, i, i)
    if char == "(" then
      level = level + 1
    elseif char == ")" then
      level = level - 1
      if level == 0 then
        return i
      end
    end
  end
  return nil  -- 没有找到匹配的括号
end

-- 非递归解析表达式
local function evaluate_expr(key, expr)
  -- 清理表达式
  expr = string.gsub(expr, "^%s*(.-)%s*$", "%1")
  
  -- 如果表达式为空，返回真
  if expr == "" then
    return true
  end
  
  -- 检查是否是简单条件（不包含&&和||）
  if not string.find(expr, "&&") and not string.find(expr, "||") then
    -- 移除最外层的括号
    while string.sub(expr, 1, 1) == "(" and string.sub(expr, -1) == ")" do
      expr = string.sub(expr, 2, #expr - 1)
      expr = string.gsub(expr, "^%s*(.-)%s*$", "%1")
    end
    
    -- 处理简单条件
    return evaluate_simple_condition(key, expr)
  end
  
  -- 使用短路求值处理复合表达式
  -- 处理括号表达式
  local i = 1
  local stack = {}
  local op_stack = {}
  local curr_expr = ""
  
  while i <= #expr do
    local char = string.sub(expr, i, i)
    
    if char == "(" then
      -- 找到匹配的右括号
      local end_pos = find_matching_parenthesis(expr, i + 1)
      if end_pos then
        -- 递归评估括号内的表达式
        local sub_expr = string.sub(expr, i + 1, end_pos - 1)
        local result = evaluate_expr(key, sub_expr)
        
        -- 保存结果
        if result then
          curr_expr = curr_expr .. "true"
        else
          curr_expr = curr_expr .. "false"
        end
        
        i = end_pos + 1
      else
        -- 括号不匹配，视为语法错误
        return false
      end
    elseif char == "&" and i < #expr and string.sub(expr, i + 1, i + 1) == "&" then
      -- 遇到AND操作符，保存当前表达式和操作符
      table.insert(stack, curr_expr)
      table.insert(op_stack, "&&")
      curr_expr = ""
      i = i + 2
    elseif char == "|" and i < #expr and string.sub(expr, i + 1, i + 1) == "|" then
      -- 遇到OR操作符，保存当前表达式和操作符
      table.insert(stack, curr_expr)
      table.insert(op_stack, "||")
      curr_expr = ""
      i = i + 2
    else
      -- 普通字符，添加到当前表达式
      curr_expr = curr_expr .. char
      i = i + 1
    end
  end
  
  -- 处理最后一个表达式
  table.insert(stack, curr_expr)
  
  -- 从堆栈计算最终结果
  local results = {}
  for i, expr_part in ipairs(stack) do
    -- 清理表达式
    expr_part = string.gsub(expr_part, "^%s*(.-)%s*$", "%1")
    
    -- 处理特殊情况：true/false字符串
    if expr_part == "true" then
      results[i] = true
    elseif expr_part == "false" then
      results[i] = false
    else
      -- 评估简单条件
      results[i] = evaluate_simple_condition(key, expr_part)
    end
  end
  
  -- 按操作符优先级计算结果
  -- 先计算AND，再计算OR (操作符是左到右结合的)
  local result = results[1]
  for i, op in ipairs(op_stack) do
    if op == "&&" then
      result = result and results[i + 1]
    elseif op == "||" then
      result = result or results[i + 1]
    end
  end
  
  return result
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
      if evaluate_expr(key, expression) then
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
if sort_spec ~= "" then
  if sort_field == "" then
    -- 如果没有指定排序字段但指定了排序方向，按key排序
    table.sort(results, function(a, b)
      local a_val = type(a) == "table" and a[1] or a
      local b_val = type(b) == "table" and b[1] or b
      if sort_order == "desc" then
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
      if sort_order == "desc" then
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