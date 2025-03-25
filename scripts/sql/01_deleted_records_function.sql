
-- 获取已删除的客户记录函数
CREATE OR REPLACE FUNCTION get_deleted_customers()
RETURNS SETOF customers
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM customers
  WHERE deleted_at IS NOT NULL
  ORDER BY deleted_at DESC;
$$;

-- 测试函数
SELECT COUNT(*) FROM get_deleted_customers();
