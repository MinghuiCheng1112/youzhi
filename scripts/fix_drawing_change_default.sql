-- 修复图纸变更字段的默认值
BEGIN;

-- 检查当前的默认值
DO $$
DECLARE
  current_default TEXT;
BEGIN
  SELECT column_default INTO current_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = 'customers'
  AND column_name = 'drawing_change';
  
  RAISE NOTICE '图纸变更字段当前默认值: %', current_default;
END $$;

-- 修改字段默认值为'未出图'
ALTER TABLE customers
ALTER COLUMN drawing_change SET DEFAULT '未出图';

-- 将当前所有为false或null的值更新为'未出图'
UPDATE customers
SET drawing_change = '未出图'
WHERE drawing_change IS NULL OR drawing_change = 'false' OR drawing_change = 'f' OR drawing_change = 'NULL' OR drawing_change = '';

-- 验证修改结果
DO $$
DECLARE
  new_default TEXT;
  null_count INTEGER;
BEGIN
  -- 获取新默认值
  SELECT column_default INTO new_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = 'customers'
  AND column_name = 'drawing_change';
  
  -- 检查是否还有空值
  SELECT COUNT(*) INTO null_count
  FROM customers
  WHERE drawing_change IS NULL;
  
  RAISE NOTICE '图纸变更字段新默认值: %', new_default;
  RAISE NOTICE '仍有空值的记录数: %', null_count;
END $$;

COMMIT; 