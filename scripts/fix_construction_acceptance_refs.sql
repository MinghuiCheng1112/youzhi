-- 修复所有对construction_acceptance字段的引用
BEGIN;

-- 1. 检查construction_acceptance字段是否仍然存在
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name = 'construction_acceptance'
  ) THEN
    -- 如果字段仍然存在，确保数据迁移到新字段
    UPDATE customers
    SET 
      construction_acceptance_status = 
        CASE 
          WHEN construction_acceptance IS NULL THEN 'pending'
          WHEN construction_acceptance LIKE 'waiting:%' THEN 'waiting'
          ELSE 'completed'
        END,
      construction_acceptance_date = 
        CASE 
          WHEN construction_acceptance IS NULL THEN NULL
          WHEN construction_acceptance LIKE 'waiting:%' THEN
            -- 从waiting格式中提取日期
            SUBSTRING(construction_acceptance FROM POSITION(':' IN SUBSTRING(construction_acceptance FROM POSITION(':' IN construction_acceptance) + 1)) + POSITION(':' IN construction_acceptance) + 1)::TIMESTAMP
          ELSE construction_acceptance::TIMESTAMP
        END,
      construction_acceptance_notes = 
        CASE 
          WHEN construction_acceptance IS NULL THEN NULL
          WHEN construction_acceptance LIKE 'waiting:%' THEN 
            -- 从waiting格式中提取等待天数
            '等待中 - 设置于 ' || NOW()::TEXT
          ELSE '已验收'
        END,
      construction_acceptance_waiting_days = 
        CASE 
          WHEN construction_acceptance LIKE 'waiting:%' THEN 
            -- 从waiting格式中提取等待天数
            SUBSTRING(construction_acceptance FROM POSITION(':' IN construction_acceptance) + 1 FOR POSITION(':' IN SUBSTRING(construction_acceptance FROM POSITION(':' IN construction_acceptance) + 1)) - 1)::INTEGER
          ELSE NULL
        END,
      construction_acceptance_waiting_start = 
        CASE 
          WHEN construction_acceptance LIKE 'waiting:%' THEN
            -- 从waiting格式中提取日期
            SUBSTRING(construction_acceptance FROM POSITION(':' IN SUBSTRING(construction_acceptance FROM POSITION(':' IN construction_acceptance) + 1)) + POSITION(':' IN construction_acceptance) + 1)::TIMESTAMP
          ELSE NULL
        END
    WHERE TRUE;
    
    -- 删除旧字段
    ALTER TABLE customers DROP COLUMN construction_acceptance;
    RAISE NOTICE 'construction_acceptance字段已被移除';
  ELSE
    RAISE NOTICE 'construction_acceptance字段已不存在，无需删除';
  END IF;
END$$;

-- 2. 更新视图以使用新字段结构
DROP VIEW IF EXISTS vw_construction_acceptance_status;

CREATE OR REPLACE VIEW vw_construction_acceptance_status AS
SELECT 
    id, 
    customer_name,
    construction_acceptance_status,
    construction_acceptance_date,
    construction_acceptance_notes,
    construction_acceptance_waiting_days,
    construction_acceptance_waiting_start,
    CASE
        WHEN construction_acceptance_status = 'waiting' AND construction_acceptance_waiting_start IS NOT NULL THEN
            -- 计算已等待天数
            EXTRACT(DAY FROM (NOW() - construction_acceptance_waiting_start))::INTEGER
        ELSE NULL
    END AS days_waiting,
    CASE
        WHEN construction_acceptance_status = 'waiting' AND 
             construction_acceptance_waiting_days IS NOT NULL AND 
             construction_acceptance_waiting_start IS NOT NULL THEN
            -- 计算预计完成日期
            construction_acceptance_waiting_start + (construction_acceptance_waiting_days || ' days')::INTERVAL
        ELSE NULL
    END AS expected_completion_date
FROM customers;

-- 3. 刷新系统缓存
ANALYZE customers;

COMMIT; 