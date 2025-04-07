-- 检查和修复客户删除失败问题的SQL脚本
BEGIN;

-- 1. 检查哪些表引用了customers表的id字段
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM 
    information_schema.table_constraints AS tc 
JOIN 
    information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN 
    information_schema.constraint_column_usage AS ccu 
    ON ccu.constraint_name = tc.constraint_name
JOIN
    information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE 
    tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name = 'customers';

-- 2. 检查是否有外键约束没有设置ON DELETE CASCADE
-- 如果以下查询返回结果，表示有外键约束没有设置ON DELETE CASCADE
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM 
    information_schema.table_constraints AS tc 
JOIN 
    information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN 
    information_schema.constraint_column_usage AS ccu 
    ON ccu.constraint_name = tc.constraint_name
JOIN
    information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE 
    tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name = 'customers'
    AND rc.delete_rule != 'CASCADE';

-- 3. 列出所有引用客户ID但非CASCADE删除的外键，以便手动处理
-- 下面语句将为未设置CASCADE的外键生成修改SQL
SELECT 
    'ALTER TABLE ' || tc.table_name || 
    ' DROP CONSTRAINT ' || tc.constraint_name || ';' ||
    'ALTER TABLE ' || tc.table_name ||
    ' ADD CONSTRAINT ' || tc.constraint_name ||
    ' FOREIGN KEY (' || kcu.column_name || 
    ') REFERENCES customers(id) ON DELETE CASCADE;' AS fix_sql
FROM 
    information_schema.table_constraints AS tc 
JOIN 
    information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN 
    information_schema.constraint_column_usage AS ccu 
    ON ccu.constraint_name = tc.constraint_name
JOIN
    information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE 
    tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name = 'customers'
    AND rc.delete_rule != 'CASCADE';

-- 4. 如需手动应用修复，取消下面注释并执行

/*
-- 检查是否存在特定表的外键约束需要修复
-- 例如修复verification_codes表的外键约束
DO $$
DECLARE
    cons_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'verification_codes_customer_id_fkey'
        AND table_name = 'verification_codes'
    ) INTO cons_exists;

    IF cons_exists THEN
        ALTER TABLE verification_codes DROP CONSTRAINT verification_codes_customer_id_fkey;
        ALTER TABLE verification_codes ADD CONSTRAINT verification_codes_customer_id_fkey
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
        RAISE NOTICE 'Fixed foreign key constraint on verification_codes table';
    ELSE
        RAISE NOTICE 'Constraint verification_codes_customer_id_fkey does not exist, no action needed';
    END IF;
END $$;
*/

-- 5. 检查是否有trigger依赖于customers表
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table,
    action_statement
FROM 
    information_schema.triggers
WHERE 
    event_object_table = 'customers'
    OR action_statement LIKE '%customers%';

-- 6. 检查软删除是否正常工作
-- 先尝试一个软删除查看是否有错误
/*
DO $$
DECLARE
    test_customer_id UUID;
BEGIN
    -- 查找一个可以测试的客户
    SELECT id INTO test_customer_id FROM customers 
    WHERE deleted_at IS NULL LIMIT 1;
    
    IF test_customer_id IS NOT NULL THEN
        -- 先打印将要测试的客户ID
        RAISE NOTICE '测试软删除客户ID: %', test_customer_id;
        
        -- 尝试软删除
        UPDATE customers SET deleted_at = NOW() 
        WHERE id = test_customer_id;
        
        -- 检查是否成功软删除
        IF EXISTS (SELECT 1 FROM customers WHERE id = test_customer_id AND deleted_at IS NOT NULL) THEN
            RAISE NOTICE '软删除成功';
            
            -- 恢复客户（取消软删除）
            UPDATE customers SET deleted_at = NULL
            WHERE id = test_customer_id;
            
            RAISE NOTICE '客户已恢复';
        ELSE
            RAISE NOTICE '软删除失败或查询异常';
        END IF;
    ELSE
        RAISE NOTICE '未找到可测试的客户';
    END IF;
END $$;
*/

-- 7. 检查是否有孤立的关联记录
-- 检查是否有客户ID不存在但关联表中有记录的情况
SELECT 'modification_records' AS table_name, COUNT(*) AS orphaned_records
FROM modification_records mr
WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = mr.customer_id)
UNION ALL
SELECT 'draw_records' AS table_name, COUNT(*) AS orphaned_records
FROM draw_records dr
WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = dr.customer_id);

-- 如果上述查询返回非零数字，可能需要清理这些孤立记录

COMMIT; 