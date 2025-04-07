/**
 * 检查customers表中与construction_acceptance相关的触发器和字段
 */
require('dotenv').config();
const { Client } = require('pg');

async function checkTriggers() {
  const client = new Client({
    user: process.env.SUPABASE_DB_USER || process.env.SUPABASE_USER,
    password: process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_PASSWORD,
    host: process.env.SUPABASE_DB_HOST || process.env.SUPABASE_HOST,
    port: process.env.SUPABASE_DB_PORT || process.env.SUPABASE_PORT,
    database: process.env.SUPABASE_DB_NAME || process.env.SUPABASE_DATABASE,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('连接数据库成功');
    
    const result = await client.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        action_statement
      FROM 
        information_schema.triggers
      WHERE 
        event_object_table = 'customers'
        AND (trigger_name LIKE '%construction_acceptance%' OR action_statement LIKE '%construction_acceptance_status%')
      ORDER BY 
        trigger_name;
    `);
    
    if (result.rows.length === 0) {
      console.log('没有找到与construction_acceptance相关的触发器');
    } else {
      console.log(`找到 ${result.rows.length} 个相关触发器：`);
      result.rows.forEach(trigger => {
        console.log(`触发器名称: ${trigger.trigger_name}`);
        console.log(`事件类型: ${trigger.event_manipulation}`);
        console.log(`操作语句: ${trigger.action_statement.substring(0, 100)}...`);
        console.log();
      });
    }

    // 检查字段是否存在
    const columnResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      AND column_name = 'construction_acceptance_status';
    `);
    
    if (columnResult.rows.length === 0) {
      console.log('customers表中不存在construction_acceptance_status字段');
    } else {
      console.log('customers表中存在construction_acceptance_status字段');
    }
    
  } catch (err) {
    console.error('执行查询出错:', err);
  } finally {
    await client.end();
    console.log('数据库连接已关闭');
  }
}

checkTriggers(); 