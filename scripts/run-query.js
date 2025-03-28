const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');

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
  console.log('输入SQL查询，输入"exit"退出, 输入"tables"查看表列表');
  
  // 简单的REPL循环
  const promptUser = () => {
    rl.question('SQL> ', async (query) => {
      if (query.toLowerCase() === 'exit') {
        console.log('正在断开连接...');
        await pool.end();
        rl.close();
        return;
      }
      
      if (query.toLowerCase() === 'tables') {
        try {
          const result = await pool.query(`
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
          console.log('可用的表:');
          console.table(result.rows);
        } catch (err) {
          console.error('查询错误:', err.message);
        }
        promptUser();
        return;
      }
      
      if (query.toLowerCase() === 'views') {
        try {
          const result = await pool.query(`
            SELECT 
              table_name as view_name
            FROM 
              information_schema.views
            WHERE 
              table_schema = 'public'
            ORDER BY 
              table_name
          `);
          console.log('可用的视图:');
          console.table(result.rows);
        } catch (err) {
          console.error('查询错误:', err.message);
        }
        promptUser();
        return;
      }

      if (query.toLowerCase().startsWith('describe ') || query.toLowerCase().startsWith('desc ')) {
        const tableName = query.split(' ')[1];
        if (tableName) {
          try {
            const result = await pool.query(`
              SELECT 
                column_name, 
                data_type, 
                is_nullable, 
                column_default
              FROM 
                information_schema.columns 
              WHERE 
                table_schema = 'public' 
                AND table_name = $1
              ORDER BY 
                ordinal_position
            `, [tableName]);
            console.log(`表 "${tableName}" 的结构:`);
            console.table(result.rows);
          } catch (err) {
            console.error('查询错误:', err.message);
          }
        } else {
          console.error('请指定表名，例如: describe customers');
        }
        promptUser();
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