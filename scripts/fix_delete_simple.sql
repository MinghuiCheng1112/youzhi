-- 简单修复客户删除功能
BEGIN;

-- 禁用客户表上的所有触发器
DROP TRIGGER IF EXISTS trigger_capture_soft_deleted_customer ON customers;
DROP TRIGGER IF EXISTS trigger_record_deleted_customer ON customers;

-- 创建一个简单高效的删除函数
CREATE OR REPLACE FUNCTION direct_delete_customer(customer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  success BOOLEAN := false;
BEGIN
  -- 直接标记删除
  UPDATE customers 
  SET deleted_at = NOW() 
  WHERE id = customer_id 
  AND deleted_at IS NULL;
  
  GET DIAGNOSTICS success = ROW_COUNT;
  RETURN success > 0;
END;
$$ LANGUAGE plpgsql;

-- 完全绕过触发器的前端调用函数
CREATE OR REPLACE FUNCTION safe_delete_customer(customer_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- 直接调用简单删除函数
  RETURN direct_delete_customer(customer_id);
END;
$$ LANGUAGE plpgsql;

-- 授予权限
GRANT EXECUTE ON FUNCTION direct_delete_customer(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION safe_delete_customer(UUID) TO service_role;

COMMIT; 