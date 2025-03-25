import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

// 加载环境变量
dotenv.config();

// 从环境变量中获取Supabase连接信息
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PASSWORD = 'CK50QOdXXutc4IO3'; // 用户提供的密码

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

// 构建连接信息
const connectionConfig = {
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: SUPABASE_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

console.log('正在连接到:', `postgresql://${connectionConfig.user}:****@${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`);

// 创建连接池
const pool = new Pool(connectionConfig);

// 要执行的SQL命令
const sqlCommands = [
  // 1. 检查表结构
  `SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'customers' AND column_name LIKE '%outbound%'`,

  // 2. 添加方钢出库相关字段
  `ALTER TABLE customers 
   ADD COLUMN IF NOT EXISTS square_steel_outbound BOOLEAN DEFAULT FALSE,
   ADD COLUMN IF NOT EXISTS square_steel_outbound_date DATE`,

  // 3. 添加组件出库相关字段
  `ALTER TABLE customers 
   ADD COLUMN IF NOT EXISTS component_outbound BOOLEAN DEFAULT FALSE,
   ADD COLUMN IF NOT EXISTS component_outbound_date DATE`,

  // 4. 创建更新方钢出库状态函数
  `CREATE OR REPLACE FUNCTION update_square_steel_outbound(customer_id UUID)
   RETURNS VOID AS $$
   BEGIN
     UPDATE customers
     SET square_steel_outbound = TRUE,
         square_steel_outbound_date = CURRENT_DATE
     WHERE id = customer_id;
   END;
   $$ LANGUAGE plpgsql`,

  // 5. 创建更新组件出库状态函数
  `CREATE OR REPLACE FUNCTION update_component_outbound(customer_id UUID)
   RETURNS VOID AS $$
   BEGIN
     UPDATE customers
     SET component_outbound = TRUE,
         component_outbound_date = CURRENT_DATE
     WHERE id = customer_id;
   END;
   $$ LANGUAGE plpgsql`,
   
  // 6. 验证添加的字段
  `SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'customers' AND column_name LIKE '%outbound%'`
];

// 执行SQL命令
async function executeSqlCommands() {
  const client = await pool.connect();
  try {
    console.log('成功连接到数据库，开始执行SQL命令...\n');
    
    for (let i = 0; i < sqlCommands.length; i++) {
      const cmd = sqlCommands[i];
      console.log(`执行SQL命令 ${i + 1}/${sqlCommands.length}:`);
      console.log('-------------------------------------------');
      console.log(cmd);
      console.log('-------------------------------------------');
      
      try {
        const result = await client.query(cmd);
        if (result.rows && result.rows.length > 0) {
          console.log('查询结果:');
          console.table(result.rows);
        } else {
          console.log('命令执行成功，无返回数据');
        }
      } catch (err) {
        console.error('执行命令失败:', err.message);
      }
      
      console.log('\n');
    }
    
    console.log('所有SQL命令执行完毕');
    
    // 执行测试
    console.log('\n执行出库功能测试...');
    
    // 获取一个客户ID
    const idResult = await client.query('SELECT id FROM customers LIMIT 1');
    if (idResult.rows.length > 0) {
      const customerId = idResult.rows[0].id;
      console.log(`测试客户ID: ${customerId}`);
      
      // 测试更新方钢出库状态
      console.log('\n更新方钢出库状态...');
      await client.query(`SELECT update_square_steel_outbound('${customerId}')`);
      
      // 测试更新组件出库状态
      console.log('更新组件出库状态...');
      await client.query(`SELECT update_component_outbound('${customerId}')`);
      
      // 验证更新结果
      console.log('\n验证更新结果:');
      const verifyResult = await client.query(`
        SELECT id, square_steel_outbound, square_steel_outbound_date, 
               component_outbound, component_outbound_date
        FROM customers
        WHERE id = '${customerId}'
      `);
      
      console.table(verifyResult.rows);
    } else {
      console.log('无法找到客户记录进行测试');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

executeSqlCommands().catch(err => {
  console.error('执行SQL时出错:', err);
  process.exit(1);
}); 