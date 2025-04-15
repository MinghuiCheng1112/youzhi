-- 修改user_roles表，添加pending角色
ALTER TABLE user_roles 
  DROP CONSTRAINT IF EXISTS user_roles_role_check,
  ADD CONSTRAINT user_roles_role_check 
  CHECK (role IN ('admin', 'filing_officer', 'salesman', 'warehouse', 'construction_team', 'grid_connector', 'surveyor', 'dispatch', 'procurement', 'pending'));

-- 创建视图以查看待分配角色的用户
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

-- 添加email,name,phone列(如果不存在)
DO $$ 
BEGIN
  -- 检查email列是否存在
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_roles' AND column_name = 'email'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN email TEXT;
  END IF;

  -- 检查name列是否存在  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_roles' AND column_name = 'name'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN name TEXT;
  END IF;

  -- 检查phone列是否存在
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_roles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN phone TEXT;
  END IF;
END $$; 