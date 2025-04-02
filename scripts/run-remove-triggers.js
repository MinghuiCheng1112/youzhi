require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// 数据库连接配置
const dbConfig = {
  host: process.env.SUPABASE_DB_HOST,
  port: process.env.SUPABASE_DB_PORT,
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

async function removeTriggers() {
  console.log('开始删除依赖触发器...');
  const client = new Client(dbConfig);
  
  try {
    // 连接数据库
    await client.connect();
    console.log('已连接到数据库');
    
    // 直接执行删除触发器的SQL
    const sql = `
      -- 删除所有依赖于旧字段的触发器
      DROP TRIGGER IF EXISTS update_technical_review_timestamp ON customers;
      DROP TRIGGER IF EXISTS update_technical_review_rejected_timestamp ON customers;
      DROP TRIGGER IF EXISTS update_construction_acceptance_timestamp ON customers;
    `;
    
    await client.query(sql);
    console.log('已成功删除依赖触发器');
    
  } catch (err) {
    console.error('删除触发器时发生错误：', err);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await client.end();
    console.log('数据库连接已关闭');
  }
}

// 执行删除触发器
removeTriggers(); 