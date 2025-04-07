/**
 * 检查deleted_records表的结构
 */
require('dotenv').config();
const { Client } = require('pg');

async function checkDeletedRecordsTable() {
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
    console.log('连接数据库成功');
    
    // 获取deleted_records表的列信息
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'deleted_records' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n=== deleted_records表结构 ===');
    if (result.rows.length > 0) {
      result.rows.forEach(col => {
        console.log(`${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('找不到deleted_records表或表中没有列');
    }
    
  } catch (err) {
    console.error('执行查询出错:', err);
  } finally {
    await client.end();
    console.log('\n数据库连接已关闭');
  }
}

checkDeletedRecordsTable().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
}); 