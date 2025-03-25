-- 修复admin_users表和user_roles表的无限递归策略问题

-- 1. 禁用所有表的RLS
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;

-- 2. 删除所有现有策略
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "users_read_own_roles_fixed" ON public.user_roles;
DROP POLICY IF EXISTS "users_update_own_roles_fixed" ON public.user_roles;
DROP POLICY IF EXISTS "users_insert_own_roles_fixed" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins_manage_all_roles_fixed" ON public.user_roles;

DROP POLICY IF EXISTS "Admins can view admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can insert admin users" ON public.admin_users;
DROP POLICY IF EXISTS "admins_view_admin_users_fixed" ON public.admin_users;
DROP POLICY IF EXISTS "admins_insert_admin_users_fixed" ON public.admin_users;

-- 3. 确保管理员ID正确添加到admin_users表
-- 先检查表结构并确定主键
DO $$
BEGIN
  -- 尝试插入管理员到admin_users表
  BEGIN
    INSERT INTO public.admin_users (user_id) 
    VALUES ('f2876b6c-34cf-4a59-bf5c-0fe1efc1d223');
  EXCEPTION 
    WHEN unique_violation THEN
      -- 如果已存在，什么都不做
    WHEN others THEN
      RAISE NOTICE '插入admin_users表出错: %', SQLERRM;
  END;

  -- 尝试插入或更新user_roles表
  BEGIN
    -- 尝试删除可能存在的记录
    DELETE FROM public.user_roles WHERE user_id = 'f2876b6c-34cf-4a59-bf5c-0fe1efc1d223';
    
    -- 插入新记录
    INSERT INTO public.user_roles (user_id, role)
    VALUES ('f2876b6c-34cf-4a59-bf5c-0fe1efc1d223', 'admin');
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE '更新user_roles表出错: %', SQLERRM;
  END;
END
$$;

-- 5. 完全移除行级安全策略，使用简单的应用程序权限检查
-- 这是一个更简单的解决方案，避免复杂的RLS策略可能导致的递归问题 

-- 修复管理员用户权限问题的脚本

-- 1. 创建一个admin_users表来存储管理员用户ID
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. 将当前系统中角色为'admin'的用户添加到admin_users表
INSERT INTO public.admin_users (user_id)
SELECT user_id FROM public.user_roles WHERE role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- 3. 为admin_users表启用行级安全
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 4. 创建策略允许管理员查看和管理admin_users表
CREATE POLICY "允许管理员查看admin_users" ON public.admin_users
FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM public.admin_users)
);

CREATE POLICY "允许管理员管理admin_users" ON public.admin_users
FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM public.admin_users)
);

-- 5. 修复RLS策略，避免无限递归问题
-- 修复user_roles表的策略
DROP POLICY IF EXISTS "users_read_own_roles_fixed" ON public.user_roles;
DROP POLICY IF EXISTS "users_update_own_roles_fixed" ON public.user_roles;
DROP POLICY IF EXISTS "users_insert_own_roles_fixed" ON public.user_roles;
DROP POLICY IF EXISTS "admins_manage_all_roles_fixed" ON public.user_roles;

-- 创建新的安全策略
-- 用户可以读取自己的角色
CREATE POLICY "users_read_own_roles_fixed" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

-- 用户可以更新自己的角色
CREATE POLICY "users_update_own_roles_fixed" ON public.user_roles
FOR UPDATE USING (auth.uid() = user_id);

-- 用户可以插入自己的角色
CREATE POLICY "users_insert_own_roles_fixed" ON public.user_roles
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 管理员可以管理所有角色
CREATE POLICY "admins_manage_all_roles_fixed" ON public.user_roles
FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM public.admin_users)
);

-- 添加管理员通用策略函数
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 修复customers表访问策略
DROP POLICY IF EXISTS "允许管理员访问所有客户" ON public.customers;
DROP POLICY IF EXISTS "允许用户访问自己的客户" ON public.customers;

-- 创建新的customers表策略
CREATE POLICY "允许管理员访问所有客户" ON public.customers
FOR ALL USING (public.is_admin());

CREATE POLICY "允许用户访问分配的客户" ON public.customers
FOR SELECT USING (
  (sales_user_id = auth.uid()) OR
  (survey_user_id = auth.uid()) OR
  (construction_user_id = auth.uid()) OR
  (filing_user_id = auth.uid()) OR
  (warehouse_user_id = auth.uid()) OR
  (dispatch_user_id = auth.uid()) OR
  (grid_user_id = auth.uid()) OR
  (procurement_user_id = auth.uid())
); 