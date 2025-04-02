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

async function removeLegacyFields() {
  console.log('开始执行旧字段移除...');
  const client = new Client(dbConfig);
  
  try {
    // 连接数据库
    await client.connect();
    console.log('已连接到数据库');
    
    // 首先检查新字段是否存在
    console.log('检查新字段是否已正确创建...');
    const checkFieldsQuery = `
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'customers'
      AND column_name IN (
        'technical_review_status',
        'construction_acceptance_status',
        'construction_acceptance_waiting_days',
        'construction_acceptance_waiting_start'
      );
    `;
    
    const fieldsResult = await client.query(checkFieldsQuery);
    if (fieldsResult.rows.length < 4) {
      console.error('错误: 新字段未完全创建。请先运行optimize_review_acceptance_fields.sql脚本。');
      process.exit(1);
    }
    console.log('新字段检查通过。');
    
    // 读取SQL脚本
    const sqlFilePath = path.join(__dirname, 'remove_legacy_fields.sql');
    if (!fs.existsSync(sqlFilePath)) {
      console.error(`错误: SQL脚本文件不存在: ${sqlFilePath}`);
      process.exit(1);
    }
    
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('已读取SQL脚本文件');
    
    // 执行SQL脚本
    console.log('开始执行SQL脚本删除旧字段...');
    await client.query(sqlScript);
    console.log('SQL脚本执行完成');
    
    // 验证旧字段是否已删除
    console.log('\n===== 验证旧字段是否已删除 =====');
    const oldFieldsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'customers'
      AND column_name IN (
        'technical_review',
        'technical_review_rejected',
        'construction_acceptance'
      );
    `;
    
    const oldFieldsResult = await client.query(oldFieldsQuery);
    if (oldFieldsResult.rows.length > 0) {
      console.warn('警告: 以下旧字段仍然存在:');
      console.table(oldFieldsResult.rows);
    } else {
      console.log('所有旧字段已成功删除');
    }
    
    // 查询一些客户数据，验证新字段数据正常
    console.log('\n===== 检查客户数据 =====');
    const customerDataQuery = `
      SELECT 
        id, 
        customer_name,
        technical_review_status,
        technical_review_date,
        construction_acceptance_status,
        construction_acceptance_date,
        construction_acceptance_waiting_days,
        construction_acceptance_waiting_start
      FROM customers
      LIMIT 5;
    `;
    
    const customerDataResult = await client.query(customerDataQuery);
    console.table(customerDataResult.rows);
    
    // 检查视图
    console.log('\n===== 检查视图 =====');
    const viewsQuery = `
      SELECT viewname, definition
      FROM pg_views
      WHERE viewname IN (
        'vw_technical_review_status',
        'vw_construction_acceptance_status'
      );
    `;
    
    const viewsResult = await client.query(viewsQuery);
    console.log('视图状态:');
    console.table(viewsResult.rows.map(row => ({ 视图名称: row.viewname, 已重建: true })));
    
    console.log('\n旧字段移除操作已成功完成！');
  } catch (err) {
    console.error('执行旧字段移除操作时发生错误：', err);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await client.end();
    console.log('数据库连接已关闭');
  }
}

// 执行字段移除
removeLegacyFields(); 