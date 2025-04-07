-- 增强版删除记录管理功能 
BEGIN;

-- 0. 先删除已存在的函数
DROP FUNCTION IF EXISTS get_deleted_records() CASCADE;
DROP FUNCTION IF EXISTS restore_deleted_record(UUID) CASCADE;
DROP FUNCTION IF EXISTS batch_restore_deleted_records(UUID[]) CASCADE;

-- 1. 创建一个返回更完整的删除记录信息的函数
CREATE OR REPLACE FUNCTION get_deleted_records()
RETURNS SETOF customers AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM customers
  WHERE deleted_at IS NOT NULL
  ORDER BY deleted_at DESC;
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

-- 4. 创建永久删除记录的函数（物理删除）
CREATE OR REPLACE FUNCTION permanently_delete_record(customer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  success BOOLEAN := false;
BEGIN
  -- 永久删除客户记录
  DELETE FROM customers
  WHERE id = customer_id;
  
  GET DIAGNOSTICS success = ROW_COUNT;
  
  RETURN success > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 批量永久删除记录的函数
CREATE OR REPLACE FUNCTION batch_permanently_delete_records(customer_ids UUID[])
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
    -- 调用单个永久删除函数
    result := permanently_delete_record(cid);
    
    -- 返回结果
    customer_id := cid;
    success := result;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 授予权限
GRANT EXECUTE ON FUNCTION get_deleted_records() TO service_role;
GRANT EXECUTE ON FUNCTION restore_deleted_record(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION batch_restore_deleted_records(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION permanently_delete_record(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION batch_permanently_delete_records(UUID[]) TO service_role;

COMMIT; 