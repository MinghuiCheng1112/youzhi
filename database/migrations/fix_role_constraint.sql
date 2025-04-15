-- 修改user_roles表的角色约束
ALTER TABLE user_roles 
  DROP CONSTRAINT IF EXISTS user_roles_role_check,
  ADD CONSTRAINT user_roles_role_check 
  CHECK (role IN ('admin', 'filing_officer', 'salesman', 'warehouse', 'construction_team', 'grid_connector', 'surveyor', 'dispatch', 'procurement', 'pending'));

-- 确保user_roles表有email, name, phone列
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS phone TEXT;

-- 为已有但没有角色记录的用户创建角色记录
INSERT INTO user_roles (user_id, email, name, phone, role, created_at)
SELECT id, email, '', '', 'pending', CURRENT_TIMESTAMP
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
);

-- 创建查看pending用户的视图
CREATE OR REPLACE VIEW pending_users AS
SELECT 
  ur.id,
  ur.user_id,
  ur.email,
  ur.name,
  ur.phone,
  ur.created_at
FROM user_roles ur
WHERE ur.role = 'pending'; 