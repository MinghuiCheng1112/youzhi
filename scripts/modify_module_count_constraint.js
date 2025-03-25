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

// 执行修改约束的函数
async function modifyModuleCountConstraint() {
  const client = await pool.connect();
  
  try {
    console.log('正在检查module_count列的当前约束...');
    
    // 首先检查列的当前约束
    const checkResult = await client.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'module_count'
    `);
    
    if (checkResult.rows.length === 0) {
      console.error('找不到customers表中的module_count列');
      return;
    }
    
    const column = checkResult.rows[0];
    console.log('当前列信息:', column);
    
    // 如果已经允许为NULL，则不需要修改
    if (column.is_nullable === 'YES') {
      console.log('module_count列已经允许为NULL值，无需修改');
      return;
    }
    
    console.log('正在修改module_count列约束，设置为允许NULL值...');
    
    // 执行ALTER TABLE语句修改约束
    await client.query(`
      ALTER TABLE customers ALTER COLUMN module_count DROP NOT NULL;
    `);
    
    console.log('成功修改module_count列约束！现在允许为NULL值');
    
    // 验证修改
    const verifyResult = await client.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'module_count'
    `);
    
    console.log('修改后的列信息:', verifyResult.rows[0]);
    
  } catch (err) {
    console.error('修改约束时出错:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行函数
modifyModuleCountConstraint(); 