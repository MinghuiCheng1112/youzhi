/**
 * 检查customers表中company字段的定义
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

async function checkCompanyField() {
  try {
    const client = await pool.connect();
    console.log('成功连接到数据库');
    
    // 1. 检查company字段的定义
    console.log('\n1. 检查company字段定义:');
    const columnInfoQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default,
        character_maximum_length,
        udt_name
      FROM 
        information_schema.columns 
      WHERE 
        table_schema = 'public' 
        AND table_name = 'customers'
        AND column_name = 'company'
    `;
    
    const columnResult = await client.query(columnInfoQuery);
    console.log('company字段信息:');
    console.table(columnResult.rows);
    
    // 2. 检查company字段的约束
    console.log('\n2. 检查company字段的约束:');
    const constraintQuery = `
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        cc.check_clause
      FROM
        information_schema.table_constraints tc
      JOIN
        information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN
        information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
      WHERE
        tc.table_schema = 'public'
        AND tc.table_name = 'customers'
        AND kcu.column_name = 'company'
    `;
    
    const constraintResult = await client.query(constraintQuery);
    console.log('company字段约束:');
    console.table(constraintResult.rows);
    
    // 3. 检查company字段的值域
    console.log('\n3. 检查company字段的值分布:');
    const valueDistributionQuery = `
      SELECT
        company as 值,
        count(*) as 数量
      FROM
        customers
      GROUP BY
        company
      ORDER BY
        count(*) DESC
    `;
    
    const valueResult = await client.query(valueDistributionQuery);
    console.log('company字段值分布:');
    console.table(valueResult.rows);
    
    // 4. 检查新增客户时company字段的问题
    console.log('\n4. 检查新增客户时company字段可能的问题:');
    const insertTestQuery = `
      EXPLAIN ANALYZE
      INSERT INTO customers 
      (customer_name, register_date, company) 
      VALUES 
      ('测试客户', NOW(), '昊尘')
      RETURNING *
    `;
    
    try {
      const insertResult = await client.query(insertTestQuery);
      console.log('模拟插入分析:');
      insertResult.rows.forEach(row => console.log(row));
    } catch (error) {
      console.error('模拟插入失败:', error.message);
    }
    
    client.release();
  } catch (error) {
    console.error('检查过程中发生错误:', error);
  } finally {
    await pool.end();
  }
}

checkCompanyField(); 