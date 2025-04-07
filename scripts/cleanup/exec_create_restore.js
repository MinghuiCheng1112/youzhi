/**
 * 执行创建restore_deleted_record函数的SQL脚本
 * 此脚本连接到数据库并执行scripts/cleanup/create_restore_function.sql中的SQL命令
 */

require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');
const path = require('path');

// 数据库连接配置
const dbConfig = {
  user: process.env.SUPABASE_DB_USER || process.env.SUPABASE_USER,
  password: process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_PASSWORD,
  host: process.env.SUPABASE_DB_HOST || process.env.SUPABASE_HOST,
  port: process.env.SUPABASE_DB_PORT || process.env.SUPABASE_PORT,
  database: process.env.SUPABASE_DB_NAME || process.env.SUPABASE_DATABASE,
  ssl: { rejectUnauthorized: false }
};

async function runSQLScript() {
  console.log('===================================');
  console.log('  创建restore_deleted_record函数脚本');
  console.log('===================================\n');

  // 创建数据库连接
  const client = new Client(dbConfig);

  try {
    console.log('[信息] 连接到数据库...');
    await client.connect();
    console.log('[成功] 数据库连接成功\n');

    // 读取 SQL 脚本
    const sqlFilePath = path.join(__dirname, 'create_restore_function.sql');
    console.log(`[信息] 读取 SQL 脚本: ${sqlFilePath}`);
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL 脚本文件不存在: ${sqlFilePath}`);
    }
    
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('[成功] SQL 脚本已加载\n');

    // 日志拦截器
    client.on('notice', msg => {
      const message = msg.message.trim();
      console.log(`[通知] ${message}`);
    });

    // 执行 SQL 脚本
    console.log('[信息] 开始执行 SQL 脚本...');
    await client.query(sqlScript);
    console.log('\n[成功] SQL 脚本执行完成');

    // 最终验证
    console.log('\n[信息] 最终验证...');
    const verifyResult = await client.query(`
      SELECT 
        p.proname AS routine_name,
        pg_get_functiondef(p.oid) AS definition
      FROM 
        pg_proc p
      JOIN 
        pg_namespace n ON p.pronamespace = n.oid
      WHERE 
        n.nspname = 'public' 
        AND pg_get_functiondef(p.oid) LIKE '%customer_id%'
        AND (p.proname = 'capture_soft_deleted_customer' 
             OR p.proname = 'record_deleted_customer'
             OR p.proname = 'restore_deleted_record');
    `);

    if (verifyResult.rows.length > 0) {
      console.log(`\n[警告] 仍有 ${verifyResult.rows.length} 个函数引用了不存在的字段 'customer_id':`);
      verifyResult.rows.forEach(row => {
        console.log(`- ${row.routine_name}`);
      });
    } else {
      console.log('\n[成功] 所有函数已成功创建，不引用不存在的字段');
    }

  } catch (err) {
    console.error('\n[错误] 执行过程中出现错误:');
    console.error(err.message);
    
    if (err.stack) {
      console.error('\n错误堆栈:');
      console.error(err.stack);
    }
  } finally {
    // 关闭数据库连接
    try {
      await client.end();
      console.log('\n[信息] 数据库连接已关闭');
    } catch (err) {
      console.error(`[错误] 关闭数据库连接时出错: ${err.message}`);
    }
    
    console.log('\n===================================');
    console.log('  创建函数脚本执行完成');
    console.log('===================================');
  }
}

// 运行脚本
runSQLScript().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
}); 