/**
 * 执行修复客户删除触发器函数的SQL脚本
 */
// 先加载数据库专用配置
require('dotenv').config({ path: '.env.db' });
// 再加载普通配置，避免覆盖专用配置
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runFixScript() {
  // 使用PG环境变量自动连接
  const client = new Client();

  try {
    // 连接到数据库
    await client.connect();
    console.log('连接数据库成功');

    // 读取SQL脚本
    const scriptPath = path.resolve(__dirname, 'fix_delete_customer_functions.sql');
    const sqlScript = fs.readFileSync(scriptPath, 'utf8');
    console.log(`成功加载SQL脚本: ${scriptPath}`);

    // 执行SQL脚本
    console.log('开始执行修复脚本...');
    const result = await client.query(sqlScript);
    console.log('SQL脚本执行完成');
    
    // 显示结果
    if (result.rows && result.rows.length > 0) {
      console.log('结果:', result.rows[0].result);
    }

    // 验证修复
    console.log('\n开始验证修复结果...');
    
    // 1. 验证capture_soft_deleted_customer函数
    const captureFuncResult = await client.query(`
      SELECT pg_get_functiondef(oid) AS definition
      FROM pg_proc 
      WHERE proname = 'capture_soft_deleted_customer'
    `);
    
    let captureFixed = true;
    if (captureFuncResult.rows.length > 0) {
      const def = captureFuncResult.rows[0].definition;
      const problemColumns = ['created_at', 'updated_at'];
      
      for (const col of problemColumns) {
        if (def.includes(`OLD.${col}`) || def.includes(`NEW.${col}`)) {
          console.log(`[警告] capture_soft_deleted_customer函数仍然引用了不存在的列: ${col}`);
          captureFixed = false;
        }
      }
      
      if (captureFixed) {
        console.log('[成功] capture_soft_deleted_customer函数已修复');
      }
    }
    
    // 2. 验证record_deleted_customer函数
    const recordFuncResult = await client.query(`
      SELECT pg_get_functiondef(oid) AS definition
      FROM pg_proc 
      WHERE proname = 'record_deleted_customer'
    `);
    
    let recordFixed = true;
    if (recordFuncResult.rows.length > 0) {
      const def = recordFuncResult.rows[0].definition;
      const problemColumns = ['created_at', 'updated_at'];
      
      for (const col of problemColumns) {
        if (def.includes(`OLD.${col}`) || def.includes(`NEW.${col}`)) {
          console.log(`[警告] record_deleted_customer函数仍然引用了不存在的列: ${col}`);
          recordFixed = false;
        }
      }
      
      if (recordFixed) {
        console.log('[成功] record_deleted_customer函数已修复');
      }
    }
    
    // 3. 验证触发器
    const triggersResult = await client.query(`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_table = 'customers'
        AND (trigger_name = 'trigger_capture_soft_deleted_customer'
             OR trigger_name = 'trigger_record_deleted_customer')
    `);
    
    if (triggersResult.rows.length === 2) {
      console.log('[成功] 触发器已重新创建');
    } else {
      console.log(`[警告] 触发器数量不正确，期望2，实际${triggersResult.rows.length}`);
    }
    
    // 测试客户删除
    console.log('\n是否要测试客户删除? (已跳过，避免影响生产数据)');
    
    console.log('\n验证完成。如果所有测试都显示"[成功]"，则修复已成功应用。');
    console.log('现在客户删除功能应该可以正常工作了。');
  } catch (err) {
    console.error('执行修复脚本时出错:', err);
  } finally {
    await client.end();
    console.log('\n数据库连接已关闭');
  }
}

runFixScript().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});