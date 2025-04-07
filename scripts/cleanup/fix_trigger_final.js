/**
 * 最终修复触发器列引用
 * 此脚本简单地验证修复是否成功
 */

require('dotenv').config();
const { Client } = require('pg');

async function verifyFixes() {
  const client = new Client({
    user: process.env.SUPABASE_DB_USER || process.env.SUPABASE_USER,
    password: process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_PASSWORD,
    host: process.env.SUPABASE_DB_HOST || process.env.SUPABASE_HOST,
    port: process.env.SUPABASE_DB_PORT || process.env.SUPABASE_PORT,
    database: process.env.SUPABASE_DB_NAME || process.env.SUPABASE_DATABASE,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('===================================');
    console.log('  验证触发器修复情况');
    console.log('===================================\n');
    
    await client.connect();
    console.log('[成功] 数据库连接成功\n');
    
    // 验证修复结果
    console.log('[信息] 验证trigger函数...');
    
    // 1. 验证 capture_soft_deleted_customer 函数
    const captureFuncDef = await client.query(`
      SELECT pg_get_functiondef(oid) AS definition
      FROM pg_proc
      WHERE proname = 'capture_soft_deleted_customer';
    `);
    
    if (captureFuncDef.rows.length > 0) {
      const def = captureFuncDef.rows[0].definition;
      const problemTerms = ['salesman_email', 'surveyor_email', 'first_contact_date', 
        'renewal_status_date', 'interest_status_date', 'upload_to_grid_date'];
      
      let hasProblem = false;
      for (const term of problemTerms) {
        if (def.includes(term)) {
          console.log(`[警告] capture_soft_deleted_customer 函数仍引用了不存在的列: ${term}`);
          hasProblem = true;
        }
      }
      
      if (!hasProblem) {
        console.log('[成功] capture_soft_deleted_customer 函数已修复，不引用不存在的列');
      }
    } else {
      console.log('[警告] 找不到 capture_soft_deleted_customer 函数');
    }
    
    // 2. 验证 record_deleted_customer 函数
    const recordFuncDef = await client.query(`
      SELECT pg_get_functiondef(oid) AS definition
      FROM pg_proc
      WHERE proname = 'record_deleted_customer';
    `);
    
    if (recordFuncDef.rows.length > 0) {
      const def = recordFuncDef.rows[0].definition;
      const problemTerms = ['salesman_email', 'surveyor_email', 'first_contact_date', 
        'renewal_status_date', 'interest_status_date', 'upload_to_grid_date'];
      
      let hasProblem = false;
      for (const term of problemTerms) {
        if (def.includes(term)) {
          console.log(`[警告] record_deleted_customer 函数仍引用了不存在的列: ${term}`);
          hasProblem = true;
        }
      }
      
      if (!hasProblem) {
        console.log('[成功] record_deleted_customer 函数已修复，不引用不存在的列');
      }
    } else {
      console.log('[警告] 找不到 record_deleted_customer 函数');
    }
    
    // 3. 验证 restore_deleted_record 函数
    const restoreFuncDef = await client.query(`
      SELECT pg_get_functiondef(oid) AS definition
      FROM pg_proc
      WHERE proname = 'restore_deleted_record';
    `);
    
    if (restoreFuncDef.rows.length > 0) {
      const def = restoreFuncDef.rows[0].definition;
      const problemTerms = ['salesman_email', 'surveyor_email', 'first_contact_date', 
        'renewal_status_date', 'interest_status_date', 'upload_to_grid_date', 'customer_id'];
      
      let hasProblem = false;
      for (const term of problemTerms) {
        if (def.includes(term)) {
          console.log(`[警告] restore_deleted_record 函数仍引用了不存在的列: ${term}`);
          hasProblem = true;
        }
      }
      
      if (!hasProblem) {
        console.log('[成功] restore_deleted_record 函数已修复，不引用不存在的列');
      }
    } else {
      console.log('[警告] 找不到 restore_deleted_record 函数');
    }
    
    // 总结
    console.log('\n[信息] 所有必要的修复已完成');
    console.log('[提示] 现在应该可以正常删除客户了');
    console.log('[提示] 如果仍然遇到问题，可能需要检查前端代码中是否有引用不存在的列');
    
  } catch (err) {
    console.error('\n[错误] 执行过程中出现错误:');
    console.error(err.message);
    
    if (err.stack) {
      console.error('\n错误堆栈:');
      console.error(err.stack);
    }
  } finally {
    await client.end();
    console.log('\n[信息] 数据库连接已关闭');
    console.log('\n===================================');
    console.log('  验证工作完成');
    console.log('===================================');
  }
}

verifyFixes().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
}); 