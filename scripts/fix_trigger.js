import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

// 加载环境变量
dotenv.config();

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
  // 1. 检查触发器函数
  `SELECT 
     proname, prosrc
   FROM 
     pg_proc
   WHERE 
     prosrc LIKE '%outbound_date%'`,

  // 2. 查看record_customer_changes函数的源码
  `SELECT 
     proname, prosrc
   FROM 
     pg_proc
   WHERE 
     proname = 'record_customer_changes'`,

  // 3. 修改record_customer_changes函数
  `CREATE OR REPLACE FUNCTION record_customer_changes()
   RETURNS TRIGGER AS $$
   BEGIN
     -- 记录客户修改记录
     IF TG_OP = 'UPDATE' THEN
       INSERT INTO modification_records (
         customer_id, 
         change_type, 
         changed_fields, 
         old_values, 
         new_values, 
         changed_by
       )
       VALUES (
         NEW.id,
         'UPDATE',
         (SELECT array_agg(key) FROM jsonb_each(row_to_json(NEW)::jsonb - row_to_json(OLD)::jsonb)),
         row_to_json(OLD),
         row_to_json(NEW),
         auth.uid()
       );
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,

  // 4. 测试更新函数
  `SELECT update_square_steel_outbound('51f2d60a-234e-4702-b182-fbda418622f4')`,
  
  // 5. 测试方钢出库
  `SELECT update_component_outbound('51f2d60a-234e-4702-b182-fbda418622f4')`,

  // 6. 验证更新结果
  `SELECT id, square_steel_outbound, square_steel_outbound_date, 
         component_outbound, component_outbound_date
   FROM customers
   WHERE id = '51f2d60a-234e-4702-b182-fbda418622f4'`
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
    
  } finally {
    client.release();
    await pool.end();
  }
}

executeSqlCommands().catch(err => {
  console.error('执行SQL时出错:', err);
  process.exit(1);
}); 