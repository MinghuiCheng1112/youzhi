-- 直接更新测试记录
UPDATE customers 
SET construction_acceptance_date = NOW()
WHERE id = 'ea98761e-176b-429f-8618-7784a01249fb'
RETURNING id, customer_name, construction_acceptance_date; 