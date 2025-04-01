/**
 * 修改组件数量字段为可空状态的脚本
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

async function allowNullModuleCount() {
  const client = await pool.connect();
  try {
    // 开始事务
    await client.query('BEGIN');
    
    console.log('成功连接到数据库');
    
    // 检查module_count字段的当前状态
    console.log('检查组件数量字段的当前状态:');
    const moduleCountFieldQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable 
      FROM 
        information_schema.columns 
      WHERE 
        table_schema = 'public' 
        AND table_name = 'customers'
        AND column_name = 'module_count'
    `;
    
    const moduleCountFieldResult = await client.query(moduleCountFieldQuery);
    console.log('组件数量字段当前定义:');
    console.table(moduleCountFieldResult.rows);
    
    // 检查是否需要更新module_count字段为可空
    if (moduleCountFieldResult.rows.length > 0 && moduleCountFieldResult.rows[0].is_nullable === 'NO') {
      console.log('组件数量字段当前为非空，修改为可空...');
      try {
        await client.query(`
          ALTER TABLE customers
          ALTER COLUMN module_count DROP NOT NULL
        `);
        console.log('成功修改组件数量字段为可空');
      } catch (error) {
        console.error('修改组件数量字段过程中发生错误:', error.message);
        await client.query('ROLLBACK');
        throw error;
      }
    } else {
      console.log('组件数量字段已经是可空的，无需修改');
    }
    
    // 完成事务
    await client.query('COMMIT');
    console.log('\n操作已成功完成！');
    
  } catch (error) {
    console.error('执行过程中发生错误:', error);
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

allowNullModuleCount(); 