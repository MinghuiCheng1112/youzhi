import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase 配置缺失');
  process.exit(1);
}

console.log('使用Supabase URL:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  try {
    console.log('正在查询带有异常施工状态的客户...');
    const { data, error } = await supabase
      .from('customers')
      .select('id, construction_status')
      .not('construction_status', 'is', null);
    
    if (error) {
      console.error('查询出错:', error);
      return;
    }
    
    console.log(`找到 ${data.length} 条记录需要修复`);
    
    // 修复数据
    let successCount = 0;
    let failCount = 0;
    
    for (const record of data) {
      try {
        // 设置为当前时间的ISO字符串
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('customers')
          .update({ construction_status: now })
          .eq('id', record.id);
          
        if (updateError) {
          console.error(`更新ID ${record.id} 失败:`, updateError);
          failCount++;
        } else {
          console.log(`已修复ID ${record.id} 的施工状态为: ${now}`);
          successCount++;
        }
      } catch (e) {
        console.error(`处理ID ${record.id} 时出错:`, e);
        failCount++;
      }
    }
    
    console.log(`修复完成: 成功 ${successCount}, 失败 ${failCount}`);
    
  } catch (error) {
    console.error('执行出错:', error);
  }
}

main();