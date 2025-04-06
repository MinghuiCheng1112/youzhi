/**
 * 执行施工队与派工日期关联触发器脚本
 * 此脚本连接数据库并执行SQL文件中的命令，确保施工队与派工日期的数据一致性
 */

require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');
const path = require('path');

// 连接数据库
const client = new Client({
  host: process.env.SUPABASE_HOST,
  port: process.env.SUPABASE_PORT,
  database: process.env.SUPABASE_DATABASE,
  user: process.env.SUPABASE_USER,
  password: process.env.SUPABASE_PASSWORD,
  ssl: false // 禁用SSL
});

async function executeScript() {
  try {
    console.log('正在连接数据库...');
    await client.connect();
    console.log('已连接到数据库');

    // 读取SQL文件
    const sqlFilePath = path.join(__dirname, 'deploy_dispatch_date_consistency_trigger.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('SQL脚本已加载');
    console.log('执行SQL脚本...');

    // 执行SQL脚本
    const result = await client.query(sqlScript);
    console.log('SQL脚本执行成功');
    
    // 显示最后一个查询的结果（成功消息）
    if (Array.isArray(result) && result.length > 0 && result[result.length - 1].rows) {
      console.log('执行结果:', result[result.length - 1].rows[0]);
    } else if (result.rows && result.rows.length > 0) {
      console.log('执行结果:', result.rows[0]);
    }

    console.log('操作完成: 施工队与派工日期关联触发器已成功创建');
  } catch (error) {
    console.error('执行脚本时出错:', error);
  } finally {
    await client.end();
    console.log('数据库连接已关闭');
  }
}

executeScript(); 