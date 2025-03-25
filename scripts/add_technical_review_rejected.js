import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

// 从环境变量中获取连接信息
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// 提取出项目引用和数据库连接信息
let projectRef = '';
if (supabaseUrl) {
  const matches = supabaseUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/);
  if (matches && matches.length > 1) {
    projectRef = matches[1];
  }
}

// 使用cursor-connect.js中的正确密码
const pool = new Pool({
  host: `db.${projectRef}.supabase.co`,
  database: 'postgres',
  user: 'postgres',
  password: 'CK50QOdXXutc4IO3', // 正确的密码
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * 添加technical_review_rejected列到customers表
 */
async function addTechnicalReviewRejectedColumn() {
  const client = await pool.connect();
  try {
    console.log('连接到数据库成功');
    console.log('项目引用:', projectRef);
    
    // 开始事务
    await client.query('BEGIN');
    
    // 检查列是否已存在
    const checkColumnResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      AND column_name = 'technical_review_rejected'
    `);
    
    if (checkColumnResult.rows.length === 0) {
      console.log('添加technical_review_rejected列...');
      
      // 添加technical_review_rejected列
      await client.query(`
        ALTER TABLE customers 
        ADD COLUMN IF NOT EXISTS technical_review_rejected TEXT
      `);
      
      console.log('成功添加technical_review_rejected列');
    } else {
      console.log('technical_review_rejected列已存在，无需添加');
    }
    
    // 提交事务
    await client.query('COMMIT');
    console.log('操作完成');
    
  } catch (error) {
    // 发生错误时回滚事务
    await client.query('ROLLBACK');
    console.error('操作失败:', error);
    throw error;
  } finally {
    // 释放客户端
    client.release();
    // 关闭连接池
    await pool.end();
  }
}

// 执行脚本
addTechnicalReviewRejectedColumn()
  .then(() => {
    console.log('脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  }); 