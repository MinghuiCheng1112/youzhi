// 更新触发器脚本 - 删除依赖construction_teams表的触发器
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// 创建Supabase客户端
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 需要执行的SQL命令
const sqlCommands = [
  // 删除客户表上的自动填充施工队电话触发器
  `DROP TRIGGER IF EXISTS auto_fill_team_phone_trigger ON customers`,
  
  // 创建新的触发器函数，从user_roles表获取施工队电话
  `CREATE OR REPLACE FUNCTION auto_fill_team_phone_from_roles()
   RETURNS TRIGGER AS $$
   DECLARE
     v_phone TEXT;
   BEGIN
     -- 只在施工队字段发生变化时执行
     IF NEW.construction_team IS DISTINCT FROM OLD.construction_team THEN
       -- 如果施工队不为空，查找对应电话并设置
       IF NEW.construction_team IS NOT NULL AND NEW.construction_team != '' THEN
         -- 优先从user_roles表获取电话
         SELECT phone INTO v_phone
         FROM user_roles
         WHERE role = 'construction_team' AND name = NEW.construction_team
         LIMIT 1;
         
         -- 如果找到了电话，则使用它
         IF v_phone IS NOT NULL THEN
           NEW.construction_team_phone = v_phone;
         ELSE
           -- 否则保持现有电话或者设为空
           NEW.construction_team_phone = NULL;
         END IF;
       -- 如果施工队为空，也清空电话
       ELSE
         NEW.construction_team_phone = NULL;
       END IF;
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  
  // 创建新的触发器
  `CREATE TRIGGER auto_fill_team_phone_trigger
   BEFORE UPDATE OF construction_team ON customers
   FOR EACH ROW
   EXECUTE FUNCTION auto_fill_team_phone_from_roles()`
];

// 执行SQL命令的函数
async function executeSqlCommands() {
  console.log('开始更新触发器...');
  
  for (const sql of sqlCommands) {
    try {
      console.log(`执行: ${sql.substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql });
      
      if (error) {
        console.error('SQL执行错误:', error);
      } else {
        console.log('SQL执行成功');
      }
    } catch (err) {
      console.error('执行出错:', err);
    }
  }
  
  console.log('触发器更新完成');
}

// 执行脚本
executeSqlCommands()
  .then(() => {
    console.log('触发器更新操作完成');
    process.exit(0);
  })
  .catch((err) => {
    console.error('触发器更新失败:', err);
    process.exit(1);
  }); 