-- 刷新Supabase模式缓存

-- 强制刷新PostgreSQL统计信息
ANALYZE VERBOSE customers;

-- 使用pg_stat_statements模块清理其缓存（如果安装了）
SELECT pg_stat_statements_reset();

-- 清理解析和计划缓存（不能在事务内使用）
DISCARD ALL;

-- 表维护
VACUUM ANALYZE customers;

-- 记录操作日志
DO $$
BEGIN
  RAISE NOTICE '模式缓存刷新完成';
END
$$; 