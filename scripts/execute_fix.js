import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

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

// 读取SQL文件
const sqlFilePath = path.join(process.cwd(), 'scripts', 'fix_outbound_issue.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

// 将SQL文件按分号分割为单独的命令
const sqlCommands = sqlContent
  .replace(/--.*$/gm, '') // 移除SQL注释
  .split(';')
  .filter(cmd => cmd.trim() !== '');

// 执行SQL命令
async function executeSqlCommands() {
  const client = await pool.connect();
  try {
    console.log('成功连接到数据库，开始执行SQL命令...\n');
    
    for (let i = 0; i < sqlCommands.length; i++) {
      const cmd = sqlCommands[i].trim();
      if (cmd) {
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