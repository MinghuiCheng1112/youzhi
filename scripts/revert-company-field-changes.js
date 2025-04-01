/**
 * 还原之前对数据库的修改：
 * 1. 删除公司字段的检查约束
 * 2. 将电话字段恢复为非空
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

async function revertChanges() {
  const client = await pool.connect();
  try {
    // 开始事务
    await client.query('BEGIN');
    
    console.log('成功连接到数据库');
    
    // 1. 检查并删除公司字段的约束
    console.log('\n1. 检查并删除公司字段的约束：');
    const checkExistingConstraintQuery = `
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'customers'
      AND constraint_name = 'customers_company_check'
    `;
    
    const existingConstraint = await client.query(checkExistingConstraintQuery);
    
    if (existingConstraint.rows.length > 0) {
      console.log('找到公司字段约束，将删除它');
      try {
        await client.query(`
          ALTER TABLE customers
          DROP CONSTRAINT customers_company_check
        `);
        console.log('成功删除公司字段约束');
      } catch (error) {
        console.error('删除约束过程中发生错误:', error.message);
        await client.query('ROLLBACK');
        throw error;
      }
    } else {
      console.log('未找到公司字段约束，无需删除');
    }
    
    // 2. 检查并修改phone字段为非空
    console.log('\n2. 检查并修改phone字段为非空：');
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
    
    // 检查是否需要更新phone字段为非空
    if (phoneFieldResult.rows.length > 0 && phoneFieldResult.rows[0].is_nullable === 'YES') {
      // 查看是否有空值记录
      const nullPhoneQuery = `
        SELECT count(*) as null_count
        FROM customers
        WHERE phone IS NULL
      `;
      
      const nullPhoneResult = await client.query(nullPhoneQuery);
      const nullCount = parseInt(nullPhoneResult.rows[0].null_count);
      
      if (nullCount > 0) {
        console.log(`警告: 有 ${nullCount} 条记录的phone字段为空。无法将字段设为非空。`);
        console.log('请先更新这些记录，为其设置有效的电话号码。');
      } else {
        console.log('电话字段当前可为空，将修改为非空...');
        try {
          await client.query(`
            ALTER TABLE customers
            ALTER COLUMN phone SET NOT NULL
          `);
          console.log('成功修改phone字段为非空');
        } catch (error) {
          console.error('修改phone字段过程中发生错误:', error.message);
          await client.query('ROLLBACK');
          throw error;
        }
      }
    } else {
      console.log('电话字段已经是非空的，无需修改');
    }
    
    // 完成事务
    await client.query('COMMIT');
    console.log('\n所有还原操作都已成功完成！');
    
  } catch (error) {
    console.error('执行还原过程中发生错误:', error);
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

revertChanges();