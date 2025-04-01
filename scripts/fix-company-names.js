/**
 * 修复数据库中公司名称的脚本
 * 将英文表示的公司名称（如youZhi）更新为中文表示（如祐之）
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

async function fixCompanyNames() {
  const client = await pool.connect();
  try {
    // 开始事务
    await client.query('BEGIN');
    
    console.log('成功连接到数据库');
    
    // 1. 检查公司字段的当前状态
    console.log('\n1. 检查公司字段的分布情况:');
    const companyDistributionQuery = `
      SELECT 
        company, 
        COUNT(*) as count
      FROM 
        customers
      GROUP BY 
        company
      ORDER BY 
        count DESC
    `;
    
    const companyDistribution = await client.query(companyDistributionQuery);
    console.log('公司字段当前分布:');
    console.table(companyDistribution.rows);
    
    // 2. 修复英文表示的公司名称
    console.log('\n2. 修复英文表示的公司名称:');
    
    // 将 'youZhi' 更新为 '祐之'
    const updateYouZhiQuery = `
      UPDATE customers
      SET company = '祐之'
      WHERE company = 'youZhi'
      RETURNING id, customer_name, company
    `;
    
    const youZhiResult = await client.query(updateYouZhiQuery);
    console.log(`更新了 ${youZhiResult.rowCount} 条记录，从 'youZhi' 到 '祐之':`);
    if (youZhiResult.rowCount > 0) {
      console.table(youZhiResult.rows.slice(0, 5)); // 只显示前5条作为示例
      if (youZhiResult.rowCount > 5) {
        console.log(`... 以及其他 ${youZhiResult.rowCount - 5} 条记录`);
      }
    }
    
    // 将 'haochen' 更新为 '昊尘'
    const updateHaochenQuery = `
      UPDATE customers
      SET company = '昊尘'
      WHERE company = 'haochen'
      RETURNING id, customer_name, company
    `;
    
    const haochenResult = await client.query(updateHaochenQuery);
    console.log(`更新了 ${haochenResult.rowCount} 条记录，从 'haochen' 到 '昊尘':`);
    if (haochenResult.rowCount > 0) {
      console.table(haochenResult.rows.slice(0, 5)); // 只显示前5条作为示例
      if (haochenResult.rowCount > 5) {
        console.log(`... 以及其他 ${haochenResult.rowCount - 5} 条记录`);
      }
    }
    
    // 3. 确认修复后的公司字段分布
    console.log('\n3. 确认修复后的公司字段分布:');
    const fixedCompanyDistribution = await client.query(companyDistributionQuery);
    console.log('修复后的公司字段分布:');
    console.table(fixedCompanyDistribution.rows);
    
    // 完成事务
    await client.query('COMMIT');
    console.log('\n所有修复都已成功完成！');
    
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

fixCompanyNames(); 