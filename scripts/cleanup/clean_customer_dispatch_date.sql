-- 清理触发器脚本：当施工队字段为空时，自动将派工日期字段清空为null
-- 这确保了数据一致性，避免出现有派工日期但无施工队的情况

-- 首先删除已存在的同名触发器（如果有）
DROP TRIGGER IF EXISTS ensure_construction_team_dispatch_date_consistency ON customers;

-- 创建触发器函数
CREATE OR REPLACE FUNCTION ensure_construction_team_consistency()
RETURNS TRIGGER AS $$
BEGIN
    -- 如果施工队为空，则同时清空派工日期
    IF (NEW.construction_team IS NULL) THEN
        NEW.dispatch_date := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器，在更新记录前执行
CREATE TRIGGER ensure_construction_team_dispatch_date_consistency
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION ensure_construction_team_consistency();

-- 添加一次性更新，修复现有数据
DO $$
BEGIN
    -- 修复已有数据中施工队为空但派工日期不为空的情况
    UPDATE customers
    SET dispatch_date = NULL
    WHERE construction_team IS NULL 
    AND dispatch_date IS NOT NULL;
    
    RAISE NOTICE '数据已修复: 所有施工队为空的记录的派工日期已设置为空';
END $$;

-- 返回成功消息
SELECT '触发器已创建: 当施工队为空时，派工日期将自动设置为空' as message; 