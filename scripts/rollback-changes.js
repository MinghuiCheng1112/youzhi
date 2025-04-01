const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 从环境变量中获取Supabase连接信息
const SUPABASE_DB_HOST = process.env.SUPABASE_DB_HOST;
const SUPABASE_DB = process.env.SUPABASE_DB || 'postgres';
const SUPABASE_DB_USER = process.env.SUPABASE_DB_USER || 'postgres';
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const SUPABASE_DB_PORT = process.env.SUPABASE_DB_PORT || 5432;

// 验证必要的环境变量是否存在
if (!SUPABASE_DB_HOST || !SUPABASE_DB_PASSWORD) {
  console.error('缺少Supabase数据库连接信息。请确保.env文件中包含必要的环境变量：');
  console.error('SUPABASE_DB_HOST, SUPABASE_DB_PASSWORD');
  process.exit(1);
}

// 构建连接信息
const connectionConfig = {
  host: SUPABASE_DB_HOST,
  port: SUPABASE_DB_PORT,
  database: SUPABASE_DB,
  user: SUPABASE_DB_USER,
  password: SUPABASE_DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

console.log('正在连接到:', `postgresql://${connectionConfig.user}:****@${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`);

// 创建连接池
const pool = new Pool(connectionConfig);

// 回滚脚本
async function rollbackChanges() {
  const client = await pool.connect();
  try {
    console.log('开始回滚数据库更改...');

    // 开始事务
    await client.query('BEGIN');

    // 1. 恢复原始的 restore_deleted_record 函数
    console.log('正在恢复原始的 restore_deleted_record 函数...');
    await client.query(`
      CREATE OR REPLACE FUNCTION restore_deleted_record(record_id UUID)
      RETURNS VOID AS $$
      DECLARE
          deleted_record deleted_records;
      BEGIN
          -- 获取要恢复的记录
          SELECT * INTO deleted_record 
          FROM deleted_records 
          WHERE id = record_id;
          
          -- 检查记录是否存在
          IF deleted_record.id IS NULL THEN
              RAISE EXCEPTION '删除记录不存在';
          END IF;
          
          -- 检查原始ID的记录是否已经存在
          IF EXISTS (SELECT 1 FROM customers WHERE id = deleted_record.original_id) THEN
              -- 更新已有记录，将deleted_at设为NULL
              UPDATE customers
              SET deleted_at = NULL
              WHERE id = deleted_record.original_id;
          ELSE
              -- 重新创建客户记录
              INSERT INTO customers (
                  id, register_date, customer_name, phone, address, id_card,
                  salesman, salesman_phone, station_management, filing_date, meter_number,
                  designer, drawing_change, urge_order, capacity, investment_amount,
                  land_area, module_count, inverter, copper_wire, aluminum_wire,
                  distribution_box, square_steel_outbound_date, component_outbound_date,
                  dispatch_date, construction_team, construction_team_phone,
                  construction_status, main_line, technical_review, upload_to_grid,
                  construction_acceptance, meter_installation_date, power_purchase_contract,
                  status, price, company, remarks, created_at, updated_at, deleted_at
              )
              VALUES (
                  deleted_record.original_id, deleted_record.register_date, deleted_record.customer_name, 
                  deleted_record.phone, deleted_record.address, deleted_record.id_card,
                  deleted_record.salesman, deleted_record.salesman_phone, deleted_record.station_management, 
                  deleted_record.filing_date, deleted_record.meter_number,
                  deleted_record.designer, deleted_record.drawing_change, deleted_record.urge_order, 
                  deleted_record.capacity, deleted_record.investment_amount,
                  deleted_record.land_area, deleted_record.module_count, deleted_record.inverter, 
                  deleted_record.copper_wire, deleted_record.aluminum_wire,
                  deleted_record.distribution_box, deleted_record.square_steel_outbound_date, 
                  deleted_record.component_outbound_date,
                  deleted_record.dispatch_date, deleted_record.construction_team, 
                  deleted_record.construction_team_phone,
                  deleted_record.construction_status, deleted_record.main_line, 
                  deleted_record.technical_review, deleted_record.upload_to_grid,
                  deleted_record.construction_acceptance, deleted_record.meter_installation_date, 
                  deleted_record.power_purchase_contract,
                  deleted_record.status, deleted_record.price, deleted_record.company, 
                  deleted_record.remarks, deleted_record.customer_created_at, 
                  now(), NULL
              );
          END IF;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    // 2. 恢复原始的字段类型 - 如果已经修改了
    console.log('正在恢复原始的字段类型...');
    
    // 检查并恢复 square_steel_outbound_date 字段
    const checkSteelField = await client.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'square_steel_outbound_date'
    `);
    
    if (checkSteelField.rows.length > 0 && checkSteelField.rows[0].data_type === 'timestamp with time zone') {
      await client.query(`
        ALTER TABLE customers 
        ALTER COLUMN square_steel_outbound_date TYPE TEXT USING square_steel_outbound_date::TEXT
      `);
      console.log('已恢复 customers 表的 square_steel_outbound_date 字段类型为 TEXT');
    }
    
    // 检查并恢复 component_outbound_date 字段
    const checkComponentField = await client.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'component_outbound_date'
    `);
    
    if (checkComponentField.rows.length > 0 && checkComponentField.rows[0].data_type === 'timestamp with time zone') {
      await client.query(`
        ALTER TABLE customers 
        ALTER COLUMN component_outbound_date TYPE TEXT USING component_outbound_date::TEXT
      `);
      console.log('已恢复 customers 表的 component_outbound_date 字段类型为 TEXT');
    }
    
    // 检查并恢复 deleted_records 表相应字段
    const checkDeletedRecordsSteelField = await client.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'deleted_records' AND column_name = 'square_steel_outbound_date'
    `);
    
    if (checkDeletedRecordsSteelField.rows.length > 0 && checkDeletedRecordsSteelField.rows[0].data_type === 'timestamp with time zone') {
      await client.query(`
        ALTER TABLE deleted_records 
        ALTER COLUMN square_steel_outbound_date TYPE TEXT USING square_steel_outbound_date::TEXT
      `);
      console.log('已恢复 deleted_records 表的 square_steel_outbound_date 字段类型为 TEXT');
    }
    
    const checkDeletedRecordsComponentField = await client.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'deleted_records' AND column_name = 'component_outbound_date'
    `);
    
    if (checkDeletedRecordsComponentField.rows.length > 0 && checkDeletedRecordsComponentField.rows[0].data_type === 'timestamp with time zone') {
      await client.query(`
        ALTER TABLE deleted_records 
        ALTER COLUMN component_outbound_date TYPE TEXT USING component_outbound_date::TEXT
      `);
      console.log('已恢复 deleted_records 表的 component_outbound_date 字段类型为 TEXT');
    }

    // 提交事务
    await client.query('COMMIT');
    console.log('回滚操作已成功完成！');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('回滚操作失败:', error.message);
  } finally {
    client.release();
  }
}

// 主函数
async function main() {
  try {
    // 执行回滚操作
    await rollbackChanges();
  } catch (error) {
    console.error('执行脚本时发生错误:', error.message);
  } finally {
    // 关闭数据库连接池
    await pool.end();
  }
}

// 执行主函数
main(); 