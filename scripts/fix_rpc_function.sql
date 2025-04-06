-- 修复RPC函数，确保返回值正确

-- 更新函数
CREATE OR REPLACE FUNCTION update_construction_acceptance_date(
  p_customer_id UUID, 
  p_acceptance_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- 使用创建者的权限
AS $$
DECLARE
  result JSONB;
BEGIN
  -- 输出执行日志
  RAISE NOTICE '执行更新建设验收日期: ID=%, 日期=%', p_customer_id, p_acceptance_date;
  
  -- 更新操作
  UPDATE customers 
  SET construction_acceptance_date = p_acceptance_date
  WHERE id = p_customer_id
  RETURNING jsonb_build_object(
    'id', id,
    'customer_name', customer_name,
    'construction_acceptance_date', construction_acceptance_date,
    'timestamp', NOW(),
    'status', '成功'
  ) INTO result;
  
  -- 如果没有行被更新，返回错误
  IF result IS NULL THEN
    result := jsonb_build_object(
      'id', p_customer_id,
      'timestamp', NOW(),
      'status', '失败',
      'message', format('未找到ID为%s的客户', p_customer_id)
    );
  END IF;
  
  RETURN result;
END;
$$;

-- 重新授予公共权限，允许匿名用户调用
GRANT EXECUTE ON FUNCTION update_construction_acceptance_date TO anon;
GRANT EXECUTE ON FUNCTION update_construction_acceptance_date TO authenticated;
GRANT EXECUTE ON FUNCTION update_construction_acceptance_date TO service_role;

-- 测试函数调用
SELECT update_construction_acceptance_date(
  'ea98761e-176b-429f-8618-7784a01249fb',
  NOW()
) AS result; 