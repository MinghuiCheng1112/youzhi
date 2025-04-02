require('dotenv').config();
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

async function checkDeletedRecords() {
  const client = await pool.connect();
  
  try {
    console.log('连接到数据库成功');
    
    // 1. 检查软删除的客户数
    const { rows: softDeletedCustomers } = await client.query(`
      SELECT COUNT(*) as count 
      FROM customers 
      WHERE deleted_at IS NOT NULL
    `);
    
    console.log(`软删除的客户数量: ${softDeletedCustomers[0].count}`);
    
    // 2. 检查删除记录表中的记录数
    const { rows: deletedRecords } = await client.query(`
      SELECT COUNT(*) as count 
      FROM deleted_records
    `);
    
    console.log(`删除记录表中的记录数量: ${deletedRecords[0].count}`);
    
    // 3. 检查未恢复的删除记录数
    const { rows: nonRestoredRecords } = await client.query(`
      SELECT COUNT(*) as count 
      FROM deleted_records 
      WHERE restored_at IS NULL
    `);
    
    console.log(`未恢复的删除记录数量: ${nonRestoredRecords[0].count}`);
    
    // 4. 检查已恢复的删除记录数
    const { rows: restoredRecords } = await client.query(`
      SELECT COUNT(*) as count 
      FROM deleted_records 
      WHERE restored_at IS NOT NULL
    `);
    
    console.log(`已恢复的删除记录数量: ${restoredRecords[0].count}`);
    
    // 5. 检查触发器是否正常运行
    console.log('\n检查最近几条删除记录:');
    const { rows: recentDeletedRecords } = await client.query(`
      SELECT id, original_id, customer_name, deleted_at, restored_at
      FROM deleted_records
      ORDER BY deleted_at DESC
      LIMIT 5
    `);
    
    console.table(recentDeletedRecords);
    
    // 6. 查看哪些软删除的客户没有对应的删除记录
    console.log('\n检查是否有软删除的客户没有对应的删除记录:');
    const { rows: missingRecords } = await client.query(`
      SELECT id, customer_name, deleted_at
      FROM customers c
      WHERE c.deleted_at IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM deleted_records dr
          WHERE dr.original_id = c.id
      )
      LIMIT 10
    `);
    
    if (missingRecords.length > 0) {
      console.log('存在软删除的客户没有对应的删除记录:');
      console.table(missingRecords);
      
      // 修复这些缺失的记录
      console.log('\n开始修复缺失的删除记录...');
      
      for (const record of missingRecords) {
        console.log(`正在为客户 ${record.customer_name} (ID: ${record.id}) 创建删除记录...`);
        
        try {
          await client.query(`
            INSERT INTO deleted_records (
              original_id, register_date, customer_name, phone, address, id_card,
              salesman, salesman_phone, station_management, filing_date, meter_number,
              designer, drawing_change, urge_order, capacity, investment_amount,
              land_area, module_count, inverter, copper_wire, aluminum_wire,
              distribution_box, square_steel_outbound_date, component_outbound_date,
              dispatch_date, construction_team, construction_team_phone,
              construction_status, main_line, technical_review_status, upload_to_grid,
              construction_acceptance_status, meter_installation_date, power_purchase_contract,
              status, price, company, remarks, deleted_at, customer_created_at, customer_updated_at
            )
            SELECT 
              id, register_date, customer_name, phone, address, id_card,
              salesman, salesman_phone, station_management, filing_date, meter_number,
              designer, drawing_change, urge_order, capacity, investment_amount,
              land_area, module_count, inverter, copper_wire, aluminum_wire,
              distribution_box, square_steel_outbound_date, component_outbound_date,
              dispatch_date, construction_team, construction_team_phone,
              construction_status, main_line, technical_review_status, upload_to_grid,
              construction_acceptance_status, meter_installation_date, power_purchase_contract,
              status, price, company, remarks, deleted_at, created_at, updated_at
            FROM customers
            WHERE id = $1
          `, [record.id]);
          
          console.log(`✅ 成功为客户 ${record.customer_name} 创建删除记录`);
        } catch (error) {
          console.error(`❌ 为客户 ${record.customer_name} 创建删除记录失败:`, error);
        }
      }
    } else {
      console.log('所有软删除的客户都有对应的删除记录。');
    }
    
    // 7. 检查删除记录表的触发器
    console.log('\n检查删除记录触发器:');
    const { rows: triggers } = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'customers'
      AND trigger_name IN ('trigger_record_deleted_customer', 'trigger_capture_soft_deleted_customer')
    `);
    
    console.table(triggers);
    
    // 8. 测试恢复删除记录功能
    if (recentDeletedRecords.length > 0) {
      console.log('\n测试恢复删除记录API函数:');
      
      // 选择最近的一条未恢复的记录
      const testRecord = recentDeletedRecords.find(r => r.restored_at === null);
      
      if (testRecord) {
        console.log(`选择测试记录: ${testRecord.customer_name} (ID: ${testRecord.id})`);
        console.log('测试 get_deleted_records() 函数...');
        
        const { rows: getResult } = await client.query(`
          SELECT * FROM get_deleted_records() 
          WHERE id = $1
        `, [testRecord.id]);
        
        console.log(`get_deleted_records() 函数返回测试记录: ${getResult.length > 0 ? '是' : '否'}`);
        
        // 不执行实际恢复操作，只检查函数是否存在
        const { rows: functionCheck } = await client.query(`
          SELECT routine_name
          FROM information_schema.routines
          WHERE routine_name = 'restore_deleted_record'
          AND routine_type = 'FUNCTION'
        `);
        
        console.log(`restore_deleted_record 函数是否存在: ${functionCheck.length > 0 ? '是' : '否'}`);
      } else {
        console.log('没有找到可用于测试的未恢复记录');
      }
    }
  } catch (error) {
    console.error('检查删除记录时出错:', error);
    throw error;
  } finally {
    // 释放客户端连接
    client.release();
    await pool.end();
  }
}

// 执行检查
checkDeletedRecords()
  .then(() => {
    console.log('检查完成，数据库连接已关闭');
  })
  .catch(err => {
    console.error('检查过程中发生错误:', err);
    process.exit(1);
  }); 