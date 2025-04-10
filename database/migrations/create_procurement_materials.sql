-- 创建采购材料表
CREATE TABLE IF NOT EXISTS procurement_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  specs TEXT NOT NULL,
  per_household NUMERIC(10, 2) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  warehouse_inventory INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_procurement_materials_name ON procurement_materials(name);

-- 创建触发器自动更新updated_at字段
CREATE OR REPLACE FUNCTION update_procurement_materials_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_procurement_materials_timestamp
BEFORE UPDATE ON procurement_materials
FOR EACH ROW
EXECUTE FUNCTION update_procurement_materials_timestamp();

-- 添加预设的材料数据
INSERT INTO procurement_materials (name, specs, per_household, price, warehouse_inventory) VALUES
('南飞锌镁铝方矩管ZM275', '100*100*2.0', 10, 180.11, 0),
('南飞锌镁铝方矩管ZM275', '50*100*2.0', 10, 133.54, 0),
('南飞锌镁铝方矩管ZM275', '40*60*2.0', 40, 85.62, 0),
('南飞锌镁铝方矩管ZM275', '40*40*2.0', 6, 68.17, 0),
('南飞锌镁铝角钢光伏支架ZM275', '40*40*2.5', 6, 46.84, 0),
('南飞柱底钢板Q235B', '200*200*6', 25, 9.95, 0),
('南飞柱底加劲板Q235B', '45*100*4.0', 40, 0.82, 0),
('南飞不锈钢膨胀螺栓SUS304', 'M12*80', 100, 1.53, 0),
('南飞U型80防水压块组合', 'U型螺栓:M8*50*105mm
配套螺母
上压块带刺片:80*52*2.5mm
下垫板:70*28*2.5mm', 200, 1.43, 0),
('南飞阳光房四级纵向小水槽', '2360mm', 45, 7.81, 0),
('南飞阳光房四级纵向中水槽', '4000mm', 13, 31.54, 0),
('南飞阳光房四级主水槽', '4000mm', 8, 57.05, 0),
('南飞阳光房阳光房四级横向小水槽', '适用60*40檩条', 12, 31.84, 0),
('南飞阳光房四级包边水槽', '适用60*40檩条', 15, 21.64, 0),
('南飞阳光房四级屋脊水槽', '适用60*40檩条', 4, 35.82, 0)
ON CONFLICT DO NOTHING; 