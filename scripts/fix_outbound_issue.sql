-- 1. 首先检查customers表结构
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customers';

-- 2. 添加缺少的字段（如果不存在）
DO $$
BEGIN
    -- 检查square_steel_outbound_date列是否存在
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'customers' AND column_name = 'square_steel_outbound_date') THEN
        -- 添加方钢出库日期字段
        ALTER TABLE customers ADD COLUMN square_steel_outbound_date DATE;
    END IF;
    
    -- 检查component_outbound_date列是否存在
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'customers' AND column_name = 'component_outbound_date') THEN
        -- 添加组件出库日期字段
        ALTER TABLE customers ADD COLUMN component_outbound_date DATE;
    END IF;
    
    -- 检查square_steel_outbound列是否存在
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'customers' AND column_name = 'square_steel_outbound') THEN
        -- 添加方钢是否已出库字段
        ALTER TABLE customers ADD COLUMN square_steel_outbound BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- 检查component_outbound列是否存在
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'customers' AND column_name = 'component_outbound') THEN
        -- 添加组件是否已出库字段
        ALTER TABLE customers ADD COLUMN component_outbound BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. 创建更新出库状态的函数
-- 更新方钢出库状态函数
CREATE OR REPLACE FUNCTION update_square_steel_outbound(customer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE customers
  SET square_steel_outbound = TRUE,
      square_steel_outbound_date = CURRENT_DATE
  WHERE id = customer_id;
END;
$$ LANGUAGE plpgsql;

-- 更新组件出库状态函数
CREATE OR REPLACE FUNCTION update_component_outbound(customer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE customers
  SET component_outbound = TRUE,
      component_outbound_date = CURRENT_DATE
  WHERE id = customer_id;
END;
$$ LANGUAGE plpgsql;

-- 4. 获取一个客户ID用于测试
SELECT id FROM customers LIMIT 1;

-- 5. 验证表结构（在添加字段后）
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customers' AND column_name LIKE '%outbound%'; 