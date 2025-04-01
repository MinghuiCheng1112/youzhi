/**
 * 修复新增客户时公司字段保存错误的问题
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

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

async function fixCustomerCompanyField() {
  const client = await pool.connect();
  try {
    // 开始事务
    await client.query('BEGIN');
    
    console.log('成功连接到数据库');
    
    // 1. 检查customers表中的必填字段
    console.log('\n1. 检查customers表中的必填字段：');
    const requiredFieldsQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable 
      FROM 
        information_schema.columns 
      WHERE 
        table_schema = 'public' 
        AND table_name = 'customers'
        AND is_nullable = 'NO'
      ORDER BY 
        ordinal_position
    `;
    
    const requiredFieldsResult = await client.query(requiredFieldsQuery);
    console.log('必填字段列表:');
    console.table(requiredFieldsResult.rows);
    
    // 2. 确认公司字段类型
    console.log('\n2. 确认公司字段的当前类型:');
    const companyFieldQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default,
        udt_name
      FROM 
        information_schema.columns 
      WHERE 
        table_schema = 'public' 
        AND table_name = 'customers'
        AND column_name = 'company'
    `;
    
    const companyFieldResult = await client.query(companyFieldQuery);
    console.log('公司字段定义:');
    console.table(companyFieldResult.rows);
    
    // 3. 检查现有公司值的分布
    const companyValuesQuery = `
      SELECT
        company,
        count(*) as count
      FROM
        customers
      GROUP BY
        company
      ORDER BY
        count DESC
    `;
    
    const companyValuesResult = await client.query(companyValuesQuery);
    console.log('\n3. 公司字段的当前值分布:');
    console.table(companyValuesResult.rows);
    
    // 4. 修改公司字段定义 - 添加检查约束，确保值只能是'昊尘'或'祐之'
    console.log('\n4. 添加公司字段的检查约束:');
    
    try {
      // 先检查是否已存在同名约束
      const checkExistingConstraintQuery = `
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'customers'
        AND constraint_name = 'customers_company_check'
      `;
      
      const existingConstraint = await client.query(checkExistingConstraintQuery);
      
      if (existingConstraint.rows.length > 0) {
        console.log('已存在公司字段的约束，先删除它');
        await client.query(`
          ALTER TABLE customers
          DROP CONSTRAINT customers_company_check
        `);
      }
      
      // 添加新的检查约束
      await client.query(`
        ALTER TABLE customers
        ADD CONSTRAINT customers_company_check
        CHECK (company IS NULL OR company IN ('昊尘', '祐之'))
      `);
      
      console.log('成功添加公司字段约束，现在只能是 "昊尘" 或 "祐之"');
    } catch (error) {
      console.error('添加约束过程中发生错误:', error.message);
      // 回滚事务
      await client.query('ROLLBACK');
      throw error;
    }
    
    // 5. 检查phone字段，修改为可空
    console.log('\n5. 检查phone字段，并修改为可空:');
    
    // 先检查phone字段的当前定义
    const phoneFieldQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable 
      FROM 
        information_schema.columns 
      WHERE 
        table_schema = 'public' 
        AND table_name = 'customers'
        AND column_name = 'phone'
    `;
    
    const phoneFieldResult = await client.query(phoneFieldQuery);
    console.log('电话字段当前定义:');
    console.table(phoneFieldResult.rows);
    
    if (phoneFieldResult.rows.length > 0 && phoneFieldResult.rows[0].is_nullable === 'NO') {
      console.log('phone字段为必填，修改为可空以便支持新功能...');
      try {
        await client.query(`
          ALTER TABLE customers
          ALTER COLUMN phone DROP NOT NULL
        `);
        console.log('成功修改phone字段为可空');
      } catch (error) {
        console.error('修改phone字段过程中发生错误:', error.message);
        // 回滚事务
        await client.query('ROLLBACK');
        throw error;
      }
    } else {
      console.log('phone字段已经是可空的，不需要修改');
    }
    
    // 完成事务
    await client.query('COMMIT');
    console.log('\n所有修改都已成功完成！');
    
  } catch (error) {
    console.error('执行修复过程中发生错误:', error);
    try {
      // 尝试回滚事务
      await client.query('ROLLBACK');
      console.log('事务已回滚');
    } catch (rollbackError) {
      console.error('回滚事务失败:', rollbackError);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

fixCustomerCompanyField(); 