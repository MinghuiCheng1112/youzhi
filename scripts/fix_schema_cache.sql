-- 修复schema缓存问题，确保系统不再尝试访问已删除的construction_acceptance字段
BEGIN;

-- 重建construction_acceptance视图以确保它能正确工作
DROP VIEW IF EXISTS vw_construction_acceptance_status;

-- 重新创建建设验收状态视图，使用新字段结构
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

-- 刷新系统视图以更新缓存
ANALYZE customers;

COMMIT; 