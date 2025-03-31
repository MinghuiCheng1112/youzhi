/**
 * 异步数据库更新脚本
 * 用于处理技术审核栏和建设验收栏的数据库更新
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const { fileURLToPath } = require('url');

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// 获取 Supabase 连接信息
const supabaseUrl = process.env.VITE_SUPABASE_URL;
if (!supabaseUrl) {
  console.error('未找到 VITE_SUPABASE_URL 环境变量');
  process.exit(1);
}

// 从URL中提取项目引用
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1];
if (!projectRef) {
  console.error('无法从Supabase URL中提取项目引用');
  process.exit(1);
}

// 构建连接配置
const connectionConfig = {
  host: `db.${projectRef}.supabase.co`,
  database: 'postgres',
  user: process.env.VITE_SUPABASE_DB_USER || 'postgres',
  password: process.env.VITE_SUPABASE_DB_PASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
};

// 创建连接池
const pool = new Pool(connectionConfig);

// 打印带时间戳的日志
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * 更新技术审核状态
 * @param {string} customerId - 客户ID
 * @param {string} status - 状态：'approved', 'rejected', 或 'reset'
 * @returns {Promise<boolean>} - 更新是否成功
 */
async function updateTechnicalReview(customerId, status) {
  if (!customerId) {
    log(`错误: 无效的客户ID: ${customerId}`);
    return false;
  }

  const client = await pool.connect();
  try {
    // 开始事务
    await client.query('BEGIN');
    log(`开始更新客户 ${customerId} 的技术审核状态为 ${status}`);

    let updateObj = {};
    const now = new Date().toISOString();

    if (status === 'approved') {
      updateObj = {
        technical_review: now,
        technical_review_date: now,
        technical_review_notes: '已通过技术审核',
        technical_review_rejected: null
      };
    } else if (status === 'rejected') {
      updateObj = {
        technical_review: null,
        technical_review_date: now,
        technical_review_notes: '技术审核不通过',
        technical_review_rejected: `技术驳回 (${new Date().toLocaleString()})`
      };
    } else {
      // 重置状态
      updateObj = {
        technical_review: null,
        technical_review_date: null,
        technical_review_notes: null,
        technical_review_rejected: null
      };
    }

    // 构建更新查询
    const fields = Object.keys(updateObj);
    const values = Object.values(updateObj);
    const setExpressions = fields.map((field, index) => 
      `${field} = $${index + 2}`
    ).join(', ');

    const query = `
      UPDATE customers 
      SET ${setExpressions}
      WHERE id = $1
    `;

    // 执行更新查询
    await client.query(query, [customerId, ...values]);
    
    // 提交事务
    await client.query('COMMIT');
    log(`成功更新客户 ${customerId} 的技术审核状态`);
    return true;
  } catch (error) {
    // 回滚事务
    await client.query('ROLLBACK');
    log(`更新客户 ${customerId} 的技术审核状态失败: ${error.message}`);
    console.error('完整错误:', error);
    return false;
  } finally {
    // 释放客户端
    client.release();
  }
}

/**
 * 更新建设验收状态
 * @param {string} customerId - 客户ID
 * @param {string|null} status - 状态：'reset', 'waiting', 或 null表示立即完成
 * @param {number} [days] - 等待天数（仅当status为'waiting'时使用）
 * @returns {Promise<boolean>} - 更新是否成功
 */
async function updateConstructionAcceptance(customerId, status, days) {
  if (!customerId) {
    log(`错误: 无效的客户ID: ${customerId}`);
    return false;
  }

  const client = await pool.connect();
  try {
    // 开始事务
    await client.query('BEGIN');
    log(`开始更新客户 ${customerId} 的建设验收状态为 ${status || '完成'}`);

    let updateObj = {};
    const now = new Date();
    const isoNow = now.toISOString();
    
    if (status === 'reset') {
      // 重置验收状态
      updateObj = {
        construction_acceptance: null,
        construction_acceptance_date: null,
        construction_acceptance_notes: null
      };
    } else if (status === 'waiting' && days) {
      // 等待状态
      const formattedDate = now.toISOString().split('T')[0]; // YYYY-MM-DD格式
      updateObj = {
        construction_acceptance: `waiting:${days}:${formattedDate}`,
        construction_acceptance_date: isoNow,
        construction_acceptance_notes: `等待中 - 设置于 ${now.toLocaleString()}`
      };
    } else {
      // 立即完成状态
      updateObj = {
        construction_acceptance: isoNow,
        construction_acceptance_date: isoNow,
        construction_acceptance_notes: '今日验收完成'
      };
    }

    // 构建更新查询
    const fields = Object.keys(updateObj);
    const values = Object.values(updateObj);
    const setExpressions = fields.map((field, index) => 
      `${field} = $${index + 2}`
    ).join(', ');

    const query = `
      UPDATE customers 
      SET ${setExpressions}
      WHERE id = $1
    `;

    // 执行更新查询
    await client.query(query, [customerId, ...values]);
    
    // 提交事务
    await client.query('COMMIT');
    log(`成功更新客户 ${customerId} 的建设验收状态`);
    return true;
  } catch (error) {
    // 回滚事务
    await client.query('ROLLBACK');
    log(`更新客户 ${customerId} 的建设验收状态失败: ${error.message}`);
    console.error('完整错误:', error);
    return false;
  } finally {
    // 释放客户端
    client.release();
  }
}

// 测试连接函数
async function testConnection() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM information_schema.tables WHERE table_name = $1', ['customers']);
    if (res.rowCount > 0) {
      log('数据库连接成功，customers表存在');
      return true;
    } else {
      log('数据库连接成功，但customers表不存在');
      return false;
    }
  } catch (error) {
    log(`数据库连接测试失败: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

// 导出函数供其他模块使用
module.exports = {
  updateTechnicalReview,
  updateConstructionAcceptance,
  testConnection
};

// 如果直接运行此脚本，测试连接
if (require.main === module) {
  testConnection()
    .then(success => {
      if (success) {
        log('可以使用以下方式调用此模块:');
        log('1. updateTechnicalReview(客户ID, 状态): 更新技术审核状态');
        log('   状态可以是: "approved" - 通过, "rejected" - 驳回, "reset" - 重置');
        log('2. updateConstructionAcceptance(客户ID, 状态, 天数): 更新建设验收状态');
        log('   状态可以是: "reset" - 重置, "waiting" - 等待, null - 立即完成');
        log('   当状态为"waiting"时需要指定天数');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`测试连接时出错: ${error}`);
      process.exit(1);
    });
} 