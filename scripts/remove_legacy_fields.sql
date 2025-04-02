-- 删除旧字段，完成数据迁移
-- 此脚本应在执行optimize_review_acceptance_fields.sql脚本并确认数据正常迁移后运行

BEGIN;

-- 第一步：先确认数据已经成功迁移
DO $$
DECLARE
  pending_migration_count INTEGER;
BEGIN
  -- 检查是否有记录未迁移状态
  SELECT COUNT(*) INTO pending_migration_count
  FROM customers
  WHERE (technical_review IS NOT NULL OR technical_review_rejected IS NOT NULL) 
    AND technical_review_status IS NULL;
    
  IF pending_migration_count > 0 THEN
    RAISE EXCEPTION '还有%条记录未完成技术审核状态迁移', pending_migration_count;
  END IF;
  
  -- 检查是否有记录未迁移建设验收状态
  SELECT COUNT(*) INTO pending_migration_count
  FROM customers
  WHERE construction_acceptance IS NOT NULL 
    AND construction_acceptance_status IS NULL;
    
  IF pending_migration_count > 0 THEN
    RAISE EXCEPTION '还有%条记录未完成建设验收状态迁移', pending_migration_count;
  END IF;
  
  RAISE NOTICE '数据迁移校验通过，可以继续执行删除操作';
END $$;

-- 第二步：删除依赖于旧字段的触发器
DROP TRIGGER IF EXISTS update_technical_review_status ON customers;
DROP TRIGGER IF EXISTS update_construction_acceptance_status ON customers;

-- 第三步：更新触发器函数，移除对旧字段的引用
CREATE OR REPLACE FUNCTION update_technical_review_status_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- 如果技术审核状态发生变化
    IF NEW.technical_review_status IS DISTINCT FROM OLD.technical_review_status THEN
        -- 更新审核日期
        IF NEW.technical_review_status IN ('approved', 'rejected') THEN
            NEW.technical_review_date = NOW();
            
            -- 更新审核备注
            IF NEW.technical_review_status = 'approved' THEN
                NEW.technical_review_notes = COALESCE(NEW.technical_review_notes, '已通过技术审核');
            ELSIF NEW.technical_review_status = 'rejected' THEN
                NEW.technical_review_notes = COALESCE(NEW.technical_review_notes, '技术审核不通过');
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_construction_acceptance_status_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- 如果建设验收状态发生变化
    IF NEW.construction_acceptance_status IS DISTINCT FROM OLD.construction_acceptance_status THEN
        -- 更新验收日期
        IF NEW.construction_acceptance_status IN ('waiting', 'completed') THEN
            NEW.construction_acceptance_date = NOW();
            
            -- 特殊处理等待状态
            IF NEW.construction_acceptance_status = 'waiting' THEN
                -- 确保等待天数和开始时间有值
                NEW.construction_acceptance_waiting_days = COALESCE(NEW.construction_acceptance_waiting_days, 7);
                NEW.construction_acceptance_waiting_start = NOW();
                NEW.construction_acceptance_notes = COALESCE(NEW.construction_acceptance_notes, 
                                                            '等待中 - 设置于 ' || to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'));
            ELSIF NEW.construction_acceptance_status = 'completed' THEN
                NEW.construction_acceptance_notes = COALESCE(NEW.construction_acceptance_notes, '今日验收完成');
                
                -- 清除等待相关字段
                NEW.construction_acceptance_waiting_days = NULL;
                NEW.construction_acceptance_waiting_start = NULL;
            END IF;
        ELSIF NEW.construction_acceptance_status = 'pending' THEN
            -- 重置相关字段
            NEW.construction_acceptance_waiting_days = NULL;
            NEW.construction_acceptance_waiting_start = NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 重新创建触发器
CREATE TRIGGER update_technical_review_status
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION update_technical_review_status_trigger();

CREATE TRIGGER update_construction_acceptance_status
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION update_construction_acceptance_status_trigger();

-- 第四步：删除旧字段
ALTER TABLE customers 
  DROP COLUMN IF EXISTS technical_review,
  DROP COLUMN IF EXISTS technical_review_rejected,
  DROP COLUMN IF EXISTS construction_acceptance;

-- 第五步：更新视图以移除对已删除字段的引用
DROP VIEW IF EXISTS vw_technical_review_status;
DROP VIEW IF EXISTS vw_construction_acceptance_status;

-- 重新创建技术审核状态视图
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

-- 重新创建建设验收状态视图
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

-- 完成事务
COMMIT; 