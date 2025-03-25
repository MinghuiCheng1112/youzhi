import { Customer, ImportResult } from '../types'
import { calculateAllFields } from '../utils/calculationUtils'
import { supabase } from './supabase';

/**
 * 客户相关API
 * 包含所有与客户数据交互的方法，如获取、创建、更新、删除客户信息
 * 以及导入客户数据、检查重复客户、获取抽签客户等功能
 */
export type CreateCustomerInput = Omit<Customer, 'id' | 'created_at' | 'updated_at'>;

// 定义UpdateCustomerInput类型
type UpdateCustomerInput = Partial<Omit<Customer, 'id' | 'created_at' | 'updated_at'>>;

export const customerApi = {
  /**
   * 获取所有未删除的客户
   * 按登记日期降序排列，最新登记的客户排在前面
   * @returns {Promise<Customer[]>} 客户数组
   */
  getAll: async (): Promise<Customer[]> => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * 根据ID获取单个客户详细信息
   * @param {string} id - 客户ID
   * @returns {Promise<Customer | null>} 客户对象或null
   */
  getById: async (id: string): Promise<Customer | null> => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  /**
   * 创建新客户
   * 自动设置登记日期为当前时间，并根据组件数量计算相关字段
   * @param {Partial<Customer>} customer - 客户信息对象
   * @returns {Promise<Customer>} 创建成功的客户对象
   */
  create: async (customer: CreateCustomerInput): Promise<Customer> => {
    const { data, error } = await supabase
      .from('customers')
      .insert([customer])
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * 更新客户信息
   * 如果组件数量变更，自动重新计算相关字段
   * 同时记录所有字段的修改历史
   * @param {string} id - 客户ID
   * @param {Partial<Customer>} updates - 更新的客户信息
   * @param {string} userId - 执行更新操作的用户ID
   * @returns {Promise<Customer>} 更新后的客户对象
   */
  update: async (id: string, customer: UpdateCustomerInput): Promise<Customer> => {
    // 添加日志查看更新的数据
    console.log('更新客户数据:', id, JSON.stringify(customer));
    
    // 创建一个副本
    const updatedCustomer = { ...customer };
    
    // 特殊处理drawing_change字段，确保是布尔类型
    if ('drawing_change' in updatedCustomer) {
      const drawingChange = updatedCustomer.drawing_change;
      updatedCustomer.drawing_change = Boolean(drawingChange);
      console.log('处理后的drawing_change值:', updatedCustomer.drawing_change, '类型:', typeof updatedCustomer.drawing_change);
    }
    
    const { data, error } = await supabase
      .from('customers')
      .update(updatedCustomer)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * 软删除客户（将客户标记为已删除而非物理删除）
   * 通过设置deleted_at字段为当前时间来实现软删除
   * @param {string} id - 客户ID
   * @returns {Promise<void>} 无返回值
   */
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  /**
   * 检查客户是否重复
   * 根据客户姓名或电话号码检查系统中是否已存在相同客户
   * @param {string} name - 客户姓名
   * @param {string} phone - 客户电话号码
   * @returns {Promise<boolean>} 如果存在重复客户返回true，否则返回false
   */
  checkDuplicate: async (name: string, phone: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('customers')
      .select('id')
      .eq('customer_name', name)
      .eq('phone', phone)
      .is('deleted_at', null)

    if (error) throw error
    return (data && data.length > 0) || false
  },

  /**
   * 批量导入客户数据
   * 支持批量导入客户信息，自动处理重复客户和计算相关字段
   * 返回导入结果统计，包括成功、失败、重复的数量和详情
   * @param {Partial<Customer>[]} customers - 客户信息数组
   * @returns {Promise<ImportResult>} 导入结果统计
   */
  importCustomers: async (customers: Partial<Customer>[]): Promise<ImportResult> => {
    const result: ImportResult = {
      total: customers.length,
      success: 0,
      duplicate: 0,
      failed: 0,
      failedItems: []
    }

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i]
      try {
        // 检查必要字段
        if (!customer.customer_name || !customer.phone) {
          result.failed++
          result.failedItems?.push({
            row: i + 1,
            reason: '缺少必要字段：客户姓名或电话号码'
          })
          continue
        }

        // 检查是否重复
        const isDuplicate = await customerApi.checkDuplicate(
          customer.customer_name || '',
          customer.phone || ''
        )

        if (isDuplicate) {
          result.duplicate++
          result.failedItems?.push({
            row: i + 1,
            reason: '客户重复'
          })
          continue
        }

        // 计算相关字段
        if (customer.module_count) {
          const calculatedFields = calculateAllFields(customer.module_count)
          Object.assign(customer, calculatedFields)
        }

        // 创建客户
        await customerApi.create(customer as CreateCustomerInput)
        result.success++
      } catch (error) {
        result.failed++
        let errorMessage = '未知错误'
        
        if (error instanceof Error) {
          // 提取更详细的错误信息
          if (error.message.includes('duplicate key')) {
            errorMessage = '客户数据重复'
          } else if (error.message.includes('violates not-null')) {
            errorMessage = '缺少必要数据'
          } else if (error.message.includes('invalid input syntax')) {
            errorMessage = '数据格式错误'
          } else {
            errorMessage = error.message
          }
        }
        
        result.failedItems?.push({
          row: i + 1,
          reason: `导入失败: ${errorMessage}`
        })
      }
    }

    return result
  },

  /**
   * 获取符合抽签条件的客户（已出库但未派工的客户）
   * 筛选出已方钢出库但尚未派工的客户，按出库日期升序排列
   * 用于抽签系统选择施工队
   * @returns {Promise<Customer[]>} 符合抽签条件的客户数组
   */
  getEligibleForDraw: async (): Promise<Customer[]> => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .is('deleted_at', null)
      .not('square_steel_outbound_date', 'is', null)
      .is('dispatch_date', null)
      .order('square_steel_outbound_date', { ascending: true })

    if (error) throw error
    return data || []
  },

  /**
   * 获取所有抽签记录
   * 包含客户姓名信息，按抽签日期降序排列
   * @returns {Promise<DrawRecord[]>} 抽签记录数组
   */
  getDrawRecords: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('draw_records')
      .select(`
        *,
        customers:customer_id (customer_name)
      `)
      .order('draw_date', { ascending: false })

    if (error) throw error
    
    // 格式化数据
    return (data || []).map(record => ({
      ...record,
      customer_name: record.customers?.customer_name || ''
    }))
  },

  /**
   * 创建抽签记录
   * 记录抽签结果，包括客户ID、乡镇、随机码、施工队等信息
   * 自动设置抽签日期为当前时间
   * @param {Partial<DrawRecord>} drawRecord - 抽签记录信息
   * @returns {Promise<DrawRecord>} 创建成功的抽签记录
   */
  createDrawRecord: async (drawRecord: Partial<any>): Promise<any> => {
    // 检查验证码是否已使用
    const { data: existingRecord, error: _checkError } = await supabase
      .from('draw_records')
      .select('id')
      .eq('random_code', drawRecord.random_code)
      .single()
    
    if (existingRecord) {
      throw new Error('验证码已被使用')
    }
    
    // 如果验证码未使用，则创建记录
    const { data, error } = await supabase
      .from('draw_records')
      .insert({
        ...drawRecord,
        draw_date: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * 获取所有已删除的客户
   * 筛选出已标记为删除的客户记录，按删除时间降序排列
   * @returns {Promise<Customer[]>} 已删除的客户数组
   */
  getDeletedCustomers: async (): Promise<Customer[]> => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * 恢复已删除的客户
   * 将客户的deleted_at字段设置为null，使其重新显示在系统中
   * @param {string} id - 客户ID
   * @returns {Promise<void>} 无返回值
   */
  restoreCustomer: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('customers')
      .update({ deleted_at: null })
      .eq('id', id)

    if (error) throw error
  },

  /**
   * 获取所有客户的修改记录
   * 包含客户姓名信息，按修改时间降序排列
   * @returns {Promise<any[]>} 修改记录数组
   */
  getModificationRecords: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('modification_records')
      .select(`
        *,
        customers:customer_id (customer_name)
      `)
      .order('modified_at', { ascending: false })

    if (error) throw error
    
    // 格式化数据
    return (data || []).map(record => ({
      ...record,
      customer_name: record.customers?.customer_name || ''
    }))
  },

  // 通过业务员获取客户
  getBySalesman: async (email: string): Promise<Customer[]> => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('salesman', email)
      .is('deleted_at', null)
      .order('register_date', { ascending: false })
    
    if (error) throw error
    return data || []
  },
  
  // 获取特定状态的客户
  getByConstructionStatus: async (status: string): Promise<Customer[]> => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('construction_status', status)
      .is('deleted_at', null)
      .order('register_date', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  /**
   * 更新出库状态
   * @param {string} id - 客户ID
   * @param {string} type - 出库类型，'square_steel'或'component'
   * @param {boolean} status - 出库状态，true表示出库，false表示撤销出库
   * @returns {Promise<Customer>} 更新后的客户对象
   */
  updateOutboundStatus: async (
    id: string,
    type: 'square_steel' | 'component',
    status: boolean
  ): Promise<Customer> => {
    try {
      // 使用新的切换函数
      const functionName = type === 'square_steel' ? 'toggle_square_steel_status' : 'toggle_component_status';
      
      console.log(`更新出库状态: ${type} for 客户 ${id}`);
      
      // 首先获取当前客户数据
      const { data: currentCustomer, error: getError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();
        
      if (getError) {
        console.error('获取当前客户数据失败:', getError);
        throw new Error(`获取客户数据失败: ${getError.message}`);
      }
      
      if (!currentCustomer) {
        throw new Error(`未找到ID为${id}的客户`);
      }
      
      // 确定要更新的字段和值
      const now = new Date().toISOString().split('T')[0]; // 仅使用日期部分 YYYY-MM-DD
      let updates: Partial<Customer> = {};
      
      if (type === 'square_steel') {
        // 获取当前状态
        const currentStatus = currentCustomer.square_steel_status || 'none';
        
        // 根据当前状态决定下一个状态
        if (currentStatus === 'none') {
          // 未出库 -> 出库
          updates = {
            square_steel_outbound_date: now,
            square_steel_status: 'outbound'
          };
        } else if (currentStatus === 'outbound') {
          // 出库 -> 回库
          updates = {
            square_steel_inbound_date: now,
            square_steel_status: 'inbound'
          };
        } else if (currentStatus === 'inbound') {
          // 回库 -> 未出库（重置）
          updates = {
            square_steel_outbound_date: null,
            square_steel_inbound_date: null,
            square_steel_status: 'none'
          };
        }
      } else { // component
        // 获取当前状态
        const currentStatus = currentCustomer.component_status || 'none';
        
        // 根据当前状态决定下一个状态
        if (currentStatus === 'none') {
          // 未出库 -> 出库
          updates = {
            component_outbound_date: now,
            component_status: 'outbound'
          };
        } else if (currentStatus === 'outbound') {
          // 出库 -> 回库
          updates = {
            component_inbound_date: now,
            component_status: 'inbound'
          };
        } else if (currentStatus === 'inbound') {
          // 回库 -> 未出库（重置）
          updates = {
            component_outbound_date: null,
            component_inbound_date: null,
            component_status: 'none'
          };
        }
      }
      
      console.log(`直接更新客户数据:`, updates);
      
      // 直接更新数据库中的字段
      const { data: updatedCustomer, error: updateError } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('更新客户数据失败:', updateError);
        throw new Error(`更新出库状态失败: ${updateError.message}`);
      }

      // 获取更新后的完整客户数据
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      console.log('状态更新结果:', customerData);
      return customerData as Customer;
    } catch (error) {
      console.error('更新出库状态失败:', error);
      throw error;
    }
  },
  
  /**
   * 更新催单状态
   * 如果客户当前没有催单，则添加当前时间作为催单时间；
   * 如果客户已有催单，则删除催单时间
   * @param {string} id - 客户ID
   * @returns {Promise<Customer>} 更新后的客户对象
   */
  updateUrgeOrder: async (id: string): Promise<Customer> => {
    // 首先获取客户当前状态
    const { data: customer, error: getError } = await supabase
      .from('customers')
      .select('id, urge_order')
      .eq('id', id)
      .single();
    
    if (getError) throw getError;
    
    // 根据当前状态确定新的催单值
    // 如果已经有催单时间，则清除；否则设置为当前时间
    const newUrgeOrderValue = customer.urge_order ? null : new Date().toISOString();
    
    // 更新客户的催单状态
    const { data, error } = await supabase
      .from('customers')
      .update({ urge_order: newUrgeOrderValue })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
}

/**
 * 修改记录相关API
 * 包含获取客户修改历史记录的方法
 * 用于追踪客户信息的变更历史
 */
export const recordApi = {
  /**
   * 获取指定客户的所有修改记录
   * 按修改时间降序排列，最新的修改排在前面
   * @param {string} customerId - 客户ID
   * @returns {Promise<ModificationRecord[]>} 修改记录数组
   */
  getByCustomerId: async (customerId: string): Promise<any[]> => {
    const { data, error } = await supabase
      .from('modification_records')
      .select('*')
      .eq('customer_id', customerId)
      .order('modified_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * 获取系统中所有客户的修改记录
   * 包含客户姓名信息，按修改时间降序排列
   * @returns {Promise<ModificationRecord[]>} 修改记录数组
   */
  getAll: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('modification_records')
      .select('*, customers(customer_name)')
      .order('modified_at', { ascending: false })

    if (error) throw error
    return data || []
  }
}

/**
 * 删除记录相关API
 * 包含获取和恢复已删除客户的方法
 * 用于管理软删除的客户记录
 */
export const deletedRecordsApi = {
  async getDeletedRecords() {
    try {
      const { data, error } = await supabase.rpc('get_deleted_records');
      
      if (error) {
        console.error('获取删除记录失败:', error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('获取删除记录出现异常:', error);
      return { data: null, error };
    }
  },
  
  async restoreDeletedRecord(recordId: string) {
    try {
      const { data, error } = await supabase.rpc('restore_deleted_record', {
        record_id: recordId
      });
      
      if (error) {
        console.error('恢复删除记录失败:', error);
        return { success: false, error };
      }
      
      return { success: true, error: null };
    } catch (error) {
      console.error('恢复删除记录出现异常:', error);
      return { success: false, error };
    }
  },
  
  async batchRestoreDeletedRecords(recordIds: string[]) {
    try {
      // 使用Promise.all并行处理多个恢复请求
      const results = await Promise.all(
        recordIds.map(id => this.restoreDeletedRecord(id))
      );
      
      // 检查是否有任何恢复失败
      const hasFailures = results.some(result => !result.success);
      
      if (hasFailures) {
        const failedCount = results.filter(result => !result.success).length;
        return {
          success: false,
          error: `${failedCount}/${recordIds.length} 个记录恢复失败`,
          results
        };
      }
      
      return { success: true, error: null, results };
    } catch (error) {
      console.error('批量恢复删除记录出现异常:', error);
      return { success: false, error, results: [] };
    }
  }
}

/**
 * 用于抽签工作台选择施工队
 */

/**
 * 抽签工作台相关API
 * 包含抽签工作台所需的所有方法，如获取可抽签客户、创建抽签记录、更新派工信息等
 */
export const drawSystemApi = {
  /**
   * 获取指定乡镇可抽签的客户
   * 筛选出已方钢出库但未派工且地址包含指定乡镇的客户
   * 按出库日期升序排列，优先处理等待时间较长的客户
   * @param {string} township - 乡镇名称
   * @returns {Promise<Customer[]>} 符合条件的客户数组
   */
  getAvailableCustomers: async (township: string): Promise<Customer[]> => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .is('deleted_at', null)
      .not('square_steel_outbound_date', 'is', null)
      .is('dispatch_date', null)
      .ilike('address', `%${township}%`)
      .order('square_steel_outbound_date', { ascending: true })

    if (error) throw error
    return data || []
  },

  /**
   * 更新客户的派工信息
   * 设置客户的派工日期为当前时间，并分配指定的施工队
   * 在抽签完成后调用此方法更新客户状态
   * @param {string} customerId - 客户ID
   * @param {string} constructionTeam - 施工队名称
   * @returns {Promise<void>} 无返回值
   */
  updateCustomerDispatch: async (customerId: string, constructionTeam: string): Promise<void> => {
    const { error } = await supabase
      .from('customers')
      .update({
        dispatch_date: new Date().toISOString(),
        construction_team: constructionTeam,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId)

    if (error) throw error
  },

  /**
   * 生成4位数字随机码
   * 用于抽签工作台的验证码，范围为1000-9999
   * @returns {string} 4位数字随机码
   */
  generateRandomCode: (): string => {
    return Math.floor(1000 + Math.random() * 9000).toString()
  },

  /**
   * 验证随机码是否有效
   * 检查随机码是否已被使用过，确保每个随机码只能使用一次
   * @param {string} code - 需要验证的随机码
   * @returns {Promise<boolean>} 如果随机码有效返回true，否则返回false
   */
  validateRandomCode: async (code: string): Promise<boolean> => {
    // 检查是否已经使用过
    const { data, error } = await supabase
      .from('draw_records')
      .select('id')
      .eq('random_code', code)

    if (error) throw error
    return !(data && data.length > 0)
  }
}

// 新增的API - 施工队管理
export const constructionTeamApi = {
  /**
   * 获取所有施工队信息
   * @returns {Promise<{name: string, phone: string}[]>} 施工队信息数组
   */
  getAll: async (): Promise<{name: string, phone: string}[]> => {
    try {
      // 不再尝试从construction_teams表获取，而是调用getFromUserRoles方法
      console.log('从user_roles表获取施工队信息');
      return await constructionTeamApi.getFromUserRoles();
    } catch (error) {
      console.error('获取施工队列表失败:', error);
      // 如果获取失败，返回一个空数组
      return [];
    }
  },
  
  /**
   * 从user_roles表获取施工队信息
   * 根据role字段筛选出施工队角色的用户
   * @returns {Promise<{name: string, phone: string}[]>} 施工队信息数组
   */
  getFromUserRoles: async (): Promise<{name: string, phone: string}[]> => {
    try {
      console.log('从user_roles表获取施工队信息');
      
      // 从user_roles表查询角色为construction_team的用户
      const { data, error } = await supabase
        .from('user_roles')
        .select('name, phone, email')
        .eq('role', 'construction_team')
        .order('name', { ascending: true });
      
      if (error) {
        console.error('从user_roles表获取施工队失败:', error);
        return [];
      }
      
      console.log('从user_roles获取到的施工队数据:', data);
      
      // 确保返回的每个施工队都有name字段
      return (data || []).map(team => ({
        name: team.name || team.email || '未命名施工队',
        phone: team.phone || ''
      }));
    } catch (err) {
      console.error('获取user_roles施工队数据时出错:', err);
      return [];
    }
  }
}

// 踏勘员API
export const surveyorApi = {
  /**
   * 从user_roles表获取踏勘员信息
   * 根据role字段筛选出踏勘员角色的用户
   * @returns {Promise<{name: string, phone: string}[]>} 踏勘员信息数组
   */
  getFromUserRoles: async (): Promise<{name: string, phone: string}[]> => {
    try {
      console.log('从user_roles表获取踏勘员信息');
      
      // 从user_roles表查询角色为surveyor的用户
      const { data, error } = await supabase
        .from('user_roles')
        .select('name, phone, email')
        .eq('role', 'surveyor')
        .order('name', { ascending: true });
      
      if (error) {
        console.error('从user_roles表获取踏勘员失败:', error);
        return [];
      }
      
      console.log('从user_roles获取到的踏勘员数据:', data);
      
      // 确保返回的每个踏勘员都有name字段
      return (data || []).map(surveyor => ({
        name: surveyor.name || surveyor.email || '未命名踏勘员',
        phone: surveyor.phone || ''
      }));
    } catch (err) {
      console.error('获取user_roles踏勘员数据时出错:', err);
      return [];
    }
  }
}

// 验证码API服务
export const verificationCodeApi = {
  /**
   * 生成新的验证码
   * @param {string} createdBy - 生成验证码的用户
   * @param {string[]} blockedSalesmen - 屏蔽的业务员列表
   * @returns {Promise<{code: string, success: boolean, error: string | null}>} 生成的验证码和状态
   */
  generate: async (createdBy: string, blockedSalesmen: string[] = []): Promise<{code: string, success: boolean, error: string | null}> => {
    try {
      // 生成4位随机数字验证码
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      
      // 计算过期时间（24小时后）
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      // 将验证码保存到数据库
      const { error } = await supabase
        .from('verification_codes')
        .insert({
          code,
          created_by: createdBy,
          expires_at: expiresAt.toISOString(),
          blocked_salesmen: blockedSalesmen.length > 0 ? blockedSalesmen : null,
          is_active: true
        });
      
      if (error) {
        console.error('保存验证码失败:', error);
        return { code: '', success: false, error: '保存验证码失败' };
      }
      
      return { code, success: true, error: null };
    } catch (error) {
      console.error('生成验证码出错:', error);
      return { code: '', success: false, error: '生成验证码出错' };
    }
  },
  
  /**
   * 验证验证码是否有效，但不标记为已使用
   * @param {string} code - 要验证的验证码
   * @returns {Promise<{valid: boolean, codeId: string, blockedSalesmen: string[], error: string | null}>} 验证结果
   */
  validateOnly: async (code: string): Promise<{valid: boolean, codeId: string, blockedSalesmen: string[], error: string | null}> => {
    try {
      // 先进行字符串格式化处理，确保验证码是4位字符串
      const cleanCode = String(code).trim().slice(0, 4);
      console.log('API处理后的验证码:', cleanCode, '长度:', cleanCode.length);
      
      // 确保验证码格式正确
      if (!cleanCode || cleanCode.length !== 4) {
        console.error('验证码格式不正确:', cleanCode);
        return { valid: false, codeId: '', blockedSalesmen: [], error: '验证码必须是4位数字' };
      }
      
      // 查询验证码 - 先不加任何过滤条件
      const { data, error } = await supabase
        .from('verification_codes')
        .select('*')
        .eq('code', cleanCode)
        .limit(1);
      
      if (error) {
        console.error('验证码查询失败:', error);
        return { valid: false, codeId: '', blockedSalesmen: [], error: '查询失败: ' + error.message };
      }
      
      console.log('验证码查询结果:', data);
      
      if (!data || data.length === 0) {
        console.log('未找到验证码记录');
        return { valid: false, codeId: '', blockedSalesmen: [], error: '验证码不存在' };
      }
      
      const verificationCode = data[0];
      console.log('找到验证码记录:', verificationCode);
      
      // 检查验证码是否已使用
      if (verificationCode.used_at) {
        console.log('验证码已被使用,时间:', verificationCode.used_at);
        return { valid: false, codeId: '', blockedSalesmen: [], error: '验证码已被使用' };
      }
      
      // 检查验证码是否已过期
      const expiresAt = new Date(verificationCode.expires_at);
      const now = new Date();
      
      if (now > expiresAt) {
        console.log('验证码已过期，过期时间:', expiresAt, '当前时间:', now);
        return { valid: false, codeId: '', blockedSalesmen: [], error: '验证码已过期' };
      }
      
      // 如果验证码存在、未使用且未过期，则验证成功
      console.log('验证码有效，ID:', verificationCode.id);
      const blockedSalesmen = verificationCode.blocked_salesmen || [];
      return { 
        valid: true, 
        codeId: verificationCode.id, 
        blockedSalesmen, 
        error: null 
      };
    } catch (error) {
      console.error('验证验证码出错:', error);
      return { valid: false, codeId: '', blockedSalesmen: [], error: '验证验证码出错: ' + (error instanceof Error ? error.message : String(error)) };
    }
  },
  
  /**
   * 标记验证码为已使用
   * @param {string} codeId - 验证码ID
   * @param {string} usedBy - 使用验证码的用户
   * @returns {Promise<{success: boolean, error: string | null}>} 操作结果
   */
  markAsUsed: async (codeId: string, usedBy: string): Promise<{success: boolean, error: string | null}> => {
    try {
      console.log('标记验证码为已使用，ID:', codeId, '使用者:', usedBy);
      
      // 先检查验证码是否已被使用
      const { data: checkData, error: checkError } = await supabase
        .from('verification_codes')
        .select('used_at, is_active')
        .eq('id', codeId)
        .single();
      
      if (checkError) {
        console.error('检查验证码使用状态失败:', checkError);
        return { success: false, error: '检查验证码状态失败: ' + checkError.message };
      }
      
      if (checkData && checkData.used_at) {
        console.log('验证码已被使用,无需再次标记');
        return { success: true, error: null }; // 已经标记过了，返回成功
      }
      
      const now = new Date();
      // 标记验证码为已使用
      const { data, error } = await supabase
        .from('verification_codes')
        .update({
          used_at: now.toISOString(),
          used_by: usedBy,
          is_active: false
        })
        .eq('id', codeId)
        .select();
      
      if (error) {
        console.error('标记验证码为已使用失败:', error);
        return { success: false, error: '标记验证码为已使用失败: ' + error.message };
      }
      
      // 确保数据库更新成功
      if (!data || data.length === 0) {
        console.error('标记验证码为已使用可能失败：返回数据为空');
        return { success: false, error: '标记验证码为已使用可能失败：返回数据为空' };
      }
      
      console.log('成功标记验证码为已使用, 返回数据:', data);
      return { success: true, error: null };
    } catch (error) {
      console.error('标记验证码为已使用出错:', error);
      return { success: false, error: '标记验证码为已使用出错: ' + (error instanceof Error ? error.message : String(error)) };
    }
  },
  
  /**
   * 验证验证码是否有效（旧方法，会立即标记为已使用）
   * @param {string} code - 要验证的验证码
   * @param {string} usedBy - 使用验证码的用户
   * @returns {Promise<{valid: boolean, blockedSalesmen: string[], error: string | null}>} 验证结果
   */
  validate: async (code: string, usedBy: string): Promise<{valid: boolean, blockedSalesmen: string[], error: string | null}> => {
    try {
      // 查询验证码
      const { data, error } = await supabase
        .from('verification_codes')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('验证码查询失败:', error);
        return { valid: false, blockedSalesmen: [], error: '验证码无效' };
      }
      
      if (!data || data.length === 0) {
        return { valid: false, blockedSalesmen: [], error: '验证码不存在或已失效' };
      }
      
      const verificationCode = data[0];
      
      // 检查验证码是否过期
      const expiresAt = new Date(verificationCode.expires_at);
      const now = new Date();
      
      if (now > expiresAt) {
        return { valid: false, blockedSalesmen: [], error: '验证码已过期' };
      }
      
      // 验证成功，将验证码标记为已使用
      const { error: updateError } = await supabase
        .from('verification_codes')
        .update({
          used_at: now.toISOString(),
          used_by: usedBy,
          is_active: false
        })
        .eq('id', verificationCode.id);
      
      if (updateError) {
        console.error('更新验证码状态失败:', updateError);
        return { valid: false, blockedSalesmen: [], error: '更新验证码状态失败' };
      }
      
      // 返回验证成功和屏蔽业务员列表
      const blockedSalesmen = verificationCode.blocked_salesmen || [];
      return { valid: true, blockedSalesmen, error: null };
    } catch (error) {
      console.error('验证验证码出错:', error);
      return { valid: false, blockedSalesmen: [], error: '验证验证码出错' };
    }
  }
}