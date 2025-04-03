import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 初始化Supabase客户端
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少Supabase连接信息。请确保.env文件中包含VITE_SUPABASE_URL和VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('使用Supabase URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

// 直接执行SQL修复
async function directSQLFix() {
  try {
    console.log('执行直接SQL修复...');
    
    // 获取所有客户记录
    console.log('获取客户数据...');
    const { data: customers, error: fetchError } = await supabase
      .from('customers')
      .select('id, drawing_change');
    
    if (fetchError) {
      console.error('获取客户数据出错:', fetchError);
      return;
    }
    
    console.log(`找到 ${customers.length} 条客户记录`);
    
    // 逐个修复客户记录
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const customer of customers) {
      try {
        // 确定正确的drawing_change值
        let correctValue = '未出图';
        
        if (customer.drawing_change !== null) {
          if (typeof customer.drawing_change === 'boolean') {
            correctValue = customer.drawing_change ? '变更一' : '未出图';
          } else if (typeof customer.drawing_change === 'string') {
            if (customer.drawing_change.trim() === '') {
              correctValue = '未出图';
            } else if (customer.drawing_change === 'true') {
              correctValue = '变更一';
            } else if (customer.drawing_change === 'false') {
              correctValue = '未出图';
            } else {
              correctValue = customer.drawing_change;
            }
          }
        }
        
        // 更新记录
        const { error: updateError } = await supabase
          .from('customers')
          .update({ drawing_change: correctValue })
          .eq('id', customer.id);
        
        if (updateError) {
          console.error(`更新客户 ${customer.id} 出错:`, updateError);
          errorCount++;
        } else {
          fixedCount++;
          if (fixedCount % 10 === 0) {
            console.log(`已修复 ${fixedCount} 条记录...`);
          }
        }
      } catch (err) {
        console.error(`处理客户 ${customer.id} 时出错:`, err);
        errorCount++;
      }
    }
    
    console.log('修复完成。结果:');
    console.log(`- 总记录数: ${customers.length}`);
    console.log(`- 成功修复: ${fixedCount}`);
    console.log(`- 修复失败: ${errorCount}`);
    
  } catch (error) {
    console.error('执行修复时出现异常:', error);
  }
}

// 执行修复
directSQLFix(); 