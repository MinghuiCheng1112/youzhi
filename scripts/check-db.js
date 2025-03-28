import pg from 'pg';
const { Pool } = pg;

// 连接到Supabase数据库
const pool = new Pool({
  host: 'db.xvjmntuvkfnxdmvqnusl.supabase.co', // 这是一个猜测的主机名，可能需要修改
  database: 'postgres',
  user: 'postgres',
  password: '6npns5PuooEPzSCg',
  port: 5432,
  ssl: {
    rejectUnauthorized: false // 如果需要SSL连接
  }
});

// 检查 customers 表的结构
async function checkCustomersTable() {
  try {
    const client = await pool.connect();
    console.log('成功连接到数据库');

    // 获取customers表的所有列
    const columnsRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'customers'
      ORDER BY ordinal_position;
    `);
    
    console.log('customers表结构:');
    columnsRes.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? '(可为空)' : '(不可为空)'}`);
    });
    
    // 特别检查我们需要的状态字段
    const statusFields = [
      'inverter_status', 'inverter_inbound_date',
      'copper_wire_status', 'copper_wire_inbound_date',
      'aluminum_wire_status', 'aluminum_wire_inbound_date',
      'distribution_box_status', 'distribution_box_inbound_date'
    ];
    
    const missingFields = [];
    for (const field of statusFields) {
      const found = columnsRes.rows.some(row => row.column_name === field);
      if (!found) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      console.log('\n缺少的字段:');
      missingFields.forEach(field => console.log(`- ${field}`));
    } else {
      console.log('\n所有需要的状态字段都存在');
    }
    
    client.release();
  } catch (err) {
    console.error('数据库查询出错:', err);
  } finally {
    pool.end();
  }
}

checkCustomersTable(); 