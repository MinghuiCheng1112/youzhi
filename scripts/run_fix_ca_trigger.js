const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Supabase连接信息
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey);

async function runFixScript() {
  console.log('===================================');
  console.log('  修复construction_acceptance触发器');
  console.log('===================================');

  try {
    console.log('[信息] 连接到数据库...');

    // 读取SQL脚本
    const sqlPath = path.join(__dirname, 'cleanup', 'fix_construction_acceptance_trigger.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('[信息] 执行SQL脚本...');
    
    // 执行SQL脚本
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sqlScript });
    
    if (error) {
      console.error('[错误] SQL执行失败:', error);
      return;
    }
    
    console.log('[成功] SQL脚本执行成功!');
    console.log('[信息] 触发器已修复，客户删除功能应该可以正常工作了');
  } catch (error) {
    console.error('[错误] 执行过程中出现错误:', error);
  }

  console.log('===================================');
  console.log('  修复工具执行完成');
  console.log('===================================');
}

runFixScript(); 