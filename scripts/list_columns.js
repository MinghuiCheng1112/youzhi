// 列出customers表的所有列
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

async function listColumns() {
  const client = await pool.connect();
  try {
    console.log('获取customers表的列信息...');
    
    const query = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      ORDER BY ordinal_position;
    `;
    
    const result = await client.query(query);
    
    console.log('customers表的列:');
    console.table(result.rows);
    
  } catch (error) {
    console.error('执行查询时出错:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

listColumns().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
}); 