-- 修复deleted_records表，添加缺失的construction_acceptance_date相关字段
BEGIN;

-- 诊断信息
DO $$
BEGIN
  RAISE NOTICE '开始检查并修复deleted_records表中缺少的construction_acceptance_date字段...';
END $$;

-- 添加construction_acceptance_date字段
DO $$
BEGIN
  -- 检查并添加construction_acceptance_date字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'construction_acceptance_date'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN construction_acceptance_date TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE '已添加construction_acceptance_date字段';
  ELSE
    RAISE NOTICE 'construction_acceptance_date字段已存在';
  END IF;
  
  -- 检查并添加upload_to_grid_date字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'upload_to_grid_date'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN upload_to_grid_date TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE '已添加upload_to_grid_date字段';
  ELSE
    RAISE NOTICE 'upload_to_grid_date字段已存在';
  END IF;
  
  -- 检查并添加technical_review_date字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'technical_review_date'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN technical_review_date TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE '已添加technical_review_date字段';
  ELSE
    RAISE NOTICE 'technical_review_date字段已存在';
  END IF;
  
  -- 检查并添加construction_acceptance_notes字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'construction_acceptance_notes'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN construction_acceptance_notes TEXT;
    RAISE NOTICE '已添加construction_acceptance_notes字段';
  ELSE
    RAISE NOTICE 'construction_acceptance_notes字段已存在';
  END IF;
  
  -- 检查并添加technical_review_notes字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_records' AND column_name = 'technical_review_notes'
  ) THEN
    ALTER TABLE deleted_records ADD COLUMN technical_review_notes TEXT;
    RAISE NOTICE '已添加technical_review_notes字段';
  ELSE
    RAISE NOTICE 'technical_review_notes字段已存在';
  END IF;
END $$;

-- 诊断信息
DO $$
BEGIN
  RAISE NOTICE 'deleted_records表字段修复完成！';
END $$;

COMMIT; 