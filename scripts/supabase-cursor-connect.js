const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const { Pool } = pg;

// 加载环境变量，指定从项目根目录加载.env文件
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 从环境变量中获取Supabase连接信息
const SUPABASE_DB_HOST = process.env.SUPABASE_DB_HOST;
const SUPABASE_DB = process.env.SUPABASE_DB || 'postgres';
const SUPABASE_DB_USER = process.env.SUPABASE_DB_USER || 'postgres';
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const SUPABASE_DB_PORT = process.env.SUPABASE_DB_PORT || 5432;

// 验证必要的环境变量是否存在
if (!SUPABASE_DB_HOST || !SUPABASE_DB_PASSWORD) {
  console.error('缺少Supabase数据库连接信息。请确保.env文件中包含必要的环境变量：');
  console.error('SUPABASE_DB_HOST, SUPABASE_DB_PASSWORD');
  process.exit(1);
}

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

async function testConnection() {
  let client;
  try {
    client = await pool.connect();
    console.log('成功连接到Supabase PostgreSQL数据库！');
    
    // 获取数据库信息
    const dbInfo = await client.query(`
      SELECT current_database() as db, 
             current_user as user, 
             version() as version
    `);
    console.log('\n数据库连接信息:');
    console.table(dbInfo.rows);
    
    // 获取可用表信息
    const tablesInfo = await client.query(`
      SELECT table_name, COUNT(column_name)::text as column_count
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY table_name
      ORDER BY table_name
    `);
    console.log('\n可用的公共表:');
    console.table(tablesInfo.rows);
    
    // 获取可用视图信息
    const viewsInfo = await client.query(`
      SELECT table_name as view_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('\n可用的公共视图:');
    console.table(viewsInfo.rows);
    
    // 获取行级安全策略信息
    const rls = await client.query(`
      SELECT tablename, policyname, permissive, roles, cmd
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);
    console.log('\n行级安全策略:');
    console.table(rls.rows);
    
    // 查询customers表数据
    console.log('\n查询customers表最新10条数据:');
    const customersData = await client.query(`
      SELECT id, customer_name, phone, address, register_date
      FROM customers
      ORDER BY register_date DESC
      LIMIT 10
    `);
    console.table(customersData.rows);
    
    console.log('\n您已成功连接到Supabase PostgreSQL数据库！');
    console.log('在Cursor中，您可以：');
    console.log('1. 执行"node scripts/supabase-cursor-connect.js"验证连接');
    console.log('2. 执行"node scripts/view-db-structure.mjs"查看完整数据库结构');
    console.log('3. 执行"node scripts/run-query.js"运行自定义SQL查询');
    
  } catch (err) {
    console.error('连接或查询出错:', err);
  } finally {
    if (client) {
      client.release();
    }
  }
}

process.on('SIGINT', async () => {
  console.log('正在关闭连接池...');
  await pool.end();
  console.log('连接池已关闭');
  process.exit(0);
});

// 执行测试连接
testConnection(); 