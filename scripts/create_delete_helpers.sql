-- 创建辅助函数，用于安全地删除客户，避免触发器问题
BEGIN;

-- 诊断信息
DO $$
BEGIN
  RAISE NOTICE '创建客户删除辅助函数...';
END $$;

-- 删除已存在的函数
DROP FUNCTION IF EXISTS safe_delete_customer(uuid);
DROP FUNCTION IF EXISTS direct_update_customer(uuid, timestamp with time zone);

-- 创建直接更新客户状态的函数（不使用触发器）
CREATE OR REPLACE FUNCTION direct_update_customer(p_id UUID, p_deleted_at TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN AS $$
DECLARE
  success BOOLEAN := false;
BEGIN
  -- 直接执行更新，绕过触发器
  UPDATE customers 
  SET deleted_at = p_deleted_at
  WHERE id = p_id
  AND deleted_at IS NULL;
  
  GET DIAGNOSTICS success = ROW_COUNT;
  
  -- 记录到日志
  IF success THEN
    RAISE NOTICE '客户 % 已成功通过direct_update_customer标记为已删除', p_id;
  ELSE
    RAISE NOTICE '无法通过direct_update_customer标记客户 % 为已删除', p_id;
  END IF;
  
  RETURN success > 0;
END;
$$ LANGUAGE plpgsql;

-- 安全删除客户的函数
CREATE OR REPLACE FUNCTION safe_delete_customer(customer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  found_id UUID;
  success BOOLEAN := false;
BEGIN
  -- 检查客户是否存在
  SELECT id INTO found_id 
  FROM customers 
  WHERE id = customer_id 
  AND deleted_at IS NULL;
  
  IF found_id IS NULL THEN
    RAISE NOTICE '客户不存在或已被删除: %', customer_id;
    RETURN false;
  END IF;
  
  -- 尝试软删除
  BEGIN
    UPDATE customers 
    SET deleted_at = NOW() 
    WHERE id = customer_id;
    
    GET DIAGNOSTICS success = ROW_COUNT;
    
    IF success THEN
      RAISE NOTICE '客户 % 已成功标记为已删除', customer_id;
      RETURN true;
    ELSE
      RAISE NOTICE '无法标记客户 % 为已删除', customer_id;
      RETURN false;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- 记录错误信息
    RAISE NOTICE '删除客户 % 时出错: %', customer_id, SQLERRM;
    RETURN false;
  END;
END;
$$ LANGUAGE plpgsql;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION direct_update_customer(UUID, TIMESTAMP WITH TIME ZONE) TO service_role;
GRANT EXECUTE ON FUNCTION safe_delete_customer(UUID) TO service_role;

-- 诊断信息
DO $$
BEGIN
  RAISE NOTICE '辅助函数创建完成！您可以使用以下函数删除客户:';
  RAISE NOTICE '- SELECT safe_delete_customer(''客户ID'');';
  RAISE NOTICE '- SELECT direct_update_customer(''客户ID'', NOW());';
END $$;

COMMIT; 