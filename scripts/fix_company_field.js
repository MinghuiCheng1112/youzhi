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

async function fixCompanyField() {
  let client;
  
  try {
    // 获取数据库连接
    client = await pool.connect();
    console.log('成功连接到数据库');

    // 步骤1: 检查company字段的约束条件
    console.log('检查company字段约束...');
    const constraintQuery = `
      SELECT con.conname, pg_get_constraintdef(con.oid) as def
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE rel.relname = 'customers' 
      AND con.contype = 'c' 
      AND pg_get_constraintdef(con.oid) LIKE '%company%'
    `;
    
    const constraintResult = await client.query(constraintQuery);
    
    // 步骤2: 如果找到约束，修改约束条件
    if (constraintResult.rows.length > 0) {
      console.log('找到与company字段相关的约束:', constraintResult.rows);
      
      for (const constraint of constraintResult.rows) {
        console.log(`处理约束: ${constraint.conname}`);
        
        // 首先删除旧约束
        await client.query(`ALTER TABLE customers DROP CONSTRAINT IF EXISTS ${constraint.conname}`);
        console.log(`已删除约束: ${constraint.conname}`);
        
        // 创建新约束，添加"昊尘"和"祐之"
        let newConstraintDef = constraint.def;
        
        if (newConstraintDef.includes('haochen') || newConstraintDef.includes('youzhi')) {
          // 替换约束定义中的值
          newConstraintDef = newConstraintDef
            .replace(/(['"])haochen\1/g, "'昊尘'")
            .replace(/(['"])youzhi\1/g, "'祐之'");
            
          // 提取CHECK约束的条件部分
          const checkMatch = newConstraintDef.match(/CHECK \((.*)\)/i);
          if (checkMatch && checkMatch[1]) {
            const newConstraintName = constraint.conname;
            const newCheckCondition = checkMatch[1];
            
            // 添加新约束
            await client.query(`ALTER TABLE customers ADD CONSTRAINT ${newConstraintName} CHECK (${newCheckCondition})`);
            console.log(`已创建新约束: ${newConstraintName}`);
          } else {
            console.error('无法解析约束定义:', newConstraintDef);
          }
        } else {
          console.log('约束中不包含需要替换的值，将重新添加原约束');
          
          // 从定义中提取CHECK部分
          const checkMatch = newConstraintDef.match(/CHECK \((.*)\)/i);
          if (checkMatch && checkMatch[1]) {
            await client.query(`ALTER TABLE customers ADD CONSTRAINT ${constraint.conname} CHECK (${checkMatch[1]})`);
            console.log(`已重新添加约束: ${constraint.conname}`);
          }
        }
      }
    } else {
      console.log('未找到与company字段相关的约束');
    }
    
    // 步骤3: 更新表中的数据
    console.log('更新customers表中的company字段...');
    
    // 更新haochen为昊尘
    const updateHaochenResult = await client.query(`
      UPDATE customers 
      SET company = '昊尘' 
      WHERE company = 'haochen'
    `);
    console.log(`已将${updateHaochenResult.rowCount}条记录从'haochen'更新为'昊尘'`);
    
    // 更新youzhi为祐之
    const updateYouzhiResult = await client.query(`
      UPDATE customers 
      SET company = '祐之' 
      WHERE company = 'youzhi'
    `);
    console.log(`已将${updateYouzhiResult.rowCount}条记录从'youzhi'更新为'祐之'`);
    
    console.log('修复完成！');
    
  } catch (err) {
    console.error('执行修复脚本时出错:', err);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// 执行修复
fixCompanyField(); 