/**
 * 建设验收API修复
 * 
 * 这个补丁文件提供了专门用于处理建设验收字段更新的安全方法，
 * 确保在数据库模式与前端代码不完全匹配时仍能正常工作
 */

import { customerApi } from './api';
import { supabase } from './supabase';

/**
 * 安全更新建设验收状态
 * 只传递construction_acceptance_date字段
 */
export async function updateConstructionAcceptance(id: string, isAccepted: boolean) {
  console.log('[API修复] 安全更新建设验收状态，参数:', { id, isAccepted });
  
  try {
    // 尝试使用直接RPC调用更新 - 更安全的方法
    return await updateConstructionAcceptanceDirectRPC(id, isAccepted);
  } catch (rpcError) {
    console.error('[API修复] RPC调用失败，尝试使用原始API:', rpcError);
    
    try {
      // 尝试使用原始客户端API
      // 确保只发送一个字段
      const updateData = {
        construction_acceptance_date: isAccepted ? new Date().toISOString() : null
      };
      
      // 直接调用原始API，确保不添加额外字段
      const result = await customerApi.update(id, updateData);
      console.log('[API修复] 更新成功:', result);
      return result;
    } catch (apiError) {
      console.error('[API修复] 原始API调用也失败，尝试直接SQL调用:', apiError);
      
      // 最后尝试直接SQL方法
      return await updateConstructionAcceptanceDirectSQL(id, isAccepted);
    }
  }
}

/**
 * 直接使用RPC方法更新construction_acceptance_date字段
 * 
 * 这个方法使用Supabase的RPC功能，调用一个自定义的SQL函数
 * 这个函数必须在数据库中存在才能工作
 */
async function updateConstructionAcceptanceDirectRPC(id: string, isAccepted: boolean) {
  console.log('[API修复-RPC] 尝试使用RPC更新');
  
  // 这里会在数据库不支持RPC的情况下失败，所以外层需要捕获错误
  const { data, error } = await supabase.rpc('update_construction_acceptance_date', {
    p_customer_id: id,
    p_acceptance_date: isAccepted ? new Date().toISOString() : null
  });
  
  if (error) throw error;
  return data;
}

/**
 * 直接使用SQL更新construction_acceptance_date字段
 * 
 * 这个方法使用Supabase的原始SQL执行功能
 * 这是最后的备选方案，因为它会绕过数据库权限和应用逻辑
 */
async function updateConstructionAcceptanceDirectSQL(id: string, isAccepted: boolean) {
  console.log('[API修复-SQL] 尝试使用SQL直接更新');
  
  // 准备SQL参数
  const newValue = isAccepted ? new Date().toISOString() : null;
  
  // 执行SQL
  const { data, error } = await supabase.from('customers')
    .update({ construction_acceptance_date: newValue })
    .eq('id', id)
    .select('id, customer_name, construction_acceptance_date');
  
  if (error) {
    console.error('[API修复-SQL] SQL更新失败:', error);
    throw error;
  }
  
  console.log('[API修复-SQL] SQL更新成功:', data);
  return data;
} 