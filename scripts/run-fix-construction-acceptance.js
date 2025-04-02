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

async function runFixScript() {
  const client = await pool.connect();
  
  try {
    console.log('连接到数据库成功');
    
    // 读取SQL修复脚本
    const scriptPath = path.join(__dirname, 'fix_construction_acceptance_refs.sql');
    const sqlScript = fs.readFileSync(scriptPath, 'utf8');
    console.log('成功读取修复脚本');
    
    // 开始事务
    await client.query('BEGIN');
    
    // 执行修复脚本
    console.log('执行SQL修复脚本...');
    const result = await client.query(sqlScript);
    console.log('SQL修复脚本执行完成');
    
    // 提交事务
    await client.query('COMMIT');
    
    // 验证修复结果
    console.log('验证修复结果...');
    
    // 1. 检查字段是否被移除
    const { rows: columnsCheck } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      AND column_name = 'construction_acceptance'
    `);
    
    if (columnsCheck.length === 0) {
      console.log('验证通过: construction_acceptance字段已不存在');
    } else {
      console.warn('警告: construction_acceptance字段仍然存在');
    }
    
    // 2. 检查新视图是否创建成功
    const { rows: viewCheck } = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_name = 'vw_construction_acceptance_status'
    `);
    
    if (viewCheck.length > 0) {
      console.log('验证通过: vw_construction_acceptance_status视图已成功创建');
    } else {
      console.warn('警告: vw_construction_acceptance_status视图创建失败');
    }
    
    console.log('所有修复操作已完成!');
  } catch (error) {
    // 如果有错误，回滚事务
    await client.query('ROLLBACK');
    console.error('修复脚本执行失败:', error);
    throw error;
  } finally {
    // 释放客户端连接
    client.release();
    await pool.end();
  }
}

// 执行修复脚本
runFixScript()
  .then(() => {
    console.log('数据库修复完成，连接已关闭');
  })
  .catch(err => {
    console.error('修复过程中发生错误:', err);
    process.exit(1);
  }); 