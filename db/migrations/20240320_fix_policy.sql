-- 修复user_roles表的RLS策略问题

-- 先删除导致递归的策略
DROP POLICY IF EXISTS user_roles_policy ON public.user_roles;

-- 禁用RLS以便操作表
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- 确保表格权限
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- 添加不会导致递归的简化策略
-- 注意：此策略允许所有已认证用户查看所有用户角色，但只能修改自己的记录
CREATE POLICY user_roles_select_policy ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (true);
  
CREATE POLICY user_roles_insert_policy ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR 
             (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role');

CREATE POLICY user_roles_update_policy ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR 
        (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role')
  WITH CHECK (auth.uid() = user_id OR 
             (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role');
             
CREATE POLICY user_roles_delete_policy ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR 
        (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role');

-- 重新启用RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY; 