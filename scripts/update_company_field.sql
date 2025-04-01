-- 修改customers表中company字段的约束，允许使用中文名称"昊尘"和"祐之"

-- 首先检查现有的约束
DO $$
DECLARE
    constraint_exists boolean;
BEGIN
    -- 检查customers_company_check约束是否存在
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'customers'
        AND constraint_name = 'customers_company_check'
    ) INTO constraint_exists;
    
    -- 如果存在，删除约束
    IF constraint_exists THEN
        EXECUTE 'ALTER TABLE customers DROP CONSTRAINT customers_company_check';
        RAISE NOTICE '已删除现有的company字段约束';
    ELSE
        RAISE NOTICE 'company字段约束不存在，无需删除';
    END IF;
    
    -- 添加新的约束，允许中文名称
    EXECUTE 'ALTER TABLE customers ADD CONSTRAINT customers_company_check CHECK (company IS NULL OR company IN (''haoChen'', ''youZhi'', ''昊尘'', ''祐之''))';
    RAISE NOTICE '已添加新的公司字段约束，允许使用中文名称"昊尘"和"祐之"';
END $$;

-- 查询约束状态
SELECT
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM
    information_schema.table_constraints tc
JOIN
    information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE
    tc.table_name = 'customers'
    AND tc.constraint_name = 'customers_company_check';

-- 输出完成信息
SELECT 'company字段约束已成功更新' AS message; 