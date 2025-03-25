// 执行添加踏勘员字段的SQL脚本
const fs = require('fs');
const { Client } = require('pg');

// 从.env文件读取配置
require('dotenv').config();

// 读取SQL文件内容
const sqlContent = fs.readFileSync('./scripts/add_surveyor_columns.sql', 'utf8');

// Supabase数据库连接配置
const dbConfig = {
  host: 'db.rkkkicdabwqtjzsoaxty.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '6npns5PuooEPzSCg',
  ssl: {
    rejectUnauthorized: false // 允许自签名证书，生产环境中应更改
  }
};

// 创建数据库客户端
const client = new Client(dbConfig);

async function executeSQL() {
  try {
    console.log('正在连接到Supabase数据库...');
    await client.connect();
    
    console.log('连接成功，执行SQL脚本...');
    console.log('SQL脚本内容:', sqlContent);
    
    await client.query(sqlContent);
    
    console.log('SQL脚本执行成功！');
    console.log('已添加surveyor和surveyor_phone列到customers表');
    
  } catch (error) {
    console.error('执行SQL脚本时出错:', error);
  } finally {
    // 关闭数据库连接
    await client.end();
    console.log('数据库连接已关闭');
  }
}

// 执行脚本
executeSQL().catch(error => {
  console.error('脚本执行过程中发生错误:', error);
  process.exit(1);
}); 