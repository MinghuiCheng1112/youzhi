-- 技术审核和建设验收字段优化脚本
-- 此脚本将优化customers表中的技术审核和建设验收相关字段

BEGIN;

-- 第一步：添加新字段

-- 添加技术审核状态字段
ALTER TABLE customers ADD COLUMN IF NOT EXISTS technical_review_status TEXT;
-- 注释：technical_review_status可以是'pending'(待审核)、'approved'(已通过)、'rejected'(已驳回)

-- 保留technical_review_date，无需添加
-- 保留technical_review_notes，无需添加

-- 添加建设验收状态字段
ALTER TABLE customers ADD COLUMN IF NOT EXISTS construction_acceptance_status TEXT;
-- 注释：construction_acceptance_status可以是'pending'(未验收)、'waiting'(等待中)、'completed'(已验收)

-- 添加等待天数字段
ALTER TABLE customers ADD COLUMN IF NOT EXISTS construction_acceptance_waiting_days INTEGER;

-- 添加等待开始时间字段
ALTER TABLE customers ADD COLUMN IF NOT EXISTS construction_acceptance_waiting_start TIMESTAMP WITH TIME ZONE;

-- 保留construction_acceptance_date，无需添加
-- 保留construction_acceptance_notes，无需添加

-- 第二步：迁移数据到新字段

-- 迁移技术审核状态数据
UPDATE customers
SET technical_review_status =
    CASE
        WHEN technical_review IS NOT NULL THEN 'approved'
        WHEN technical_review_rejected IS NOT NULL THEN 'rejected'
        ELSE 'pending'
    END;

-- 迁移建设验收状态数据
UPDATE customers
SET 
    construction_acceptance_status =
        CASE
            WHEN construction_acceptance IS NULL THEN 'pending'
            WHEN construction_acceptance::text LIKE 'waiting:%' THEN 'waiting'
            ELSE 'completed'
        END,
    construction_acceptance_waiting_days =
        CASE
            WHEN construction_acceptance::text LIKE 'waiting:%' THEN
                (regexp_match(construction_acceptance::text, 'waiting:(\d+):'))[1]::INTEGER
            ELSE NULL
        END,
    construction_acceptance_waiting_start =
        CASE
            WHEN construction_acceptance::text LIKE 'waiting:%' THEN
                -- 提取日期部分，格式为YYYY-MM-DD
                to_timestamp((regexp_match(construction_acceptance::text, 'waiting:\d+:(.+)'))[1], 'YYYY-MM-DD')
            ELSE NULL
        END;

-- 第三步：添加约束

-- 添加技术审核状态约束
ALTER TABLE customers
ADD CONSTRAINT check_technical_review_status
CHECK (technical_review_status IN ('pending', 'approved', 'rejected'));

-- 添加建设验收状态约束
ALTER TABLE customers
ADD CONSTRAINT check_construction_acceptance_status
CHECK (construction_acceptance_status IN ('pending', 'waiting', 'completed'));

-- 第四步：创建索引以提高查询性能

-- 创建技术审核状态索引
CREATE INDEX IF NOT EXISTS idx_customers_technical_review_status
ON customers(technical_review_status);

-- 创建建设验收状态索引
CREATE INDEX IF NOT EXISTS idx_customers_construction_acceptance_status
ON customers(construction_acceptance_status);

-- 第五步：更新触发器函数

-- 技术审核状态更新触发器函数
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
                NEW.technical_review_rejected = NULL; -- 清除驳回信息
                NEW.technical_review = NOW(); -- 保持向后兼容
            ELSIF NEW.technical_review_status = 'rejected' THEN
                NEW.technical_review_notes = COALESCE(NEW.technical_review_notes, '技术审核不通过');
                NEW.technical_review_rejected = '技术驳回 (' || to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') || ')'; -- 保持向后兼容
                NEW.technical_review = NULL; -- 保持向后兼容
            END IF;
        ELSIF NEW.technical_review_status = 'pending' THEN
            -- 重置相关字段
            NEW.technical_review = NULL; -- 保持向后兼容
            NEW.technical_review_rejected = NULL; -- 保持向后兼容
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS update_technical_review_status ON customers;
CREATE TRIGGER update_technical_review_status
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION update_technical_review_status_trigger();

-- 建设验收状态更新触发器函数
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
                
                -- 保持向后兼容
                NEW.construction_acceptance = 'waiting:' || 
                                            NEW.construction_acceptance_waiting_days || ':' || 
                                            to_char(NEW.construction_acceptance_waiting_start, 'YYYY-MM-DD');
            ELSIF NEW.construction_acceptance_status = 'completed' THEN
                NEW.construction_acceptance_notes = COALESCE(NEW.construction_acceptance_notes, '今日验收完成');
                
                -- 清除等待相关字段
                NEW.construction_acceptance_waiting_days = NULL;
                NEW.construction_acceptance_waiting_start = NULL;
                
                -- 保持向后兼容
                NEW.construction_acceptance = NOW();
            END IF;
        ELSIF NEW.construction_acceptance_status = 'pending' THEN
            -- 重置相关字段
            NEW.construction_acceptance = NULL; -- 保持向后兼容
            NEW.construction_acceptance_waiting_days = NULL;
            NEW.construction_acceptance_waiting_start = NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS update_construction_acceptance_status ON customers;
CREATE TRIGGER update_construction_acceptance_status
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION update_construction_acceptance_status_trigger();

-- 第六步：创建视图以便于查询

-- 创建技术审核状态视图
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

-- 创建建设验收状态视图
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