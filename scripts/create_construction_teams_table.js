// @ts-check
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载.env文件
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

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

// 要执行的SQL命令
const sqlCommands = [
  // 创建施工队表
  `CREATE TABLE IF NOT EXISTS construction_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    phone TEXT,
    address TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  )`,
  
  // 创建施工队表更新触发器
  `CREATE OR REPLACE FUNCTION update_construction_team_timestamp()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = now();
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  
  `DROP TRIGGER IF EXISTS update_construction_team_timestamp ON construction_teams`,
  
  `CREATE TRIGGER update_construction_team_timestamp
   BEFORE UPDATE ON construction_teams
   FOR EACH ROW
   EXECUTE FUNCTION update_construction_team_timestamp()`,
  
  // 创建触发器，当施工队信息更新时自动更新关联客户的施工队电话
  `CREATE OR REPLACE FUNCTION update_customer_team_phone()
   RETURNS TRIGGER AS $$
   BEGIN
     -- 当施工队电话更新时，更新所有关联客户的施工队电话
     IF NEW.phone IS DISTINCT FROM OLD.phone THEN
       UPDATE customers 
       SET construction_team_phone = NEW.phone,
           updated_at = now()
       WHERE construction_team = NEW.name;
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  
  `DROP TRIGGER IF EXISTS update_customer_team_phone_trigger ON construction_teams`,
  
  `CREATE TRIGGER update_customer_team_phone_trigger
   AFTER UPDATE ON construction_teams
   FOR EACH ROW
   EXECUTE FUNCTION update_customer_team_phone()`,
  
  // 创建触发器，当为客户选择施工队时自动填充施工队电话
  `CREATE OR REPLACE FUNCTION auto_fill_team_phone()
   RETURNS TRIGGER AS $$
   BEGIN
     -- 只在施工队字段发生变化时执行
     IF NEW.construction_team IS DISTINCT FROM OLD.construction_team THEN
       -- 如果施工队不为空，查找对应电话并设置
       IF NEW.construction_team IS NOT NULL AND NEW.construction_team != '' THEN
         SELECT phone INTO NEW.construction_team_phone
         FROM construction_teams
         WHERE name = NEW.construction_team;
       -- 如果施工队为空，也清空电话
       ELSE
         NEW.construction_team_phone = NULL;
       END IF;
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  
  `DROP TRIGGER IF EXISTS auto_fill_team_phone_trigger ON customers`,
  
  `CREATE TRIGGER auto_fill_team_phone_trigger
   BEFORE UPDATE ON customers
   FOR EACH ROW
   EXECUTE FUNCTION auto_fill_team_phone()`,
  
  // 插入示例数据
  `INSERT INTO construction_teams (name, phone, address)
   VALUES 
   ('北城施工队', '13800138001', '北城区域'),
   ('南城施工队', '13800138002', '南城区域'),
   ('东城施工队', '13800138003', '东城区域'),
   ('西城施工队', '13800138004', '西城区域'),
   ('中心施工队', '13800138005', '中心区域')
   ON CONFLICT (name) DO UPDATE 
   SET phone = EXCLUDED.phone,
       address = EXCLUDED.address,
       updated_at = now()`
];

// 执行SQL命令
async function executeSqlCommands() {
  const client = await pool.connect();
  try {
    console.log('成功连接到数据库，开始执行SQL命令...\n');
    
    for (let i = 0; i < sqlCommands.length; i++) {
      const cmd = sqlCommands[i];
      console.log(`执行SQL命令 ${i + 1}/${sqlCommands.length}:`);
      console.log('-------------------------------------------');
      console.log(cmd);
      console.log('-------------------------------------------');
      
      try {
        const result = await client.query(cmd);
        if (result.rows && result.rows.length > 0) {
          console.log('查询结果:');
          console.table(result.rows);
        } else {
          console.log('命令执行成功，无返回数据');
        }
      } catch (err) {
        console.error('执行命令失败:', err.message);
      }
      
      console.log('\n');
    }
    
    console.log('所有SQL命令执行完毕');
    console.log('施工队管理功能已实现！可以通过选择施工队自动关联电话信息。');
    
  } finally {
    client.release();
    await pool.end();
  }
}

executeSqlCommands().catch(err => {
  console.error('执行SQL时出错:', err);
  process.exit(1);
}); 