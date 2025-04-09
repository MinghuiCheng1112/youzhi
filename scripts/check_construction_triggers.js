/**
 * 脚本用于检查数据库中的触发器和函数是否还引用已删除的字段
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

// 获取数据库连接信息
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const pgConnection = process.env.POSTGRES_CONNECTION_STRING;

async function checkDatabaseObjects() {
  try {
    // 使用PostgreSQL连接池直接连接
    const pool = new Pool({
      connectionString: pgConnection
    });

    console.log('连接数据库...');
    const client = await pool.connect();

    console.log('检查触发器函数...');
    const query = `
      SELECT 
        routine_name, 
        routine_definition 
      FROM 
        information_schema.routines 
      WHERE 
        routine_definition LIKE '%construction_acceptance_waiting%' OR
        routine_definition LIKE '%construction_acceptance_status%' OR
        routine_definition LIKE '%construction_acceptance_notes%'
    `;

    const { rows } = await client.query(query);
    
    if (rows.length === 0) {
      console.log('没有找到引用废弃字段的触发器函数！');
    } else {
      console.log(`找到 ${rows.length} 个引用废弃字段的触发器函数：`);
      
      for (const row of rows) {
        console.log(`\n函数名: ${row.routine_name}`);
        console.log('------------------------');
        console.log(row.routine_definition);
        console.log('------------------------');
      }
      
      console.log('\n需要修复这些函数以删除对废弃字段的引用');
    }

    // 检查触发器
    console.log('\n检查触发器...');
    const triggerQuery = `
      SELECT 
        trigger_name,
        event_manipulation,
        action_statement
      FROM 
        information_schema.triggers
      WHERE 
        action_statement LIKE '%construction_acceptance_waiting%' OR
        action_statement LIKE '%construction_acceptance_status%' OR
        action_statement LIKE '%construction_acceptance_notes%'
    `;

    const triggerResult = await client.query(triggerQuery);
    
    if (triggerResult.rows.length === 0) {
      console.log('没有找到引用废弃字段的触发器！');
    } else {
      console.log(`找到 ${triggerResult.rows.length} 个引用废弃字段的触发器：`);
      
      for (const row of triggerResult.rows) {
        console.log(`\n触发器名: ${row.trigger_name}`);
        console.log(`事件: ${row.event_manipulation}`);
        console.log('------------------------');
        console.log(row.action_statement);
        console.log('------------------------');
      }
      
      console.log('\n需要修复这些触发器以删除对废弃字段的引用');
    }

    // 关闭连接
    client.release();
    await pool.end();
    
    console.log('数据库连接已关闭');
  } catch (error) {
    console.error('检查数据库对象时出错:', error);
  }
}

// 执行检查
checkDatabaseObjects(); 