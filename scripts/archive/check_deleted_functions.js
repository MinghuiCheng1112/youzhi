/**
 * 检查客户删除相关的函数定义
 */
require('dotenv').config();
const { Client } = require('pg');

async function checkDeleteFunctions() {
  const client = new Client({
    user: process.env.SUPABASE_DB_USER || process.env.SUPABASE_USER,
    password: process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_PASSWORD,
    host: process.env.SUPABASE_DB_HOST || process.env.SUPABASE_HOST,
    port: process.env.SUPABASE_DB_PORT || process.env.SUPABASE_PORT,
    database: process.env.SUPABASE_DB_NAME || process.env.SUPABASE_DATABASE,
    ssl: false
  });

  try {
    await client.connect();
    console.log('连接数据库成功');
    
    // 获取capture_soft_deleted_customer函数定义
    const captureFunctionResult = await client.query(`
      SELECT pg_get_functiondef(oid) AS definition
      FROM pg_proc 
      WHERE proname = 'capture_soft_deleted_customer';
    `);
    
    // 获取record_deleted_customer函数定义
    const recordFunctionResult = await client.query(`
      SELECT pg_get_functiondef(oid) AS definition
      FROM pg_proc 
      WHERE proname = 'record_deleted_customer';
    `);
    
    // 检查deleted_records表的所有列
    const deletedRecordsColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'deleted_records'
      ORDER BY ordinal_position;
    `);
    
    // 提取列名到一个数组
    const existingColumns = deletedRecordsColumns.rows.map(row => row.column_name);
    console.log('\n=== deleted_records表现有列 ===');
    console.log(existingColumns.join(', '));
    
    // 1. 检查capture_soft_deleted_customer函数
    if (captureFunctionResult.rows.length > 0) {
      const captureDefinition = captureFunctionResult.rows[0].definition;
      console.log('\n=== capture_soft_deleted_customer函数定义 ===');
      console.log(captureDefinition);
      
      // 执行问题分析
      analyzeFunctionDefinition('capture_soft_deleted_customer', captureDefinition, existingColumns);
    } else {
      console.log('找不到capture_soft_deleted_customer函数');
    }
    
    // 2. 检查record_deleted_customer函数
    if (recordFunctionResult.rows.length > 0) {
      const recordDefinition = recordFunctionResult.rows[0].definition;
      console.log('\n=== record_deleted_customer函数定义 ===');
      console.log(recordDefinition);
      
      // 执行问题分析
      analyzeFunctionDefinition('record_deleted_customer', recordDefinition, existingColumns);
    } else {
      console.log('找不到record_deleted_customer函数');
    }
    
  } catch (err) {
    console.error('执行查询出错:', err);
  } finally {
    await client.end();
    console.log('\n数据库连接已关闭');
  }
}

// 分析函数定义中的问题
function analyzeFunctionDefinition(functionName, definition, existingColumns) {
  console.log(`\n=== 分析 ${functionName} 引用问题 ===`);
  
  // 从函数定义中解析列名引用
  const columnReferences = parseColumnReferences(definition);
  
  // 检查引用的列是否存在于deleted_records表中
  const missingColumns = columnReferences.filter(col => !existingColumns.includes(col));
  
  if (missingColumns.length > 0) {
    console.log(`[问题] 函数引用了不存在的列: ${missingColumns.join(', ')}`);
    
    // 提供修复建议
    suggestFix(functionName, definition, missingColumns);
  } else {
    console.log('[正常] 未发现引用不存在列的问题');
  }
}

// 从函数定义中解析出引用的列名
function parseColumnReferences(definition) {
  // 正则表达式: 从NEW.xx和OLD.xx模式中提取列名
  const newColRegex = /NEW\.([a-z_]+)/g;
  const oldColRegex = /OLD\.([a-z_]+)/g;
  
  // 从INSERT INTO deleted_records (col1, col2, ...) 模式中提取列名
  const insertColsRegex = /INSERT\s+INTO\s+deleted_records\s*\(([^)]+)\)/i;
  
  // 收集所有列名引用
  const refs = new Set();
  
  // 提取NEW.xx引用
  let match;
  while ((match = newColRegex.exec(definition)) !== null) {
    refs.add(match[1]);
  }
  
  // 提取OLD.xx引用
  while ((match = oldColRegex.exec(definition)) !== null) {
    refs.add(match[1]);
  }
  
  // 提取INSERT INTO语句中的列名
  const insertMatch = insertColsRegex.exec(definition);
  if (insertMatch) {
    const columnList = insertMatch[1].split(',').map(col => col.trim());
    columnList.forEach(col => refs.add(col));
  }
  
  return Array.from(refs);
}

// 提供修复建议
function suggestFix(functionName, definition, missingColumns) {
  console.log('\n=== 修复建议 ===');
  console.log(`函数 ${functionName} 引用了这些不存在的列: ${missingColumns.join(', ')}`);
  console.log('建议修改函数定义，移除对这些列的引用。');
  
  // 针对不同的函数提供具体建议
  if (functionName === 'capture_soft_deleted_customer') {
    console.log('1. 在函数中移除对这些列的所有引用');
    console.log('2. 确保INSERT INTO语句不包含这些列');
  } else if (functionName === 'record_deleted_customer') {
    console.log('1. 在函数中移除对这些列的所有引用');
    console.log('2. 确保INSERT INTO语句不包含这些列');
  }
}

checkDeleteFunctions().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
}); 