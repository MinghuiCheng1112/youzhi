-- 删除建设验收相关的废弃字段
BEGIN;

-- 首先删除依赖的视图
DROP VIEW IF EXISTS vw_construction_acceptance_status;

-- 检查并删除construction_acceptance_status字段
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'construction_acceptance_status'
  ) THEN
    ALTER TABLE customers DROP COLUMN construction_acceptance_status;
    RAISE NOTICE '已删除 construction_acceptance_status 字段';
  ELSE
    RAISE NOTICE 'construction_acceptance_status 字段不存在，无需删除';
  END IF;
END
$$;

-- 检查并删除construction_acceptance_notes字段
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'construction_acceptance_notes'
  ) THEN
    ALTER TABLE customers DROP COLUMN construction_acceptance_notes;
    RAISE NOTICE '已删除 construction_acceptance_notes 字段';
  ELSE
    RAISE NOTICE 'construction_acceptance_notes 字段不存在，无需删除';
  END IF;
END
$$;

-- 检查并删除construction_acceptance_waiting_days字段
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'construction_acceptance_waiting_days'
  ) THEN
    ALTER TABLE customers DROP COLUMN construction_acceptance_waiting_days;
    RAISE NOTICE '已删除 construction_acceptance_waiting_days 字段';
  ELSE
    RAISE NOTICE 'construction_acceptance_waiting_days 字段不存在，无需删除';
  END IF;
END
$$;

-- 检查并删除construction_acceptance_waiting_start字段
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'construction_acceptance_waiting_start'
  ) THEN
    ALTER TABLE customers DROP COLUMN construction_acceptance_waiting_start;
    RAISE NOTICE '已删除 construction_acceptance_waiting_start 字段';
  ELSE
    RAISE NOTICE 'construction_acceptance_waiting_start 字段不存在，无需删除';
  END IF;
END
$$;

-- 确保construction_acceptance_date字段存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'construction_acceptance_date'
  ) THEN
    ALTER TABLE customers ADD COLUMN construction_acceptance_date TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE '已添加 construction_acceptance_date 字段';
  ELSE
    RAISE NOTICE 'construction_acceptance_date 字段已存在';
  END IF;
END
$$;

-- 刷新系统缓存
ANALYZE customers;

COMMIT; 