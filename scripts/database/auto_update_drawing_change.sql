-- 自动更新图纸变更状态触发器
-- 当组件数量字段有值时，自动将图纸变更设置为"已出图"
-- 创建日期: 2023-07-15

-- 首先检查并删除可能已存在的触发器和函数
DROP TRIGGER IF EXISTS auto_update_drawing_change_trigger ON customers;
DROP FUNCTION IF EXISTS auto_update_drawing_change();

-- 创建触发器函数
CREATE OR REPLACE FUNCTION auto_update_drawing_change()
RETURNS TRIGGER AS $$
BEGIN
  -- 当组件数量大于0且图纸变更为"未出图"或为空时，自动设置为"已出图"
  IF NEW.module_count IS NOT NULL AND NEW.module_count > 0 AND 
     (NEW.drawing_change IS NULL OR NEW.drawing_change = '未出图') THEN
    NEW.drawing_change := '已出图';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建BEFORE UPDATE触发器，确保在记录更改之前应用逻辑
CREATE TRIGGER auto_update_drawing_change_trigger
BEFORE UPDATE OR INSERT ON customers
FOR EACH ROW
EXECUTE FUNCTION auto_update_drawing_change();

-- 立即更新现有记录
UPDATE customers
SET drawing_change = '已出图'
WHERE module_count IS NOT NULL 
  AND module_count > 0 
  AND (drawing_change IS NULL OR drawing_change = '未出图');

-- 输出成功信息
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '已更新 % 条现有记录的图纸变更状态', updated_count;
  RAISE NOTICE '自动更新图纸变更状态的触发器已成功创建';
END $$; 