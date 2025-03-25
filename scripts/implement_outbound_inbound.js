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
  // 1. 修改customers表，添加新的字段
  `ALTER TABLE customers 
   ADD COLUMN IF NOT EXISTS square_steel_status TEXT DEFAULT 'none',
   ADD COLUMN IF NOT EXISTS component_status TEXT DEFAULT 'none',
   ALTER COLUMN square_steel_outbound_date TYPE TIMESTAMP WITH TIME ZONE USING square_steel_outbound_date::TIMESTAMP WITH TIME ZONE,
   ALTER COLUMN component_outbound_date TYPE TIMESTAMP WITH TIME ZONE USING component_outbound_date::TIMESTAMP WITH TIME ZONE`,

  // 2. 添加方钢入库日期和组件入库日期字段
  `ALTER TABLE customers 
   ADD COLUMN IF NOT EXISTS square_steel_inbound_date TIMESTAMP WITH TIME ZONE,
   ADD COLUMN IF NOT EXISTS component_inbound_date TIMESTAMP WITH TIME ZONE`,

  // 3. 创建方钢出库函数
  `CREATE OR REPLACE FUNCTION update_square_steel_outbound(customer_id UUID)
   RETURNS VOID AS $$
   BEGIN
     UPDATE customers
     SET 
       square_steel_outbound = TRUE,
       square_steel_status = 'outbound',
       square_steel_outbound_date = CURRENT_TIMESTAMP,
       square_steel_inbound_date = NULL
     WHERE id = customer_id;
   END;
   $$ LANGUAGE plpgsql`,

  // 4. 创建方钢回库函数
  `CREATE OR REPLACE FUNCTION update_square_steel_inbound(customer_id UUID)
   RETURNS VOID AS $$
   BEGIN
     UPDATE customers
     SET 
       square_steel_outbound = FALSE,
       square_steel_status = 'inbound',
       square_steel_inbound_date = CURRENT_TIMESTAMP
     WHERE id = customer_id;
   END;
   $$ LANGUAGE plpgsql`,

  // 5. 创建组件出库函数
  `CREATE OR REPLACE FUNCTION update_component_outbound(customer_id UUID)
   RETURNS VOID AS $$
   BEGIN
     UPDATE customers
     SET 
       component_outbound = TRUE,
       component_status = 'outbound',
       component_outbound_date = CURRENT_TIMESTAMP,
       component_inbound_date = NULL
     WHERE id = customer_id;
   END;
   $$ LANGUAGE plpgsql`,

  // 6. 创建组件回库函数
  `CREATE OR REPLACE FUNCTION update_component_inbound(customer_id UUID)
   RETURNS VOID AS $$
   BEGIN
     UPDATE customers
     SET 
       component_outbound = FALSE,
       component_status = 'inbound',
       component_inbound_date = CURRENT_TIMESTAMP
     WHERE id = customer_id;
   END;
   $$ LANGUAGE plpgsql`,

  // 7. 创建通用的切换方钢状态函数
  `CREATE OR REPLACE FUNCTION toggle_square_steel_status(customer_id UUID)
   RETURNS TEXT AS $$
   DECLARE
     current_status TEXT;
   BEGIN
     -- 获取当前状态
     SELECT square_steel_status INTO current_status FROM customers WHERE id = customer_id;
     
     -- 根据当前状态切换
     IF current_status = 'none' OR current_status = 'inbound' THEN
       -- 切换到出库状态
       PERFORM update_square_steel_outbound(customer_id);
       RETURN 'outbound';
     ELSIF current_status = 'outbound' THEN
       -- 切换到回库状态
       PERFORM update_square_steel_inbound(customer_id);
       RETURN 'inbound';
     ELSE
       -- 默认切换到出库状态
       PERFORM update_square_steel_outbound(customer_id);
       RETURN 'outbound';
     END IF;
   END;
   $$ LANGUAGE plpgsql`,

  // 8. 创建通用的切换组件状态函数
  `CREATE OR REPLACE FUNCTION toggle_component_status(customer_id UUID)
   RETURNS TEXT AS $$
   DECLARE
     current_status TEXT;
   BEGIN
     -- 获取当前状态
     SELECT component_status INTO current_status FROM customers WHERE id = customer_id;
     
     -- 根据当前状态切换
     IF current_status = 'none' OR current_status = 'inbound' THEN
       -- 切换到出库状态
       PERFORM update_component_outbound(customer_id);
       RETURN 'outbound';
     ELSIF current_status = 'outbound' THEN
       -- 切换到回库状态
       PERFORM update_component_inbound(customer_id);
       RETURN 'inbound';
     ELSE
       -- 默认切换到出库状态
       PERFORM update_component_outbound(customer_id);
       RETURN 'outbound';
     END IF;
   END;
   $$ LANGUAGE plpgsql`,

  // 9. 测试函数：将测试客户方钢设为出库状态 
  `SELECT toggle_square_steel_status('51f2d60a-234e-4702-b182-fbda418622f4') AS new_square_steel_status`,
   
  // 10. 测试函数：将测试客户组件设为出库状态
  `SELECT toggle_component_status('51f2d60a-234e-4702-b182-fbda418622f4') AS new_component_status`,

  // 11. 查看测试结果
  `SELECT 
     id, 
     square_steel_status, 
     square_steel_outbound_date, 
     square_steel_inbound_date,
     component_status, 
     component_outbound_date, 
     component_inbound_date
   FROM customers
   WHERE id = '51f2d60a-234e-4702-b182-fbda418622f4'`,

  // 12. 测试函数：将测试客户方钢再次切换状态（应该变为回库状态）
  `SELECT toggle_square_steel_status('51f2d60a-234e-4702-b182-fbda418622f4') AS new_square_steel_status`,
   
  // 13. 测试函数：将测试客户组件再次切换状态（应该变为回库状态）
  `SELECT toggle_component_status('51f2d60a-234e-4702-b182-fbda418622f4') AS new_component_status`,

  // 14. 再次查看测试结果
  `SELECT 
     id, 
     square_steel_status, 
     square_steel_outbound_date, 
     square_steel_inbound_date,
     component_status, 
     component_outbound_date, 
     component_inbound_date
   FROM customers
   WHERE id = '51f2d60a-234e-4702-b182-fbda418622f4'`
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
    console.log('方钢出库/回库和组件出库/回库功能已实现!');
    
  } finally {
    client.release();
    await pool.end();
  }
}

executeSqlCommands().catch(err => {
  console.error('执行SQL时出错:', err);
  process.exit(1);
}); 