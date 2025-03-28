const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

const { Pool } = pg;

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 从环境变量中获取Supabase连接信息
const SUPABASE_DB_HOST = process.env.SUPABASE_DB_HOST;
const SUPABASE_DB = process.env.SUPABASE_DB || 'postgres';
const SUPABASE_DB_USER = process.env.SUPABASE_DB_USER || 'postgres.rkkkicdabwqtjzsoaxty';
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const SUPABASE_DB_PORT = process.env.SUPABASE_DB_PORT || 6543;

// 构建连接信息
const connectionConfig = {
  host: SUPABASE_DB_HOST,
  port: SUPABASE_DB_PORT,
  database: SUPABASE_DB,
  user: SUPABASE_DB_USER,
  password: SUPABASE_DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

console.log('正在连接到:', `postgresql://${connectionConfig.user}:****@${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`);

// 创建连接池
const pool = new Pool(connectionConfig);

// 查看特定表的结构
async function checkTableStructure() {
  try {
    const client = await pool.connect();
    console.log('成功连接到Supabase PostgreSQL数据库！');
    
    // 查询customers表结构
    const columnsQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default
      FROM 
        information_schema.columns 
      WHERE 
        table_schema = 'public' 
        AND table_name = 'customers'
      ORDER BY 
        ordinal_position
    `;
    
    const columnsResult = await client.query(columnsQuery);
    console.log('\ncustomers表结构:');
    console.table(columnsResult.rows);
    
    // 查看施工状态字段的详细信息
    const constructionStatusQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default,
        character_maximum_length
      FROM 
        information_schema.columns 
      WHERE 
        table_schema = 'public' 
        AND table_name = 'customers'
        AND column_name = 'construction_status'
    `;
    
    const statusResult = await client.query(constructionStatusQuery);
    console.log('\n施工状态字段信息:');
    console.table(statusResult.rows);
    
    // 检查施工状态使用情况
    const statusUsageQuery = `
      SELECT 
        construction_status, 
        COUNT(*) as count
      FROM 
        customers
      WHERE 
        construction_status IS NOT NULL
      GROUP BY 
        construction_status
      ORDER BY 
        count DESC
    `;
    
    const usageResult = await client.query(statusUsageQuery);
    console.log('\n施工状态使用情况:');
    console.table(usageResult.rows);
    
    // 检查最近更新失败的记录
    const recentFailuresQuery = `
      SELECT 
        id, 
        customer_name, 
        updated_at, 
        construction_status
      FROM 
        customers
      ORDER BY 
        updated_at DESC
      LIMIT 5
    `;
    
    const recentResult = await client.query(recentFailuresQuery);
    console.log('\n最近更新的记录:');
    console.table(recentResult.rows);
    
    client.release();
    await pool.end();
    
  } catch (err) {
    console.error('数据库操作失败:', err.message);
    try {
      await pool.end();
    } catch (closeErr) {
      console.error('关闭连接池失败:', closeErr.message);
    }
    process.exit(1);
  }
}

checkTableStructure(); 