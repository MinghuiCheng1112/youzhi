require('dotenv').config();
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

async function checkFields() {
  console.log('开始检查相关字段...');
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('已连接到数据库');
    
    // 检查表结构
    console.log('\n===== 表结构检查 =====');
    const tableStructureQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'customers'
      AND column_name IN (
        'technical_review', 'technical_review_date', 'technical_review_notes',
        'construction_acceptance', 'construction_acceptance_date', 'construction_acceptance_notes',
        'upload_to_grid', 'construction_status', 'main_line'
      )
      ORDER BY column_name;
    `;
    
    const tableStructure = await client.query(tableStructureQuery);
    console.table(tableStructure.rows);
    
    // 检查字段使用情况
    console.log('\n===== 字段使用情况 =====');
    const fieldUsageQuery = `
      SELECT 
        column_name,
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE value IS NOT NULL) as non_null_records,
        ROUND(COUNT(*) FILTER (WHERE value IS NOT NULL)::numeric / COUNT(*) * 100, 2) as usage_percentage
      FROM (
        SELECT 
          technical_review, technical_review_date, technical_review_notes,
          construction_acceptance, construction_acceptance_date, construction_acceptance_notes,
          upload_to_grid, construction_status, main_line
        FROM customers
      ) t
      CROSS JOIN LATERAL (
        VALUES 
          ('technical_review', technical_review),
          ('technical_review_date', technical_review_date),
          ('technical_review_notes', technical_review_notes),
          ('construction_acceptance', construction_acceptance),
          ('construction_acceptance_date', construction_acceptance_date),
          ('construction_acceptance_notes', construction_acceptance_notes),
          ('upload_to_grid', upload_to_grid),
          ('construction_status', construction_status),
          ('main_line', main_line)
      ) as x(column_name, value)
      GROUP BY column_name
      ORDER BY usage_percentage DESC;
    `;
    
    const fieldUsage = await client.query(fieldUsageQuery);
    console.table(fieldUsage.rows);
    
    console.log('\n检查完成！');
  } catch (err) {
    console.error('检查字段使用情况时发生错误：', err);
  } finally {
    await client.end();
    console.log('数据库连接已关闭');
  }
}

checkFields(); 