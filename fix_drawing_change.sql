-- 尝试将当前drawing_change字段中的值转换为字符串格式
UPDATE public.customers 
SET drawing_change = 
  CASE 
    WHEN drawing_change = 'true' THEN '变更一' 
    WHEN drawing_change = 'false' THEN '无变更'
    WHEN drawing_change IS NULL THEN '无变更'
    ELSE drawing_change  -- 保留已经是字符串的值
  END;

-- 确保所有null值都设置为默认值
UPDATE public.customers
SET drawing_change = '无变更'
WHERE drawing_change IS NULL; 