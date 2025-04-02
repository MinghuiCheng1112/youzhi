require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// 数据库连接配置
const dbConfig = {
  host: process.env.SUPABASE_DB_HOST,
  port: process.env.SUPABASE_DB_PORT,
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

async function optimizeFields() {
  console.log('开始执行字段优化...');
  const client = new Client(dbConfig);
  
  try {
    // 连接数据库
    await client.connect();
    console.log('已连接到数据库');
    
    // 读取SQL脚本
    const sqlFilePath = path.join(__dirname, 'optimize_review_acceptance_fields.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('已读取SQL脚本文件');
    
    // 执行SQL脚本
    console.log('开始执行SQL脚本...');
    await client.query(sqlScript);
    console.log('SQL脚本执行完成');
    
    // 验证字段是否添加成功
    console.log('\n===== 验证新字段 =====');
    const fieldsQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'customers'
      AND column_name IN (
        'technical_review_status',
        'construction_acceptance_status',
        'construction_acceptance_waiting_days',
        'construction_acceptance_waiting_start'
      )
      ORDER BY column_name;
    `;
    
    const fieldsResult = await client.query(fieldsQuery);
    console.table(fieldsResult.rows);
    
    // 检查数据迁移情况
    console.log('\n===== 检查数据迁移情况 =====');
    const dataMigrationQuery = `
      SELECT 
        COUNT(*) as total_customers,
        COUNT(*) FILTER (WHERE technical_review_status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE technical_review_status = 'rejected') as rejected_count,
        COUNT(*) FILTER (WHERE technical_review_status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE construction_acceptance_status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE construction_acceptance_status = 'waiting') as waiting_count,
        COUNT(*) FILTER (WHERE construction_acceptance_status = 'pending') as ca_pending_count
      FROM customers;
    `;
    
    const dataMigrationResult = await client.query(dataMigrationQuery);
    console.table(dataMigrationResult.rows);
    
    // 检查索引创建情况
    console.log('\n===== 检查索引创建情况 =====');
    const indexesQuery = `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'customers'
      AND indexname IN (
        'idx_customers_technical_review_status',
        'idx_customers_construction_acceptance_status'
      );
    `;
    
    const indexesResult = await client.query(indexesQuery);
    console.table(indexesResult.rows);
    
    // 检查约束创建情况
    console.log('\n===== 检查约束创建情况 =====');
    const constraintsQuery = `
      SELECT conname, pg_get_constraintdef(oid) as constraint_def
      FROM pg_constraint
      WHERE conrelid = 'customers'::regclass
      AND conname IN (
        'check_technical_review_status',
        'check_construction_acceptance_status'
      );
    `;
    
    const constraintsResult = await client.query(constraintsQuery);
    console.table(constraintsResult.rows);
    
    // 检查触发器创建情况
    console.log('\n===== 检查触发器创建情况 =====');
    const triggersQuery = `
      SELECT 
        trigger_name,
        event_manipulation,
        action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'customers'
      AND trigger_name IN (
        'update_technical_review_status',
        'update_construction_acceptance_status'
      );
    `;
    
    const triggersResult = await client.query(triggersQuery);
    console.table(triggersResult.rows);
    
    // 检查视图创建情况
    console.log('\n===== 检查视图创建情况 =====');
    const viewsQuery = `
      SELECT viewname
      FROM pg_views
      WHERE viewname IN (
        'vw_technical_review_status',
        'vw_construction_acceptance_status'
      );
    `;
    
    const viewsResult = await client.query(viewsQuery);
    console.table(viewsResult.rows);
    
    console.log('\n字段优化已成功完成！');
  } catch (err) {
    console.error('执行字段优化时发生错误：', err);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await client.end();
    console.log('数据库连接已关闭');
  }
}

// 执行优化
optimizeFields(); 