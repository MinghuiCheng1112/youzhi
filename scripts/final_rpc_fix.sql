-- 最终的RPC函数修复
CREATE OR REPLACE FUNCTION update_construction_acceptance_date(
  p_customer_id UUID, 
  p_acceptance_date TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  customer_name TEXT,
  construction_acceptance_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 更新操作并返回结果
  RETURN QUERY
  UPDATE customers 
  SET 
    construction_acceptance_date = p_acceptance_date,
    updated_at = NOW()
  WHERE id = p_customer_id
  RETURNING 
    customers.id,
    customers.customer_name,
    customers.construction_acceptance_date,
    customers.updated_at;
END;
$$;

-- 重新授予权限
GRANT EXECUTE ON FUNCTION update_construction_acceptance_date TO anon;
GRANT EXECUTE ON FUNCTION update_construction_acceptance_date TO authenticated;
GRANT EXECUTE ON FUNCTION update_construction_acceptance_date TO service_role;

-- 测试调用
SELECT * FROM update_construction_acceptance_date(
  'ea98761e-176b-429f-8618-7784a01249fb',
  NOW()
);

-- 验证结果
SELECT id, customer_name, construction_acceptance_date, updated_at
FROM customers
WHERE id = 'ea98761e-176b-429f-8618-7784a01249fb'; 