/**
 * 检查所有触发器和存储过程
 * 这个脚本会查找所有可能引用已删除字段'construction_acceptance_status'的数据库对象
 */
require('dotenv').config();
const { Client } = require('pg');

async function checkAllDatabaseObjects() {
  const client = new Client({
    user: process.env.SUPABASE_DB_USER || process.env.SUPABASE_USER,
    password: process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_PASSWORD,
    host: process.env.SUPABASE_DB_HOST || process.env.SUPABASE_HOST,
    port: process.env.SUPABASE_DB_PORT || process.env.SUPABASE_PORT,
    database: process.env.SUPABASE_DB_NAME || process.env.SUPABASE_DATABASE,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('===================================');
    console.log('  数据库对象检查工具');
    console.log('===================================\n');

    await client.connect();
    console.log('[信息] 连接数据库成功');

    // 1. 检查所有触发器
    console.log('\n[检查] 查找所有触发器和函数...');
    const triggersResult = await client.query(`
      SELECT 
        trigger_name,
        event_object_table,
        event_manipulation,
        action_statement
      FROM 
        information_schema.triggers
      ORDER BY 
        event_object_table, trigger_name;
    `);

    // 2. 检查所有函数定义
    const functionsResult = await client.query(`
      SELECT 
        routine_name,
        routine_definition
      FROM 
        information_schema.routines
      WHERE 
        routine_type = 'FUNCTION'
        AND routine_schema = 'public';
    `);

    // 3. 检查引用已删除字段的触发器
    console.log('\n[检查] 分析触发器引用...');
    const problematicTriggers = [];
    for (const trigger of triggersResult.rows) {
      if (trigger.action_statement.includes('construction_acceptance_status')) {
        problematicTriggers.push({
          type: '触发器',
          name: trigger.trigger_name,
          table: trigger.event_object_table,
          event: trigger.event_manipulation,
          problematicField: 'construction_acceptance_status'
        });
      }
    }

    // 4. 检查引用已删除字段的函数
    const problematicFunctions = [];
    for (const func of functionsResult.rows) {
      const definition = func.routine_definition || '';
      if (definition.includes('construction_acceptance_status')) {
        problematicFunctions.push({
          type: '函数',
          name: func.routine_name,
          problematicField: 'construction_acceptance_status'
        });
      }
    }

    // 5. 检查RPC函数
    console.log('\n[检查] 分析RPC函数...');
    const rpcResult = await client.query(`
      SELECT 
        p.proname AS name,
        pg_get_functiondef(p.oid) AS definition
      FROM 
        pg_proc p
      JOIN 
        pg_namespace n ON p.pronamespace = n.oid
      WHERE 
        n.nspname = 'public';
    `);

    const problematicRPCs = [];
    for (const rpc of rpcResult.rows) {
      const definition = rpc.definition || '';
      if (definition.includes('construction_acceptance_status')) {
        problematicRPCs.push({
          type: 'RPC函数',
          name: rpc.name,
          problematicField: 'construction_acceptance_status'
        });
      }
    }

    // 6. 显示结果
    console.log('\n===================================');
    console.log('  检查结果');
    console.log('===================================');

    const allProblems = [...problematicTriggers, ...problematicFunctions, ...problematicRPCs];
    
    if (allProblems.length === 0) {
      console.log('\n[成功] 没有发现引用已删除字段的数据库对象');
    } else {
      console.log(`\n[警告] 发现 ${allProblems.length} 个引用已删除字段的数据库对象:`);
      allProblems.forEach((item, index) => {
        console.log(`\n${index + 1}. 类型: ${item.type}`);
        console.log(`   名称: ${item.name}`);
        if (item.table) {
          console.log(`   表: ${item.table}`);
        }
        if (item.event) {
          console.log(`   事件: ${item.event}`);
        }
        console.log(`   问题字段: ${item.problematicField}`);
      });

      // 7. 生成修复脚本
      console.log('\n===================================');
      console.log('  修复建议');
      console.log('===================================');

      console.log('\n请使用以下脚本修复上述问题:');
      console.log('\n```sql');
      console.log('BEGIN;');
      console.log('-- 删除有问题的触发器');
      problematicTriggers.forEach(trigger => {
        console.log(`DROP TRIGGER IF EXISTS ${trigger.name} ON ${trigger.table};`);
      });
      
      console.log('\n-- 删除有问题的函数');
      problematicFunctions.forEach(func => {
        console.log(`DROP FUNCTION IF EXISTS ${func.name}();`);
      });

      console.log('\n-- 删除有问题的RPC函数');
      problematicRPCs.forEach(rpc => {
        if (!problematicFunctions.some(f => f.name === rpc.name)) {
          console.log(`DROP FUNCTION IF EXISTS ${rpc.name}();`);
        }
      });
      console.log('COMMIT;');
      console.log('```');
    }

  } catch (err) {
    console.error('\n[错误] 执行查询出错:', err);
  } finally {
    await client.end();
    console.log('\n[信息] 数据库连接已关闭');
  }
}

checkAllDatabaseObjects().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
}); 