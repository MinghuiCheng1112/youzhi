require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// 数据库连接配置
const dbConfig = {
  host: process.env.SUPABASE_DB_HOST,
  port: process.env.SUPABASE_DB_PORT,
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

// 验证环境变量
const requiredEnvVars = [
  'SUPABASE_DB_HOST',
  'SUPABASE_DB_PORT',
  'SUPABASE_DB_NAME',
  'SUPABASE_DB_USER',
  'SUPABASE_DB_PASSWORD'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`错误: 环境变量 ${envVar} 未设置。请确保.env文件包含所有必需的环境变量。`);
    process.exit(1);
  }
}

async function cleanFilingDate() {
  console.log('开始清理备案日期字段...');
  const client = new Client(dbConfig);
  
  try {
    // 连接数据库
    await client.connect();
    console.log('已连接到数据库');
    
    // 读取SQL脚本
    const sqlFilePath = path.join(__dirname, 'clean_filing_date.sql');
    if (!fs.existsSync(sqlFilePath)) {
      console.error(`错误: SQL脚本文件不存在: ${sqlFilePath}`);
      process.exit(1);
    }
    
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('已读取SQL脚本文件');
    
    // 执行SQL脚本
    console.log('开始执行SQL脚本...');
    const result = await client.query(sqlScript);
    console.log('SQL脚本执行完成');
    
    // 显示更新结果
    const lastResult = result[result.length - 3]; // SQL脚本中最后一个SELECT语句的结果
    console.log('\n===== 更新后的备案日期示例 =====');
    console.table(lastResult.rows);
    
    // 查询更新的记录数
    const countQuery = `
      SELECT COUNT(*) as updated_count
      FROM customers
      WHERE filing_date IS NOT NULL;
    `;
    
    const countResult = await client.query(countQuery);
    console.log(`\n总共有 ${countResult.rows[0].updated_count} 条记录的备案日期`);
    
    console.log('\n备案日期字段清理完成！时间部分已被移除');
  } catch (err) {
    console.error('执行备案日期清理时发生错误：', err);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await client.end();
    console.log('数据库连接已关闭');
  }
}

// 执行清理
cleanFilingDate(); 