// 修复采购材料顺序的脚本
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// 创建Supabase客户端
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 定义特定顺序的材料列表
const materialsList = [
  {name: '南飞锌镁铝方矩管ZM275', specs: '100*100*2.0', per_household: 10, price: 180.11, warehouse_inventory: 0},
  {name: '南飞锌镁铝方矩管ZM275', specs: '50*100*2.0', per_household: 10, price: 133.54, warehouse_inventory: 0},
  {name: '南飞锌镁铝方矩管ZM275', specs: '40*60*2.0', per_household: 40, price: 85.62, warehouse_inventory: 0},
  {name: '南飞锌镁铝方矩管ZM275', specs: '40*40*2.0', per_household: 6, price: 68.17, warehouse_inventory: 0},
  {name: '南飞锌镁铝角钢光伏支架ZM275', specs: '40*40*2.5', per_household: 6, price: 46.84, warehouse_inventory: 0},
  {name: '南飞柱底钢板Q235B', specs: '200*200*6', per_household: 25, price: 9.95, warehouse_inventory: 0},
  {name: '南飞柱底加劲板Q235B', specs: '45*100*4.0', per_household: 40, price: 0.82, warehouse_inventory: 0},
  {name: '南飞不锈钢膨胀螺栓SUS304', specs: 'M12*80', per_household: 100, price: 1.53, warehouse_inventory: 0},
  {name: '南飞U型80防水压块组合', specs: 'U型螺栓:M8*50*105mm\n配套螺母\n上压块带刺片:80*52*2.5mm\n下垫板:70*28*2.5mm', per_household: 200, price: 1.43, warehouse_inventory: 0},
  {name: '南飞阳光房四级纵向小水槽', specs: '2360mm', per_household: 45, price: 7.81, warehouse_inventory: 0},
  {name: '南飞阳光房四级纵向中水槽', specs: '4000mm', per_household: 13, price: 31.54, warehouse_inventory: 0},
  {name: '南飞阳光房四级主水槽', specs: '4000mm', per_household: 8, price: 57.05, warehouse_inventory: 0},
  {name: '南飞阳光房阳光房四级横向小水槽', specs: '适用60*40檩条', per_household: 12, price: 31.84, warehouse_inventory: 0},
  {name: '南飞阳光房四级包边水槽', specs: '适用60*40檩条', per_household: 15, price: 21.64, warehouse_inventory: 0},
  {name: '南飞阳光房四级屋脊水槽', specs: '适用60*40檩条', per_household: 4, price: 35.82, warehouse_inventory: 0},
];

async function fixMaterialsOrder() {
  console.log('开始修复采购材料顺序...');
  
  try {
    // 先删除所有现有材料
    console.log('删除现有材料...');
    const { error: deleteError } = await supabase
      .from('procurement_materials')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 确保删除所有行
    
    if (deleteError) {
      throw deleteError;
    }
    
    console.log('所有现有材料已删除');
    
    // 重新插入材料
    console.log('插入新的材料数据...');
    const { data, error: insertError } = await supabase
      .from('procurement_materials')
      .insert(materialsList)
      .select();
    
    if (insertError) {
      throw insertError;
    }
    
    console.log('材料已按照正确顺序插入，总计:', data.length);
    console.log('材料顺序修复完成!');
    
    // 打印新插入的材料
    data.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} - ${item.specs}`);
    });
    
  } catch (error) {
    console.error('修复材料顺序时出错:', error);
  }
}

// 执行修复
fixMaterialsOrder(); 