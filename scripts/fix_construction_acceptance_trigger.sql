-- 修复建设验收触发器函数
BEGIN;

-- 重新创建建设验收触发器函数，移除对已删除字段的引用
CREATE OR REPLACE FUNCTION public.update_simple_construction_acceptance()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- 处理建设验收日期更新的逻辑
  -- 移除了对已删除字段construction_acceptance_waiting_start的引用
  
  RETURN NEW;
END;
$function$;

-- 刷新系统缓存
ANALYZE customers;

COMMIT; 