/**
 * 执行SQL脚本确保施工队与派工日期关联
 * 
 * 此脚本用于执行SQL文件中的命令，维护施工队与派工日期的数据一致性
 */

require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');

// 连接数据库
const client = new Client({
  host: process.env.SUPABASE_HOST,
  port: process.env.SUPABASE_PORT,
  database: process.env.SUPABASE_DATABASE,
  user: process.env.SUPABASE_USER,
  password: process.env.SUPABASE_PASSWORD,
  // 禁用SSL，解决SSL连接问题
  ssl: false
});

async function executeScript() {
  try {
    await client.connect();
    console.log('已连接到数据库');

    // 读取SQL文件
    const sqlScript = fs.readFileSync('./scripts/cleanup/ensure_dispatch_date.sql', 'utf8');
    console.log('SQL脚本已加载');

    // 执行SQL脚本
    const result = await client.query(sqlScript);
    console.log('SQL脚本执行成功');
    
    // 显示最后一个查询的结果（成功消息）
    if (result.length && result[result.length - 1].rows) {
      console.log('结果:', result[result.length - 1].rows[0]);
    }

    console.log('操作完成: 施工队与派工日期数据一致性已建立');
  } catch (error) {
    console.error('执行脚本时出错:', error);
  } finally {
    await client.end();
    console.log('数据库连接已关闭');
  }
}

executeScript(); 