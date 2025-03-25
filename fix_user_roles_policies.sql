-- 修复user_roles表的无限递归策略问题

-- 1. 首先删除所有现有的策略
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.user_roles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.user_roles;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.user_roles;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.user_roles;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.user_roles;

-- 2. 暂时禁用RLS，清理现有数据
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- 3. 创建一个管理员用户标识表(不受RLS约束)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. 添加当前管理员到admin_users表
-- 请将下面的UUID替换为你的管理员用户ID
INSERT INTO public.admin_users (user_id) 
VALUES ('f2876b6c-34cf-4a59-bf5c-0fe1efc1d223')
ON CONFLICT (user_id) DO NOTHING;

-- 5. 为user_roles表重新启用RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 6. 创建新的RLS策略，避免递归查询
-- 用户可以读取自己的角色
CREATE POLICY "users_read_own_roles_fixed"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- 用户可以更新自己的角色 
CREATE POLICY "users_update_own_roles_fixed"
ON public.user_roles
FOR UPDATE
USING (auth.uid() = user_id);

-- 用户可以插入自己的角色
CREATE POLICY "users_insert_own_roles_fixed"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 管理员可以管理所有角色(不使用递归查询，而是使用admin_users表)
CREATE POLICY "admins_manage_all_roles_fixed"
ON public.user_roles
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  )
);

-- 7. 将现有的admin角色用户添加到admin_users表
INSERT INTO public.admin_users (user_id)
SELECT user_id FROM public.user_roles WHERE role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- 8. 为admin_users表启用RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 9. 创建admin_users表的RLS策略
-- 管理员可以查看所有admin用户
CREATE POLICY "admins_view_admin_users_fixed"
ON public.admin_users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  )
);

-- 管理员可以添加其他管理员
CREATE POLICY "admins_insert_admin_users_fixed"
ON public.admin_users
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  )
); 