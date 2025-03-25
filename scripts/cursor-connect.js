import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量，指定从项目根目录加载.env文件
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 从环境变量中获取Supabase连接信息
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PASSWORD = 'CK50QOdXXutc4IO3'; // 用户提供的密码

if (!SUPABASE_URL) {
  console.error('缺少Supabase URL。请确保.env文件中包含VITE_SUPABASE_URL');
  process.exit(1);
}

// 提取项目引用
const match = SUPABASE_URL.match(/https:\/\/(.*?)\.supabase\.co/);
if (!match) {
  console.error('无法从Supabase URL中解析项目信息');
  process.exit(1);
}

const projectRef = match[1];
console.log(`已识别项目引用: ${projectRef}`);

// 构建连接信息 - 使用标准的Supabase连接格式
const connectionConfig = {
  host: `db.${projectRef}.supabase.co`,
  port: 5432, // 注意：Supabase PostgreSQL使用标准端口5432
  database: 'postgres',
  user: 'postgres',
  password: SUPABASE_PASSWORD,
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
    const tablesResult = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('\n可用的公共表:');
    if (tablesResult.rows.length > 0) {
      console.table(tablesResult.rows);
    } else {
      console.log('未找到公共表');
    }
    
    client.release();
    
    console.log('\n您已成功连接到Supabase PostgreSQL数据库！');
    console.log('在Cursor中，您可以：');
    console.log('1. 使用此脚本验证连接');
    console.log('2. 在Cursor的SQL面板中手动执行查询');
    console.log('3. 修改此脚本以执行特定的数据库操作');
    
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