/**
 * 修复派工日期与施工队的关联
 * 此脚本确保数据库中所有记录的施工队与派工日期保持一致
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

async function fixDispatchDateConsistency() {
  try {
    console.log('正在连接数据库...');
    await client.connect();
    console.log('已连接到数据库');

    // 1. 修复施工队为空但派工日期不为空的情况
    console.log('正在修复施工队为空但派工日期不为空的情况...');
    const fixQuery1 = `
      UPDATE customers
      SET dispatch_date = NULL
      WHERE (construction_team IS NULL OR construction_team = '')
      AND dispatch_date IS NOT NULL
      RETURNING id, customer_name, construction_team, dispatch_date;
    `;
    const fixResult1 = await client.query(fixQuery1);
    console.log(`修复了 ${fixResult1.rowCount} 条记录，施工队为空但派工日期不为空`);
    if (fixResult1.rows.length > 0) {
      console.log('示例记录:');
      fixResult1.rows.slice(0, 5).forEach(row => {
        console.log(row);
      });
    }

    // 2. 修复施工队不为空但派工日期为空的情况
    console.log('正在修复施工队不为空但派工日期为空的情况...');
    const fixQuery2 = `
      UPDATE customers
      SET dispatch_date = CURRENT_DATE
      WHERE construction_team IS NOT NULL 
      AND construction_team != ''
      AND dispatch_date IS NULL
      RETURNING id, customer_name, construction_team, dispatch_date;
    `;
    const fixResult2 = await client.query(fixQuery2);
    console.log(`修复了 ${fixResult2.rowCount} 条记录，施工队不为空但派工日期为空`);
    if (fixResult2.rows.length > 0) {
      console.log('示例记录:');
      fixResult2.rows.slice(0, 5).forEach(row => {
        console.log(row);
      });
    }

    // 3. 再次验证是否还有不一致的记录
    console.log('正在验证数据一致性...');
    
    // 检查施工队为空但派工日期不为空的情况
    const verifyQuery1 = `
      SELECT COUNT(*) as count
      FROM customers
      WHERE (construction_team IS NULL OR construction_team = '')
      AND dispatch_date IS NOT NULL;
    `;
    const verifyResult1 = await client.query(verifyQuery1);
    console.log(`施工队为空但派工日期不为空的记录数: ${verifyResult1.rows[0].count}`);
    
    // 检查施工队不为空但派工日期为空的情况
    const verifyQuery2 = `
      SELECT COUNT(*) as count
      FROM customers
      WHERE construction_team IS NOT NULL 
      AND construction_team != ''
      AND dispatch_date IS NULL;
    `;
    const verifyResult2 = await client.query(verifyQuery2);
    console.log(`施工队不为空但派工日期为空的记录数: ${verifyResult2.rows[0].count}`);

    if (verifyResult1.rows[0].count === '0' && verifyResult2.rows[0].count === '0') {
      console.log('所有记录的施工队与派工日期现在都保持一致');
    } else {
      console.log('警告: 仍有不一致的记录，请检查数据库');
    }

    // 4. 检查触发器是否存在
    const triggerCheckQuery = `
      SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'ensure_dispatch_date_consistency'
      );
    `;
    const triggerResult = await client.query(triggerCheckQuery);
    if (triggerResult.rows[0].exists) {
      console.log('触发器 ensure_dispatch_date_consistency 存在，这将确保未来的更新保持一致性');
    } else {
      console.log('警告: 触发器 ensure_dispatch_date_consistency 不存在，请执行触发器创建脚本');
    }

    console.log('修复完成');
  } catch (error) {
    console.error('执行脚本时出错:', error);
  } finally {
    await client.end();
    console.log('数据库连接已关闭');
  }
}

fixDispatchDateConsistency(); 