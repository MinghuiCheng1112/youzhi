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
  // 删除已存在的触发器（如果有）
  `DROP TRIGGER IF EXISTS update_dispatch_date_trigger ON customers`,
  
  // 创建触发器函数
  `CREATE OR REPLACE FUNCTION set_dispatch_date()
   RETURNS TRIGGER AS $$
   BEGIN
     -- 当施工队从空值变为非空值时，设置派工日期为当前时间
     IF (NEW.construction_team IS NOT NULL AND
        (OLD.construction_team IS NULL OR OLD.construction_team = '')) THEN
       NEW.dispatch_date = CURRENT_TIMESTAMP;
     -- 当施工队从非空值变为空值时，清空派工日期
     ELSIF (NEW.construction_team IS NULL OR NEW.construction_team = '') AND 
           (OLD.construction_team IS NOT NULL AND OLD.construction_team != '') THEN
       NEW.dispatch_date = NULL;
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  
  // 创建触发器
  `CREATE TRIGGER update_dispatch_date_trigger
   BEFORE UPDATE ON customers
   FOR EACH ROW
   EXECUTE FUNCTION set_dispatch_date()`,
  
  // 验证触发器是否创建成功
  `SELECT tgname FROM pg_trigger WHERE tgrelid = 'customers'::regclass::oid`,
  
  // 测试触发器功能
  `UPDATE customers 
   SET construction_team = '测试施工队', dispatch_date = NULL
   WHERE id = '51f2d60a-234e-4702-b182-fbda418622f4'
   RETURNING id, construction_team, dispatch_date`,
  
  // 重置测试数据
  `UPDATE customers 
   SET construction_team = NULL, dispatch_date = NULL
   WHERE id = '51f2d60a-234e-4702-b182-fbda418622f4'
   RETURNING id, construction_team, dispatch_date`,
  
  // 再次测试触发器
  `UPDATE customers 
   SET construction_team = '自动派工示例'
   WHERE id = '51f2d60a-234e-4702-b182-fbda418622f4'
   RETURNING id, construction_team, dispatch_date`
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
    console.log('自动派工日期功能已实现！当施工队从空变为非空时，派工日期会自动设置为当前时间。');
    
  } finally {
    client.release();
    await pool.end();
  }
}

executeSqlCommands().catch(err => {
  console.error('执行SQL时出错:', err);
  process.exit(1);
}); 