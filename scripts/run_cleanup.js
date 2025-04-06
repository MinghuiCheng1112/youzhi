// 运行清理废弃字段的SQL脚本
const { Pool } = require('pg');
const { readFileSync } = require('fs');
const { join } = require('path');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 使用单独的数据库连接参数
const pool = new Pool({
  host: process.env.SUPABASE_DB_HOST,
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  port: parseInt(process.env.SUPABASE_DB_PORT || '5432', 10),
  ssl: { rejectUnauthorized: false }
});

async function runCleanupScript() {
  const client = await pool.connect();
  try {
    console.log('开始执行清理废弃字段脚本...');
    
    // 读取SQL脚本
    const sqlFilePath = join(__dirname, 'cleanup_deprecated_fields.sql');
    const sqlScript = readFileSync(sqlFilePath, 'utf8');
    
    // 执行SQL脚本
    await client.query(sqlScript);
    
    console.log('清理废弃字段脚本执行完成');
  } catch (error) {
    console.error('执行清理废弃字段脚本时出错:', error);
    console.error('错误详情:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

runCleanupScript().catch(err => {
  console.error('脚本执行失败:', err);
  console.error('错误堆栈:', err.stack);
  process.exit(1);
}); 