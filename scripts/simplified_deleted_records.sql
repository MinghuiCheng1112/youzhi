-- 简化删除记录管理 - 从customers表查询删除记录
BEGIN;

-- 0. 先删除旧的函数和对象
DROP FUNCTION IF EXISTS get_deleted_records() CASCADE;
DROP FUNCTION IF EXISTS restore_deleted_record(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_restored_records() CASCADE;
DROP TRIGGER IF EXISTS trigger_capture_soft_deleted_customer ON customers;
DROP TRIGGER IF EXISTS trigger_record_deleted_customer ON customers;
DROP FUNCTION IF EXISTS capture_soft_deleted_customer() CASCADE;
DROP FUNCTION IF EXISTS record_deleted_customer() CASCADE;
DROP FUNCTION IF EXISTS batch_restore_deleted_records(UUID[]) CASCADE;

-- 删除旧表
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'deleted_records') THEN
    DROP TABLE deleted_records CASCADE;
    RAISE NOTICE 'deleted_records表已删除';
  ELSE
    RAISE NOTICE 'deleted_records表不存在';
  END IF;
END $$;

-- 1. 创建一个新的查询已删除客户的函数
CREATE OR REPLACE FUNCTION get_deleted_records()
RETURNS TABLE (
  id UUID,
  customer_name TEXT,
  phone TEXT,
  address TEXT,
  register_date TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  original_id UUID -- 保持兼容性，直接使用customer的id
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.customer_name,
    c.phone,
    c.address,
    c.register_date,
    c.deleted_at,
    c.id AS original_id
  FROM 
    customers c
  WHERE 
    c.deleted_at IS NOT NULL
  ORDER BY 
    c.deleted_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 创建恢复删除记录的函数
CREATE OR REPLACE FUNCTION restore_deleted_record(customer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  success BOOLEAN := false;
BEGIN
  -- 直接恢复客户，将deleted_at设置为NULL
  UPDATE customers
  SET 
    deleted_at = NULL,
    updated_at = NOW()
  WHERE 
    id = customer_id
    AND deleted_at IS NOT NULL;
  
  GET DIAGNOSTICS success = ROW_COUNT;
  
  RETURN success > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 批量恢复删除记录的函数
CREATE OR REPLACE FUNCTION batch_restore_deleted_records(customer_ids UUID[])
RETURNS TABLE (
  customer_id UUID,
  success BOOLEAN
) AS $$
DECLARE
  cid UUID;
  result BOOLEAN;
BEGIN
  FOREACH cid IN ARRAY customer_ids
  LOOP
    -- 调用单个恢复函数
    result := restore_deleted_record(cid);
    
    -- 返回结果
    customer_id := cid;
    success := result;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 授予权限
GRANT EXECUTE ON FUNCTION get_deleted_records() TO service_role;
GRANT EXECUTE ON FUNCTION restore_deleted_record(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION batch_restore_deleted_records(UUID[]) TO service_role;

COMMIT; 