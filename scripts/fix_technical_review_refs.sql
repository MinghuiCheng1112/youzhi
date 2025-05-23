-- 修复所有对technical_review字段的引用
BEGIN;

-- 1. 检查technical_review字段是否仍然存在
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'technical_review'
  ) THEN
    -- 如果字段仍然存在，确保数据迁移到新字段
    UPDATE customers
    SET 
      technical_review_status = 
        CASE 
          WHEN technical_review IS NULL THEN 'pending'
          ELSE 'approved'
        END,
      technical_review_date = 
        CASE 
          WHEN technical_review IS NULL THEN NULL
          ELSE technical_review::TIMESTAMP
        END,
      technical_review_notes = 
        CASE 
          WHEN technical_review IS NULL THEN NULL
          ELSE '已通过审核'
        END
    WHERE TRUE;
    
    -- 删除旧字段
    ALTER TABLE customers DROP COLUMN technical_review;
    RAISE NOTICE 'technical_review字段已被移除';
  ELSE
    RAISE NOTICE 'technical_review字段已不存在，无需删除';
  END IF;
END$$;

-- 2. 更新视图以使用新字段结构（如果视图存在）
DROP VIEW IF EXISTS vw_technical_review_status;

CREATE OR REPLACE VIEW vw_technical_review_status AS
SELECT 
    id, 
    customer_name,
    technical_review_status,
    technical_review_date,
    technical_review_notes,
    CASE
        WHEN technical_review_status = 'approved' THEN technical_review_date
        ELSE NULL
    END AS approval_date,
    CASE
        WHEN technical_review_status = 'rejected' THEN technical_review_date
        ELSE NULL
    END AS rejection_date
FROM customers;

-- 3. 刷新系统缓存
ANALYZE customers;

COMMIT;
