import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量，指定从项目根目录加载.env文件
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// 从环境变量中获取Supabase连接信息
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PASSWORD = '6npns5PuooEPzSCg'; // 用户提供的密码

if (!SUPABASE_URL) {
  console.error('缺少Supabase URL。请确保.env文件中包含VITE_SUPABASE_URL');
  process.exit(1);
}

// 提取项目引用
const match = SUPABASE_URL.match(/https:\/\/(.*?)\.supabase\.co/);
if (!match) {
  console.error('无法从Supabase URL中解析项目信息');
  process.exit(1);
}

const projectRef = match[1];
console.log(`已识别项目引用: ${projectRef}`);

// Supabase连接配置
const connectionConfig = {
  host: `db.${projectRef}.supabase.co`,
  database: 'postgres',
  user: 'postgres',
  password: SUPABASE_PASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
};

console.log('尝试连接到数据库:', `postgresql://${connectionConfig.user}:****@${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`);

// 创建连接池
const pool = new Pool(connectionConfig);

async function updateDatabase() {
  let client;
  try {
    client = await pool.connect();
    console.log('成功连接到数据库');
    
    // 查询customers表结构
    const tableRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'customers'
      );
    `);
    
    if (!tableRes.rows[0].exists) {
      console.error('customers表不存在');
      return;
    }
    
    // 检查缺少的字段
    const requiredFields = [
      { name: 'inverter_status', type: 'TEXT', default: "'none'" },
      { name: 'inverter_inbound_date', type: 'TEXT', default: 'NULL' },
      { name: 'copper_wire_status', type: 'TEXT', default: "'none'" },
      { name: 'copper_wire_inbound_date', type: 'TEXT', default: 'NULL' },
      { name: 'aluminum_wire_status', type: 'TEXT', default: "'none'" },
      { name: 'aluminum_wire_inbound_date', type: 'TEXT', default: 'NULL' },
      { name: 'distribution_box_status', type: 'TEXT', default: "'none'" },
      { name: 'distribution_box_inbound_date', type: 'TEXT', default: 'NULL' }
    ];
    
    // 获取现有字段
    const columnsRes = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'customers';
    `);
    
    const existingColumns = columnsRes.rows.map(row => row.column_name);
    console.log('现有字段:', existingColumns);
    
    // 添加缺少的字段
    const missingFields = requiredFields.filter(field => !existingColumns.includes(field.name));
    
    if (missingFields.length === 0) {
      console.log('所有需要的字段已存在，无需修改');
      return;
    }
    
    console.log('需要添加的字段:', missingFields.map(f => f.name));
    
    // 开始事务
    await client.query('BEGIN');
    
    for (const field of missingFields) {
      console.log(`添加字段 ${field.name}...`);
      await client.query(`
        ALTER TABLE customers 
        ADD COLUMN IF NOT EXISTS ${field.name} ${field.type} DEFAULT ${field.default};
      `);
    }
    
    // 初始化状态字段
    if (missingFields.some(f => f.name === 'inverter_status')) {
      await client.query(`
        UPDATE customers
        SET inverter_status = 'outbound'
        WHERE inverter_outbound_date IS NOT NULL;
      `);
    }
    
    if (missingFields.some(f => f.name === 'copper_wire_status')) {
      await client.query(`
        UPDATE customers
        SET copper_wire_status = 'outbound'
        WHERE copper_wire_outbound_date IS NOT NULL;
      `);
    }
    
    if (missingFields.some(f => f.name === 'aluminum_wire_status')) {
      await client.query(`
        UPDATE customers
        SET aluminum_wire_status = 'outbound'
        WHERE aluminum_wire_outbound_date IS NOT NULL;
      `);
    }
    
    if (missingFields.some(f => f.name === 'distribution_box_status')) {
      await client.query(`
        UPDATE customers
        SET distribution_box_status = 'outbound'
        WHERE distribution_box_outbound_date IS NOT NULL;
      `);
    }
    
    // 提交事务
    await client.query('COMMIT');
    
    console.log('数据库更新成功！');
  } catch (err) {
    console.error('数据库更新失败:', err);
    if (client) {
      await client.query('ROLLBACK');
    }
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

updateDatabase(); 