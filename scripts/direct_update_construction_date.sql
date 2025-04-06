-- 这个脚本直接更新construction_acceptance_date字段
-- 使用方法: 替换下面的ID值和要设置的日期
-- 如果要设置为null，将'2023-10-01'替换为NULL（不带引号）

UPDATE customers 
SET construction_acceptance_date = '2023-10-01' -- 或 NULL
WHERE id = '123e4567-e89b-12d3-a456-426614174000';

-- 确认更新
SELECT id, customer_name, construction_acceptance_date
FROM customers
WHERE id = '123e4567-e89b-12d3-a456-426614174000'; 