/**
 * 专门检查函数体内容的脚本
 */
require('dotenv').config();
const { Client } = require('pg');

async function checkFunctionBody() {
  const client = new Client({
    user: process.env.SUPABASE_DB_USER || process.env.SUPABASE_USER,
    password: process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_PASSWORD,
    host: process.env.SUPABASE_DB_HOST || process.env.SUPABASE_HOST,
    port: process.env.SUPABASE_DB_PORT || process.env.SUPABASE_PORT,
    database: process.env.SUPABASE_DB_NAME || process.env.SUPABASE_DATABASE,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('连接数据库成功\n');
    
    // 使用pg_get_functiondef查看完整函数定义
    const result = await client.query(`
      SELECT 
        p.proname AS function_name,
        pg_get_functiondef(p.oid) AS function_def
      FROM 
        pg_proc p
      JOIN 
        pg_namespace n ON p.pronamespace = n.oid
      WHERE 
        n.nspname = 'public'
        AND p.proname = 'update_simple_construction_acceptance';
    `);
    
    if (result.rows.length > 0) {
      console.log(`函数定义:\n${'-'.repeat(50)}`);
      console.log(result.rows[0].function_def);
      console.log(`${'-'.repeat(50)}\n`);
      
      if (result.rows[0].function_def.includes('construction_acceptance_status')) {
        console.log('警告: 函数体中仍然引用已删除的字段 construction_acceptance_status');
        
        // 提取引用位置
        const lines = result.rows[0].function_def.split('\n');
        const problematicLines = [];
        
        lines.forEach((line, index) => {
          if (line.includes('construction_acceptance_status')) {
            problematicLines.push({ lineNumber: index + 1, content: line.trim() });
          }
        });
        
        if (problematicLines.length > 0) {
          console.log('\n问题行:');
          problematicLines.forEach(line => {
            console.log(`第 ${line.lineNumber} 行: ${line.content}`);
          });
        }
      } else {
        console.log('函数体中没有引用已删除的字段 construction_acceptance_status');
      }
    } else {
      console.log('找不到指定的函数');
    }
    
  } catch (err) {
    console.error('执行查询出错:', err);
  } finally {
    await client.end();
    console.log('\n数据库连接已关闭');
  }
}

checkFunctionBody().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
}); 