-- 先删除原有函数，再创建新的
DROP FUNCTION IF EXISTS update_construction_acceptance_date(uuid, timestamp with time zone);

-- 创建新函数
CREATE OR REPLACE FUNCTION update_construction_acceptance_date(
  p_customer_id UUID, 
  p_acceptance_date TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  customer_record customers%ROWTYPE;
  operation_result TEXT;
BEGIN
  -- 更新操作
  UPDATE customers 
  SET 
    construction_acceptance_date = p_acceptance_date,
    updated_at = NOW()
  WHERE customers.id = p_customer_id
  RETURNING * INTO customer_record;
  
  -- 处理结果
  IF customer_record IS NULL THEN
    operation_result := '更新失败: 找不到指定的客户';
  ELSE
    operation_result := format(
      '更新成功: 客户 %s 的建设验收日期已更新为 %s',
      customer_record.customer_name,
      COALESCE(p_acceptance_date::TEXT, 'NULL')
    );
  END IF;
  
  RETURN operation_result;
END;
$$;

-- 重新授予权限
GRANT EXECUTE ON FUNCTION update_construction_acceptance_date(UUID, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION update_construction_acceptance_date(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION update_construction_acceptance_date(UUID, TIMESTAMPTZ) TO service_role;

-- 测试调用
SELECT update_construction_acceptance_date(
  'ea98761e-176b-429f-8618-7784a01249fb',
  NULL
);

-- 验证结果
SELECT id, customer_name, construction_acceptance_date, updated_at
FROM customers
WHERE id = 'ea98761e-176b-429f-8618-7784a01249fb'; 