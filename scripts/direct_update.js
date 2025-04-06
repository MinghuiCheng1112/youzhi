// 直接通过数据库连接更新construction_acceptance_date字段
require('dotenv').config();
const { Pool } = require('pg');

// 从环境变量中获取数据库连接信息
const pool = new Pool({
  host: process.env.SUPABASE_HOST,
  port: process.env.SUPABASE_PORT,
  database: process.env.SUPABASE_DB,
  user: process.env.SUPABASE_USER,
  password: process.env.SUPABASE_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

// 从命令行获取参数
const customerId = process.argv[2]; // 客户ID
const setToNull = process.argv[3] === 'null'; // 是否设置为null

if (!customerId) {
  console.error('请提供客户ID');
  console.log('使用方法: node direct_update.js 客户ID [null]');
  console.log('示例: node direct_update.js 123e4567-e89b-12d3-a456-426614174000');
  console.log('示例: node direct_update.js 123e4567-e89b-12d3-a456-426614174000 null');
  process.exit(1);
}

async function updateConstructionAcceptanceDate() {
  const client = await pool.connect();
  
  try {
    console.log('连接到数据库...');
    
    // 准备SQL语句
    const newValue = setToNull ? null : new Date().toISOString();
    const updateSql = `
      UPDATE customers 
      SET construction_acceptance_date = $1
      WHERE id = $2
      RETURNING id, customer_name, construction_acceptance_date
    `;
    
    // 执行更新
    console.log(`更新客户(${customerId})的建设验收日期为: ${setToNull ? 'null' : newValue}`);
    const result = await client.query(updateSql, [newValue, customerId]);
    
    if (result.rows.length > 0) {
      console.log('更新成功!');
      console.log('更新后的数据:', result.rows[0]);
    } else {
      console.log(`未找到ID为${customerId}的客户`);
    }
  } catch (error) {
    console.error('更新失败:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

updateConstructionAcceptanceDate(); 