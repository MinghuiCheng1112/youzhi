/**
 * 向deleted_records表添加恢复日期字段
 * 并更新restore_deleted_record函数记录恢复日期
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// 检查环境变量
const requiredEnvVars = [
  'SUPABASE_DB_HOST',
  'SUPABASE_DB_PORT',
  'SUPABASE_DB_NAME',
  'SUPABASE_DB_USER',
  'SUPABASE_DB_PASSWORD',
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('缺少以下环境变量：', missingEnvVars.join(', '));
  process.exit(1);
}

// 数据库连接配置
const dbConfig = {
  host: process.env.SUPABASE_DB_HOST,
  port: process.env.SUPABASE_DB_PORT,
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

async function addRestoredDateColumn() {
  console.log('开始添加恢复日期列...');
  const client = new Client(dbConfig);
  
  try {
    // 连接数据库
    await client.connect();
    console.log('已连接到数据库');
    
    // 读取SQL脚本文件
    const sqlFilePath = path.join(__dirname, 'add_restored_date_column.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('已读取SQL脚本文件');
    
    // 开始事务
    await client.query('BEGIN');
    console.log('开始事务');
    
    // 执行SQL脚本
    try {
      await client.query(sqlScript);
      console.log('SQL脚本执行成功');
      
      // 提交事务
      await client.query('COMMIT');
      console.log('事务已提交');
    } catch (err) {
      // 回滚事务
      await client.query('ROLLBACK');
      console.error('SQL脚本执行失败，事务已回滚');
      throw err;
    }
    
    console.log('恢复日期列已添加成功！');
  } catch (err) {
    console.error('添加恢复日期列时发生错误：', err);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await client.end();
    console.log('数据库连接已关闭');
  }
}

// 执行主函数
addRestoredDateColumn().catch(err => {
  console.error('执行脚本时发生错误：', err);
  process.exit(1);
}); 