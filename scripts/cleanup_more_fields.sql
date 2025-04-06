-- 清理customers表中更多的废弃字段
BEGIN;

-- 检查outbound_date字段是否存在
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'outbound_date'
  ) THEN
    -- 删除outbound_date字段
    ALTER TABLE customers DROP COLUMN outbound_date;
    RAISE NOTICE 'outbound_date字段已被移除';
  ELSE
    RAISE NOTICE 'outbound_date字段已不存在，无需删除';
  END IF;
END$$;

-- 检查technical_review_rejected字段是否存在
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'technical_review_rejected'
  ) THEN
    -- 删除technical_review_rejected字段
    ALTER TABLE customers DROP COLUMN technical_review_rejected;
    RAISE NOTICE 'technical_review_rejected字段已被移除';
  ELSE
    RAISE NOTICE 'technical_review_rejected字段已不存在，无需删除';
  END IF;
END$$;

-- 刷新系统缓存
ANALYZE customers;

COMMIT; 