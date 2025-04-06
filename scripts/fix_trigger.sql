-- 修复引用已删除字段的触发器

-- 查看现有的触发器
SELECT trigger_name, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'customers';

-- 删除引用construction_acceptance_status字段的触发器
DROP TRIGGER IF EXISTS update_construction_acceptance_status ON customers;

-- 删除相关的触发器函数
DROP FUNCTION IF EXISTS update_construction_acceptance_status_trigger();

-- 只保留基本的更新功能，创建一个新的简化版本的触发器函数
CREATE OR REPLACE FUNCTION update_simple_construction_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果建设验收日期改变了，记录一些日志（可选）
  -- 这个函数不再引用已删除的字段
  IF NEW.construction_acceptance_date IS DISTINCT FROM OLD.construction_acceptance_date THEN
    RAISE NOTICE '客户 % 的建设验收状态已更新', NEW.customer_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建新的触发器
CREATE TRIGGER update_simple_construction_acceptance
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION update_simple_construction_acceptance(); 