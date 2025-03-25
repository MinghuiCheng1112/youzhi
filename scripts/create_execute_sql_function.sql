-- 创建execute_sql RPC函数
-- 请在Supabase Studio的SQL编辑器中执行此SQL文件

-- 首先，启用pgcrypto扩展（如果尚未启用）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 创建execute_sql函数
CREATE OR REPLACE FUNCTION execute_sql(sql_query text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    -- 确保当前用户有权限执行此操作
    IF NOT (SELECT IS_ADMIN() OR IS_DB_OWNER()) THEN
        RAISE EXCEPTION '只有管理员和数据库所有者才能执行此操作';
    END IF;

    -- 执行SQL查询并获取结果为JSON
    EXECUTE 'SELECT array_to_json(array_agg(row_to_json(t))) FROM (' || sql_query || ') t' INTO result;
    
    -- 如果查询没有返回任何结果，则返回空数组
    IF result IS NULL THEN
        result := '[]'::JSONB;
    END IF;
    
    RETURN result;
EXCEPTION WHEN OTHERS THEN
    -- 返回错误信息
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- 为管理员和验证用户授予执行权限
GRANT EXECUTE ON FUNCTION execute_sql TO authenticated;
GRANT EXECUTE ON FUNCTION execute_sql TO service_role;

-- 定义辅助函数检查当前用户是否为管理员
CREATE OR REPLACE FUNCTION IS_ADMIN() 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM auth.users 
        JOIN user_roles ON auth.users.id = user_roles.user_id
        JOIN roles ON user_roles.role_id = roles.id
        WHERE auth.uid() = auth.users.id AND roles.name = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 定义辅助函数检查当前用户是否为数据库所有者
CREATE OR REPLACE FUNCTION IS_DB_OWNER() 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT rolname FROM pg_roles WHERE oid = pg_backend_pid()::regrole) = 'postgres';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 