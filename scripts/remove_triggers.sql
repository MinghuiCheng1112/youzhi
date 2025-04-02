-- 删除所有依赖于旧字段的触发器
DROP TRIGGER IF EXISTS update_technical_review_timestamp ON customers;
DROP TRIGGER IF EXISTS update_technical_review_rejected_timestamp ON customers;
DROP TRIGGER IF EXISTS update_construction_acceptance_timestamp ON customers; 