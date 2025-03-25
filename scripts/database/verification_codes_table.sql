-- 验证码表及权限设置
-- 本脚本创建验证码表并设置适当的权限和安全策略

-- 创建验证码表（如果不存在）
CREATE TABLE IF NOT EXISTS verification_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) NOT NULL,
  created_by VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  used_by VARCHAR(50),
  blocked_salesmen JSONB,
  is_active BOOLEAN DEFAULT TRUE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_verification_codes_is_active ON verification_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at);

-- 启用行级安全策略（RLS）
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果有）
DROP POLICY IF EXISTS verification_codes_all_users_policy ON verification_codes;

-- 创建允许所有已认证用户访问验证码表的策略
-- 任何已登录用户都可以查询验证码表中的记录
CREATE POLICY verification_codes_all_users_policy ON verification_codes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 授予对验证码表的访问权限给所有角色
GRANT SELECT, INSERT, UPDATE ON verification_codes TO app_admin, app_filing_officer, app_salesman, app_warehouse, app_construction_team, app_grid_connector;
GRANT USAGE, SELECT ON SEQUENCE verification_codes_id_seq TO app_admin, app_filing_officer, app_salesman, app_warehouse, app_construction_team, app_grid_connector;

-- 将表的所有权授予超级用户或服务角色（如果适用）
-- ALTER TABLE verification_codes OWNER TO service_role;

-- 设置公共访问权限
-- 为anon角色授予验证权限，使未认证用户也能验证验证码
GRANT SELECT ON verification_codes TO anon;

-- 添加触发器函数：自动设置验证码过期
CREATE OR REPLACE FUNCTION set_verification_code_expired()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果验证码已被使用或已过期，则自动将is_active设置为false
  IF NEW.used_at IS NOT NULL OR NEW.expires_at < CURRENT_TIMESTAMP THEN
    NEW.is_active = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS verification_code_expiry_trigger ON verification_codes;
CREATE TRIGGER verification_code_expiry_trigger
BEFORE INSERT OR UPDATE ON verification_codes
FOR EACH ROW EXECUTE FUNCTION set_verification_code_expired();

-- 添加清理过期验证码的函数
CREATE OR REPLACE FUNCTION clean_expired_verification_codes()
RETURNS void AS $$
BEGIN
  -- 将所有已过期但仍标记为活动的验证码标记为非活动
  UPDATE verification_codes
  SET is_active = false
  WHERE expires_at < CURRENT_TIMESTAMP AND is_active = true;
  
  -- 可选：删除超过30天的验证码记录
  -- DELETE FROM verification_codes WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 提示信息
COMMENT ON TABLE verification_codes IS '存储系统生成的验证码信息，用于抽签和其他验证操作';
COMMENT ON COLUMN verification_codes.code IS '4位数字验证码';
COMMENT ON COLUMN verification_codes.created_by IS '创建验证码的用户';
COMMENT ON COLUMN verification_codes.created_at IS '验证码创建时间';
COMMENT ON COLUMN verification_codes.expires_at IS '验证码过期时间（通常为创建后24小时）';
COMMENT ON COLUMN verification_codes.used_at IS '验证码使用时间';
COMMENT ON COLUMN verification_codes.used_by IS '使用验证码的用户';
COMMENT ON COLUMN verification_codes.blocked_salesmen IS '被屏蔽的业务员列表（JSON格式）';
COMMENT ON COLUMN verification_codes.is_active IS '验证码是否仍然有效'; 