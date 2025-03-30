#!/usr/bin/env node

/**
 * 数据库表结构查询脚本
 * 
 * 本脚本连接到Supabase数据库并列出所有表及其字段结构
 * 使用方法: node scripts/db-schema.js
 */

const dotenv = require('dotenv');
const path = require('path');
const { Pool } = require('pg');
const colors = require('ansi-colors');

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 从环境变量中获取Supabase连接信息
const SUPABASE_DB_HOST = process.env.SUPABASE_DB_HOST;
const SUPABASE_DB = process.env.SUPABASE_DB || 'postgres';
const SUPABASE_DB_USER = process.env.SUPABASE_DB_USER || 'postgres';
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const SUPABASE_DB_PORT = process.env.SUPABASE_DB_PORT || 5432;

// 验证必要的环境变量是否存在
if (!SUPABASE_DB_HOST || !SUPABASE_DB_PASSWORD) {
  console.error('缺少Supabase数据库连接信息。请确保.env文件中包含必要的环境变量：');
  console.error('SUPABASE_DB_HOST, SUPABASE_DB_PASSWORD');
  process.exit(1);
}

// 构建连接信息
const connectionConfig = {
  host: SUPABASE_DB_HOST,
  port: SUPABASE_DB_PORT,
  database: SUPABASE_DB,
  user: SUPABASE_DB_USER,
  password: SUPABASE_DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

console.log('正在连接到:', `postgresql://${connectionConfig.user}:****@${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`);

// 创建连接池
const pool = new Pool(connectionConfig);

/**
 * 获取所有表名
 */
async function getAllTables() {
  const query = `
    SELECT 
      table_name 
    FROM 
      information_schema.tables 
    WHERE 
      table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY 
      table_name
  `;
  
  const { rows } = await pool.query(query);
  return rows.map(row => row.table_name);
}

/**
 * 获取指定表的列信息
 */
async function getTableColumns(tableName) {
  const query = `
    SELECT 
      column_name, 
      data_type, 
      is_nullable, 
      column_default,
      CASE 
        WHEN character_maximum_length IS NOT NULL THEN character_maximum_length::text
        WHEN numeric_precision IS NOT NULL THEN 
          numeric_precision::text || ',' || numeric_scale::text
        ELSE NULL
      END AS size_or_precision
    FROM 
      information_schema.columns 
    WHERE 
      table_schema = 'public' 
      AND table_name = $1
    ORDER BY 
      ordinal_position
  `;
  
  const { rows } = await pool.query(query, [tableName]);
  return rows;
}

/**
 * 获取表的主键信息
 */
async function getTablePrimaryKeys(tableName) {
  const query = `
    SELECT 
      kcu.column_name
    FROM 
      information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE 
      tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1
    ORDER BY 
      kcu.ordinal_position
  `;
  
  const { rows } = await pool.query(query, [tableName]);
  return rows.map(row => row.column_name);
}

/**
 * 获取表的外键信息
 */
async function getTableForeignKeys(tableName) {
  const query = `
    SELECT
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM
      information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE
      tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1
  `;
  
  const { rows } = await pool.query(query, [tableName]);
  return rows;
}

/**
 * 获取表的索引信息
 */
async function getTableIndexes(tableName) {
  const query = `
    SELECT
      indexname,
      indexdef
    FROM
      pg_indexes
    WHERE
      schemaname = 'public'
      AND tablename = $1
    ORDER BY
      indexname
  `;
  
  const { rows } = await pool.query(query, [tableName]);
  return rows;
}

/**
 * 显示表结构信息
 */
async function displayTableStructure() {
  try {
    const client = await pool.connect();
    console.log(colors.green.bold('成功连接到Supabase PostgreSQL数据库！'));
    
    // 获取数据库基本信息
    const infoResult = await client.query(`
      SELECT 
        current_database() as database, 
        current_user as user, 
        version() as version
    `);
    
    console.log(colors.cyan.bold('\n数据库连接信息:'));
    console.table(infoResult.rows[0]);
    
    // 获取所有表
    const tables = await getAllTables();
    console.log(colors.cyan.bold(`\n找到 ${tables.length} 个表:\n`));
    
    // 对每个表显示详细信息
    for (const tableName of tables) {
      console.log(colors.yellow.bold(`\n表名: ${tableName}`));
      
      // 获取主键
      const primaryKeys = await getTablePrimaryKeys(tableName);
      if (primaryKeys.length > 0) {
        console.log(colors.magenta(`主键: ${primaryKeys.join(', ')}`));
      }
      
      // 获取列信息
      const columns = await getTableColumns(tableName);
      console.log(colors.cyan('列信息:'));
      
      // 格式化列信息
      const formattedColumns = columns.map(col => {
        let typeInfo = col.data_type;
        if (col.size_or_precision) {
          typeInfo += `(${col.size_or_precision})`;
        }
        
        const pkMark = primaryKeys.includes(col.column_name) ? colors.red('PK') : '';
        const nullableInfo = col.is_nullable === 'YES' ? '' : 'NOT NULL';
        const defaultInfo = col.column_default ? `DEFAULT ${col.column_default}` : '';
        
        return {
          列名: col.column_name,
          类型: typeInfo,
          约束: [pkMark, nullableInfo, defaultInfo].filter(Boolean).join(' ')
        };
      });
      
      console.table(formattedColumns);
      
      // 获取外键信息
      const foreignKeys = await getTableForeignKeys(tableName);
      if (foreignKeys.length > 0) {
        console.log(colors.cyan('外键关系:'));
        const formattedFKs = foreignKeys.map(fk => ({
          '列名': fk.column_name,
          '引用表': fk.foreign_table_name,
          '引用列': fk.foreign_column_name
        }));
        console.table(formattedFKs);
      }
      
      // 获取索引信息
      const indexes = await getTableIndexes(tableName);
      if (indexes.length > 0) {
        console.log(colors.cyan('索引:'));
        const formattedIndexes = indexes.map(idx => ({
          '索引名': idx.indexname,
          '定义': idx.indexdef
        }));
        console.table(formattedIndexes);
      }
      
      console.log(colors.gray('--------------------------------------'));
    }
    
    client.release();
  } catch (error) {
    console.error(colors.red('查询数据库结构时出错:'), error);
  } finally {
    // 关闭连接池
    await pool.end();
    console.log(colors.green('数据库连接已关闭'));
  }
}

// 执行主函数
displayTableStructure().catch(err => {
  console.error(colors.red('执行脚本时发生错误:'), err);
  process.exit(1);
}); 