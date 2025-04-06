-- 创建一个RPC函数，用于更新construction_acceptance_date字段
-- 这个函数可以被前端代码直接调用，绕过Supabase的API架构

-- 创建函数
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
  -- 更新操作
  UPDATE customers 
  SET construction_acceptance_date = p_acceptance_date
  WHERE id = p_customer_id
  RETURNING jsonb_build_object(
    'id', id,
    'customer_name', customer_name,
    'construction_acceptance_date', construction_acceptance_date
  ) INTO result;
  
  -- 如果没有行被更新，返回错误
  IF result IS NULL THEN
    RAISE EXCEPTION '未找到ID为%的客户', p_customer_id;
  END IF;
  
  RETURN result;
END;
$$;

-- 授予公共权限，允许匿名用户调用
GRANT EXECUTE ON FUNCTION update_construction_acceptance_date TO anon;
GRANT EXECUTE ON FUNCTION update_construction_acceptance_date TO authenticated;
GRANT EXECUTE ON FUNCTION update_construction_acceptance_date TO service_role; 