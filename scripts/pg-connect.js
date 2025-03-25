import pg from 'pg';
import dotenv from 'dotenv';
import readline from 'readline';

const { Pool } = pg;

// 加载环境变量
dotenv.config();

// 从环境变量或Supabase连接信息中获取
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.error('缺少Supabase URL。请确保.env文件中包含VITE_SUPABASE_URL');
  process.exit(1);
}

// 提取主机和项目引用
const match = SUPABASE_URL.match(/https:\/\/(.*?)\./);
if (!match) {
  console.error('无法从Supabase URL中解析项目信息');
  process.exit(1);
}

const projectRef = match[1];
console.log(`已识别项目引用: ${projectRef}`);

// 根据Supabase项目引用构建连接信息
// Supabase连接字符串通常格式为：postgresql://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.co:6543/postgres
const connectionConfig = {
  host: `aws-0-${projectRef}.pooler.supabase.co`, // 动态生成区域信息
  port: 6543,
  database: 'postgres',
  user: `postgres.${projectRef}`,
  password: '', // 需要用户填写数据库密码
  ssl: {
    rejectUnauthorized: false
  }
};

// 创建命令行交互界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 请求用户输入密码
rl.question('请输入Supabase PostgreSQL数据库密码: ', (password) => {
  connectionConfig.password = password;
  
  console.log('尝试连接到:', `postgresql://${connectionConfig.user}:****@${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`);
  
  // 创建连接池
  const pool = new Pool(connectionConfig);

  // 测试连接
  pool.connect((err, client, done) => {
    if (err) {
      console.error('连接数据库失败:', err.message);
      process.exit(1);
    }
    
    console.log('成功连接到Supabase PostgreSQL数据库');
    console.log('输入SQL查询，输入"exit"退出');
    
    // 简单的REPL循环
    const promptUser = () => {
      rl.question('SQL> ', async (query) => {
        if (query.toLowerCase() === 'exit') {
          console.log('正在断开连接...');
          await pool.end();
          rl.close();
          return;
        }

        try {
          const result = await pool.query(query);
          console.log('查询结果:');
          console.table(result.rows);
          console.log(`受影响的行数: ${result.rowCount}`);
        } catch (err) {
          console.error('查询错误:', err.message);
        }

        promptUser();
      });
    };

    promptUser();
  });
});