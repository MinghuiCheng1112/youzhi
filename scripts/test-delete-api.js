require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js')

// 检查必要的环境变量
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`错误: 缺少环境变量 ${envVar}`);
    process.exit(1);
  }
}

// 创建 Supabase 客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testDeleteApi() {
  try {
    console.log('开始测试客户API删除功能...');
    
    // 创建一个测试客户
    const customerId = uuidv4();
    const customerName = `API测试删除客户_${new Date().toISOString().replace(/[:.]/g, '_')}`;
    
    console.log(`创建测试客户: ${customerName} (ID: ${customerId})`);
    
    const { data: createData, error: createError } = await supabase
      .from('customers')
      .insert([{
        id: customerId,
        customer_name: customerName,
        phone: '13800138000',
        address: '测试地址',
        register_date: new Date().toISOString(),
        salesman: '测试业务员',
        technical_review_status: 'pending',
        construction_acceptance_status: 'pending'
      }])
      .select();
    
    if (createError) {
      throw new Error(`创建测试客户失败: ${createError.message}`);
    }
    
    console.log('客户创建成功，等待3秒后执行软删除...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 执行软删除
    console.log(`使用API删除客户: ${customerId}`);
    const { error: deleteError } = await supabase
      .from('customers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', customerId);
      
    if (deleteError) {
      throw new Error(`删除测试客户失败: ${deleteError.message}`);
    }
    
    console.log('软删除执行完成，等待2秒后验证结果...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 验证客户记录已被软删除
    const { data: softDeletedCustomers, error: checkError } = await supabase
      .from('customers')
      .select('id, customer_name, deleted_at')
      .eq('id', customerId)
      .single();
    
    if (checkError) {
      throw new Error(`查询客户失败: ${checkError.message}`);
    }
    
    if (softDeletedCustomers && softDeletedCustomers.deleted_at) {
      console.log('✅ 客户已成功被软删除');
    } else {
      console.log('❌ 软删除失败，客户未被标记为删除');
    }
    
    // 验证是否生成了删除记录
    const { data: deletedRecords, error: recordsError } = await supabase
      .rpc('get_deleted_records');
      
    if (recordsError) {
      throw new Error(`查询删除记录失败: ${recordsError.message}`);
    }
    
    const matchingRecord = deletedRecords.find(
      record => record.original_id === customerId
    );
    
    if (matchingRecord) {
      console.log('✅ 删除记录已成功生成');
      console.log('删除记录详情:', {
        id: matchingRecord.id,
        original_id: matchingRecord.original_id,
        customer_name: matchingRecord.customer_name,
        deleted_at: matchingRecord.deleted_at
      });
      
      // 测试恢复功能
      console.log('\n测试恢复功能...');
      const { data: restoreData, error: restoreError } = await supabase
        .rpc('restore_deleted_record', {
          record_id: matchingRecord.id
        });
        
      if (restoreError) {
        throw new Error(`恢复记录失败: ${restoreError.message}`);
      }
      
      console.log('恢复操作执行完成，等待2秒后验证结果...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 验证客户是否被恢复
      const { data: restoredCustomer, error: restoredCheckError } = await supabase
        .from('customers')
        .select('id, customer_name, deleted_at')
        .eq('id', customerId)
        .single();
        
      if (restoredCheckError) {
        throw new Error(`查询恢复客户失败: ${restoredCheckError.message}`);
      }
      
      if (restoredCustomer && restoredCustomer.deleted_at === null) {
        console.log('✅ 恢复功能工作正常，客户已恢复');
      } else {
        console.log('❌ 恢复功能可能有问题，客户未正确恢复');
      }
      
      // 验证恢复记录
      const { data: restoredRecords, error: restoredRecordsError } = await supabase
        .rpc('get_restored_records');
        
      if (restoredRecordsError) {
        throw new Error(`查询已恢复记录失败: ${restoredRecordsError.message}`);
      }
      
      const restoredRecord = restoredRecords.find(
        record => record.original_id === customerId
      );
      
      if (restoredRecord && restoredRecord.restored_at) {
        console.log('✅ 恢复记录已正确标记');
        console.log('恢复记录详情:', {
          id: restoredRecord.id,
          original_id: restoredRecord.original_id,
          customer_name: restoredRecord.customer_name,
          deleted_at: restoredRecord.deleted_at,
          restored_at: restoredRecord.restored_at
        });
      } else {
        console.log('❌ 恢复记录未正确标记');
      }
    } else {
      console.log('❌ 未找到对应的删除记录');
    }
    
    // 清理测试数据
    console.log('\n清理测试数据...');
    
    // 物理删除客户记录
    await supabase
      .from('customers')
      .delete()
      .eq('id', customerId);
    
    console.log('测试完成，数据已清理');
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 执行测试
testDeleteApi()
  .then(() => {
    console.log('API删除功能测试完成');
  })
  .catch(err => {
    console.error('测试过程中发生错误:', err);
  }); 