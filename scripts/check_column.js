// 检查特定列是否存在
const { Pool } = require('pg');
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

async function checkColumn() {
  const client = await pool.connect();
  try {
    console.log('检查列是否存在...');
    
    const query = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      AND column_name = 'construction_acceptance_waiting_days';
    `;
    
    const result = await client.query(query);
    
    if (result.rows.length > 0) {
      console.log('列存在:');
      console.table(result.rows);
    } else {
      console.log('列不存在');
    }
    
  } catch (error) {
    console.error('执行查询时出错:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkColumn().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
}); 