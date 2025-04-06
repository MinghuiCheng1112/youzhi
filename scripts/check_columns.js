require('dotenv').config();
const { Client } = require('pg');

async function checkColumns() {
  // 连接数据库
  const client = new Client({
    host: process.env.SUPABASE_DB_HOST,
    database: process.env.SUPABASE_DB_NAME,
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    port: process.env.SUPABASE_DB_PORT,
    ssl: { 
      rejectUnauthorized: false
    }
  });

  try {
    console.log('正在连接Supabase数据库...');
    await client.connect();

    // 要检查的列
    const columnsToCheck = [
      'construction_acceptance_waiting_start',
      'construction_acceptance_notes',
      'construction_acceptance_waiting_days',
      'construction_acceptance_status',
      'construction_acceptance_date'
    ];

    console.log('检查列是否存在...');
    
    // 运行查询检查列是否存在
    const query = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'customers'
      AND column_name = ANY($1);
    `;
    
    const result = await client.query(query, [columnsToCheck]);
    
    console.log('\n==== 检查结果 ====');
    
    if (result.rows.length === 0) {
      console.log('指定的列都不存在于customers表中');
    } else {
      console.log('以下列仍然存在于customers表中:');
      result.rows.forEach(row => {
        console.log(`- ${row.column_name} (${row.data_type}, ${row.is_nullable === 'YES' ? '可空' : '非空'})`);
      });
      
      // 检查哪些列已被删除
      const existingColumns = result.rows.map(row => row.column_name);
      const deletedColumns = columnsToCheck.filter(col => !existingColumns.includes(col));
      
      if (deletedColumns.length > 0) {
        console.log('\n以下列已被成功删除:');
        deletedColumns.forEach(col => {
          console.log(`- ${col}`);
        });
      }
    }
    
  } catch (err) {
    console.error('执行查询时出错:', err.message);
  } finally {
    // 关闭数据库连接
    await client.end();
    console.log('\n数据库连接已关闭');
  }
}

// 执行检查
checkColumns(); 