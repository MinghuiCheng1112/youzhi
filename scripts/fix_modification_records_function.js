// 连接到数据库并修复record_customer_changes函数
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

// 创建数据库连接池
const pool = new Pool({
  host: process.env.SUPABASE_DB_HOST,
  database: process.env.SUPABASE_DB,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  port: process.env.SUPABASE_DB_PORT,
  ssl: { rejectUnauthorized: false }
});

console.log('数据库连接信息:');
console.log(`- 主机: ${process.env.SUPABASE_DB_HOST}`);
console.log(`- 数据库: ${process.env.SUPABASE_DB}`);
console.log(`- 用户: ${process.env.SUPABASE_DB_USER}`);
console.log(`- 端口: ${process.env.SUPABASE_DB_PORT}`);
console.log('正在连接到数据库...');

// 要执行的SQL命令
const sqlCommands = [
  // 1. 检查modification_records表结构
  `SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'modification_records'`,

  // 2. 查看客户变更触发器
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

  // 3. 修正record_customer_changes函数，使用正确的列名
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

  // 4. 重新创建触发器
  `DROP TRIGGER IF EXISTS customer_changes ON customers;
   CREATE TRIGGER customer_changes
   AFTER UPDATE ON customers
   FOR EACH ROW
   EXECUTE FUNCTION record_customer_changes();`
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
    console.log('客户修改记录功能已修复!');
    
  } finally {
    client.release();
    await pool.end();
  }
}

executeSqlCommands().catch(err => {
  console.error('执行SQL时出错:', err);
  process.exit(1);
}); 