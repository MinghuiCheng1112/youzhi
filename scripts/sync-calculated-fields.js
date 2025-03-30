/**
 * 自动同步计算字段脚本
 * 将客户工作台计算的相关字段数据（容量、投资金额、用地面积、逆变器、铜线、铝线、配电箱等）
 * 同步更新到Supabase数据库的customers表中
 */

const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const { Pool } = pg;

// 加载环境变量，指定从项目根目录加载.env文件
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

/**
 * 根据组件数量计算相关字段
 * @param {number} moduleCount - 组件数量
 * @returns {Object} 计算后的字段
 */
function calculateAllFields(moduleCount) {
  // 如果moduleCount为null或0，返回所有字段为空的默认值
  if (moduleCount === null || moduleCount === 0 || moduleCount < 10) {
    return {
      capacity: moduleCount ? calculateCapacity(moduleCount) : 0,
      investment_amount: moduleCount ? calculateInvestmentAmount(moduleCount) : 0,
      land_area: moduleCount ? calculateLandArea(moduleCount) : 0,
      inverter: null,
      distribution_box: null,
      copper_wire: null,
      aluminum_wire: null
    };
  }
  
  const capacity = calculateCapacity(moduleCount);
  const investmentAmount = calculateInvestmentAmount(moduleCount);
  const landArea = calculateLandArea(moduleCount);
  const inverter = determineInverter(moduleCount);
  const distributionBox = determineDistributionBox(inverter);
  const copperWire = determineCopperWire(inverter);
  const aluminumWire = determineAluminumWire(inverter);
  
  return {
    capacity,
    investment_amount: investmentAmount,
    land_area: landArea,
    inverter,
    distribution_box: distributionBox,
    copper_wire: copperWire,
    aluminum_wire: aluminumWire
  };
}

/**
 * 计算容量
 * @param {number} moduleCount - 组件数量
 * @returns {number} 容量
 */
function calculateCapacity(moduleCount) {
  return parseFloat((moduleCount * 0.71).toFixed(2));
}

/**
 * 计算投资金额
 * @param {number} moduleCount - 组件数量
 * @returns {number} 投资金额
 */
function calculateInvestmentAmount(moduleCount) {
  return parseFloat((moduleCount * 0.71 * 0.25).toFixed(2));
}

/**
 * 计算用地面积
 * @param {number} moduleCount - 组件数量
 * @returns {number} 用地面积
 */
function calculateLandArea(moduleCount) {
  return parseFloat((moduleCount * 3.106).toFixed(2));
}

/**
 * 确定逆变器型号
 * @param {number} moduleCount - 组件数量
 * @returns {string} 逆变器型号
 */
function determineInverter(moduleCount) {
  if (moduleCount === null || moduleCount === 0) return '';
  
  if (moduleCount >= 10 && moduleCount <= 13) return 'SN8.0PT-C';
  if (moduleCount >= 14 && moduleCount <= 16) return 'SN10PT-C';
  if (moduleCount >= 17 && moduleCount <= 20) return 'SN12PT-C';
  if (moduleCount >= 21 && moduleCount <= 24) return 'SN15PT-C';
  if (moduleCount >= 25 && moduleCount <= 27) return 'SN17PT-C';
  if (moduleCount >= 28 && moduleCount <= 32) return 'SN20PT-B';
  if (moduleCount >= 33 && moduleCount <= 37) return 'SN23PT-B';
  if (moduleCount >= 38 && moduleCount <= 41) return 'SN25PT-B';
  if (moduleCount >= 42 && moduleCount <= 48) return 'SN30PT-C';
  if (moduleCount >= 49 && moduleCount <= 53) return 'SN33PT-C';
  if (moduleCount >= 54 && moduleCount <= 59) return 'SN36PT-C';
  if (moduleCount >= 60 && moduleCount <= 67) return 'SN40PT-C';
  if (moduleCount >= 68 && moduleCount <= 83) return 'SN50PT-B';
  if (moduleCount >= 84 && moduleCount <= 97) return 'SN60PT';
  if (moduleCount < 10) return '-';
  return 'N+N';
}

/**
 * 确定配电箱规格
 * @param {string} inverter - 逆变器型号
 * @returns {string} 配电箱规格
 */
function determineDistributionBox(inverter) {
  if (inverter.includes('组件数量') || inverter === '-') return '';
  
  if (inverter <= 'SN30PT-C') return '30kWp';
  if (inverter > 'SN30PT-C' && inverter <= 'SN50PT-B') return '50kWp';
  if (inverter > 'SN50PT-B') return '80kWp';
  
  return '';
}

/**
 * 确定铜线规格
 * @param {string} inverter - 逆变器型号
 * @returns {string} 铜线规格
 */
function determineCopperWire(inverter) {
  if (inverter.includes('组件数量') || inverter === '-') return '';
  
  if (inverter <= 'SN20PT-B') return '3*10mm²';
  if (inverter > 'SN20PT-B' && inverter <= 'SN30PT-C') return '3*16mm²';
  if (inverter > 'SN30PT-C' && inverter <= 'SN50PT-B') return '3*25mm²';
  if (inverter > 'SN50PT-B' && inverter <= 'SN60PT') return '3*35mm²';
  
  return '';
}

/**
 * 确定铝线规格
 * @param {string} inverter - 逆变器型号
 * @returns {string} 铝线规格
 */
function determineAluminumWire(inverter) {
  if (inverter.includes('组件数量') || inverter === '-') return '';
  
  if (inverter <= 'SN20PT-B') return '3*16mm²';
  if (inverter > 'SN20PT-B' && inverter <= 'SN30PT-C') return '3*25mm²';
  if (inverter > 'SN30PT-C' && inverter <= 'SN50PT-B') return '3*35mm²';
  if (inverter > 'SN50PT-B' && inverter <= 'SN60PT') return '3*50mm²';
  if (inverter > 'SN60PT') return '3*70mm²';
  
  return '';
}

/**
 * 同步所有缺失的计算字段
 */
async function syncCalculatedFields() {
  let client;
  try {
    client = await pool.connect();
    console.log('成功连接到Supabase PostgreSQL数据库');
    
    // 获取所有有组件数量但缺少计算字段的记录
    const query = `
      SELECT id, module_count
      FROM customers
      WHERE module_count IS NOT NULL AND module_count > 0
      AND (
        capacity IS NULL OR
        investment_amount IS NULL OR
        land_area IS NULL OR
        inverter IS NULL OR
        distribution_box IS NULL OR
        copper_wire IS NULL OR
        aluminum_wire IS NULL
      )
    `;
    
    console.log('查询需要同步的客户记录...');
    const { rows: customersToUpdate } = await client.query(query);
    
    console.log(`找到 ${customersToUpdate.length} 条需要更新的记录`);
    
    // 逐个更新客户记录
    for (const customer of customersToUpdate) {
      const { id, module_count } = customer;
      const calculatedFields = calculateAllFields(Number(module_count));
      
      console.log(`更新客户ID: ${id}, 组件数量: ${module_count}`);
      console.log('计算字段:', calculatedFields);
      
      // 构建UPDATE语句
      const updateQuery = `
        UPDATE customers
        SET 
          capacity = $1,
          investment_amount = $2,
          land_area = $3,
          inverter = $4,
          distribution_box = $5,
          copper_wire = $6,
          aluminum_wire = $7
        WHERE id = $8
      `;
      
      await client.query(updateQuery, [
        calculatedFields.capacity,
        calculatedFields.investment_amount,
        calculatedFields.land_area,
        calculatedFields.inverter,
        calculatedFields.distribution_box,
        calculatedFields.copper_wire,
        calculatedFields.aluminum_wire,
        id
      ]);
      
      console.log(`客户ID: ${id} 更新成功`);
    }
    
    console.log('\n同步完成！');
    console.log(`共同步了 ${customersToUpdate.length} 条客户记录`);
    
  } catch (error) {
    console.error('同步过程中出现错误:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('数据库连接已关闭');
  }
}

/**
 * 创建数据库触发器，自动更新计算字段
 */
async function createTriggerFunction() {
  let client;
  try {
    client = await pool.connect();
    console.log('成功连接到Supabase PostgreSQL数据库');
    
    // 首先删除已有的触发器和函数（如果存在）
    const dropTriggerSQL = `
      DROP TRIGGER IF EXISTS update_calculated_fields_trigger ON customers;
    `;
    
    const dropFunctionSQL = `
      DROP FUNCTION IF EXISTS update_calculated_fields();
    `;
    
    await client.query(dropTriggerSQL);
    await client.query(dropFunctionSQL);
    
    console.log('已清除现有触发器和函数');
    
    // 创建PostgreSQL函数，用于更新计算字段
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION update_calculated_fields()
      RETURNS TRIGGER AS $$
      BEGIN
        -- 只处理module_count发生变化的情况
        IF NEW.module_count IS DISTINCT FROM OLD.module_count THEN
          -- 如果module_count为空或为0，清空相关字段
          IF NEW.module_count IS NULL OR NEW.module_count <= 0 THEN
            NEW.capacity := NULL;
            NEW.investment_amount := NULL;
            NEW.land_area := NULL;
            NEW.inverter := NULL;
            NEW.distribution_box := NULL;
            NEW.copper_wire := NULL;
            NEW.aluminum_wire := NULL;
          ELSE
            -- 计算容量
            NEW.capacity := ROUND((NEW.module_count * 0.71)::numeric, 2);
            
            -- 计算投资金额
            NEW.investment_amount := ROUND((NEW.module_count * 0.71 * 0.25)::numeric, 2);
            
            -- 计算用地面积
            NEW.land_area := ROUND((NEW.module_count * 3.106)::numeric, 2);
            
            -- 确定逆变器型号
            NEW.inverter := 
              CASE 
                WHEN NEW.module_count >= 10 AND NEW.module_count <= 13 THEN 'SN8.0PT-C'
                WHEN NEW.module_count >= 14 AND NEW.module_count <= 16 THEN 'SN10PT-C'
                WHEN NEW.module_count >= 17 AND NEW.module_count <= 20 THEN 'SN12PT-C'
                WHEN NEW.module_count >= 21 AND NEW.module_count <= 24 THEN 'SN15PT-C'
                WHEN NEW.module_count >= 25 AND NEW.module_count <= 27 THEN 'SN17PT-C'
                WHEN NEW.module_count >= 28 AND NEW.module_count <= 32 THEN 'SN20PT-B'
                WHEN NEW.module_count >= 33 AND NEW.module_count <= 37 THEN 'SN23PT-B'
                WHEN NEW.module_count >= 38 AND NEW.module_count <= 41 THEN 'SN25PT-B'
                WHEN NEW.module_count >= 42 AND NEW.module_count <= 48 THEN 'SN30PT-C'
                WHEN NEW.module_count >= 49 AND NEW.module_count <= 53 THEN 'SN33PT-C'
                WHEN NEW.module_count >= 54 AND NEW.module_count <= 59 THEN 'SN36PT-C'
                WHEN NEW.module_count >= 60 AND NEW.module_count <= 67 THEN 'SN40PT-C'
                WHEN NEW.module_count >= 68 AND NEW.module_count <= 83 THEN 'SN50PT-B'
                WHEN NEW.module_count >= 84 AND NEW.module_count <= 97 THEN 'SN60PT'
                WHEN NEW.module_count < 10 THEN '-'
                ELSE 'N+N'
              END;
            
            -- 根据逆变器型号确定配电箱规格
            NEW.distribution_box := 
              CASE 
                WHEN NEW.inverter <= 'SN30PT-C' THEN '30kWp'
                WHEN NEW.inverter > 'SN30PT-C' AND NEW.inverter <= 'SN50PT-B' THEN '50kWp'
                WHEN NEW.inverter > 'SN50PT-B' THEN '80kWp'
                ELSE NULL
              END;
            
            -- 根据逆变器型号确定铜线规格
            NEW.copper_wire := 
              CASE 
                WHEN NEW.inverter <= 'SN20PT-B' THEN '3*10mm²'
                WHEN NEW.inverter > 'SN20PT-B' AND NEW.inverter <= 'SN30PT-C' THEN '3*16mm²'
                WHEN NEW.inverter > 'SN30PT-C' AND NEW.inverter <= 'SN50PT-B' THEN '3*25mm²'
                WHEN NEW.inverter > 'SN50PT-B' AND NEW.inverter <= 'SN60PT' THEN '3*35mm²'
                ELSE NULL
              END;
            
            -- 根据逆变器型号确定铝线规格
            NEW.aluminum_wire := 
              CASE 
                WHEN NEW.inverter <= 'SN20PT-B' THEN '3*16mm²'
                WHEN NEW.inverter > 'SN20PT-B' AND NEW.inverter <= 'SN30PT-C' THEN '3*25mm²'
                WHEN NEW.inverter > 'SN30PT-C' AND NEW.inverter <= 'SN50PT-B' THEN '3*35mm²'
                WHEN NEW.inverter > 'SN50PT-B' AND NEW.inverter <= 'SN60PT' THEN '3*50mm²'
                WHEN NEW.inverter > 'SN60PT' THEN '3*70mm²'
                ELSE NULL
              END;
          END IF;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    // 创建触发器，在更新客户记录时自动计算相关字段
    const createTriggerSQL = `
      CREATE TRIGGER update_calculated_fields_trigger
      BEFORE UPDATE ON customers
      FOR EACH ROW
      EXECUTE FUNCTION update_calculated_fields();
    `;
    
    // 执行SQL语句
    await client.query(createFunctionSQL);
    await client.query(createTriggerSQL);
    
    console.log('成功创建数据库触发器和函数！');
    console.log('现在，当组件数量(module_count)变更时，相关字段将自动更新。');
    
  } catch (error) {
    console.error('创建触发器过程中出现错误:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('数据库连接已关闭');
  }
}

// 根据命令行参数执行不同的任务
const args = process.argv.slice(2);
if (args.includes('--sync')) {
  syncCalculatedFields();
} else if (args.includes('--trigger')) {
  createTriggerFunction();
} else {
  console.log('请指定要执行的操作:');
  console.log('node scripts/sync-calculated-fields.js --sync    # 同步现有记录的计算字段');
  console.log('node scripts/sync-calculated-fields.js --trigger # 创建数据库触发器自动更新字段');
} 