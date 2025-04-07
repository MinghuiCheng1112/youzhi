-- 修复批量永久删除功能
BEGIN;

-- 重新创建批量永久删除函数，修正类型转换问题
DROP FUNCTION IF EXISTS batch_permanently_delete_records(UUID[]);

CREATE OR REPLACE FUNCTION batch_permanently_delete_records(customer_ids UUID[])
RETURNS TABLE (
  customer_id UUID,
  success BOOLEAN
) AS $$
DECLARE
  cid UUID;
  delete_result BOOLEAN;
BEGIN
  -- 检查输入参数
  IF customer_ids IS NULL OR array_length(customer_ids, 1) IS NULL THEN
    RAISE NOTICE '没有提供有效的客户ID';
    RETURN;
  END IF;

  -- 循环处理每个客户ID
  FOREACH cid IN ARRAY customer_ids
  LOOP
    -- 初始化结果为false
    delete_result := false;
    
    BEGIN
      -- 删除客户记录
      DELETE FROM customers 
      WHERE id = cid;
      
      -- 检查是否删除成功
      IF FOUND THEN
        delete_result := true;
      END IF;
      
      -- 返回结果行
      customer_id := cid;
      success := delete_result;
      RETURN NEXT;
      
    EXCEPTION WHEN OTHERS THEN
      -- 出现异常时，记录错误并继续处理下一个ID
      RAISE NOTICE '删除客户ID % 时出错: %', cid, SQLERRM;
      customer_id := cid;
      success := false;
      RETURN NEXT;
    END;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 重新授予权限
GRANT EXECUTE ON FUNCTION batch_permanently_delete_records(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION batch_permanently_delete_records(UUID[]) TO authenticated;

COMMIT; 