-- 添加踏勘员字段到customers表
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS surveyor TEXT,
ADD COLUMN IF NOT EXISTS surveyor_phone TEXT;

-- 创建相关索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_customers_surveyor ON customers(surveyor);

-- 更新user_roles表的角色约束，确保包含surveyor角色
DO $$
BEGIN
    -- 检查角色约束
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_roles_role_check'
    ) THEN
        -- 删除旧的约束
        ALTER TABLE user_roles DROP CONSTRAINT user_roles_role_check;
        
        -- 创建新的约束，包含surveyor角色
        ALTER TABLE user_roles 
        ADD CONSTRAINT user_roles_role_check 
        CHECK (role IN ('admin', 'filing_officer', 'salesman', 'warehouse', 'construction_team', 'grid_connector', 'surveyor', 'dispatch'));
    END IF;
END
$$; 