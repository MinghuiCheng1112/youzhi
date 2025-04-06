-- 清理customers表中废弃的字段
BEGIN;

-- 检查construction_acceptance字段是否仍然存在
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'construction_acceptance'
  ) THEN
    -- 删除construction_acceptance字段
    ALTER TABLE customers DROP COLUMN construction_acceptance;
    RAISE NOTICE 'construction_acceptance字段已被移除';
  ELSE
    RAISE NOTICE 'construction_acceptance字段已不存在，无需删除';
  END IF;
END$$;

-- 检查technical_review字段是否仍然存在
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'technical_review'
  ) THEN
    -- 删除technical_review字段
    ALTER TABLE customers DROP COLUMN technical_review;
    RAISE NOTICE 'technical_review字段已被移除';
  ELSE
    RAISE NOTICE 'technical_review字段已不存在，无需删除';
  END IF;
END$$;

-- 检查technical_review_rejected字段是否仍然存在
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