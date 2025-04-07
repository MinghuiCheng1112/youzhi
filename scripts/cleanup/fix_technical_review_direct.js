/**
 * 直接修复technical_review字段问题
 */
require('dotenv').config({ path: '.env.db' });
require('dotenv').config();

const { Client } = require('pg');

async function fixTechnicalReviewIssue() {
  const client = new Client();

  try {
    await client.connect();
    console.log('连接数据库成功');

    console.log('修复触发器函数，在向deleted_records表插入数据时为technical_review字段提供默认空字符串值...');

    // 1. 删除现有触发器
    await client.query('DROP TRIGGER IF EXISTS trigger_capture_soft_deleted_customer ON customers;');
    await client.query('DROP TRIGGER IF EXISTS trigger_record_deleted_customer ON customers;');
    console.log('已删除现有触发器');

    // 2. 删除现有函数
    await client.query('DROP FUNCTION IF EXISTS capture_soft_deleted_customer() CASCADE;');
    await client.query('DROP FUNCTION IF EXISTS record_deleted_customer() CASCADE;');
    console.log('已删除现有函数');

    // 3. 创建新的capture_soft_deleted_customer函数
    const newCaptureFunctionSql = `
      CREATE OR REPLACE FUNCTION capture_soft_deleted_customer()
      RETURNS TRIGGER AS $$
      BEGIN
        -- 只在删除标记从NULL变为非NULL时触发
        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
          -- 将删除的客户记录插入deleted_records表，为technical_review字段提供''默认值
          INSERT INTO deleted_records (
            original_id, customer_name, phone, address, id_card,
            register_date, salesman, salesman_phone,
            station_management, filing_date, meter_number,
            designer, drawing_change, urge_order,
            capacity, investment_amount, land_area, module_count,
            inverter, copper_wire, aluminum_wire, distribution_box,
            square_steel_outbound_date, component_outbound_date,
            dispatch_date, construction_team, construction_team_phone,
            construction_status, main_line, technical_review,
            upload_to_grid, construction_acceptance,
            meter_installation_date, power_purchase_contract,
            status, deleted_at, deleted_by,
            customer_created_at, customer_updated_at,
            technical_review_status, construction_acceptance_status,
            construction_acceptance_waiting_days, construction_acceptance_waiting_start
          ) VALUES (
            NEW.id, NEW.customer_name, NEW.phone, NEW.address, NEW.id_card,
            NEW.register_date, NEW.salesman, NEW.salesman_phone,
            NEW.station_management, NEW.filing_date, NEW.meter_number,
            NEW.designer, NEW.drawing_change, NEW.urge_order,
            NEW.capacity, NEW.investment_amount, NEW.land_area, NEW.module_count,
            NEW.inverter, NEW.copper_wire, NEW.aluminum_wire, NEW.distribution_box,
            NEW.square_steel_outbound_date, NEW.component_outbound_date,
            NEW.dispatch_date, NEW.construction_team, NEW.construction_team_phone,
            NEW.construction_status, NEW.main_line, '',
            NEW.upload_to_grid, NEW.construction_acceptance,
            NEW.meter_installation_date, NEW.power_purchase_contract,
            NEW.status, NEW.deleted_at, NULL,
            NOW(), NOW(),
            NEW.technical_review_status, NULL,
            NULL, NEW.construction_acceptance_waiting_start
          );
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    await client.query(newCaptureFunctionSql);
    console.log('已创建新的capture_soft_deleted_customer函数');

    // 4. 创建新的record_deleted_customer函数
    const newRecordFunctionSql = `
      CREATE OR REPLACE FUNCTION record_deleted_customer()
      RETURNS TRIGGER AS $$
      BEGIN
        -- 将物理删除的客户记录保存到deleted_records表
        INSERT INTO deleted_records (
          original_id, customer_name, phone, address, id_card,
          register_date, salesman, salesman_phone,
          station_management, filing_date, meter_number,
          designer, drawing_change, urge_order,
          capacity, investment_amount, land_area, module_count,
          inverter, copper_wire, aluminum_wire, distribution_box,
          square_steel_outbound_date, component_outbound_date,
          dispatch_date, construction_team, construction_team_phone,
          construction_status, main_line, technical_review,
          upload_to_grid, construction_acceptance,
          meter_installation_date, power_purchase_contract,
          status, deleted_at, deleted_by,
          customer_created_at, customer_updated_at,
          technical_review_status, construction_acceptance_status,
          construction_acceptance_waiting_days, construction_acceptance_waiting_start
        ) VALUES (
          OLD.id, OLD.customer_name, OLD.phone, OLD.address, OLD.id_card,
          OLD.register_date, OLD.salesman, OLD.salesman_phone,
          OLD.station_management, OLD.filing_date, OLD.meter_number,
          OLD.designer, OLD.drawing_change, OLD.urge_order,
          OLD.capacity, OLD.investment_amount, OLD.land_area, OLD.module_count,
          OLD.inverter, OLD.copper_wire, OLD.aluminum_wire, OLD.distribution_box,
          OLD.square_steel_outbound_date, OLD.component_outbound_date,
          OLD.dispatch_date, OLD.construction_team, OLD.construction_team_phone,
          OLD.construction_status, OLD.main_line, '',
          OLD.upload_to_grid, OLD.construction_acceptance,
          OLD.meter_installation_date, OLD.power_purchase_contract,
          OLD.status, NOW(), NULL,
          NOW(), NOW(),
          OLD.technical_review_status, NULL,
          NULL, OLD.construction_acceptance_waiting_start
        );
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `;
    await client.query(newRecordFunctionSql);
    console.log('已创建新的record_deleted_customer函数');

    // 5. 重新添加触发器
    await client.query(`
      CREATE TRIGGER trigger_capture_soft_deleted_customer
      BEFORE UPDATE ON customers
      FOR EACH ROW
      EXECUTE FUNCTION capture_soft_deleted_customer();
    `);
    await client.query(`
      CREATE TRIGGER trigger_record_deleted_customer
      BEFORE DELETE ON customers
      FOR EACH ROW
      EXECUTE FUNCTION record_deleted_customer();
    `);
    console.log('已重新添加触发器');

    // 6. 设置已存在记录的technical_review为空字符串（如果是NULL）
    const updateResult = await client.query(`
      UPDATE deleted_records SET technical_review = '' WHERE technical_review IS NULL;
    `);
    console.log(`已更新 ${updateResult.rowCount} 条记录，将NULL的technical_review设置为空字符串`);

    // 7. 验证修复
    const verifyCapture = await client.query(`
      SELECT pg_get_functiondef(oid) AS definition
      FROM pg_proc WHERE proname = 'capture_soft_deleted_customer'
    `);
    
    if (verifyCapture.rows.length > 0) {
      const def = verifyCapture.rows[0].definition;
      if (def.includes(`technical_review, ''`)) {
        console.log('[成功] capture_soft_deleted_customer函数已修复，使用空字符串替代technical_review');
      } else {
        console.log('[警告] capture_soft_deleted_customer函数可能未正确修复');
      }
    }

    console.log('修复完成，现在客户删除功能应该可以正常工作了。');

  } catch (err) {
    console.error('执行修复脚本时出错:', err);
  } finally {
    await client.end();
    console.log('数据库连接已关闭');
  }
}

fixTechnicalReviewIssue().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
}); 