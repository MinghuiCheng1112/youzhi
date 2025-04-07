/**
 * 检查customers表的确切结构
 */
require('dotenv').config();
const { Client } = require('pg');

async function checkCustomersTable() {
  const client = new Client({
    user: process.env.SUPABASE_DB_USER || process.env.SUPABASE_USER,
    password: process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_PASSWORD,
    host: process.env.SUPABASE_DB_HOST || process.env.SUPABASE_HOST,
    port: process.env.SUPABASE_DB_PORT || process.env.SUPABASE_PORT,
    database: process.env.SUPABASE_DB_NAME || process.env.SUPABASE_DATABASE,
    // 完全禁用SSL
    ssl: false
  });

  try {
    await client.connect();
    console.log('连接数据库成功');
    
    // 获取customers表的所有列名
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n=== customers表所有列 ===');
    if (result.rows.length > 0) {
      result.rows.forEach(col => {
        console.log(`${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('找不到customers表或表中没有列');
    }
    
    // 检查是否有触发器函数引用了不存在的列
    console.log('\n=== 检查触发器函数 ===');
    const functionResult = await client.query(`
      SELECT 
        p.proname AS routine_name,
        pg_get_functiondef(p.oid) AS definition
      FROM 
        pg_proc p
      JOIN 
        pg_namespace n ON p.pronamespace = n.oid
      WHERE 
        n.nspname = 'public' 
        AND (p.proname = 'restore_deleted_record'
             OR p.proname LIKE '%customer%');
    `);
    
    console.log(`找到 ${functionResult.rows.length} 个与customers相关的函数`);
    
    for (const func of functionResult.rows) {
      console.log(`\n函数名: ${func.routine_name}`);
      
      // 检查函数定义中是否包含deleted_records表中不存在的列名
      const columnsToCheck = ['salesman_email', 'surveyor_email', 'first_contact_date', 
                             'renewal_status_date', 'interest_status_date', 'upload_to_grid_date'];
      
      let problemFound = false;
      for (const col of columnsToCheck) {
        if (func.definition.includes(col)) {
          console.log(`  [问题] 函数引用了不存在的列: ${col}`);
          problemFound = true;
        }
      }
      
      if (!problemFound) {
        console.log('  [正常] 未发现引用不存在列的问题');
      }
    }
    
  } catch (err) {
    console.error('执行查询出错:', err);
  } finally {
    await client.end();
    console.log('\n数据库连接已关闭');
  }
}

checkCustomersTable().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
}); 