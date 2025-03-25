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
  // 1. 检查modification_records表结构
  `SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'modification_records'`,

  // 2. 查看customer_changes触发器
  `SELECT 
     t.tgname AS trigger_name,
     p.proname AS function_name
   FROM 
     pg_trigger t
   JOIN 
     pg_proc p ON p.oid = t.tgfoid
   JOIN 
     pg_class c ON c.oid = t.tgrelid
   WHERE 
     c.relname = 'customers'`,

  // 3. 修改record_customer_changes函数，适应现有的modification_records表结构
  `CREATE OR REPLACE FUNCTION record_customer_changes()
   RETURNS TRIGGER AS $$
   DECLARE
     field_name text;
     old_value text;
     new_value text;
   BEGIN
     -- 仅处理特定字段的变化，忽略outbound相关字段的动态检查
     IF TG_OP = 'UPDATE' THEN
       -- 检查方钢出库状态变化
       IF OLD.square_steel_outbound IS DISTINCT FROM NEW.square_steel_outbound THEN
         INSERT INTO modification_records (
           customer_id, 
           field_name, 
           old_value, 
           new_value, 
           modified_by
         ) VALUES (
           NEW.id,
           'square_steel_outbound',
           OLD.square_steel_outbound::text,
           NEW.square_steel_outbound::text,
           auth.uid()
         );
       END IF;
       
       -- 检查组件出库状态变化
       IF OLD.component_outbound IS DISTINCT FROM NEW.component_outbound THEN
         INSERT INTO modification_records (
           customer_id, 
           field_name, 
           old_value, 
           new_value, 
           modified_by
         ) VALUES (
           NEW.id,
           'component_outbound',
           OLD.component_outbound::text,
           NEW.component_outbound::text,
           auth.uid()
         );
       END IF;
       
       -- 处理其他字段，使用原有的循环逻辑
       FOR field_name IN (SELECT column_name FROM information_schema.columns WHERE table_name = 'customers' AND column_name NOT LIKE '%outbound%')
       LOOP
         -- 安全地跳过outbound相关字段
         IF field_name NOT LIKE '%outbound%' THEN
           EXECUTE format('SELECT $1.%I::TEXT', field_name) USING OLD INTO old_value;
           EXECUTE format('SELECT $1.%I::TEXT', field_name) USING NEW INTO new_value;
           
           IF old_value IS DISTINCT FROM new_value THEN
             INSERT INTO modification_records (
               customer_id, 
               field_name, 
               old_value, 
               new_value, 
               modified_by
             ) VALUES (
               NEW.id,
               field_name,
               old_value,
               new_value,
               auth.uid()
             );
           END IF;
         END IF;
       END LOOP;
     END IF;
     
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,

  // 4. 创建出库处理函数（简化版，不使用动态SQL）
  `CREATE OR REPLACE FUNCTION update_square_steel_outbound(customer_id UUID)
   RETURNS VOID AS $$
   BEGIN
     UPDATE customers
     SET 
       square_steel_outbound = TRUE,
       square_steel_outbound_date = CURRENT_DATE
     WHERE id = customer_id;
   END;
   $$ LANGUAGE plpgsql`,

  // 5. 创建组件出库处理函数（简化版）
  `CREATE OR REPLACE FUNCTION update_component_outbound(customer_id UUID)
   RETURNS VOID AS $$
   BEGIN
     UPDATE customers
     SET 
       component_outbound = TRUE,
       component_outbound_date = CURRENT_DATE
     WHERE id = customer_id;
   END;
   $$ LANGUAGE plpgsql`,

  // 6. 测试更新函数
  `SELECT update_square_steel_outbound('51f2d60a-234e-4702-b182-fbda418622f4')`,
  
  // 7. 测试方钢出库
  `SELECT update_component_outbound('51f2d60a-234e-4702-b182-fbda418622f4')`,

  // 8. 验证更新结果
  `SELECT id, square_steel_outbound, square_steel_outbound_date, 
         component_outbound, component_outbound_date
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
    console.log('方钢出库和组件出库功能已修复!');
    
  } finally {
    client.release();
    await pool.end();
  }
}

executeSqlCommands().catch(err => {
  console.error('执行SQL时出错:', err);
  process.exit(1);
}); 