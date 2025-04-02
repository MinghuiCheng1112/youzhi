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

async function fixAllFields() {
  const client = await pool.connect();
  
  try {
    console.log('连接到数据库成功');
    
    // 开始事务
    await client.query('BEGIN');
    
    // 检查并修复construction_acceptance字段
    console.log('检查construction_acceptance字段...');
    const { rows: caCheck } = await client.query(`
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      AND column_name = 'construction_acceptance'
    `);
    
    if (caCheck.length > 0) {
      console.log('construction_acceptance字段存在，执行迁移...');
      await client.query(`
        UPDATE customers
        SET 
          construction_acceptance_status = 
            CASE 
              WHEN construction_acceptance IS NULL THEN 'pending'
              WHEN construction_acceptance LIKE 'waiting:%' THEN 'waiting'
              ELSE 'completed'
            END,
          construction_acceptance_date = 
            CASE 
              WHEN construction_acceptance IS NULL THEN NULL
              WHEN construction_acceptance LIKE 'waiting:%' THEN
                -- 从waiting格式中提取日期
                SUBSTRING(construction_acceptance FROM POSITION(':' IN SUBSTRING(construction_acceptance FROM POSITION(':' IN construction_acceptance) + 1)) + POSITION(':' IN construction_acceptance) + 1)::TIMESTAMP
              ELSE construction_acceptance::TIMESTAMP
            END,
          construction_acceptance_notes = 
            CASE 
              WHEN construction_acceptance IS NULL THEN NULL
              WHEN construction_acceptance LIKE 'waiting:%' THEN 
                -- 从waiting格式中提取等待天数
                '等待中 - 设置于 ' || NOW()::TEXT
              ELSE '已验收'
            END,
          construction_acceptance_waiting_days = 
            CASE 
              WHEN construction_acceptance LIKE 'waiting:%' THEN 
                -- 从waiting格式中提取等待天数
                SUBSTRING(construction_acceptance FROM POSITION(':' IN construction_acceptance) + 1 FOR POSITION(':' IN SUBSTRING(construction_acceptance FROM POSITION(':' IN construction_acceptance) + 1)) - 1)::INTEGER
              ELSE NULL
            END,
          construction_acceptance_waiting_start = 
            CASE 
              WHEN construction_acceptance LIKE 'waiting:%' THEN
                -- 从waiting格式中提取日期
                SUBSTRING(construction_acceptance FROM POSITION(':' IN SUBSTRING(construction_acceptance FROM POSITION(':' IN construction_acceptance) + 1)) + POSITION(':' IN construction_acceptance) + 1)::TIMESTAMP
              ELSE NULL
            END
        WHERE TRUE;
        
        ALTER TABLE customers DROP COLUMN construction_acceptance;
      `);
      console.log('construction_acceptance字段已迁移并删除');
    } else {
      console.log('construction_acceptance字段不存在，无需迁移');
    }
    
    // 检查并修复technical_review字段
    console.log('检查technical_review字段...');
    const { rows: trCheck } = await client.query(`
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      AND column_name = 'technical_review'
    `);
    
    if (trCheck.length > 0) {
      console.log('technical_review字段存在，执行迁移...');
      await client.query(`
        UPDATE customers
        SET 
          technical_review_status = 
            CASE 
              WHEN technical_review IS NULL THEN 'pending'
              ELSE 'approved'
            END,
          technical_review_date = 
            CASE 
              WHEN technical_review IS NULL THEN NULL
              ELSE technical_review::TIMESTAMP
            END,
          technical_review_notes = 
            CASE 
              WHEN technical_review IS NULL THEN NULL
              ELSE '已通过审核'
            END
        WHERE TRUE;
        
        ALTER TABLE customers DROP COLUMN technical_review;
      `);
      console.log('technical_review字段已迁移并删除');
    } else {
      console.log('technical_review字段不存在，无需迁移');
    }
    
    // 更新视图
    console.log('更新视图...');
    await client.query(`
      -- 建设验收视图
      DROP VIEW IF EXISTS vw_construction_acceptance_status;
      CREATE OR REPLACE VIEW vw_construction_acceptance_status AS
      SELECT 
          id, 
          customer_name,
          construction_acceptance_status,
          construction_acceptance_date,
          construction_acceptance_notes,
          construction_acceptance_waiting_days,
          construction_acceptance_waiting_start,
          CASE
              WHEN construction_acceptance_status = 'waiting' AND construction_acceptance_waiting_start IS NOT NULL THEN
                  -- 计算已等待天数
                  EXTRACT(DAY FROM (NOW() - construction_acceptance_waiting_start))::INTEGER
              ELSE NULL
          END AS days_waiting,
          CASE
              WHEN construction_acceptance_status = 'waiting' AND 
                   construction_acceptance_waiting_days IS NOT NULL AND 
                   construction_acceptance_waiting_start IS NOT NULL THEN
                  -- 计算预计完成日期
                  construction_acceptance_waiting_start + (construction_acceptance_waiting_days || ' days')::INTERVAL
              ELSE NULL
          END AS expected_completion_date
      FROM customers;
      
      -- 技术审核视图
      DROP VIEW IF EXISTS vw_technical_review_status;
      CREATE OR REPLACE VIEW vw_technical_review_status AS
      SELECT 
          id, 
          customer_name,
          technical_review_status,
          technical_review_date,
          technical_review_notes,
          CASE
              WHEN technical_review_status = 'approved' THEN technical_review_date
              ELSE NULL
          END AS approval_date,
          CASE
              WHEN technical_review_status = 'rejected' THEN technical_review_date
              ELSE NULL
          END AS rejection_date
      FROM customers;
    `);
    console.log('视图已更新');
    
    // 刷新缓存
    console.log('刷新数据库缓存...');
    await client.query('ANALYZE customers;');
    
    // 提交事务
    await client.query('COMMIT');
    console.log('所有修复操作已完成!');
    
  } catch (error) {
    // 如果有错误，回滚事务
    await client.query('ROLLBACK');
    console.error('修复脚本执行失败:', error);
    throw error;
  } finally {
    // 释放客户端连接
    client.release();
    await pool.end();
  }
}

// 执行修复脚本
fixAllFields()
  .then(() => {
    console.log('数据库修复完成，连接已关闭');
  })
  .catch(err => {
    console.error('修复过程中发生错误:', err);
    process.exit(1);
  }); 