
-- 创建测试用的删除记录
UPDATE customers
SET deleted_at = NOW()
WHERE id = (
  SELECT id FROM customers 
  WHERE deleted_at IS NULL 
  ORDER BY register_date DESC 
  LIMIT 1
)
RETURNING id, customer_name, deleted_at;

-- 确认删除记录已创建
SELECT * FROM get_deleted_customers() LIMIT 3;
