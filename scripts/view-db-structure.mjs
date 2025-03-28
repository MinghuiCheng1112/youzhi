#!/usr/bin/env node

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量，指定从项目根目录加载.env文件
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 从环境变量中获取Supabase连接信息
const SUPABASE_DB_HOST = process.env.SUPABASE_DB_HOST;
const SUPABASE_DB = process.env.SUPABASE_DB;
const SUPABASE_DB_USER = process.env.SUPABASE_DB_USER;
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const SUPABASE_DB_PORT = process.env.SUPABASE_DB_PORT;

// 验证必要的环境变量是否存在
if (!SUPABASE_DB_HOST || !SUPABASE_DB_PASSWORD) {
  console.error('缺少Supabase数据库连接信息。请确保.env文件中包含必要的环境变量。');
  process.exit(1);
}

// 构建连接信息
const connectionConfig = {
  host: SUPABASE_DB_HOST,
  port: SUPABASE_DB_PORT || 5432,
  database: SUPABASE_DB || 'postgres',
  user: SUPABASE_DB_USER || 'postgres',
  password: SUPABASE_DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

console.log('正在连接到:', `postgresql://${connectionConfig.user}:****@${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`);

// 创建连接池
const pool = new Pool(connectionConfig);

// 获取数据库表结构的函数
async function getDatabaseStructure() {
  const client = await pool.connect();
  
  try {
    console.log('成功连接到Supabase PostgreSQL数据库！');
    
    // 1. 获取数据库连接信息
    const infoResult = await client.query('SELECT current_database() as db, current_user as user, version() as version');
    console.log('\n数据库连接信息:');
    console.table(infoResult.rows);
    
    // 2. 获取所有表
    const tablesQuery = `
      SELECT 
        table_schema, 
        table_name, 
        table_type
      FROM 
        information_schema.tables 
      WHERE 
        table_schema = 'public' 
      ORDER BY 
        table_schema, table_name
    `;
    const tablesResult = await client.query(tablesQuery);
    console.log('\n数据库表列表:');
    console.table(tablesResult.rows);
    
    // 3. 获取每个表的列信息
    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;
      
      // 获取表的列信息
      const columnsQuery = `
        SELECT 
          column_name, 
          data_type, 
          is_nullable, 
          column_default,
          character_maximum_length
        FROM 
          information_schema.columns 
        WHERE 
          table_schema = 'public' 
          AND table_name = $1
        ORDER BY 
          ordinal_position
      `;
      const columnsResult = await client.query(columnsQuery, [tableName]);
      
      console.log(`\n表 "${tableName}" 的结构:`);
      console.table(columnsResult.rows);
      
      // 获取主键信息
      const primaryKeyQuery = `
        SELECT 
          tc.constraint_name, 
          kcu.column_name
        FROM 
          information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE 
          tc.constraint_type = 'PRIMARY KEY' 
          AND tc.table_schema = 'public' 
          AND tc.table_name = $1;
      `;
      const pkResult = await client.query(primaryKeyQuery, [tableName]);
      
      if (pkResult.rows.length > 0) {
        console.log(`表 "${tableName}" 的主键:`);
        console.table(pkResult.rows);
      }
      
      // 获取外键信息
      const foreignKeyQuery = `
        SELECT 
          tc.constraint_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
        FROM 
          information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage ccu 
            ON ccu.constraint_name = tc.constraint_name
        WHERE 
          tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_schema = 'public' 
          AND tc.table_name = $1;
      `;
      const fkResult = await client.query(foreignKeyQuery, [tableName]);
      
      if (fkResult.rows.length > 0) {
        console.log(`表 "${tableName}" 的外键关系:`);
        console.table(fkResult.rows);
      }
      
      // 获取索引信息
      const indexQuery = `
        SELECT
          i.relname as index_name,
          a.attname as column_name,
          ix.indisunique as is_unique
        FROM
          pg_class t,
          pg_class i,
          pg_index ix,
          pg_attribute a
        WHERE
          t.oid = ix.indrelid
          AND i.oid = ix.indexrelid
          AND a.attrelid = t.oid
          AND a.attnum = ANY(ix.indkey)
          AND t.relkind = 'r'
          AND t.relname = $1
        ORDER BY
          t.relname,
          i.relname;
      `;
      const indexResult = await client.query(indexQuery, [tableName]);
      
      if (indexResult.rows.length > 0) {
        console.log(`表 "${tableName}" 的索引:`);
        console.table(indexResult.rows);
      }
      
      console.log('\n' + '-'.repeat(80));
    }
    
    // 4. 获取所有视图
    const viewsQuery = `
      SELECT 
        table_schema, 
        table_name 
      FROM 
        information_schema.views 
      WHERE 
        table_schema = 'public' 
      ORDER BY 
        table_schema, table_name
    `;
    const viewsResult = await client.query(viewsQuery);
    
    if (viewsResult.rows.length > 0) {
      console.log('\n数据库视图列表:');
      console.table(viewsResult.rows);
      
      // 查看视图定义
      for (const viewRow of viewsResult.rows) {
        const viewName = viewRow.table_name;
        const viewDefQuery = `
          SELECT pg_get_viewdef('"public"."${viewName}"'::regclass, true) as view_definition;
        `;
        const viewDefResult = await client.query(viewDefQuery);
        
        console.log(`\n视图 "${viewName}" 的定义:`);
        console.log(viewDefResult.rows[0].view_definition);
        console.log('\n' + '-'.repeat(80));
      }
    }
    
    // 5. 获取所有函数
    const functionsQuery = `
      SELECT 
        n.nspname as schema_name,
        p.proname as function_name,
        pg_get_function_arguments(p.oid) as args,
        CASE WHEN p.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype THEN 'trigger'
             ELSE pg_get_function_result(p.oid)
        END as result_type
      FROM 
        pg_proc p
        LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE 
        n.nspname = 'public'
      ORDER BY 
        schema_name, function_name;
    `;
    const functionsResult = await client.query(functionsQuery);
    
    if (functionsResult.rows.length > 0) {
      console.log('\n数据库函数列表:');
      console.table(functionsResult.rows);
    }
    
    // 6. 获取Row Level Security (RLS) 策略信息
    const rlsQuery = `
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM 
        pg_policies
      WHERE 
        schemaname = 'public'
      ORDER BY 
        tablename, policyname;
    `;
    const rlsResult = await client.query(rlsQuery);
    
    if (rlsResult.rows.length > 0) {
      console.log('\n行级安全策略 (RLS) 列表:');
      console.table(rlsResult.rows);
    }
    
  } catch (err) {
    console.error('查询数据库结构失败:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行主函数
getDatabaseStructure().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
}); 