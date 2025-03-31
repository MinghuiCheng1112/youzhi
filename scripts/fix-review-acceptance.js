/**
 * 修复技术审核栏和建设验收栏的功能
 * - 技术审核栏：记录审核通过时间
 * - 建设验收栏：记录立即标记为已推到时间
 */
require('dotenv').config();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// 获取数据库连接配置
const connectionConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

console.log('使用以下数据库配置:');
console.log(`Host: ${connectionConfig.host}`);
console.log(`Database: ${connectionConfig.database}`);
console.log(`User: ${connectionConfig.user}`);
console.log(`Port: ${connectionConfig.port}`);
console.log(`SSL: ${Boolean(connectionConfig.ssl)}`);

// 创建连接池
const pool = new Pool(connectionConfig);

// 修复技术审核栏和建设验收栏的SQL命令
const sqlCommands = [
  // 1. 修复技术审核函数，确保始终记录审核通过时间
  `CREATE OR REPLACE FUNCTION update_technical_review_timestamp()
  RETURNS TRIGGER AS $$
  BEGIN
    -- 如果技术审核字段从NULL变为非NULL，记录当前时间
    IF (OLD.technical_review IS NULL AND NEW.technical_review IS NOT NULL) THEN
      -- 将technical_review设置为当前时间戳，而不是布尔值
      NEW.technical_review := now();
      -- 同时更新相关字段
      NEW.technical_review_date := now();
      NEW.technical_review_notes := COALESCE(NEW.technical_review_notes, '已通过技术审核');
      -- 清除驳回状态
      NEW.technical_review_rejected := NULL;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;`,

  // 2. 创建技术审核时间戳触发器
  `DROP TRIGGER IF EXISTS update_technical_review_timestamp ON customers;`,

  `CREATE TRIGGER update_technical_review_timestamp
  BEFORE UPDATE ON customers
  FOR EACH ROW
  WHEN (OLD.technical_review IS DISTINCT FROM NEW.technical_review)
  EXECUTE FUNCTION update_technical_review_timestamp();`,

  // 3. 修复建设验收栏，确保记录标记时间
  `CREATE OR REPLACE FUNCTION update_construction_acceptance_timestamp()
  RETURNS TRIGGER AS $$
  BEGIN
    -- 如果建设验收字段从NULL变为非NULL且不是以"waiting:"开头，记录当前时间
    IF (OLD.construction_acceptance IS NULL AND NEW.construction_acceptance IS NOT NULL AND 
        (NEW.construction_acceptance IS NULL OR NOT NEW.construction_acceptance::text LIKE 'waiting:%')) THEN
      -- 将construction_acceptance设置为当前时间戳
      NEW.construction_acceptance := now();
      -- 同时更新相关字段
      NEW.construction_acceptance_date := now();
      NEW.construction_acceptance_notes := COALESCE(NEW.construction_acceptance_notes, '今日验收完成');
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;`,

  // 4. 创建建设验收时间戳触发器
  `DROP TRIGGER IF EXISTS update_construction_acceptance_timestamp ON customers;`,

  `CREATE TRIGGER update_construction_acceptance_timestamp
  BEFORE UPDATE ON customers
  FOR EACH ROW
  WHEN (OLD.construction_acceptance IS DISTINCT FROM NEW.construction_acceptance)
  EXECUTE FUNCTION update_construction_acceptance_timestamp();`,

  // 5. 修复现有的技术审核数据
  `UPDATE customers 
  SET technical_review = now(),
      technical_review_date = now()
  WHERE technical_review::text = 'true' 
  OR technical_review::text = 't';`,

  // 6. 修复现有的建设验收数据
  `UPDATE customers 
  SET construction_acceptance = now(),
      construction_acceptance_date = now()
  WHERE construction_acceptance::text = 'true' 
  OR construction_acceptance::text = 't';`
];

// 执行SQL命令
async function executeCommands() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (let i = 0; i < sqlCommands.length; i++) {
      const command = sqlCommands[i];
      console.log(`执行命令 ${i + 1}/${sqlCommands.length}...`);
      await client.query(command);
      console.log('命令执行成功');
    }
    
    await client.query('COMMIT');
    console.log('\n所有命令执行成功！');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('执行过程中发生错误:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 主函数
async function main() {
  try {
    console.log('开始修复技术审核栏和建设验收栏...');
    await executeCommands();
    console.log('\n修复完成。现在技术审核栏将记录审核通过时间，建设验收栏将记录立即标记为已推到时间。');
  } catch (error) {
    console.error('修复过程出错:', error);
  } finally {
    await pool.end();
  }
}

main(); 