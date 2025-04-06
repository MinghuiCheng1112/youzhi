-- 修复construction_acceptance_notes模式缓存问题

-- 向Supabase内部系统表发送更新信号
SELECT pg_notify('pgrst', 'reload schema');

-- 刷新数据库统计信息
ANALYZE VERBOSE customers;

-- 添加临时触发器以刷新模式缓存
CREATE OR REPLACE FUNCTION refresh_schema_cache() RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 尝试创建临时触发器（如果表存在）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    DROP TRIGGER IF EXISTS refresh_schema_cache_trigger ON customers;
    CREATE TRIGGER refresh_schema_cache_trigger
    AFTER INSERT OR UPDATE OR DELETE ON customers
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_schema_cache();
  END IF;
END$$;

-- 触发缓存刷新的空更新
UPDATE customers SET id = id WHERE false;

-- 清理：删除临时触发器
DROP TRIGGER IF EXISTS refresh_schema_cache_trigger ON customers;
DROP FUNCTION IF EXISTS refresh_schema_cache(); 