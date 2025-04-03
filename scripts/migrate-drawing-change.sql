-- 查找使用drawing_change字段的策略
DO $$
DECLARE 
    policy_name text;
BEGIN
    FOR policy_name IN 
        SELECT policy.policyname
        FROM pg_policy policy
        JOIN pg_class table_class ON policy.tableid = table_class.oid
        JOIN pg_attribute attr ON policy.tableid = attr.attrelid
        WHERE 
            table_class.relname = 'customers' 
            AND table_class.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
            AND attr.attname = 'drawing_change'
            AND CAST(policy.polqual AS text) LIKE '%drawing_change%'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || policy_name || ' ON public.customers';
        RAISE NOTICE 'Dropped policy: %', policy_name;
    END LOOP;
END $$;

-- 修改customers表schema中drawing_change的定义
-- 首先确保没有任何策略或触发器阻止这一操作

-- 尝试直接将drawing_change从BOOLEAN转为TEXT
BEGIN;

-- 直接修改字段类型
ALTER TABLE public.customers 
  ALTER COLUMN drawing_change TYPE TEXT USING 
    CASE 
      WHEN drawing_change = true THEN '变更一' 
      ELSE '未出图' 
    END;

-- 设置默认值
ALTER TABLE public.customers 
  ALTER COLUMN drawing_change SET DEFAULT '未出图';

-- 更新现有记录
UPDATE public.customers 
SET drawing_change = '未出图' 
WHERE drawing_change IS NULL;

-- 添加列注释
COMMENT ON COLUMN public.customers.drawing_change IS '图纸变更状态，值为：未出图、变更一、变更二、变更三等';

COMMIT;

-- 输出成功消息
SELECT 'customers表的drawing_change字段已成功从BOOLEAN类型修改为TEXT类型' AS result; 