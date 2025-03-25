import pg from 'pg';
import dotenv from 'dotenv';
import readline from 'readline';
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

// 创建命令行交互界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 测试连接
pool.connect((err, client, done) => {
  if (err) {
    console.error('连接数据库失败:', err.message);
    process.exit(1);
  }
  
  console.log('成功连接到Supabase PostgreSQL数据库');
  console.log('可用的表:');
  
  // 获取可用表列表
  client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name", (err, result) => {
    if (err) {
      console.error('获取表列表失败:', err.message);
    } else {
      result.rows.forEach(row => {
        console.log(`- ${row.table_name}`);
      });
    }
    
    console.log('\n输入SQL查询，输入"exit"退出');
    
    // 释放客户端
    done();
    
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