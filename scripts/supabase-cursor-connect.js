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

// 测试连接并执行初始查询
async function testConnection() {
  try {
    // 测试连接
    const client = await pool.connect();
    console.log('成功连接到Supabase PostgreSQL数据库！');
    
    // 执行一些基本查询以验证连接
    const result = await client.query('SELECT current_database() as db, current_user as user, version() as version');
    console.log('\n数据库连接信息:');
    console.table(result.rows);
    
    // 显示公共表
    const tablesResult = await client.query(`
      SELECT 
        table_name,
        (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM 
        information_schema.tables t
      WHERE 
        table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY 
        table_name
    `);
    
    console.log('\n可用的公共表:');
    if (tablesResult.rows.length > 0) {
      console.table(tablesResult.rows);
    } else {
      console.log('未找到公共表');
    }
    
    // 显示视图
    const viewsResult = await client.query(`
      SELECT 
        table_name as view_name
      FROM 
        information_schema.views
      WHERE 
        table_schema = 'public'
      ORDER BY 
        table_name
    `);
    
    if (viewsResult.rows.length > 0) {
      console.log('\n可用的公共视图:');
      console.table(viewsResult.rows);
    }
    
    // 显示RLS策略
    const rlsResult = await client.query(`
      SELECT 
        tablename,
        policyname,
        permissive,
        roles,
        cmd
      FROM 
        pg_policies
      WHERE 
        schemaname = 'public'
      ORDER BY 
        tablename, policyname
    `);
    
    if (rlsResult.rows.length > 0) {
      console.log('\n行级安全策略:');
      console.table(rlsResult.rows);
    }
    
    client.release();
    
    console.log('\n您已成功连接到Supabase PostgreSQL数据库！');
    console.log('在Cursor中，您可以：');
    console.log('1. 执行"node scripts/supabase-cursor-connect.js"验证连接');
    console.log('2. 执行"node scripts/view-db-structure.mjs"查看完整数据库结构');
    console.log('3. 执行"node scripts/run-query.js"运行自定义SQL查询');
    
    // 脚本完成后关闭连接池
    await pool.end();
    
  } catch (err) {
    console.error('连接数据库失败:', err.message);
    try {
      await pool.end();
    } catch (closeErr) {
      console.error('关闭连接池失败:', closeErr.message);
    }
    process.exit(1);
  }
}

testConnection(); 