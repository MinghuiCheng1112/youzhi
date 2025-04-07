/**
 * 执行客户删除修复SQL脚本
 * 此脚本连接到数据库并执行scripts/cleanup/fix_customer_delete.sql中的SQL命令
 * 用于检查和修复客户删除失败的问题
 */

require('dotenv').config(); // 使用主环境变量文件
const fs = require('fs');
const { Client } = require('pg');
const path = require('path');

// 数据库连接配置
const dbConfig = {
  user: process.env.SUPABASE_DB_USER || process.env.SUPABASE_USER,
  password: process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_PASSWORD,
  host: process.env.SUPABASE_DB_HOST || process.env.SUPABASE_HOST,
  port: process.env.SUPABASE_DB_PORT || process.env.SUPABASE_PORT,
  database: process.env.SUPABASE_DB_NAME || process.env.SUPABASE_DATABASE,
  ssl: { rejectUnauthorized: false } // 允许自签名证书
};

// 颜色配置
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

async function runSQLScript() {
  console.log(`${colors.bright}${colors.blue}====================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  客户删除问题自动修复工具${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}====================================${colors.reset}\n`);

  // 创建数据库连接
  const client = new Client(dbConfig);

  try {
    console.log(`${colors.cyan}[信息] 连接到数据库...${colors.reset}`);
    await client.connect();
    console.log(`${colors.green}[成功] 数据库连接成功${colors.reset}\n`);

    // 读取 SQL 脚本
    const sqlFilePath = path.join(__dirname, 'auto_fix_customer_delete.sql');
    console.log(`${colors.cyan}[信息] 读取 SQL 脚本: ${sqlFilePath}${colors.reset}`);
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL 脚本文件不存在: ${sqlFilePath}`);
    }
    
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    console.log(`${colors.green}[成功] SQL 脚本已加载${colors.reset}\n`);

    // 日志拦截器，用于记录 SQL 执行的 NOTICE 消息
    client.on('notice', msg => {
      const message = msg.message.trim();
      
      if (message.includes('修复外键约束')) {
        console.log(`${colors.yellow}${message}${colors.reset}`);
      } else if (message.includes('成功修复')) {
        console.log(`${colors.green}${message}${colors.reset}`);
      } else if (message.includes('出错')) {
        console.log(`${colors.red}${message}${colors.reset}`);
      } else if (message.includes('已删除')) {
        console.log(`${colors.green}${message}${colors.reset}`);
      } else if (message.includes('没有发现')) {
        console.log(`${colors.cyan}${message}${colors.reset}`);
      } else if (message.includes('修复计划')) {
        console.log(`\n${colors.bright}${colors.yellow}${message}${colors.reset}`);
      } else if (message.includes('需要修复') || message.includes('需要清理')) {
        console.log(`${colors.yellow}${message}${colors.reset}`);
      } else if (message.includes('修复工作已完成')) {
        console.log(`\n${colors.bright}${colors.green}${message}${colors.reset}`);
      } else if (message.includes('如果你想删除特定客户') || message.includes('如果你修改了数据库结构')) {
        console.log(`${colors.cyan}${message}${colors.reset}`);
      } else if (message.includes('==========================')) {
        console.log(`${colors.blue}${message}${colors.reset}`);
      } else {
        console.log(`${colors.dim}${message}${colors.reset}`);
      }
    });

    // 执行 SQL 脚本
    console.log(`${colors.cyan}[信息] 开始执行 SQL 脚本...${colors.reset}`);
    await client.query(sqlScript);
    console.log(`\n${colors.green}[成功] SQL 脚本执行完成${colors.reset}`);

    // 额外的诊断：列出仍然引用 customers 表的外键约束
    console.log(`\n${colors.cyan}[信息] 执行额外诊断...${colors.reset}`);
    
    // 诊断1：检查外键引用
    console.log(`\n${colors.bright}[诊断] 检查引用 customers 表的外键约束：${colors.reset}`);
    const fkQuery = `
      SELECT 
        tc.table_name, 
        kcu.column_name,
        tc.constraint_name,
        rc.delete_rule
      FROM 
        information_schema.table_constraints AS tc 
      JOIN 
        information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN 
        information_schema.constraint_column_usage AS ccu 
        ON ccu.constraint_name = tc.constraint_name
      JOIN
        information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE 
        tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name = 'customers'
      ORDER BY tc.table_name, kcu.column_name;
    `;
    
    const fkRes = await client.query(fkQuery);
    
    if (fkRes.rows.length === 0) {
      console.log(`${colors.green}没有发现任何引用 customers 表的外键约束${colors.reset}`);
    } else {
      console.log(`${colors.yellow}发现 ${fkRes.rows.length} 个引用 customers 表的外键约束：${colors.reset}`);
      
      console.table(fkRes.rows.map(row => ({
        '表名': row.table_name,
        '列名': row.column_name,
        '约束名': row.constraint_name,
        '删除规则': row.delete_rule,
        '状态': row.delete_rule === 'CASCADE' ? '✓ 已配置级联删除' : '✗ 未配置级联删除'
      })));
    }

    // 诊断2：检查触发器
    console.log(`\n${colors.bright}[诊断] 检查 customers 表上的触发器：${colors.reset}`);
    const triggerQuery = `
      SELECT 
        trigger_name,
        event_manipulation,
        action_statement
      FROM 
        information_schema.triggers
      WHERE 
        event_object_table = 'customers'
      ORDER BY 
        trigger_name;
    `;
    
    const triggerRes = await client.query(triggerQuery);
    
    if (triggerRes.rows.length === 0) {
      console.log(`${colors.green}没有发现 customers 表上的触发器${colors.reset}`);
    } else {
      console.log(`${colors.yellow}发现 ${triggerRes.rows.length} 个 customers 表上的触发器：${colors.reset}`);
      
      for (const trigger of triggerRes.rows) {
        console.log(`${colors.yellow}触发器名称: ${trigger.trigger_name}${colors.reset}`);
        console.log(`${colors.dim}事件类型: ${trigger.event_manipulation}${colors.reset}`);
        console.log(`${colors.dim}操作语句: ${trigger.action_statement.substring(0, 100)}...${colors.reset}`);
        console.log();
      }
    }

    // 诊断3：检查孤立记录
    console.log(`\n${colors.bright}[诊断] 检查孤立记录：${colors.reset}`);
    const orphanedQuery = `
      SELECT 
        'modification_records' AS table_name,
        COUNT(*) AS orphaned_count
      FROM 
        modification_records mr
      WHERE 
        NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = mr.customer_id)
      UNION ALL
      SELECT 
        'draw_records' AS table_name,
        COUNT(*) AS orphaned_count
      FROM 
        draw_records dr
      WHERE 
        NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = dr.customer_id);
    `;
    
    const orphanedRes = await client.query(orphanedQuery);
    
    let hasOrphaned = false;
    for (const row of orphanedRes.rows) {
      if (row.orphaned_count > 0) {
        hasOrphaned = true;
        console.log(`${colors.red}发现 ${row.orphaned_count} 条孤立的 ${row.table_name} 记录${colors.reset}`);
      }
    }
    
    if (!hasOrphaned) {
      console.log(`${colors.green}没有发现任何孤立记录${colors.reset}`);
    }

    console.log(`\n${colors.bright}${colors.green}✓ 诊断完成${colors.reset}`);
    console.log(`\n${colors.cyan}[提示] 如果你仍然遇到删除客户的问题，请尝试使用以下 SQL 函数:${colors.reset}`);
    console.log(`${colors.yellow}SELECT safe_delete_customer('客户UUID');${colors.reset}`);

  } catch (err) {
    console.error(`\n${colors.red}[错误] 执行过程中出现错误:${colors.reset}`);
    console.error(`${colors.red}${err.message}${colors.reset}`);
    
    if (err.stack) {
      console.error(`\n${colors.dim}错误堆栈:${colors.reset}`);
      console.error(`${colors.dim}${err.stack}${colors.reset}`);
    }
  } finally {
    // 关闭数据库连接
    try {
      await client.end();
      console.log(`\n${colors.cyan}[信息] 数据库连接已关闭${colors.reset}`);
    } catch (err) {
      console.error(`${colors.red}[错误] 关闭数据库连接时出错: ${err.message}${colors.reset}`);
    }
    
    console.log(`\n${colors.bright}${colors.blue}====================================${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}  修复工具执行完成${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}====================================${colors.reset}`);
  }
}

// 运行脚本
runSQLScript().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
}); 