// 连接到数据库并添加客户姓名和电话的唯一性约束
require('dotenv').config();
const { Pool } = require('pg');

// 获取Supabase项目引用
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PASSWORD = 'CK50QOdXXutc4IO3'; // 正确的密码

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

// 创建数据库连接池
const pool = new Pool({
  host: `db.${projectRef}.supabase.co`,
  database: 'postgres',
  user: 'postgres',
  password: SUPABASE_PASSWORD,
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

console.log('数据库连接信息:');
console.log(`- 主机: db.${projectRef}.supabase.co`);
console.log(`- 数据库: postgres`);
console.log(`- 用户: postgres`);
console.log(`- 端口: 5432`);
console.log('正在连接到数据库...');

// 要执行的SQL命令
const sqlCommands = [
  // 1. 检查是否已存在约束
  `SELECT con.conname, pg_get_constraintdef(con.oid)
   FROM pg_constraint con
   JOIN pg_class rel ON rel.oid = con.conrelid
   JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
   WHERE rel.relname = 'customers'
   AND nsp.nspname = 'public'
   AND pg_get_constraintdef(con.oid) LIKE '%customer_name%' AND pg_get_constraintdef(con.oid) LIKE '%phone%'`,

  // 2. 添加唯一性约束
  `ALTER TABLE customers 
   ADD CONSTRAINT customers_name_phone_unique UNIQUE (customer_name, phone)`,

  // 3. 检查是否创建成功
  `SELECT con.conname, pg_get_constraintdef(con.oid)
   FROM pg_constraint con
   JOIN pg_class rel ON rel.oid = con.conrelid
   JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
   WHERE rel.relname = 'customers'
   AND nsp.nspname = 'public'
   AND con.conname = 'customers_name_phone_unique'`
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
          
          // 如果第一个命令返回结果，说明约束已存在，则跳过第二个命令
          if (i === 0 && result.rows.length > 0) {
            console.log('注意: 约束已存在，跳过添加约束的操作');
            i = 1; // 跳过下一个命令
          }
        } else {
          console.log('命令执行成功，无返回数据');
        }
      } catch (err) {
        console.error('执行命令失败:', err.message);
      }
      
      console.log('\n');
    }
    
    console.log('所有SQL命令执行完毕');
    console.log('客户姓名和电话的唯一性约束已添加!');
    
  } finally {
    client.release();
    await pool.end();
  }
}

executeSqlCommands().catch(err => {
  console.error('执行SQL时出错:', err);
  process.exit(1);
}); 