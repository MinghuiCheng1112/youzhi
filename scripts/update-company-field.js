/**
 * 更新customers表中company字段的约束
 * 允许使用中文名称"昊尘"和"祐之"
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 验证必要的环境变量
const requiredEnvVars = [
  'SUPABASE_DB_HOST',
  'SUPABASE_DB_PORT',
  'SUPABASE_DB_NAME',
  'SUPABASE_DB_USER',
  'SUPABASE_DB_PASSWORD'
];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`错误: 缺少环境变量 ${varName}`);
    process.exit(1);
  }
}

// 数据库连接配置
const connectionConfig = {
  host: process.env.SUPABASE_DB_HOST,
  port: process.env.SUPABASE_DB_PORT || 5432,
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

console.log('数据库连接配置:');
console.log({
  host: connectionConfig.host,
  port: connectionConfig.port,
  database: connectionConfig.database,
  user: connectionConfig.user,
  password: '******' // 隐藏密码
});

// 创建连接池
const pool = new Pool(connectionConfig);

async function updateCompanyFieldConstraint() {
  const client = await pool.connect();
  try {
    // 开始事务
    await client.query('BEGIN');
    
    console.log('成功连接到数据库');
    
    // 读取SQL脚本
    const sqlFilePath = path.join(__dirname, 'update_company_field.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('执行SQL脚本...');
    
    // 执行SQL脚本
    const result = await client.query(sqlScript);
    
    // 输出结果
    if (result && Array.isArray(result)) {
      // 如果结果是数组（多个查询结果）
      result.forEach((res, index) => {
        if (res.rows && res.rows.length > 0) {
          console.log(`查询 ${index + 1} 结果:`, res.rows);
        }
      });
    } else if (result && result.rows) {
      // 如果是单个查询结果
      console.log('查询结果:', result.rows);
    }
    
    // 提交事务
    await client.query('COMMIT');
    console.log('成功更新company字段约束，现在允许使用中文名称"昊尘"和"祐之"');
    
  } catch (error) {
    // 出错时回滚事务
    await client.query('ROLLBACK');
    console.error('执行SQL脚本时出错:', error);
    process.exit(1);
  } finally {
    // 释放客户端
    client.release();
    // 关闭连接池
    await pool.end();
  }
}

// 执行更新
updateCompanyFieldConstraint().catch(err => {
  console.error('更新过程中发生错误:', err);
  process.exit(1);
}); 