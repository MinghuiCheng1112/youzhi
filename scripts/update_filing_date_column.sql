-- 更新备案日期字段类型
DO $$
BEGIN
  -- 检查字段当前类型
  RAISE NOTICE '检查备案日期字段当前类型...';
  
  -- 修改字段类型为text
  ALTER TABLE customers
  ALTER COLUMN filing_date TYPE TEXT USING filing_date::TEXT;
  
  RAISE NOTICE '备案日期字段已从timestamptz类型修改为text类型';
END $$; 