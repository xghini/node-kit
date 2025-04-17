-- query.lua
-- 修改支持复杂表达式条件
-- Get parameters
local pattern = ARGV[1]
local sort_spec = ARGV[2] or ''
local limit = tonumber(ARGV[3]) or 0
local fields = ARGV[4]
local filter_count = tonumber(ARGV[5])

-- Parse sort specification
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
  -- 处理字段不存在的情况 (value == nil)
  if op == "IS" and val == "NULL" then
    return value == nil or value == cjson.null
  elseif op == "IS NOT" and val == "NULL" then
    return value ~= nil and value ~= cjson.null
  elseif value == nil or value == cjson.null then
    if op == "=" and val == "NULL" then
      return true
    elseif op == "<>" and val == "NULL" then
      return false
    else
      return false -- 其他操作符对于NULL值返回false
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
      return num_value ~= num_val -- 添加不等于操作符
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
      return value ~= val -- 添加不等于操作符
    end
  end
  return false
end

-- 新增：解析并评估复杂表达式
local function evaluate_expression(value, expr)
  if not value then
    return false
  end

  -- 先尝试转换为数字进行比较
  local num_value = safe_tonumber(tostring(value))

  -- 处理OR表达式 (||)
  if string.find(expr, "||") then
    for cond in string.gmatch(expr, "[^|]+") do
      cond = string.gsub(cond, "|", "") -- 移除可能的残留|符号
      cond = string.gsub(cond, "^%s*(.-)%s*$", "%1") -- 去除前后空格

      -- 检查是否有AND条件（可能是嵌套的）
      if string.find(cond, "&&") then
        -- 递归处理AND条件
        if evaluate_expression(value, cond) then
          return true -- OR条件中任一条件满足即为true
        end
      else
        -- 处理简单条件
        -- 检查是否是比较运算
        if string.find(cond, "[><]=?") or string.find(cond, "=") then
          local op, val

          -- 获取操作符和值
          if string.find(cond, ">=") then
            op = ">="
            val = string.sub(cond, 3)
          elseif string.find(cond, "<=") then
            op = "<="
            val = string.sub(cond, 3)
          elseif string.find(cond, ">") then
            op = ">"
            val = string.sub(cond, 2)
          elseif string.find(cond, "<") then
            op = "<"
            val = string.sub(cond, 2)
          elseif string.find(cond, "=") then
            op = "="
            val = string.sub(cond, 2)
          end

          -- 如果成功提取了操作符和值
          if op and val then
            val = string.gsub(val, "^%s*(.-)%s*$", "%1") -- 去除前后空格
            if safe_compare(value, val, op) then
              return true -- OR条件中任一条件满足即为true
            end
          end
        else
          -- 简单相等判断
          if num_value then
            -- 数值比较
            if num_value == tonumber(cond) then
              return true
            end
          else
            -- 字符串比较
            if tostring(value) == cond then
              return true
            end
          end
        end
      end
    end
    return false -- 所有OR条件都不满足
  end

  -- 处理AND表达式 (&&)
  if string.find(expr, "&&") then
    for cond in string.gmatch(expr, "[^&]+") do
      cond = string.gsub(cond, "&", "") -- 移除可能的残留&符号
      cond = string.gsub(cond, "^%s*(.-)%s*$", "%1") -- 去除前后空格

      -- 处理简单条件
      if cond ~= "" then
        -- 检查是否是比较运算
        if string.find(cond, "[><]=?") or string.find(cond, "=") then
          local op, val

          -- 获取操作符和值
          if string.find(cond, ">=") then
            op = ">="
            val = string.sub(cond, 3)
          elseif string.find(cond, "<=") then
            op = "<="
            val = string.sub(cond, 3)
          elseif string.find(cond, ">") then
            op = ">"
            val = string.sub(cond, 2)
          elseif string.find(cond, "<") then
            op = "<"
            val = string.sub(cond, 2)
          elseif string.find(cond, "=") then
            op = "="
            val = string.sub(cond, 2)
          end

          -- 如果成功提取了操作符和值
          if op and val then
            val = string.gsub(val, "^%s*(.-)%s*$", "%1") -- 去除前后空格
            if not safe_compare(value, val, op) then
              return false -- AND条件中任一条件不满足即为false
            end
          else
            return false -- 无法解析条件
          end
        else
          -- 简单相等判断
          if num_value then
            -- 数值比较
            if num_value ~= tonumber(cond) then
              return false
            end
          else
            -- 字符串比较
            if tostring(value) ~= cond then
              return false
            end
          end
        end
      end
    end
    return true -- 所有AND条件都满足
  end

  -- 处理单一比较条件
  if string.find(expr, "[><]=?") or string.find(expr, "=") then
    local op, val

    -- 获取操作符和值
    if string.find(expr, ">=") then
      op = ">="
      val = string.sub(expr, 3)
    elseif string.find(expr, "<=") then
      op = "<="
      val = string.sub(expr, 3)
    elseif string.find(expr, ">") then
      op = ">"
      val = string.sub(expr, 2)
    elseif string.find(expr, "<") then
      op = "<"
      val = string.sub(expr, 2)
    elseif string.find(expr, "=") then
      op = "="
      val = string.sub(expr, 2)
    end

    -- 如果成功提取了操作符和值
    if op and val then
      val = string.gsub(val, "^%s*(.-)%s*$", "%1") -- 去除前后空格
      return safe_compare(value, val, op)
    end
  end

  -- 默认精确匹配
  if num_value and tonumber(expr) then
    return num_value == tonumber(expr)
  else
    return tostring(value) == expr
  end
end

-- 通配符匹配辅助函数
local function pattern_match(str, pattern)
  if not str or not pattern then
    return false
  end

  -- 转义特殊字符
  local lua_pattern = string.gsub(pattern, "([%%%^%$%(%)%.%[%]%*%+%-%?])", function(c)
    if c == "*" then
      return ".*" -- 将*转换为Lua的通配符.*
    else
      return "%" .. c -- 转义其他特殊字符
    end
  end)

  -- 使用Lua模式匹配
  return string.match(str, "^" .. lua_pattern .. "$") ~= nil
end

-- Parse fields if provided
local field_list = {}
if fields ~= '' then
  for field in string.gmatch(fields, '[^,]+') do
    table.insert(field_list, field)
  end
end

-- Parse filters with validation
local filters = {}
local i = 6
while i <= 5 + filter_count * 3 do
  -- 确保在索引范围内
  if i > #ARGV or i + 1 > #ARGV or i + 2 > #ARGV then
    break
  end

  local key = ARGV[i]
  local op = ARGV[i + 1]
  local value = ARGV[i + 2]

  -- 验证操作符是否合法 (增加!=操作符支持)
  if op ~= "=" and op ~= ">" and op ~= "<" and op ~= ">=" and op ~= "<=" and op ~= "IN" and op ~= "LIKE" and op ~= "<>" and
    op ~= "!=" and op ~= "IS" and op ~= "IS NOT" and op ~= "EXPR" then
    -- 非法操作符时跳过此过滤器
    break
  end

  -- 统一处理不等于操作符，将!=转为<>以便统一处理
  if op == "!=" then
    op = "<>"
  end

  -- 在safe_compare函数中正确处理<>操作符
  local function safe_compare(value, val, op)
    -- 处理字段不存在的情况 (value == nil)
    if op == "IS" and val == "NULL" then
      return value == nil or value == cjson.null
    elseif op == "IS NOT" and val == "NULL" then
      return value ~= nil and value ~= cjson.null
    elseif value == nil or value == cjson.null then
      if op == "=" and val == "NULL" then
        return true
      elseif op == "<>" and val == "NULL" then
        return false
      else
        return op == "<>" -- 对于<>操作符，当字段不存在时返回true（满足不等于条件）
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
        return num_value ~= num_val -- 正确处理不等于操作符
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
        return value ~= val -- 正确处理不等于操作符
      end
    end
    return false
  end

  filters[#filters + 1] = {key, op, value}
  i = i + 3
end

-- 检查字段是否包含通配符
local function has_wildcard(field)
  return string.find(field, '*', 1, true) ~= nil or string.find(field, '?', 1, true) ~= nil
end

-- Scan keys matching pattern
local results = {}
local cursor = "0"
repeat
  local res = redis.call("SCAN", cursor, "MATCH", pattern, "COUNT", 100)
  cursor = res[1]
  local keys = res[2]

  for _, key in ipairs(keys) do
    -- Skip non-hash keys
    if redis.call("TYPE", key).ok == "hash" then
      local match = true

      for f_idx, filter in ipairs(filters) do
        local field = filter[1]
        local op = filter[2]
        local val = filter[3]

        -- 检查字段是否包含通配符
        if has_wildcard(field) then
          -- 获取所有hash字段
          local all_fields = redis.call("HKEYS", key)
          local field_matched = false

          -- 遍历所有字段，查找匹配的字段
          for _, hash_field in ipairs(all_fields) do
            if pattern_match(hash_field, field) then
              -- 对于每个匹配的字段，获取其值并进行条件判断
              local value = redis.call("HGET", key, hash_field)

              -- 使用与非通配符相同的逻辑进行条件判断
              if op == "IN" then
                local success, values = pcall(cjson.decode, val)
                if not success then
                  return redis.error_reply("Invalid JSON in IN operator")
                end

                for _, test_value in ipairs(values) do
                  if tostring(value) == tostring(test_value) then
                    field_matched = true
                    break
                  end
                end
              elseif op == "LIKE" then
                if pattern_match(tostring(value), val) then
                  field_matched = true
                  break
                end
              elseif op == "EXPR" then
                -- 使用表达式评估函数
                if evaluate_expression(value, val) then
                  field_matched = true
                  break
                end
              else
                if safe_compare(value, val, op) then
                  field_matched = true
                  break
                end
              end

              -- 如果找到一个匹配的字段且条件也匹配，可以提前退出循环
              if field_matched then
                break
              end
            end
          end

          -- 如果没有一个字段匹配，则整个记录不匹配
          if not field_matched then
            match = false
            break
          end
        else
          -- 原有的非通配符字段逻辑
          -- 判断字段是否存在
          local exists = redis.call("HEXISTS", key, field) == 1

          -- 特别处理 <> 操作符，如果字段不存在也算匹配
          if op == "<>" and not exists and val ~= "NULL" then
            -- 字段不存在也满足不等于条件，跳过此过滤器
            -- (使用 continue 的替代方案)
          else
            -- 检查是否满足 IS NULL 条件
            if op == "IS" and val == "NULL" then
              -- 如果要求字段不存在，但实际存在，则不匹配
              if exists then
                -- 检查值是否为 null
                local value = redis.call("HGET", key, field)
                if value ~= cjson.null then
                  match = false
                  break
                end
              end
              -- 如果字段不存在或值为 null，则继续下一个过滤器
            elseif op == "IS NOT" and val == "NULL" then
              -- 如果要求字段存在，但实际不存在，则不匹配
              if not exists then
                match = false
                break
              else
                -- 检查值是否为 null
                local value = redis.call("HGET", key, field)
                if value == cjson.null then
                  match = false
                  break
                end
              end
            elseif op == "=" and val == "NULL" then
              -- 如果要求字段值为 NULL，但字段存在且值不为 null，则不匹配
              if exists then
                local value = redis.call("HGET", key, field)
                if value ~= cjson.null then
                  match = false
                  break
                end
              end
              -- 如果字段不存在或值为 null，则继续下一个过滤器
            elseif op == "<>" and val == "NULL" then
              -- 如果要求字段值不为 NULL，但字段不存在或值为 null，则不匹配
              if not exists then
                match = false
                break
              else
                local value = redis.call("HGET", key, field)
                if value == cjson.null then
                  match = false
                  break
                end
              end
            elseif op == "EXPR" then
              -- 新增：表达式处理
              if not exists then
                -- 对于表达式查询，字段不存在时不匹配
                match = false
                break
              else
                local value = redis.call("HGET", key, field)
                -- 使用表达式评估函数
                if not evaluate_expression(value, val) then
                  match = false
                  break
                end
              end
            else
              -- 对于其他操作，字段必须存在
              if not exists then
                match = false
                break
              end

              -- 获取字段值
              local value = redis.call("HGET", key, field)

              -- 修复不等于操作符：单独处理不等于操作
              if op == "<>" then
                -- 确保value和val是字符串形式比较
                local str_value = tostring(value)
                local str_val = tostring(val)

                -- 尝试数值转换
                local num_value = safe_tonumber(str_value)
                local num_val = safe_tonumber(str_val)

                -- 两个值都能转为数字时进行数值比较，否则进行字符串比较
                if num_value and num_val then
                  if num_value == num_val then
                    match = false
                    break
                  end
                else
                  if str_value == str_val then
                    match = false
                    break
                  end
                end
              elseif op == "IN" then
                local success, values = pcall(cjson.decode, val)
                if not success then
                  return redis.error_reply("Invalid JSON in IN operator")
                end

                local found = false
                for _, test_value in ipairs(values) do
                  if type(test_value) == "string" and string.find(test_value, "*", 1, true) then
                    -- 通配符匹配
                    if pattern_match(tostring(value), test_value) then
                      found = true
                      break
                    end
                  else
                    -- 精确匹配
                    if tostring(value) == tostring(test_value) then
                      found = true
                      break
                    end
                  end
                end
                if not found then
                  match = false
                  break
                end
              elseif op == "LIKE" then
                -- 使用通配符匹配
                if not pattern_match(tostring(value), val) then
                  match = false
                  break
                end
              else
                -- 使用比较函数
                if not safe_compare(value, val, op) then
                  match = false
                  break
                end
              end
            end
          end
        end
      end

      if match then
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

-- Sort results based on sort specification
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

-- Apply limit with validation
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
