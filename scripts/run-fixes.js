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

async function runFixScripts() {
  console.log('开始执行修复脚本...');
  const client = new Client(dbConfig);
  
  try {
    // 连接数据库
    await client.connect();
    console.log('已连接到数据库');
    
    // 执行schema缓存修复脚本
    console.log('\n===== 执行schema缓存修复脚本 =====');
    const schemaCacheFixPath = path.join(__dirname, 'fix_schema_cache.sql');
    const schemaCacheFixScript = fs.readFileSync(schemaCacheFixPath, 'utf8');
    await client.query(schemaCacheFixScript);
    console.log('Schema缓存修复完成');
    
    // 执行图纸变更默认值修复脚本
    console.log('\n===== 执行图纸变更默认值修复脚本 =====');
    const drawingChangeFixPath = path.join(__dirname, 'fix_drawing_change_default.sql');
    const drawingChangeFixScript = fs.readFileSync(drawingChangeFixPath, 'utf8');
    const drawingChangeResult = await client.query(drawingChangeFixScript);
    
    // 过滤并显示NOTICE信息
    const notices = drawingChangeResult
      .filter(r => r.command === 'NOTICE')
      .map(r => r.message);
      
    if (notices.length > 0) {
      console.log('脚本执行结果信息:');
      console.log(notices.join('\n'));
    }
    
    console.log('图纸变更默认值修复完成');
    
    // 验证修复结果
    console.log('\n===== 验证修复结果 =====');
    
    // 检查视图是否存在
    const viewCheckQuery = `
      SELECT viewname 
      FROM pg_views 
      WHERE viewname = 'vw_construction_acceptance_status';
    `;
    const viewCheckResult = await client.query(viewCheckQuery);
    console.log(`视图状态: vw_construction_acceptance_status ${viewCheckResult.rowCount > 0 ? '存在' : '不存在'}`);
    
    // 检查drawing_change默认值
    const defaultCheckQuery = `
      SELECT column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'customers' 
      AND column_name = 'drawing_change';
    `;
    const defaultCheckResult = await client.query(defaultCheckQuery);
    if (defaultCheckResult.rowCount > 0) {
      console.log(`图纸变更字段默认值: ${defaultCheckResult.rows[0].column_default}`);
    }
    
    console.log('\n所有修复脚本执行完成!');
    
  } catch (err) {
    console.error('执行修复脚本时发生错误：', err);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await client.end();
    console.log('数据库连接已关闭');
  }
}

// 执行修复脚本
runFixScripts(); 