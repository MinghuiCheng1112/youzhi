/**
 * 检查数据库中派工日期与施工队的关联情况
 * 此脚本连接数据库并检查是否存在派工日期与施工队不一致的数据
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

async function checkDispatchDateConsistency() {
  try {
    console.log('正在连接数据库...');
    console.log('连接配置:', {
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      ssl: false
    });
    await client.connect();
    console.log('已连接到数据库');

    // 检查触发器是否存在
    const triggerCheckQuery = `
      SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'ensure_dispatch_date_consistency'
      );
    `;
    const triggerResult = await client.query(triggerCheckQuery);
    if (triggerResult.rows[0].exists) {
      console.log('触发器 ensure_dispatch_date_consistency 存在');
    } else {
      console.log('警告: 触发器 ensure_dispatch_date_consistency 不存在');
    }

    // 检查施工队为空但派工日期不为空的情况
    const inconsistentQuery1 = `
      SELECT id, customer_name, construction_team, dispatch_date
      FROM customers
      WHERE (construction_team IS NULL OR construction_team = '')
      AND dispatch_date IS NOT NULL;
    `;
    const result1 = await client.query(inconsistentQuery1);
    if (result1.rows.length > 0) {
      console.log('发现施工队为空但派工日期不为空的记录:', result1.rows.length, '条');
      console.log('示例记录:');
      result1.rows.slice(0, 5).forEach(row => {
        console.log(row);
      });
    } else {
      console.log('没有发现施工队为空但派工日期不为空的记录');
    }

    // 检查施工队不为空但派工日期为空的情况
    const inconsistentQuery2 = `
      SELECT id, customer_name, construction_team, dispatch_date
      FROM customers
      WHERE construction_team IS NOT NULL AND construction_team != ''
      AND dispatch_date IS NULL;
    `;
    const result2 = await client.query(inconsistentQuery2);
    if (result2.rows.length > 0) {
      console.log('发现施工队不为空但派工日期为空的记录:', result2.rows.length, '条');
      console.log('示例记录:');
      result2.rows.slice(0, 5).forEach(row => {
        console.log(row);
      });
    } else {
      console.log('没有发现施工队不为空但派工日期为空的记录');
    }

    // 检查最近更新的记录中是否有不一致的情况
    const recentChangesQuery = `
      SELECT id, customer_name, construction_team, dispatch_date, updated_at
      FROM customers
      WHERE updated_at > NOW() - INTERVAL '3 days'
      ORDER BY updated_at DESC
      LIMIT 10;
    `;
    const recentResult = await client.query(recentChangesQuery);
    console.log('最近更新的记录:');
    recentResult.rows.forEach(row => {
      console.log(row);
    });

    console.log('检查完成');
  } catch (error) {
    console.error('执行脚本时出错:', error);
  } finally {
    await client.end();
    console.log('数据库连接已关闭');
  }
}

checkDispatchDateConsistency(); 