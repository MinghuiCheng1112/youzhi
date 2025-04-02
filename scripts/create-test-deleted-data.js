require('dotenv').config();
console.log('脚本开始执行');
console.log('环境变量检查...');

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

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
  console.log(`环境变量 ${envVar} 已设置`);
}

// 配置数据库连接
console.log('配置数据库连接...');
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

async function createTestDeletedData() {
  console.log('开始创建测试删除数据...');
  const client = await pool.connect();
  
  try {
    console.log('连接到数据库成功');
    
    // 开始一个事务
    await client.query('BEGIN');
    
    // 创建一个测试客户
    const customerId = uuidv4();
    const customerName = `测试删除客户_${new Date().toISOString().replace(/[:.]/g, '_')}`;
    
    console.log(`创建测试客户: ${customerName} (ID: ${customerId})`);
    
    await client.query(`
      INSERT INTO customers (
        id, customer_name, phone, address, register_date, salesman
      ) VALUES (
        $1, $2, '13800138000', '测试地址', NOW(), '测试业务员'
      )
    `, [customerId, customerName]);
    
    console.log('客户创建成功，等待3秒后执行软删除...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 执行软删除
    await client.query(`
      UPDATE customers
      SET deleted_at = NOW()
      WHERE id = $1
    `, [customerId]);
    
    console.log('软删除执行完成，等待2秒后验证结果...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 验证客户记录已被软删除
    const { rows: softDeletedCustomers } = await client.query(`
      SELECT id, customer_name, deleted_at 
      FROM customers 
      WHERE id = $1
    `, [customerId]);
    
    if (softDeletedCustomers.length > 0 && softDeletedCustomers[0].deleted_at) {
      console.log('✅ 客户已成功被软删除');
    } else {
      console.log('❌ 软删除失败，客户未被标记为删除');
    }
    
    // 验证是否生成了删除记录
    const { rows: deletedRecords } = await client.query(`
      SELECT id, original_id, customer_name, deleted_at 
      FROM deleted_records 
      WHERE original_id = $1
    `, [customerId]);
    
    if (deletedRecords.length > 0) {
      console.log('✅ 删除记录已成功生成');
      console.log('删除记录详情:', deletedRecords[0]);
    } else {
      console.log('❌ 未找到对应的删除记录');
    }
    
    // 提交事务
    await client.query('COMMIT');
    
    console.log('\n测试总结:');
    console.log(`1. 测试客户 ${customerName} 已创建并软删除`);
    console.log(`2. 客户ID: ${customerId}`);
    console.log(`3. 删除记录状态: ${deletedRecords.length > 0 ? '已生成' : '未生成'}`);
    if (deletedRecords.length > 0) {
      console.log(`4. 删除记录ID: ${deletedRecords[0].id}`);
    }
    
  } catch (error) {
    // 如果发生错误，回滚事务
    await client.query('ROLLBACK');
    console.error('测试过程中出错:', error);
    throw error;
  } finally {
    // 释放客户端连接
    client.release();
    await pool.end();
  }
}

// 执行测试
console.log('准备执行测试函数...');
createTestDeletedData()
  .then(() => {
    console.log('测试完成，数据库连接已关闭');
  })
  .catch(err => {
    console.error('测试过程中发生错误:', err);
    process.exit(1);
  }); 