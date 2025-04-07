const { Client } = require('pg');
require('dotenv').config();

// 建立数据库连接
const client = new Client({
  host: process.env.SUPABASE_HOST,
  port: process.env.SUPABASE_PORT,
  database: process.env.SUPABASE_DATABASE,
  user: process.env.SUPABASE_USER,
  password: process.env.SUPABASE_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('正在连接Supabase数据库...');
    await client.connect();
    console.log('数据库连接成功');

    // 检查deleted_records表的列结构
    console.log('正在检查deleted_records表的列结构...');
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'deleted_records'
      ORDER BY ordinal_position;
    `;
    
    const columnsResult = await client.query(columnsQuery);
    
    console.log('\n==== deleted_records表的列结构 ====');
    console.table(columnsResult.rows.map(row => ({
      column_name: row.column_name,
      data_type: row.data_type,
      is_nullable: row.is_nullable
    })));

    // 检查customers表的列结构
    console.log('\n正在检查customers表的列结构...');
    const customersColumnsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'customers'
      ORDER BY ordinal_position;
    `;
    
    const customersColumnsResult = await client.query(customersColumnsQuery);
    
    console.log('\n==== customers表的列结构 ====');
    console.table(customersColumnsResult.rows.map(row => ({
      column_name: row.column_name,
      data_type: row.data_type,
      is_nullable: row.is_nullable
    })));

    // 比较两个表的列差异
    const customerColumns = new Set(customersColumnsResult.rows.map(row => row.column_name));
    const deletedRecordsColumns = new Set(columnsResult.rows.map(row => row.column_name));
    
    const inCustomersOnly = [...customerColumns].filter(col => !deletedRecordsColumns.has(col));
    const inDeletedRecordsOnly = [...deletedRecordsColumns].filter(col => !customerColumns.has(col));
    
    console.log('\n==== 表格列比较 ====');
    console.log('仅在customers表中存在的列:', inCustomersOnly);
    console.log('仅在deleted_records表中存在的列:', inDeletedRecordsOnly);

  } catch (error) {
    console.error('出错了:', error);
  } finally {
    await client.end();
    console.log('数据库连接已关闭');
  }
}

main(); 