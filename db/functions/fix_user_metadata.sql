-- 简化版的获取所有用户元数据函数，避免递归检查
CREATE OR REPLACE FUNCTION public.get_all_user_metadata()
RETURNS TABLE (
  user_id UUID,
  metadata JSONB
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 简化权限检查
  -- 从用户表获取所有元数据
  RETURN QUERY
  SELECT au.id, au.raw_user_meta_data
  FROM auth.users au;
END;
$$ LANGUAGE plpgsql;

-- 简化版的添加用户元数据函数，避免递归检查
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