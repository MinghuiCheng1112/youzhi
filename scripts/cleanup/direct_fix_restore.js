/**
 * 直接修改restore_deleted_record函数定义
 * 此脚本会直接在数据库中查询和更新函数定义
 */
require('dotenv').config();
const { Client } = require('pg');

async function directFixFunction() {
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
    console.log('  直接修复restore_deleted_record函数');
    console.log('===================================\n');
    
    await client.connect();
    console.log('[成功] 数据库连接成功\n');
    
    // 查询函数定义
    console.log('[信息] 查询函数定义...');
    const result = await client.query(`
      SELECT pg_get_functiondef(oid) AS funcdef
      FROM pg_proc
      WHERE proname = 'restore_deleted_record'
        AND proargtypes::text LIKE '%uuid%';
    `);
    
    if (result.rows.length === 0) {
      throw new Error('找不到restore_deleted_record函数');
    }
    
    const funcDef = result.rows[0].funcdef;
    console.log('\n原始函数定义片段:');
    // 只输出部分定义以便于查看
    console.log(funcDef.substring(0, 500) + '...\n');
    
    // 检查所有customer_id引用位置
    const lines = funcDef.split('\n');
    const problematicLines = [];
    lines.forEach((line, index) => {
      if (line.includes('customer_id')) {
        problematicLines.push({ lineNumber: index + 1, content: line.trim() });
      }
    });
    
    if (problematicLines.length > 0) {
      console.log('\n找到以下包含customer_id的行:');
      problematicLines.forEach(line => {
        console.log(`第 ${line.lineNumber} 行: ${line.content}`);
      });
    }
    
    console.log('\n[信息] 尝试手动删除并重建函数...');
    await client.query('DROP FUNCTION IF EXISTS restore_deleted_record(UUID);');
    
    // 创建新函数，确保没有customer_id
    await client.query(`
      CREATE OR REPLACE FUNCTION restore_deleted_record(record_id UUID)
      RETURNS TEXT AS $BODY$
      DECLARE
        customer_exists BOOLEAN;
        deleted_customer RECORD;
      BEGIN
        -- 获取要恢复的已删除记录
        SELECT * INTO deleted_customer FROM deleted_records WHERE id = record_id;
        
        IF NOT FOUND THEN
          RETURN '找不到指定的删除记录';
        END IF;
        
        -- 检查客户ID是否已存在（可能已经被重新创建）
        SELECT EXISTS(
          SELECT 1 FROM customers WHERE id = deleted_customer.original_id
        ) INTO customer_exists;
        
        IF customer_exists THEN
          -- 如果客户ID存在，则更新而不是插入
          UPDATE customers SET
            customer_name = deleted_customer.customer_name,
            phone = deleted_customer.phone,
            address = deleted_customer.address,
            id_card = deleted_customer.id_card,
            register_date = deleted_customer.register_date,
            salesman = deleted_customer.salesman,
            salesman_phone = deleted_customer.salesman_phone,
            surveyor = deleted_customer.surveyor,
            surveyor_phone = deleted_customer.surveyor_phone,
            designer = deleted_customer.designer,
            designer_phone = deleted_customer.designer_phone,
            meter_number = deleted_customer.meter_number,
            capacity = deleted_customer.capacity,
            investment_amount = deleted_customer.investment_amount,
            land_area = deleted_customer.land_area,
            module_count = deleted_customer.module_count,
            inverter = deleted_customer.inverter,
            copper_wire = deleted_customer.copper_wire,
            aluminum_wire = deleted_customer.aluminum_wire,
            distribution_box = deleted_customer.distribution_box,
            square_steel_outbound_date = deleted_customer.square_steel_outbound_date,
            component_outbound_date = deleted_customer.component_outbound_date,
            dispatch_date = deleted_customer.dispatch_date,
            construction_team = deleted_customer.construction_team,
            construction_team_phone = deleted_customer.construction_team_phone,
            construction_acceptance_date = deleted_customer.construction_acceptance_date,
            construction_acceptance_waiting_start = deleted_customer.construction_acceptance_waiting_start,
            meter_installation_date = deleted_customer.meter_installation_date,
            power_purchase_contract = deleted_customer.power_purchase_contract,
            technical_review = deleted_customer.technical_review,
            technical_review_status = deleted_customer.technical_review_status,
            station_management = deleted_customer.station_management,
            urge_order = deleted_customer.urge_order,
            drawing_change = deleted_customer.drawing_change,
            filing_date = deleted_customer.filing_date,
            construction_status = deleted_customer.construction_status,
            deleted_at = NULL,
            updated_at = NOW()
          WHERE id = deleted_customer.original_id;
          
          -- 将删除记录标记为已恢复
          UPDATE deleted_records 
          SET restored_at = NOW(), 
              restoration_note = '数据已恢复到现有客户记录' 
          WHERE id = record_id;
          
          RETURN '客户已恢复（通过更新现有记录）';
        ELSE
          -- 如果客户ID不存在，则插入新记录
          INSERT INTO customers (
            id, customer_name, phone, address, id_card, 
            register_date, salesman, salesman_phone,
            surveyor, surveyor_phone,
            designer, designer_phone, meter_number,
            capacity, investment_amount, land_area, module_count,
            inverter, copper_wire, aluminum_wire, distribution_box,
            square_steel_outbound_date, component_outbound_date,
            dispatch_date, construction_team, construction_team_phone,
            construction_acceptance_date, construction_acceptance_waiting_start,
            meter_installation_date, power_purchase_contract,
            technical_review, technical_review_status,
            station_management, urge_order, drawing_change,
            filing_date, construction_status, deleted_at,
            created_at, updated_at
          ) VALUES (
            deleted_customer.original_id, deleted_customer.customer_name, 
            deleted_customer.phone, deleted_customer.address, deleted_customer.id_card,
            deleted_customer.register_date, deleted_customer.salesman, 
            deleted_customer.salesman_phone,
            deleted_customer.surveyor, deleted_customer.surveyor_phone,
            deleted_customer.designer, deleted_customer.designer_phone, 
            deleted_customer.meter_number,
            deleted_customer.capacity, deleted_customer.investment_amount, 
            deleted_customer.land_area, deleted_customer.module_count,
            deleted_customer.inverter, deleted_customer.copper_wire, 
            deleted_customer.aluminum_wire, deleted_customer.distribution_box,
            deleted_customer.square_steel_outbound_date, deleted_customer.component_outbound_date,
            deleted_customer.dispatch_date, deleted_customer.construction_team, 
            deleted_customer.construction_team_phone,
            deleted_customer.construction_acceptance_date, 
            deleted_customer.construction_acceptance_waiting_start,
            deleted_customer.meter_installation_date, deleted_customer.power_purchase_contract,
            deleted_customer.technical_review, 
            deleted_customer.technical_review_status,
            deleted_customer.station_management, deleted_customer.urge_order, 
            deleted_customer.drawing_change,
            deleted_customer.filing_date, deleted_customer.construction_status, 
            NULL,
            deleted_customer.customer_created_at, NOW()
          );
          
          -- 将删除记录标记为已恢复
          UPDATE deleted_records 
          SET restored_at = NOW(), 
              restoration_note = '数据已恢复（创建新记录）' 
          WHERE id = record_id;
          
          RETURN '客户已恢复（创建新记录）';
        END IF;
      END;
      $BODY$ LANGUAGE plpgsql;
    `);
    
    // 最终确认
    console.log('\n[信息] 最终确认函数修复...');
    const verifyAfter = await client.query(`
      SELECT pg_get_functiondef(oid) AS funcdef
      FROM pg_proc
      WHERE proname = 'restore_deleted_record'
        AND proargtypes::text LIKE '%uuid%';
    `);
    
    if (verifyAfter.rows.length === 0) {
      throw new Error('找不到修复后的restore_deleted_record函数');
    }
    
    const newFuncDef = verifyAfter.rows[0].funcdef;
    
    // 检查是否仍有customer_id引用
    if (newFuncDef.includes('customer_id')) {
      console.log('\n[警告] 函数仍然包含customer_id引用!');
    } else {
      console.log('\n[成功] 函数已成功修复，不再引用customer_id');
    }
    
    // 最终验证 - 再次使用pg_proc检查所有引用
    const finalCheck = await client.query(`
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

    if (finalCheck.rows.length > 0) {
      console.log(`\n[警告] 仍有 ${finalCheck.rows.length} 个函数引用了不存在的字段 'customer_id':`);
      finalCheck.rows.forEach(row => {
        console.log(`- ${row.routine_name}`);
      });
    } else {
      console.log('\n[成功] 所有函数都已成功修复！');
    }
    
  } catch (err) {
    console.error('\n[错误] 执行过程中出现错误:');
    console.error(err);
  } finally {
    await client.end();
    console.log('\n[信息] 数据库连接已关闭');
    console.log('\n===================================');
    console.log('  修复工具执行完成');
    console.log('===================================');
  }
}

directFixFunction().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
}); 