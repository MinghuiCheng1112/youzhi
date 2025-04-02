require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 检查必要的环境变量
const requiredEnvVars = [
  'SUPABASE_DB_HOST',
  'SUPABASE_DB_PORT',
  'SUPABASE_DB_NAME',
  'SUPABASE_DB_USER',
  'SUPABASE_DB_PASSWORD',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`错误: 缺少环境变量 ${envVar}`);
    process.exit(1);
  }
}

// 配置数据库连接
const pool = new Pool({
  host: process.env.SUPABASE_DB_HOST,
  port: process.env.SUPABASE_DB_PORT,
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixTable() {
  const client = await pool.connect();
  
  try {
    console.log('连接到数据库成功');
    
    // 检查deleted_records表是否存在
    const { rows: tableExists } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'deleted_records'
      );
    `);
    
    if (!tableExists[0].exists) {
      console.error('错误: deleted_records表不存在');
      return;
    }
    
    console.log('检查deleted_records表的结构...');
    
    // 列出当前的表结构
    const { rows: columns } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'deleted_records'
      ORDER BY ordinal_position;
    `);
    
    console.log('当前表结构:');
    console.table(columns);
    
    // 执行SQL脚本修复表结构
    console.log('读取SQL修复脚本...');
    const sqlFilePath = path.join(__dirname, 'fix-deleted-records-table.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('执行SQL修复脚本...');
    await client.query(sqlContent);
    
    // 再次检查表结构，验证修复效果
    const { rows: updatedColumns } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'deleted_records'
      ORDER BY ordinal_position;
    `);
    
    console.log('修复后的表结构:');
    console.table(updatedColumns);
    
    // 验证API函数是否存在
    const { rows: functions } = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_name IN ('get_deleted_records', 'get_restored_records', 'restore_deleted_record')
      AND routine_type = 'FUNCTION'
    `);
    
    console.log('验证API函数:');
    console.table(functions);
    
    if (functions.length === 3) {
      console.log('✅ API函数已正确创建/更新');
    } else {
      const missingFunctions = ['get_deleted_records', 'get_restored_records', 'restore_deleted_record'].filter(
        fn => !functions.find(row => row.routine_name === fn)
      );
      console.warn(`⚠️ 部分API函数可能未正确创建: ${missingFunctions.join(', ')}`);
    }
    
    console.log('表结构修复完成');
    
  } catch (error) {
    console.error('修复过程中出错:', error);
    throw error;
  } finally {
    // 释放客户端连接
    client.release();
    await pool.end();
  }
}

// 执行修复
fixTable()
  .then(() => {
    console.log('修复完成，数据库连接已关闭');
  })
  .catch(err => {
    console.error('修复过程中发生错误:', err);
    process.exit(1);
  });