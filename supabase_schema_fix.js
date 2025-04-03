import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化环境变量
dotenv.config({ path: path.resolve(__dirname, '.env') });

// 初始化Supabase客户端
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少Supabase连接信息。请确保.env文件中包含VITE_SUPABASE_URL和VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('使用Supabase URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

// 修复Supabase架构
async function fixSupabaseSchema() {
  try {
    console.log('开始修复Supabase架构...');
    
    // 第1步：列出所有使用drawing_change字段的策略
    console.log('步骤1: 查询使用drawing_change字段的策略...');
    const listPoliciesSQL = `
      SELECT policyname 
      FROM pg_policies 
      WHERE tablename = 'customers' 
      AND policydef::text LIKE '%drawing_change%';
    `;
    
    const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', { sql_query: listPoliciesSQL });
    
    if (policiesError) {
      console.error('查询策略时出错:', policiesError);
      return;
    }
    
    console.log('发现以下策略可能使用了drawing_change字段:', policies);
    
    // 第2步：删除所有customers表上的策略
    console.log('步骤2: 删除所有customers表上的策略...');
    const dropPoliciesSQL = `
      DO $$
      DECLARE
        policy_record RECORD;
      BEGIN
        FOR policy_record IN 
          SELECT policyname 
          FROM pg_policies 
          WHERE tablename = 'customers'
        LOOP
          EXECUTE format('DROP POLICY IF EXISTS %I ON customers', policy_record.policyname);
          RAISE NOTICE 'Dropped policy %', policy_record.policyname;
        END LOOP;
      END
      $$;
    `;
    
    const { data: dropResult, error: dropError } = await supabase.rpc('exec_sql', { sql_query: dropPoliciesSQL });
    
    if (dropError) {
      console.error('删除策略时出错:', dropError);
      return;
    }
    
    console.log('策略删除结果:', dropResult);
    
    // 第3步：修改drawing_change字段类型
    console.log('步骤3: 修改drawing_change字段类型为TEXT...');
    const alterColumnSQL = `
      ALTER TABLE customers
      ALTER COLUMN drawing_change TYPE TEXT
      USING CASE WHEN drawing_change THEN '变更一' ELSE '未出图' END;
      
      -- 设置默认值
      ALTER TABLE customers
      ALTER COLUMN drawing_change SET DEFAULT '未出图';
    `;
    
    const { data: alterResult, error: alterError } = await supabase.rpc('exec_sql', { sql_query: alterColumnSQL });
    
    if (alterError) {
      console.error('修改字段类型时出错:', alterError);
      return;
    }
    
    console.log('字段类型修改结果:', alterResult);
    
    // 第4步：重新创建默认策略
    console.log('步骤4: 重新创建基本的访问策略...');
    const createPoliciesSQL = `
      -- 为已认证用户创建SELECT策略
      CREATE POLICY "启用已认证用户读取" ON customers
      FOR SELECT TO authenticated USING (true);
      
      -- 为已认证用户创建INSERT策略
      CREATE POLICY "启用已认证用户插入" ON customers
      FOR INSERT TO authenticated WITH CHECK (true);
      
      -- 为已认证用户创建UPDATE策略
      CREATE POLICY "启用已认证用户更新" ON customers
      FOR UPDATE TO authenticated USING (true);
      
      -- 为已认证用户创建DELETE策略(软删除)
      CREATE POLICY "启用已认证用户删除" ON customers
      FOR DELETE TO authenticated USING (true);
    `;
    
    const { data: createResult, error: createError } = await supabase.rpc('exec_sql', { sql_query: createPoliciesSQL });
    
    if (createError) {
      console.error('创建策略时出错:', createError);
      return;
    }
    
    console.log('策略创建结果:', createResult);
    
    // 第5步：更新所有记录，确保drawing_change字段值正确
    console.log('步骤5: 更新所有记录确保值正确...');
    const updateRecordsSQL = `
      UPDATE customers
      SET drawing_change = CASE 
          WHEN drawing_change IS NULL THEN '未出图'
          WHEN drawing_change = '' THEN '未出图'
          ELSE drawing_change
        END;
    `;
    
    const { data: updateResult, error: updateError } = await supabase.rpc('exec_sql', { sql_query: updateRecordsSQL });
    
    if (updateError) {
      console.error('更新记录时出错:', updateError);
      return;
    }
    
    console.log('记录更新结果:', updateResult);
    
    console.log('修复完成!');
    console.log('请确认前端应用中的图纸变更字段现在能正常工作。');
    
  } catch (error) {
    console.error('执行修复时出现异常:', error);
  }
}

// 执行修复
fixSupabaseSchema(); 