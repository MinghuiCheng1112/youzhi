require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

// 从环境变量中获取数据库连接信息
const pool = new Pool({
  host: process.env.SUPABASE_HOST,
  port: process.env.SUPABASE_PORT,
  database: process.env.SUPABASE_DB,
  user: process.env.SUPABASE_USER,
  password: process.env.SUPABASE_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

// 建立连接
async function execSQL() {
  let client;

  try {
    console.log('正在连接Supabase数据库...');
    console.log(`使用连接信息: ${process.env.SUPABASE_HOST}:${process.env.SUPABASE_PORT} - ${process.env.SUPABASE_DB}`);
    
    // 获取脚本文件路径
    const scriptPath = process.argv[2];
    if (!scriptPath) {
      throw new Error('未提供SQL脚本文件路径。使用方法: node exec_sql.js 脚本路径.sql');
    }
    
    console.log(`读取SQL文件: ${process.cwd()}\\${scriptPath}`);
    
    // 读取SQL脚本内容
    const sqlContent = fs.readFileSync(scriptPath, { encoding: 'utf8' });
    
    // 建立连接
    client = await pool.connect();
    
    // 执行SQL
    const result = await client.query(sqlContent);
    console.log('SQL脚本执行成功!');
    
    // 输出结果
    if (result.rows && result.rows.length > 0) {
      console.log('执行结果:');
      console.table(result.rows);
    } else if (result.length > 0) {
      // 处理多结果集
      result.forEach((r, i) => {
        if (r.rows && r.rows.length > 0) {
          console.log(`结果集 ${i+1}:`);
          console.table(r.rows);
        }
      });
    }
    
  } catch (err) {
    console.error('执行SQL时出错:', err);
  } finally {
    if (client) {
      client.release();
    }
    console.log('数据库连接已关闭');
    pool.end();
  }
}

execSQL(); 