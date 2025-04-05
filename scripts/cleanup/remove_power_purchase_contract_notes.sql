-- 在客户表中移除购售电合同备注字段（power_purchase_contract_notes）
-- 由于这是已废弃的字段，脚本删除此字段

-- 检查字段是否存在
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'customers' 
        AND column_name = 'power_purchase_contract_notes'
    ) THEN
        -- 删除字段
        ALTER TABLE customers DROP COLUMN power_purchase_contract_notes;
        RAISE NOTICE '已成功移除字段: power_purchase_contract_notes';
    ELSE
        RAISE NOTICE '字段不存在: power_purchase_contract_notes';
    END IF;
END $$;

-- 完成后通知
SELECT '操作完成：移除购售电合同备注字段' as message; 