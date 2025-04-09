/**
 * 测试更新施工队时派工日期的变化情况
 * 此脚本模拟前端对施工队字段的更新，检查派工日期是否正确更新
 */

require('dotenv').config({ path: '.env.db' });
const { Client } = require('pg');

// 连接数据库
const client = new Client({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: false // 禁用SSL
});

async function testDispatchDateConsistency() {
  try {
    console.log('正在连接数据库...');
    await client.connect();
    console.log('已连接到数据库');

    // 1. 获取一个测试客户
    const getCustomerQuery = `
      SELECT id, customer_name, construction_team, dispatch_date
      FROM customers
      WHERE id = '8eb1cc5f-fda5-4e49-899b-18d6b978b711'
      LIMIT 1;
    `;
    const customerResult = await client.query(getCustomerQuery);
    
    if (customerResult.rows.length === 0) {
      console.log('未找到测试客户，将创建一个新客户');
      
      // 创建一个测试客户
      const createCustomerQuery = `
        INSERT INTO customers (customer_name, phone, address)
        VALUES ('测试客户', '13800138000', '测试地址')
        RETURNING id, customer_name;
      `;
      const createResult = await client.query(createCustomerQuery);
      console.log('已创建测试客户:', createResult.rows[0]);
      
      // 使用新创建的客户
      var testCustomer = createResult.rows[0];
    } else {
      // 使用已有客户
      var testCustomer = customerResult.rows[0];
      console.log('使用已有测试客户:', testCustomer);
    }

    // 2. 测试设置施工队为null，检查派工日期是否自动设为null
    console.log('测试1: 设置施工队为null');
    const updateQuery1 = `
      UPDATE customers
      SET construction_team = null
      WHERE id = $1
      RETURNING id, customer_name, construction_team, dispatch_date;
    `;
    const updateResult1 = await client.query(updateQuery1, [testCustomer.id]);
    console.log('更新结果:', updateResult1.rows[0]);
    console.log('派工日期是否为null:', updateResult1.rows[0].dispatch_date === null);

    // 等待一秒，避免时间戳太接近
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. 测试设置施工队为非null值，检查派工日期是否自动设置为当前日期
    console.log('测试2: 设置施工队为非null值');
    const updateQuery2 = `
      UPDATE customers
      SET construction_team = '测试施工队'
      WHERE id = $1
      RETURNING id, customer_name, construction_team, dispatch_date;
    `;
    const updateResult2 = await client.query(updateQuery2, [testCustomer.id]);
    console.log('更新结果:', updateResult2.rows[0]);
    console.log('派工日期是否被设置:', updateResult2.rows[0].dispatch_date !== null);
    
    if (updateResult2.rows[0].dispatch_date) {
      console.log('派工日期:', new Date(updateResult2.rows[0].dispatch_date).toISOString());
    }

    // 4. 测试修改施工队为另一个非null值，检查派工日期是否保持不变
    console.log('测试3: 修改施工队为另一个非null值');
    const updateQuery3 = `
      UPDATE customers
      SET construction_team = '另一个测试施工队'
      WHERE id = $1
      RETURNING id, customer_name, construction_team, dispatch_date;
    `;
    const updateResult3 = await client.query(updateQuery3, [testCustomer.id]);
    console.log('更新结果:', updateResult3.rows[0]);
    console.log('派工日期是否保持不变:', updateResult3.rows[0].dispatch_date !== null);
    
    if (updateResult3.rows[0].dispatch_date) {
      console.log('派工日期:', new Date(updateResult3.rows[0].dispatch_date).toISOString());
    }

    console.log('测试完成');
  } catch (error) {
    console.error('执行脚本时出错:', error);
  } finally {
    await client.end();
    console.log('数据库连接已关闭');
  }
}

testDispatchDateConsistency(); 