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
const SUPABASE_PASSWORD = 'CK50QOdXXutc4IO3';

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

// 构建连接信息
const connectionConfig = {
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
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

// 查询表结构
async function checkTableStructure() {
  try {
    // 测试连接
    const client = await pool.connect();
    console.log('成功连接到Supabase PostgreSQL数据库！');
    
    // 查询construction_teams表结构
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'construction_teams'
      ORDER BY ordinal_position
    `);
    
    console.log('\nconstruction_teams表结构:');
    if (result.rows.length > 0) {
      console.table(result.rows);
    } else {
      console.log('未找到construction_teams表结构');
    }
    
    // 查询construction_teams表中的所有数据
    const dataResult = await client.query(`
      SELECT *
      FROM public.construction_teams
      LIMIT 10
    `);
    
    console.log('\nconstruction_teams表示例数据:');
    if (dataResult.rows.length > 0) {
      console.table(dataResult.rows);
    } else {
      console.log('未找到施工队数据');
    }
    
    client.release();
    console.log('\n查询完成');
    
    // 脚本完成后关闭连接池
    await pool.end();
    
  } catch (err) {
    console.error('查询失败:', err.message);
    try {
      await pool.end();
    } catch (closeErr) {
      console.error('关闭连接池失败:', closeErr.message);
    }
    process.exit(1);
  }
}

checkTableStructure(); 