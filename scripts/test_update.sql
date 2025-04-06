-- 测试更新construction_acceptance_date字段
-- 这个脚本尝试直接更新一个随机客户的字段
-- 如果成功，说明基本SQL更新功能正常

-- 找出一个客户ID进行测试
SELECT id, customer_name, construction_acceptance_date
FROM customers
LIMIT 1;

-- 更新测试（请将上面查询出的ID替换到下面的WHERE子句中）
-- UPDATE customers 
-- SET construction_acceptance_date = NOW()
-- WHERE id = '替换为上面查询到的ID'
-- RETURNING id, customer_name, construction_acceptance_date; 