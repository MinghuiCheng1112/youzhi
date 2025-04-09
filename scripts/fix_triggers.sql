-- 触发器修复脚本
BEGIN;

-- 删除触发器 update_simple_construction_acceptance
DROP TRIGGER IF EXISTS update_simple_construction_acceptance ON customers;

-- 删除函数 get_field_chinese_name
DROP FUNCTION IF EXISTS get_field_chinese_name();

-- 删除函数 update_construction_acceptance_date
DROP FUNCTION IF EXISTS update_construction_acceptance_date();

-- 删除函数 update_construction_acceptance_timestamp
DROP FUNCTION IF EXISTS update_construction_acceptance_timestamp();

-- 删除函数 update_simple_construction_acceptance
DROP FUNCTION IF EXISTS update_simple_construction_acceptance();

-- 创建新的简化触发器函数
CREATE OR REPLACE FUNCTION update_construction_acceptance_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- 什么都不做，只是一个空壳函数
  -- 因为我们已经在前端代码中处理了建设验收日期的逻辑
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 包含我们之前创建的移除废弃字段脚本
-- 删除废弃的建设验收相关字段
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

-- 检查并删除旧的construction_acceptance字段
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'construction_acceptance'
  ) THEN
    ALTER TABLE customers DROP COLUMN construction_acceptance;
    RAISE NOTICE '已删除 construction_acceptance 字段';
  ELSE
    RAISE NOTICE 'construction_acceptance 字段不存在，无需删除';
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

-- 同样检查并删除deleted_records表中的废弃字段
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' 
    AND column_name = 'construction_acceptance_status'
  ) THEN
    ALTER TABLE deleted_records DROP COLUMN construction_acceptance_status;
    RAISE NOTICE '已删除deleted_records表中的construction_acceptance_status字段';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' 
    AND column_name = 'construction_acceptance_notes'
  ) THEN
    ALTER TABLE deleted_records DROP COLUMN construction_acceptance_notes;
    RAISE NOTICE '已删除deleted_records表中的construction_acceptance_notes字段';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' 
    AND column_name = 'construction_acceptance_waiting_days'
  ) THEN
    ALTER TABLE deleted_records DROP COLUMN construction_acceptance_waiting_days;
    RAISE NOTICE '已删除deleted_records表中的construction_acceptance_waiting_days字段';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' 
    AND column_name = 'construction_acceptance_waiting_start'
  ) THEN
    ALTER TABLE deleted_records DROP COLUMN construction_acceptance_waiting_start;
    RAISE NOTICE '已删除deleted_records表中的construction_acceptance_waiting_start字段';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' 
    AND column_name = 'construction_acceptance'
  ) THEN
    ALTER TABLE deleted_records DROP COLUMN construction_acceptance;
    RAISE NOTICE '已删除deleted_records表中的construction_acceptance字段';
  END IF;
END
$$;

-- 刷新系统缓存
ANALYZE customers;
IF EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'deleted_records'
) THEN
  ANALYZE deleted_records;
END IF;

COMMIT; 
COMMIT;
