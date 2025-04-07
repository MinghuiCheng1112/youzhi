/**
 * 检查restore_deleted_record函数定义
 */
require('dotenv').config();
const { Client } = require('pg');

async function checkRestoreFunction() {
  const client = new Client({
    user: process.env.SUPABASE_DB_USER || process.env.SUPABASE_USER,
    password: process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_PASSWORD,
    host: process.env.SUPABASE_DB_HOST || process.env.SUPABASE_HOST,
    port: process.env.SUPABASE_DB_PORT || process.env.SUPABASE_PORT,
    database: process.env.SUPABASE_DB_NAME || process.env.SUPABASE_DATABASE,
    ssl: false
  });

  try {
    await client.connect();
    console.log('连接数据库成功');
    
    // 获取函数定义
    const result = await client.query(`
      SELECT pg_get_functiondef(oid) AS definition
      FROM pg_proc 
      WHERE proname = 'restore_deleted_record';
    `);
    
    if (result.rows.length > 0) {
      console.log('\n=== restore_deleted_record函数定义 ===');
      console.log(result.rows[0].definition);
      
      // 检查函数定义中是否包含deleted_records表中不存在的列名
      const columnsToCheck = ['salesman_email', 'surveyor_email', 'first_contact_date', 
                             'renewal_status_date', 'interest_status_date', 'upload_to_grid_date'];
      
      console.log('\n=== 检查函数引用问题 ===');
      let problemFound = false;
      for (const col of columnsToCheck) {
        if (result.rows[0].definition.includes(col)) {
          console.log(`[问题] 函数引用了不存在的列: ${col}`);
          problemFound = true;
        }
      }
      
      if (!problemFound) {
        console.log('[正常] 未发现引用不存在列的问题');
      }
    } else {
      console.log('找不到restore_deleted_record函数');
    }
    
  } catch (err) {
    console.error('执行查询出错:', err);
  } finally {
    await client.end();
    console.log('\n数据库连接已关闭');
  }
}

checkRestoreFunction().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
}); 