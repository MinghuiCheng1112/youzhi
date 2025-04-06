-- 删除废弃的建设验收相关字段
BEGIN;

-- 首先删除依赖于这些字段的视图
DROP VIEW IF EXISTS vw_construction_acceptance_status;

-- 检查并删除construction_acceptance_waiting_start字段
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'construction_acceptance_waiting_start'
  ) THEN
    -- 字段存在，执行删除
    ALTER TABLE customers DROP COLUMN construction_acceptance_waiting_start;
    RAISE NOTICE 'construction_acceptance_waiting_start字段已被移除';
  ELSE
    RAISE NOTICE 'construction_acceptance_waiting_start字段不存在，无需删除';
  END IF;
END$$;

-- 检查并删除construction_acceptance_notes字段
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'construction_acceptance_notes'
  ) THEN
    -- 字段存在，执行删除
    ALTER TABLE customers DROP COLUMN construction_acceptance_notes;
    RAISE NOTICE 'construction_acceptance_notes字段已被移除';
  ELSE
    RAISE NOTICE 'construction_acceptance_notes字段不存在，无需删除';
  END IF;
END$$;

-- 删除多余的等待天数字段，保持功能简化
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'construction_acceptance_waiting_days'
  ) THEN
    -- 字段存在，执行删除
    ALTER TABLE customers DROP COLUMN construction_acceptance_waiting_days;
    RAISE NOTICE 'construction_acceptance_waiting_days字段已被移除';
  ELSE
    RAISE NOTICE 'construction_acceptance_waiting_days字段不存在，无需删除';
  END IF;
END$$;

-- 创建新的视图以使用简化的字段结构
CREATE OR REPLACE VIEW vw_construction_acceptance_status AS
SELECT 
    id, 
    customer_name,
    construction_acceptance_status,
    construction_acceptance_date
FROM customers;

-- 刷新系统缓存
ANALYZE customers;

COMMIT; 