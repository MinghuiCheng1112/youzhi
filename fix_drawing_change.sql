-- 尝试将当前drawing_change字段中的值转换为字符串格式
UPDATE public.customers 
SET drawing_change = 
  CASE 
    WHEN drawing_change = 'true' THEN '变更一' 
    WHEN drawing_change = 'false' THEN '未出图'
    WHEN drawing_change IS NULL THEN '未出图'
    ELSE drawing_change  -- 保留已经是字符串的值
  END;

-- 确保所有null值都设置为默认值
UPDATE public.customers
SET drawing_change = '未出图'
WHERE drawing_change IS NULL;

-- 修复图纸变更默认值问题
-- 将customers表中drawing_change字段的默认值从"无变更"改为"未出图"

-- 修改drawing_change字段的默认值
ALTER TABLE customers
ALTER COLUMN drawing_change SET DEFAULT '未出图';

-- 更新已有记录中的"无变更"为"未出图"
UPDATE customers
SET drawing_change = '未出图'
WHERE drawing_change = '无变更';

-- 输出成功信息
SELECT 'drawing_change字段默认值和现有记录已更新完成' AS result; 