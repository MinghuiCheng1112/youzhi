require('dotenv').config();
const { Client } = require('pg');

// 检查环境变量
const requiredEnvVars = [
  'SUPABASE_DB_HOST',
  'SUPABASE_DB_PORT',
  'SUPABASE_DB_NAME',
  'SUPABASE_DB_USER',
  'SUPABASE_DB_PASSWORD',
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('缺少以下环境变量：', missingEnvVars.join(', '));
  process.exit(1);
}

// 数据库连接配置
const dbConfig = {
  host: process.env.SUPABASE_DB_HOST,
  port: process.env.SUPABASE_DB_PORT,
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

async function checkFieldsUsage() {
  console.log('开始检查技术审核和建设验收相关字段...');
  const client = new Client(dbConfig);
  
  try {
    // 连接数据库
    await client.connect();
    console.log('已连接到数据库');
    
    // 1. 检查customers表结构中的相关字段
    console.log('\n===== 检查customers表结构 =====');
    const tableStructureQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'customers'
      AND column_name IN (
        'technical_review', 'construction_acceptance', 
        'upload_to_grid', 'construction_status', 'main_line',
        'square_steel_outbound_date', 'component_outbound_date'
      )
      ORDER BY ordinal_position;
    `;
    
    const tableStructure = await client.query(tableStructureQuery);
    console.table(tableStructure.rows);
    
    // 2. 检查字段使用情况
    console.log('\n===== 检查字段使用情况 =====');
    const fieldUsageQuery = `
      SELECT 
        column_name,
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE column_name IS NOT NULL) as non_null_records,
        ROUND(COUNT(*) FILTER (WHERE column_name IS NOT NULL)::numeric / COUNT(*) * 100, 2) as usage_percentage
      FROM (
        SELECT technical_review, construction_acceptance, upload_to_grid, 
               construction_status, main_line, square_steel_outbound_date, component_outbound_date
        FROM customers
      ) t
      CROSS JOIN LATERAL (
        VALUES 
          ('technical_review', technical_review),
          ('construction_acceptance', construction_acceptance),
          ('upload_to_grid', upload_to_grid),
          ('construction_status', construction_status),
          ('main_line', main_line),
          ('square_steel_outbound_date', square_steel_outbound_date),
          ('component_outbound_date', component_outbound_date)
      ) as x(column_name, column_value)
      GROUP BY column_name
      ORDER BY usage_percentage DESC;
    `;
    
    const fieldUsage = await client.query(fieldUsageQuery);
    console.table(fieldUsage.rows);
    
    // 3. 检查字段值的分布情况
    console.log('\n===== 检查字段值分布 =====');
    for (const field of ['technical_review', 'construction_acceptance', 'upload_to_grid', 'construction_status', 'main_line']) {
      const valueDistributionQuery = `
        SELECT 
          ${field} as value, 
          COUNT(*) as count,
          ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM customers WHERE ${field} IS NOT NULL) * 100, 2) as percentage
        FROM customers 
        WHERE ${field} IS NOT NULL
        GROUP BY ${field}
        ORDER BY count DESC
        LIMIT 10;
      `;
      
      try {
        const valueDistribution = await client.query(valueDistributionQuery);
        if (valueDistribution.rows.length > 0) {
          console.log(`\n${field} 字段值分布:`);
          console.table(valueDistribution.rows);
        } else {
          console.log(`\n${field} 字段没有非空值`);
        }
      } catch (err) {
        console.error(`查询 ${field} 字段值分布时出错:`, err.message);
      }
    }
    
    // 4. 检查日期字段的格式一致性
    console.log('\n===== 检查日期字段格式一致性 =====');
    for (const field of ['square_steel_outbound_date', 'component_outbound_date']) {
      const dateFormatQuery = `
        SELECT 
          CASE 
            WHEN ${field} ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN 'YYYY-MM-DD'
            WHEN ${field} ~ '^\\d{4}/\\d{2}/\\d{2}$' THEN 'YYYY/MM/DD'
            WHEN ${field} ~ '^\\d{2}-\\d{2}-\\d{4}$' THEN 'DD-MM-YYYY'
            WHEN ${field} ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN 'DD/MM/YYYY'
            ELSE 'other'
          END as format,
          COUNT(*) as count,
          ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM customers WHERE ${field} IS NOT NULL) * 100, 2) as percentage
        FROM customers
        WHERE ${field} IS NOT NULL
        GROUP BY format
        ORDER BY count DESC;
      `;
      
      try {
        const dateFormat = await client.query(dateFormatQuery);
        if (dateFormat.rows.length > 0) {
          console.log(`\n${field} 日期格式分布:`);
          console.table(dateFormat.rows);
        } else {
          console.log(`\n${field} 字段没有非空值`);
        }
      } catch (err) {
        console.error(`查询 ${field} 日期格式时出错:`, err.message);
      }
    }
    
    console.log('\n检查完成！');
  } catch (err) {
    console.error('检查字段使用情况时发生错误：', err);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await client.end();
    console.log('数据库连接已关闭');
  }
}

// 执行主函数
checkFieldsUsage().catch(err => {
  console.error('执行脚本时发生错误：', err);
  process.exit(1);
}); 