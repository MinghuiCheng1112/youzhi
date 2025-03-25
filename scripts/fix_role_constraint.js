const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

// 从环境变量获取Supabase连接信息
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

// 提取出项目引用
const projectRef = supabaseUrl.match(/([a-z0-9]+)\.supabase\.co/)?.[1];
console.log('已识别项目引用:', projectRef);

// 输出环境变量检查
console.log('环境变量检查:');
console.log('VITE_SUPABASE_URL:', supabaseUrl ? '已设置' : '未设置');
console.log('VITE_SUPABASE_ANON_KEY:', supabaseKey ? '已设置' : '未设置');
console.log('项目引用:', projectRef || '未识别');

// 如果无法识别项目引用，则使用默认值
const finalProjectRef = projectRef || 'rkkkicdabwqtjzsoaxty';
console.log('使用项目引用:', finalProjectRef);

// 构建直接连接PostgreSQL的配置
const dbPassword = 'CK50QOdXXutc4IO3'; // 使用提供的密码
const dbHost = `db.${finalProjectRef}.supabase.co`;
const dbUser = 'postgres';
const dbPort = 5432;
const dbName = 'postgres';

console.log('数据库连接配置:');
console.log('主机:', dbHost);
console.log('用户:', dbUser);
console.log('数据库:', dbName);
console.log('端口:', dbPort);

const pool = new Pool({
  user: dbUser,
  host: dbHost,
  database: dbName,
  password: dbPassword,
  port: dbPort,
  ssl: { rejectUnauthorized: false }
});

async function fixRoleConstraint() {
  let client;
  
  try {
    console.log('尝试连接到数据库...');
    client = await pool.connect();
    console.log('已成功连接到数据库');
    
    console.log('正在检查user_roles表的角色约束...');
    
    // 检查当前的约束定义
    const constraintQuery = `
      SELECT con.conname as constraint_name, 
             pg_get_constraintdef(con.oid) as constraint_def
      FROM pg_constraint con 
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE rel.relname = 'user_roles' 
      AND con.conname = 'user_roles_role_check'
      AND nsp.nspname = 'public';
    `;
    
    console.log('执行查询:', constraintQuery.replace(/\s+/g, ' ').trim());
    const { rows: constraints } = await client.query(constraintQuery);
    console.log(`查询结果: 找到 ${constraints.length} 个约束`);
    
    if (constraints.length === 0) {
      console.log('未找到user_roles_role_check约束，将创建新约束');
      
      // 创建新的约束
      const allRoles = [
        'admin', 'filing_officer', 'salesman', 'warehouse', 
        'construction_team', 'grid_connector', 'surveyor', 
        'dispatch', 'procurement'
      ];
      
      const createConstraintSql = `
        ALTER TABLE public.user_roles 
        ADD CONSTRAINT user_roles_role_check 
        CHECK (role IN ('${allRoles.join("','")}'));
      `;
      
      console.log('执行SQL:', createConstraintSql.replace(/\s+/g, ' ').trim());
      await client.query(createConstraintSql);
      console.log('成功创建新的角色约束');
    } else {
      // 输出当前约束定义
      console.log('当前约束定义:', constraints[0].constraint_def);
      
      // 检查约束定义中是否包含所有需要的角色
      const currentConstraint = constraints[0].constraint_def;
      const allRoles = [
        'admin', 'filing_officer', 'salesman', 'warehouse', 
        'construction_team', 'grid_connector', 'surveyor', 
        'dispatch', 'procurement'
      ];
      
      // 检查是否有缺失的角色
      const missingRoles = allRoles.filter(role => !currentConstraint.includes(`'${role}'`));
      
      if (missingRoles.length > 0) {
        console.log('发现缺失的角色:', missingRoles);
        
        // 删除旧约束并创建新约束
        console.log('开始事务...');
        await client.query('BEGIN');
        
        // 删除旧约束
        const dropConstraintSql = `
          ALTER TABLE public.user_roles 
          DROP CONSTRAINT user_roles_role_check;
        `;
        console.log('执行SQL:', dropConstraintSql.replace(/\s+/g, ' ').trim());
        await client.query(dropConstraintSql);
        console.log('已删除旧约束');
        
        // 创建新约束
        const addConstraintSql = `
          ALTER TABLE public.user_roles 
          ADD CONSTRAINT user_roles_role_check 
          CHECK (role IN ('${allRoles.join("','")}'));
        `;
        console.log('执行SQL:', addConstraintSql.replace(/\s+/g, ' ').trim());
        await client.query(addConstraintSql);
        console.log('已添加新约束');
        
        console.log('提交事务...');
        await client.query('COMMIT');
        console.log('成功更新角色约束，现在包含所有必需的角色');
      } else {
        console.log('角色约束已包含所有必需的角色，无需修改');
      }
    }
    
    // 验证约束是否正确更新
    console.log('验证约束更新...');
    const { rows: updatedConstraints } = await client.query(constraintQuery);
    if (updatedConstraints.length > 0) {
      console.log('更新后的约束定义:', updatedConstraints[0].constraint_def);
    } else {
      console.log('警告: 无法找到更新后的约束');
    }
    
    // 检查各角色在user_roles表中的数量
    const roleCountQuery = `
      SELECT role, COUNT(*) as count
      FROM public.user_roles
      GROUP BY role
      ORDER BY role;
    `;
    
    console.log('检查各角色在user_roles表中的数量...');
    const { rows: roleCounts } = await client.query(roleCountQuery);
    console.log('各角色在user_roles表中的数量:');
    console.table(roleCounts);
    
  } catch (error) {
    console.error('修复角色约束时出错:', error);
    
    // 输出更详细的错误信息
    console.error('错误详情:');
    console.error('- 消息:', error.message);
    console.error('- 错误码:', error.code);
    console.error('- 位置:', error.position);
    console.error('- 栈跟踪:', error.stack);
    
    if (client && client.query) {
      console.log('尝试回滚事务...');
      try {
        await client.query('ROLLBACK');
        console.log('事务已回滚');
      } catch (rollbackError) {
        console.error('回滚事务时出错:', rollbackError.message);
      }
    }
  } finally {
    if (client) {
      console.log('释放数据库连接...');
      client.release();
      console.log('数据库连接已释放');
    }
  }
}

// 执行修复
console.log('开始执行角色约束修复...');
fixRoleConstraint().then(() => {
  console.log('角色约束检查和修复完成');
  console.log('关闭连接池...');
  pool.end();
  console.log('连接池已关闭');
}).catch(err => {
  console.error('程序执行失败:', err);
  console.log('关闭连接池...');
  pool.end();
  console.log('连接池已关闭');
}); 