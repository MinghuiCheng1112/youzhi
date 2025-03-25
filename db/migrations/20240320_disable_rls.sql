-- 完全禁用RLS并重置权限

-- 删除所有现有策略
DROP POLICY IF EXISTS user_roles_policy ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_policy ON public.user_roles;
DROP POLICY IF EXISTS user_roles_insert_policy ON public.user_roles;
DROP POLICY IF EXISTS user_roles_update_policy ON public.user_roles;
DROP POLICY IF EXISTS user_roles_delete_policy ON public.user_roles;

-- 完全禁用RLS
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- 重置权限，简化为基本的表级权限
GRANT ALL ON public.user_roles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- 删除可能导致递归的函数
DROP FUNCTION IF EXISTS public.get_all_user_metadata();
DROP FUNCTION IF EXISTS public.add_user_metadata();

-- 确保email和name列存在
ALTER TABLE IF EXISTS public.user_roles 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS name TEXT; 