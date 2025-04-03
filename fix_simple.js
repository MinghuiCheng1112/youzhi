const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// 初始化环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 初始化Supabase客户端
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少Supabase连接信息。请确保.env文件中包含VITE_SUPABASE_URL和VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('使用Supabase URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

// 简单的SQL修复
async function fixDrawingChange() {
  try {
    console.log('执行SQL修复图纸变更字段...');
    
    // 直接执行SQL命令修复图纸变更字段
    const sqlQuery = `
      -- 尝试将布尔值转换为字符串
      UPDATE customers 
      SET drawing_change = CASE 
          WHEN drawing_change::text = 'true' THEN '变更一' 
          WHEN drawing_change::text = 'false' THEN '未出图'
          WHEN drawing_change IS NULL THEN '未出图'
          ELSE drawing_change  
        END;
        
      -- 确保所有空值都设为默认值
      UPDATE customers
      SET drawing_change = '未出图'
      WHERE drawing_change IS NULL OR drawing_change = '';
    `;
    
    console.log('执行SQL:', sqlQuery);
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sqlQuery });
    
    if (error) {
      console.error('执行SQL出错:', error);
      return;
    }
    
    console.log('SQL执行结果:', data);
    console.log('图纸变更字段修复完成！');
    
  } catch (error) {
    console.error('执行修复时出现异常:', error);
  }
}

// 执行修复
fixDrawingChange(); 