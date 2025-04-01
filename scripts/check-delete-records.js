const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '..', '.env') });

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

// 应用修复脚本
async function applyFixScript() {
  try {
    console.log('正在应用修复脚本...');
    const fixScript = require('fs').readFileSync(path.join(__dirname, 'fix_outbound_dates.sql'), 'utf8');
    await pool.query(fixScript);
    console.log('修复脚本应用成功！');
  } catch (error) {
    console.error('应用修复脚本失败:', error.message);
  }
}

// 获取删除记录
async function getDeletedRecords() {
  try {
    console.log('正在查询已删除记录...');
    const { rows } = await pool.query('SELECT * FROM deleted_records ORDER BY deleted_at DESC');
    console.log(`找到 ${rows.length} 条已删除记录:`);
    rows.forEach((record, index) => {
      console.log(`${index + 1}. ${record.customer_name} (ID: ${record.id}) - 电话: ${record.phone} - 删除时间: ${record.deleted_at}`);
    });
    return rows;
  } catch (error) {
    console.error('查询已删除记录失败:', error.message);
    return [];
  }
}

// 恢复指定记录
async function restoreRecord(recordId) {
  try {
    console.log(`正在恢复记录ID: ${recordId}...`);
    await pool.query('SELECT restore_deleted_record($1)', [recordId]);
    console.log('记录恢复成功！');
    return true;
  } catch (error) {
    console.error('恢复记录失败:', error.message);
    return false;
  }
}

// 主函数
async function main() {
  try {
    // 先应用修复脚本
    await applyFixScript();
    
    // 获取所有删除记录
    const records = await getDeletedRecords();
    
    // 如果有记录，并且命令行参数中指定了要恢复的记录索引
    if (records.length > 0 && process.argv.length > 2) {
      const index = parseInt(process.argv[2]) - 1;
      if (index >= 0 && index < records.length) {
        const recordId = records[index].id;
        await restoreRecord(recordId);
      } else {
        console.error(`错误: 无效的记录索引 ${process.argv[2]}，有效范围是 1-${records.length}`);
      }
    } else if (records.length > 0) {
      console.log('\n要恢复记录，请运行: node check-delete-records.js [记录编号]');
    }
  } catch (error) {
    console.error('执行脚本时发生错误:', error.message);
  } finally {
    // 关闭数据库连接池
    await pool.end();
  }
}

// 执行主函数
main(); 