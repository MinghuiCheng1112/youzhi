-- 确保派工日期与施工队关联的触发器脚本
-- 两条规则:
-- 1. 如果施工队为空，则派工日期必须为空
-- 2. 如果施工队从空变为有值，则派工日期设置为当前日期

-- 首先删除已存在的同名触发器（如果有）
DROP TRIGGER IF EXISTS ensure_dispatch_date_consistency ON customers;

-- 创建触发器函数
CREATE OR REPLACE FUNCTION ensure_dispatch_date_consistency()
RETURNS TRIGGER AS $$
BEGIN
    -- 如果施工队为空，则派工日期也必须为空
    IF (NEW.construction_team IS NULL OR NEW.construction_team = '') THEN
        NEW.dispatch_date := NULL;
    -- 如果施工队从空变为有值，则设置派工日期为当前日期
    ELSIF (
        (OLD.construction_team IS NULL OR OLD.construction_team = '') AND 
        (NEW.construction_team IS NOT NULL AND NEW.construction_team != '')
    ) THEN
        NEW.dispatch_date := CURRENT_DATE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器，在更新或插入记录前执行
CREATE TRIGGER ensure_dispatch_date_consistency
BEFORE INSERT OR UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION ensure_dispatch_date_consistency();

-- 添加一次性更新，修复现有数据
DO $$
BEGIN
    -- 1. 修复施工队为空但派工日期不为空的情况
    UPDATE customers
    SET dispatch_date = NULL
    WHERE (construction_team IS NULL OR construction_team = '')
    AND dispatch_date IS NOT NULL;
    
    -- 2. 修复施工队不为空但派工日期为空的情况
    UPDATE customers
    SET dispatch_date = CURRENT_DATE
    WHERE construction_team IS NOT NULL 
    AND construction_team != ''
    AND dispatch_date IS NULL;
    
    RAISE NOTICE '数据已修复: 所有记录的派工日期与施工队状态现已保持一致';
END $$;

-- 返回成功消息
SELECT '触发器已创建: 施工队与派工日期的数据一致性将自动维护' as message; 