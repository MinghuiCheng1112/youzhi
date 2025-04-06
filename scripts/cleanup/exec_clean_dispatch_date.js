/**
 * 执行SQL脚本清理派工日期与施工队关联
 * 
 * 此脚本用于执行SQL文件中的命令，确保当施工队为空时派工日期也为空
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 创建数据库连接
const pool = new Pool({
  host: process.env.SUPABASE_DB_HOST,
  port: process.env.SUPABASE_DB_PORT,
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

// 要执行的SQL文件路径
const sqlFilePath = path.join(__dirname, 'clean_customer_dispatch_date.sql');

async function executeScript() {
  let client;
  try {
    // 读取SQL文件内容
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('准备执行以下SQL:');
    console.log('-------------------------------');
    console.log(sqlContent);
    console.log('-------------------------------');

    // 获取客户端连接
    client = await pool.connect();
    
    // 执行SQL命令
    console.log('开始执行SQL命令...');
    const result = await client.query(sqlContent);
    console.log('SQL执行完成!');
    
    // 输出执行结果
    if (result && result.rows && result.rows.length > 0) {
      console.log('执行结果:');
      console.table(result.rows);
    }
    
    console.log('派工日期与施工队关联清理脚本执行完成。');
  } catch (error) {
    console.error('执行SQL脚本时出错:', error);
  } finally {
    // 确保释放客户端
    if (client) {
      client.release();
    }
    
    // 关闭连接池
    await pool.end();
  }
}

// 执行脚本
executeScript()
  .then(() => console.log('脚本完成'))
  .catch(err => console.error('脚本错误:', err)); 