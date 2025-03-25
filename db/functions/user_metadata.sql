-- 获取所有用户元数据的函数
CREATE OR REPLACE FUNCTION public.get_all_user_metadata()
RETURNS TABLE (
  user_id UUID,
  metadata JSONB
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 检查调用者是否有适当的权限
  IF (SELECT count(*) 
      FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin') = 0
     AND 
     (SELECT count(*) 
      FROM user_roles 
      WHERE user_id = auth.uid()) > 0 THEN
    RAISE EXCEPTION 'Permission denied. Only admins can view all user metadata.';
  END IF;

  -- 从用户表获取所有元数据
  RETURN QUERY
  SELECT au.id, au.raw_user_meta_data
  FROM auth.users au;
END;
$$ LANGUAGE plpgsql;

-- 添加用户元数据的函数
CREATE OR REPLACE FUNCTION public.add_user_metadata(
  user_id UUID,
  metadata JSONB
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_metadata JSONB;
  updated_metadata JSONB;
BEGIN
  -- 检查调用者是否有适当的权限（管理员或用户本人）
  IF auth.uid() <> user_id AND
     (SELECT count(*) 
      FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin') = 0 THEN
    RAISE EXCEPTION 'Permission denied. You can only update your own metadata or be an admin.';
  END IF;

  -- 获取当前元数据
  SELECT raw_user_meta_data
  INTO current_metadata
  FROM auth.users
  WHERE id = user_id;

  -- 合并新旧元数据
  IF current_metadata IS NULL THEN
    updated_metadata := metadata;
  ELSE
    updated_metadata := current_metadata || metadata;
  END IF;

  -- 更新元数据
  UPDATE auth.users
  SET raw_user_meta_data = updated_metadata
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql; 