-- 添加name字段和email字段到user_roles表
ALTER TABLE IF EXISTS public.user_roles
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- 更新表的权限
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 确保对user_roles表的权限正确设置
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- 添加行级安全策略，确保用户只能访问自己的数据
DROP POLICY IF EXISTS user_roles_policy ON public.user_roles;
CREATE POLICY user_roles_policy ON public.user_roles
  USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin'::text);

-- 修复邮箱显示问题，确保email字段有值
UPDATE public.user_roles
SET email = auth.users.email
FROM auth.users
WHERE user_roles.user_id = auth.users.id
  AND (user_roles.email IS NULL OR user_roles.email = ''); 