require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 检查必要的环境变量
const requiredEnvVars = [
  'SUPABASE_DB_HOST',
  'SUPABASE_DB_PORT',
  'SUPABASE_DB_NAME',
  'SUPABASE_DB_USER',
  'SUPABASE_DB_PASSWORD',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`错误: 缺少环境变量 ${envVar}`);
    process.exit(1);
  }
}

// 配置数据库连接
const pool = new Pool({
  host: process.env.SUPABASE_DB_HOST,
  port: process.env.SUPABASE_DB_PORT,
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixTriggers() {
  const client = await pool.connect();
  
  try {
    console.log('连接到数据库成功');
    
    // 开始一个事务
    await client.query('BEGIN');
    
    console.log('读取SQL修复脚本...');
    const sqlFilePath = path.join(__dirname, 'fix-deleted-record-triggers.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('执行SQL修复脚本...');
    await client.query(sqlContent);
    
    // 验证触发器是否存在
    const { rows: triggers } = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'customers'
      AND trigger_name IN ('trigger_record_deleted_customer', 'trigger_capture_soft_deleted_customer')
    `);
    
    console.log('验证触发器:');
    console.table(triggers);
    
    if (triggers.length === 2) {
      console.log('✅ 触发器已正确更新');
    } else {
      throw new Error(`触发器未正确创建，预期2个，实际${triggers.length}个`);
    }
    
    // 验证函数是否存在
    const { rows: functions } = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_name IN ('capture_soft_deleted_customer', 'record_deleted_customer', 'restore_deleted_record')
      AND routine_type = 'FUNCTION'
    `);
    
    console.log('验证函数:');
    console.table(functions);
    
    if (functions.length === 3) {
      console.log('✅ 函数已正确更新');
    } else {
      throw new Error(`函数未正确创建，预期3个，实际${functions.length}个`);
    }
    
    // 提交事务
    await client.query('COMMIT');
    console.log('事务已提交，修复完成');
    
    // 创建测试客户用于验证
    console.log('\n创建测试客户来验证触发器...');
    const customerId = '00000000-0000-0000-0000-000000000001';
    const customerName = `测试触发器_${new Date().toISOString().replace(/[:.]/g, '_')}`;
    
    // 先检查ID是否已存在
    const { rows: existingCustomer } = await client.query(`
      SELECT id FROM customers WHERE id = $1
    `, [customerId]);
    
    if (existingCustomer.length > 0) {
      // 已经存在，删除它
      await client.query(`DELETE FROM customers WHERE id = $1`, [customerId]);
      console.log(`删除了已存在的测试客户ID: ${customerId}`);
    }
    
    await client.query(`
      INSERT INTO customers (
        id, customer_name, phone, address, register_date, salesman,
        technical_review_status, construction_acceptance_status
      ) VALUES (
        $1, $2, '13800138000', '测试地址', NOW(), '测试业务员',
        'pending', 'pending'
      )
    `, [customerId, customerName]);
    
    console.log(`创建测试客户: ${customerName} (ID: ${customerId})`);
    console.log('等待1秒...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('执行软删除...');
    await client.query(`
      UPDATE customers
      SET deleted_at = NOW()
      WHERE id = $1
    `, [customerId]);
    
    console.log('等待1秒...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 检查是否生成了删除记录
    const { rows: deletedRecords } = await client.query(`
      SELECT id, original_id, customer_name, deleted_at
      FROM deleted_records
      WHERE original_id = $1
    `, [customerId]);
    
    if (deletedRecords.length > 0) {
      console.log('✅ 软删除触发器工作正常，生成了删除记录');
      console.log('删除记录:', deletedRecords[0]);
      
      // 测试恢复功能
      console.log('\n测试恢复功能...');
      await client.query(`
        SELECT restore_deleted_record($1)
      `, [deletedRecords[0].id]);
      
      // 检查客户是否被恢复
      const { rows: restoredCustomer } = await client.query(`
        SELECT id, customer_name, deleted_at
        FROM customers
        WHERE id = $1
      `, [customerId]);
      
      if (restoredCustomer.length > 0 && restoredCustomer[0].deleted_at === null) {
        console.log('✅ 恢复功能工作正常，客户已恢复');
      } else {
        console.log('❌ 恢复功能可能有问题，客户未正确恢复');
      }
      
      // 检查恢复记录
      const { rows: restoredRecord } = await client.query(`
        SELECT id, original_id, customer_name, restored_at, restored_by
        FROM deleted_records
        WHERE id = $1
      `, [deletedRecords[0].id]);
      
      if (restoredRecord.length > 0 && restoredRecord[0].restored_at) {
        console.log('✅ 恢复记录已正确标记');
        console.log('恢复记录:', restoredRecord[0]);
      } else {
        console.log('❌ 恢复记录未正确标记');
      }
    } else {
      console.log('❌ 软删除触发器未生成删除记录，可能需要进一步检查');
    }
    
    // 最后清理测试数据
    console.log('\n清理测试数据...');
    await client.query(`DELETE FROM customers WHERE id = $1`, [customerId]);
    console.log('测试完成');
    
  } catch (error) {
    // 如果发生错误，回滚事务
    await client.query('ROLLBACK');
    console.error('修复过程中出错:', error);
    throw error;
  } finally {
    // 释放客户端连接
    client.release();
    await pool.end();
  }
}

// 执行修复
fixTriggers()
  .then(() => {
    console.log('修复完成，数据库连接已关闭');
  })
  .catch(err => {
    console.error('修复过程中发生错误:', err);
    process.exit(1);
  }); 