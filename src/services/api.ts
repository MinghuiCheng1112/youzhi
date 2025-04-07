import { Customer, ImportResult } from '../types'
import { calculateAllFields } from '../utils/calculationUtils'
import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

// 在发送请求前处理字段的工具函数
function processNumericFields(data: any): any {
  if (!data) return data;
  
  console.log('处理数字字段前的数据:', JSON.stringify(data));
  
  // 定义需要处理的数字字段
  const numberFields = ['module_count', 'capacity', 'investment_amount', 'land_area', 'price'];
  
  // 创建一个新对象或数组，避免修改原始数据
  let processedData = Array.isArray(data) ? [...data] : {...data};
  
  // 处理单个对象的函数
  const processObject = (obj: any) => {
    const result = {...obj};
    numberFields.forEach(field => {
      if (field in result) {
        const value = result[field];
        
        // 检查是否为空值或无效数值
        if (value === '' || value === undefined || value === null || 
            (typeof value === 'string' && value.trim() === '') || 
            (typeof value === 'number' && isNaN(value))) {
          result[field] = null;
          console.log(`将${field}字段的空值转换为null，原始值:`, value);
        }
        // 如果是字符串，尝试转换为数字
        else if (typeof value === 'string') {
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            result[field] = numValue;
            console.log(`将${field}字段的字符串值转换为数字: ${value} -> ${numValue}`);
          } else {
            result[field] = null;
            console.log(`将${field}字段的无效数字字符串转换为null: ${value}`);
          }
        }
      }
    });
    return result;
  };
  
  // 根据数据类型处理
  if (Array.isArray(processedData)) {
    processedData = processedData.map(item => processObject(item));
  } else {
    processedData = processObject(processedData);
  }
  
  console.log('处理数字字段后的数据:', JSON.stringify(processedData));
  return processedData;
}

// 使用修改后的工具函数定义Supabase直接修改函数
const originalUpdate = supabase.from('customers').update;
supabase.from('customers').update = function(data: any) {
  // 预处理数据
  const processedData = processNumericFields(data);
  // 调用原始方法
  return originalUpdate.call(this, processedData);
};

/**
 * 数据缓存服务
 * 实现前端数据修改直接反映在界面上，并在后台静默推送到数据库
 */
class DataCacheService {
  private cache: Map<string, Customer> = new Map();
  private updateQueue: Map<string, {id: string, updates: Partial<Customer>, retryCount?: number}> = new Map();
  private isProcessing: boolean = false;
  private static instance: DataCacheService;

  private constructor() {
    // 设置定期处理队列
    setInterval(() => this.processUpdateQueue(), 1000); // 每秒处理一次队列
  }

  public static getInstance(): DataCacheService {
    if (!DataCacheService.instance) {
      DataCacheService.instance = new DataCacheService();
    }
    return DataCacheService.instance;
  }

  // 初始化缓存
  public initCache(customers: Customer[]): void {
    customers.forEach(customer => {
      if (customer.id) {
        this.cache.set(customer.id, {...customer});
      }
    });
  }

  // 获取缓存的所有客户数据
  public getAllCustomers(): Customer[] {
    return Array.from(this.cache.values());
  }

  // 获取单个客户数据
  public getCustomer(id: string): Customer | undefined {
    return this.cache.get(id);
  }

  // 更新客户数据并加入更新队列
  public updateCustomer(id: string, updates: Partial<Customer>): Customer {
    const customer = this.cache.get(id);
    if (!customer) {
      throw new Error(`Customer with id ${id} not found in cache`);
    }

    // 处理数字字段，确保空字符串转换为null
    const processedUpdates = { ...updates };
    const numberFields = ['module_count', 'capacity', 'investment_amount', 'land_area', 'price'];
    numberFields.forEach(field => {
      if (field in processedUpdates) {
        const value = (processedUpdates as any)[field];
        console.log(`预处理${field}字段，原始值:`, value, `类型:`, typeof value);
        
        // 处理空字符串、undefined和null
        if (value === '' || value === undefined || value === null) {
          (processedUpdates as any)[field] = null;
          console.log(`将${field}字段的空值转换为null`);
        }
        // 处理数字或数字字符串
        else if (typeof value === 'string') {
          // 如果是数字字符串，转换为数字
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            (processedUpdates as any)[field] = numValue;
            console.log(`将${field}字段的字符串值转换为数字: ${value} -> ${numValue}`);
          } else {
            // 如果是非数字字符串，设置为null
            (processedUpdates as any)[field] = null;
            console.log(`将${field}字段的非数字字符串值转换为null: ${value}`);
          }
        }
      }
    });
    
    // 更新本地缓存
    const updatedCustomer = {...customer, ...processedUpdates};
    this.cache.set(id, updatedCustomer);

    // 将更新加入队列
    this.updateQueue.set(id, {id, updates: processedUpdates});

    // 如果当前没有在处理队列，启动处理
    if (!this.isProcessing) {
      this.processUpdateQueue();
    }

    return updatedCustomer;
  }

  // 添加新客户到缓存
  public addCustomer(customer: Customer): void {
    if (customer.id) {
      this.cache.set(customer.id, {...customer});
    }
  }

  // 从缓存中删除客户
  public removeCustomer(id: string): void {
    this.cache.delete(id);
  }

  // 处理更新队列
  private async processUpdateQueue(): Promise<void> {
    if (this.isProcessing || this.updateQueue.size === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`开始处理更新队列，队列长度: ${this.updateQueue.size}`);

    try {
      // 创建队列快照，以便在处理过程中可以安全添加新的更新
      const updates = Array.from(this.updateQueue.values());
      // 临时清空队列，失败的更新会重新加入
      this.updateQueue.clear();

      // 分批处理更新，避免同时发送太多请求
      const batchSize = 5;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        // 并行处理一批更新，但记录每个更新的结果，不会因为一个失败就中断整个过程
        await Promise.all(batch.map(async (update) => {
          try {
            // 预处理数据，确保类型正确，特别是处理空字符串
            const processedUpdates = { ...update.updates };
            
            // 在发送数据库请求前打印详细内容，帮助调试
            console.log(`准备静默更新客户数据(ID: ${update.id}): `, JSON.stringify(processedUpdates));
            
            // 再次处理数字字段，以确保数据库安全
            const numberFields = ['module_count', 'capacity', 'investment_amount', 'land_area', 'price'];
            numberFields.forEach(field => {
              if (field in processedUpdates) {
                const value = (processedUpdates as any)[field];
                
                // 记录字段类型，帮助调试
                console.log(`【最终检查】${field}字段值:`, value, `类型:`, typeof value);
                
                // 严格检查并处理空字符串、undefined和null
                if (value === '' || value === undefined || value === null || 
                    (typeof value === 'string' && value.trim() === '') || 
                    (typeof value === 'number' && isNaN(value))) {
                  (processedUpdates as any)[field] = null;
                  console.log(`【最终检查】将${field}字段的空值转换为null`);
                } 
                // 处理字符串数字
                else if (typeof value === 'string') {
                  // 尝试将非空字符串转换为数字
                  const numValue = Number(value);
                  if (!isNaN(numValue)) {
                    (processedUpdates as any)[field] = numValue;
                    console.log(`【最终检查】将${field}字段的字符串值转换为数字: ${value} -> ${numValue}`);
                  } else {
                    // 如果转换失败，设置为null
                    (processedUpdates as any)[field] = null;
                    console.log(`【最终检查】将${field}字段的无效数字字符串值转换为null: ${value}`);
                  }
                }
              }
            });
            
            // 特殊处理construction_status字段
            if ('construction_status' in processedUpdates) {
              const value = (processedUpdates as any)['construction_status'];
              console.log(`【最终检查】construction_status字段值:`, value, `类型:`, typeof value);
              
              // 如果是空值或false，设置为null
              if (value === '' || value === undefined || value === false) {
                (processedUpdates as any)['construction_status'] = null;
                console.log(`【最终检查】将construction_status字段的空值转换为null`);
              } 
              // 如果是true，转换为当前时间的ISO字符串
              else if (value === true) {
                (processedUpdates as any)['construction_status'] = new Date().toISOString();
                console.log(`【最终检查】将construction_status字段的布尔值转换为日期: ${(processedUpdates as any)['construction_status']}`);
              }
              // 保留字符串值(日期字符串)
            }
            
            // 打印最终将发送到数据库的数据
            console.log(`最终发送到数据库的更新数据:`, JSON.stringify(processedUpdates));
            
            // 使用处理后的更新
            await customerApi.update(update.id, processedUpdates);
            console.log(`静默更新客户数据成功: ${update.id}`);
          } catch (error) {
            // 增强错误日志记录
            console.error(`静默更新客户数据失败: ${update.id}`, error);
            console.error(`失败的更新数据: `, JSON.stringify(update.updates));
            if (error instanceof Error) {
              console.error(`错误详情: ${error.name} - ${error.message}`);
              console.error(`错误堆栈: ${error.stack}`);
            }
            
            // 检查特定字段类型
            const updateData = update.updates;
            if (updateData && 'construction_status' in updateData) {
              console.error(`失败更新中construction_status字段值: ${(updateData as any).construction_status}, 类型: ${typeof (updateData as any).construction_status}`);
            }
            
            // 如果更新失败，将更新放回队列
            this.updateQueue.set(update.id, update);
            
            // 添加重试次数记录
            update.retryCount = (update.retryCount || 0) + 1;
            
            // 如果重试超过5次，放弃此更新并记录错误
            if (update.retryCount > 5) {
              console.error(`静默更新客户数据失败超过最大重试次数，放弃更新: ${update.id}`, update.updates);
              this.updateQueue.delete(update.id);
            }
          }
        }));
        
        // 批次间添加短暂的延迟，避免过多的并发请求
        if (i + batchSize < updates.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('处理更新队列出错:', error);
    } finally {
      this.isProcessing = false;
      console.log(`更新队列处理完成，剩余队列长度: ${this.updateQueue.size}`);

      // 如果队列中还有更新，继续处理
      if (this.updateQueue.size > 0) {
        // 延迟一秒后继续处理队列
        setTimeout(() => this.processUpdateQueue(), 1000);
      }
    }
  }
}

// 导出数据缓存服务实例
export const dataCacheService = DataCacheService.getInstance();

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
      .is('deleted_at', null)  // 只获取未删除的客户
      .order('created_at', { ascending: false })

    if (error) throw error
    
    // 初始化数据缓存
    if (data) {
      dataCacheService.initCache(data);
    }
    
    return data || []
  },

  /**
   * 根据ID获取单个客户详细信息
   * @param {string} id - 客户ID
   * @returns {Promise<Customer | null>} 客户对象或null
   */
  getById: async (id: string): Promise<Customer | null> => {
    // 尝试从缓存获取
    const cachedCustomer = dataCacheService.getCustomer(id);
    if (cachedCustomer) {
      return cachedCustomer;
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    
    // 添加到缓存
    if (data) {
      dataCacheService.addCustomer(data);
    }
    
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
    
    // 添加到缓存
    if (data) {
      dataCacheService.addCustomer(data);
    }
    
    return data
  },

  /**
   * 创建新客户(异步模式)
   * 前端立即返回一个临时ID的客户对象，后台静默处理实际创建
   * @param {CreateCustomerInput} customer - 客户信息对象
   * @returns {Promise<string>} 生成的临时客户ID
   */
  createWithCache: async (customer: CreateCustomerInput): Promise<string> => {
    // 生成一个临时ID
    const tempId = `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // 处理数据，确保格式正确
    const processedCustomer = { ...customer };
    
    // 处理数字字段
    const numberFields = ['module_count', 'capacity', 'investment_amount', 'land_area', 'price'];
    numberFields.forEach(field => {
      if (field in processedCustomer) {
        const value = (processedCustomer as any)[field];
        
        // 详细记录字段处理
        console.log(`createWithCache处理${field}字段，原始值:`, value, `类型:`, typeof value);
        
        // 严格处理各种空值情况
        if (value === '' || value === undefined || value === null || 
            (typeof value === 'string' && value.trim() === '') || 
            (typeof value === 'number' && isNaN(value))) {
          (processedCustomer as any)[field] = null;
        } 
        // 处理可能是数字的字符串
        else if (typeof value === 'string' && value.trim() !== '') {
          // 尝试将非空字符串转换为数字
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            (processedCustomer as any)[field] = numValue;
          } else {
            // 如果转换失败，设置为null
            (processedCustomer as any)[field] = null;
          }
        }
      }
    });
    
    // 处理日期对象 - 确保日期被转换为ISO字符串
    const dateFields = ['register_date'];
    dateFields.forEach(field => {
      if (field in processedCustomer && processedCustomer[field as keyof CreateCustomerInput]) {
        const dateValue = processedCustomer[field as keyof CreateCustomerInput];
        if (dateValue && typeof dateValue === 'object' && 'format' in dateValue) {
          // dayjs对象转换为ISO字符串
          try {
            (processedCustomer as any)[field] = (dateValue as any).format('YYYY-MM-DD');
            console.log(`将${field}字段从dayjs对象转换为字符串: ${(processedCustomer as any)[field]}`);
          } catch (e) {
            console.error(`转换${field}字段失败:`, e);
            (processedCustomer as any)[field] = new Date().toISOString().split('T')[0];
          }
        }
      }
    });
    
    console.log('创建客户最终数据:', JSON.stringify(processedCustomer));
    
    // 同步立即创建客户，不使用异步处理
    try {
      const result = await customerApi.create(processedCustomer);
      console.log('客户创建成功，ID:', result.id);
      return result.id;
    } catch (error) {
      console.error('客户创建失败:', error);
      throw error;
    }
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
    console.log('更新客户数据(ID:', id, '):', JSON.stringify(customer));
    
    // 创建一个副本
    const updatedCustomer = { ...customer };
    
    // 如果module_count为空值，同时将相关计算字段设置为空值
    if ('module_count' in updatedCustomer) {
      const moduleCount = (updatedCustomer as any).module_count;
      if (moduleCount === null || moduleCount === undefined || 
          moduleCount === '' || 
          (typeof moduleCount === 'number' && (isNaN(moduleCount) || moduleCount <= 0))) {
        // 确保module_count为null
        (updatedCustomer as any).module_count = null;
        // 相关字段也设置为null
        (updatedCustomer as any).capacity = null;
        (updatedCustomer as any).investment_amount = null;
        (updatedCustomer as any).land_area = null;
        console.log('update方法: module_count为空值，相关计算字段也设置为null');
      }
    }
    
    // 详细处理数字字段
    const numberFields = ['module_count', 'capacity', 'investment_amount', 'land_area', 'price'];
    numberFields.forEach(field => {
      if (field in updatedCustomer) {
        const value = updatedCustomer[field as keyof UpdateCustomerInput];
        
        // 详细记录字段处理
        console.log(`update方法处理${field}字段，原始值:`, value, `类型:`, typeof value);
        
        // 严格处理各种空值情况
        if (value === '' || value === undefined || value === null || 
            (typeof value === 'string' && value.trim() === '') || 
            (typeof value === 'number' && isNaN(value))) {
          (updatedCustomer as any)[field] = null;
          console.log(`update方法将${field}字段的空值转换为null`);
        } 
        // 处理可能是数字的字符串
        else if (typeof value === 'string' && value.trim() !== '') {
          // 尝试将非空字符串转换为数字
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            (updatedCustomer as any)[field] = numValue;
            console.log(`update方法将${field}字段的字符串值转换为数字: ${value} -> ${numValue}`);
          } else {
            // 如果转换失败，设置为null
            (updatedCustomer as any)[field] = null;
            console.log(`update方法将${field}字段的无效数字字符串值转换为null: ${value}`);
          }
        }
      }
    });
    
    // 特殊处理construction_status字段
    if ('construction_status' in updatedCustomer) {
      const value = (updatedCustomer as any)['construction_status'];
      console.log(`update方法处理construction_status字段，原始值:`, value, `类型:`, typeof value);
      
      // 如果是空值或false，设置为null
      if (value === '' || value === undefined || value === false) {
        (updatedCustomer as any)['construction_status'] = null;
        console.log(`update方法将construction_status字段的空值转换为null`);
      } 
      // 如果是true，转换为当前时间的ISO字符串
      else if (value === true) {
        (updatedCustomer as any)['construction_status'] = new Date().toISOString();
        console.log(`update方法将construction_status字段的布尔值转换为日期: ${(updatedCustomer as any)['construction_status']}`);
      }
      // 其他情况保持原值(应该是日期字符串或null)
    }
    
    // 记录最终将发送到数据库的数据
    console.log(`update方法最终发送到数据库的数据(ID: ${id}):`, JSON.stringify(updatedCustomer));
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .update(updatedCustomer)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(`update方法更新失败:`, error);
        throw error;
      }
      
      // 更新缓存
      if (data) {
        dataCacheService.addCustomer(data);
        console.log(`update方法更新成功，返回数据:`, JSON.stringify(data));
      } else {
        console.warn(`update方法更新成功但未返回数据，ID: ${id}`);
      }
      
      return data;
    } catch (error) {
      console.error(`update方法更新出错:`, error);
      // 重新抛出错误，让调用者处理
      throw error;
    }
  },

  /**
   * 使用缓存服务更新客户信息（前端立即更新，后台静默推送）
   * 支持所有类型的字段更新
   * @param {string} id - 客户ID
   * @param {Partial<Customer>} updates - 更新的客户信息
   * @returns {Customer} 更新后的客户对象（从缓存中获取）
   */
  updateWithCache: (id: string, updates: UpdateCustomerInput): Customer => {
    // 处理特殊字段类型
    const processedUpdates = { ...updates };
    
    // 记录原始数据，帮助调试
    console.log(`updateWithCache原始数据(ID: ${id}):`, JSON.stringify(processedUpdates));
    
    // 特殊处理设计师和踏勘员字段
    // 如果设计师为空，确保设计师电话也为空
    if ('designer' in processedUpdates && 
        (processedUpdates.designer === null || processedUpdates.designer === undefined || processedUpdates.designer === '')) {
      processedUpdates.designer = null; // 统一设为null
      
      // 如果没有明确设置设计师电话，同时设置为null
      if (!('designer_phone' in processedUpdates)) {
        processedUpdates.designer_phone = null;
        console.log('设计师为空，自动将设计师电话设为null');
      }
    }
    
    // 如果踏勘员为空，确保踏勘员电话也为空
    if ('surveyor' in processedUpdates && 
        (processedUpdates.surveyor === null || processedUpdates.surveyor === undefined || processedUpdates.surveyor === '')) {
      processedUpdates.surveyor = null; // 统一设为null
      
      // 如果没有明确设置踏勘员电话，同时设置为null
      if (!('surveyor_phone' in processedUpdates)) {
        processedUpdates.surveyor_phone = null;
        console.log('踏勘员为空，自动将踏勘员电话设为null');
      }
    }
    
    // 如果施工队为空，确保施工队电话也为空
    if ('construction_team' in processedUpdates && 
        (processedUpdates.construction_team === null || processedUpdates.construction_team === undefined || processedUpdates.construction_team === '')) {
      processedUpdates.construction_team = null; // 统一设为null
      
      // 如果没有明确设置施工队电话，同时设置为null
      if (!('construction_team_phone' in processedUpdates)) {
        processedUpdates.construction_team_phone = null;
        console.log('施工队为空，自动将施工队电话设为null');
      }
    }
    
    // 如果业务员为空，确保业务员电话也为空
    if ('salesman' in processedUpdates && 
        (processedUpdates.salesman === null || processedUpdates.salesman === undefined || processedUpdates.salesman === '')) {
      processedUpdates.salesman = null; // 统一设为null
      
      // 如果没有明确设置业务员电话，同时设置为null
      if (!('salesman_phone' in processedUpdates)) {
        processedUpdates.salesman_phone = null;
        console.log('业务员为空，自动将业务员电话设为null');
      }
    }
    
    // 如果module_count为空值，同时将相关计算字段设置为空值
    if ('module_count' in processedUpdates) {
      const moduleCount = (processedUpdates as any).module_count;
      if (moduleCount === null || moduleCount === undefined || 
          moduleCount === '' || 
          (typeof moduleCount === 'number' && (isNaN(moduleCount) || moduleCount <= 0))) {
        // 确保module_count为null
        (processedUpdates as any).module_count = null;
        // 相关字段也设置为null
        (processedUpdates as any).capacity = null;
        (processedUpdates as any).investment_amount = null;
        (processedUpdates as any).land_area = null;
        console.log('updateWithCache: module_count为空值，相关计算字段也设置为null');
      }
    }
    
    // 处理数字字段，确保空字符串转换为null
    const numberFields = ['module_count', 'capacity', 'investment_amount', 'land_area', 'price'];
    numberFields.forEach(field => {
      if (field in processedUpdates) {
        const value = (processedUpdates as any)[field];
        
        // 记录更详细的类型信息
        console.log(`updateWithCache处理${field}字段，原始值:`, value, `类型:`, typeof value);
        
        // 更严格地处理各种空值情况
        if (value === '' || value === undefined || value === null || 
            (typeof value === 'string' && value.trim() === '') || 
            (typeof value === 'number' && isNaN(value))) {
          (processedUpdates as any)[field] = null;
          console.log(`updateWithCache将${field}字段的空值转换为null`);
        } 
        // 处理可能是数字的字符串
        else if (typeof value === 'string' && value.trim() !== '') {
          // 尝试将非空字符串转换为数字
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            (processedUpdates as any)[field] = numValue;
            console.log(`updateWithCache将${field}字段的字符串值转换为数字: ${value} -> ${numValue}`);
          } else {
            // 如果转换失败，设置为null
            (processedUpdates as any)[field] = null;
            console.log(`updateWithCache将${field}字段的无效数字字符串值转换为null: ${value}`);
          }
        }
      }
    });
    
    // 处理日期字段
    const dateFields = ['register_date', 'dispatch_date', 'meter_installation_date'];
    dateFields.forEach(field => {
      if (field in processedUpdates && processedUpdates[field as keyof UpdateCustomerInput]) {
        const dateValue = processedUpdates[field as keyof UpdateCustomerInput];
        if (dateValue && typeof dateValue === 'object' && 'toISOString' in dateValue) {
          // 如果是日期对象，转换为ISO字符串
          (processedUpdates as any)[field] = (dateValue as unknown as { toISOString(): string }).toISOString();
        }
      }
    });
    
    // 处理布尔字段，确保正确转换
    // construction_status字段特殊处理，它实际上是一个日期字符串或null，而不是布尔值
    const boolFields: string[] = [];
    boolFields.forEach(field => {
      if (field in processedUpdates) {
        const boolValue = processedUpdates[field as keyof UpdateCustomerInput];
        if (typeof boolValue === 'string') {
          // 转换字符串到布尔值
          (processedUpdates as any)[field] = boolValue.toLowerCase() === 'true';
        }
      }
    });
    
    // 特殊处理construction_status字段，确保它是日期字符串或null
    if ('construction_status' in processedUpdates) {
      const value = processedUpdates['construction_status' as keyof UpdateCustomerInput];
      console.log(`处理construction_status字段，原始值:`, value, `类型:`, typeof value);
      
      // 如果是空值，设置为null
      if (value === '' || value === undefined || value === false) {
        (processedUpdates as any)['construction_status'] = null;
      } 
      // 如果是true，转换为当前时间的ISO字符串
      else if (value === true) {
        (processedUpdates as any)['construction_status'] = new Date().toISOString();
      }
      // 其他情况保持原值(应该是日期字符串或null)
    }
    
    // 记录最终将发送到数据缓存的数据
    console.log(`updateWithCache最终处理后的数据(ID: ${id}):`, JSON.stringify(processedUpdates));
    
    return dataCacheService.updateCustomer(id, processedUpdates);
  },

  /**
   * 软删除客户（将客户标记为已删除而非物理删除）
   * 通过设置deleted_at字段为当前时间来实现软删除
   * @param {string} id - 客户ID
   * @returns {Promise<boolean>} 删除是否成功
   */
  delete: async (id: string): Promise<boolean> => {
    console.log(`开始执行客户删除操作(ID: ${id})`);
    try {
      // 尝试方法1: 直接UPDATE语句，不使用RPC
      const { data, error } = await supabase
        .from('customers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .is('deleted_at', null);
      
      if (error) {
        console.error(`客户删除操作(直接UPDATE)失败:`, error);
        
        // 尝试方法2: 使用RPC函数
        console.log(`尝试使用RPC函数删除客户(ID: ${id})`);
        const { data: rpcData, error: rpcError } = await supabase.rpc('direct_delete_customer', {
          customer_id: id
        });
        
        if (rpcError) {
          console.error(`客户删除操作(RPC)也失败:`, rpcError);
          return false;
        }
        
        // RPC函数成功
        console.log(`客户删除操作(RPC)成功(ID: ${id})`);
        return true;
      }
      
      // 直接UPDATE成功
      console.log(`客户删除操作(直接UPDATE)成功(ID: ${id})`);
      return true;
    } catch (error) {
      console.error(`客户删除操作出现异常:`, error);
      return false;
    }
  },

  /**
   * 使用缓存服务删除客户（确保数据库操作成功后再更新前端缓存）
   * @param {string} id - 客户ID
   * @returns {Promise<boolean>} 删除是否成功
   */
  deleteWithCache: async (id: string): Promise<boolean> => {
    console.log(`开始执行带缓存的客户删除(ID: ${id})`);
    try {
      // 先获取客户信息，确保客户存在于缓存中
      const cachedCustomer = dataCacheService.getCustomer(id);
      if (!cachedCustomer) {
        console.error(`客户在缓存中不存在(ID: ${id})，尝试执行直接删除`);
      } else {
        console.log(`准备删除客户: ${cachedCustomer.customer_name} (ID: ${id})`);
      }
      
      // 直接删除客户
      const success = await customerApi.delete(id);
      
      if (success) {
        console.log(`数据库删除成功，现在更新前端缓存(ID: ${id})`);
        // 数据库删除成功后，从缓存中移除
        dataCacheService.removeCustomer(id);
        return true;
      } else {
        console.error(`数据库删除失败，不更新前端缓存(ID: ${id})`);
        return false;
      }
    } catch (error) {
      console.error(`带缓存的客户删除操作出现异常:`, error);
      return false;
    }
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
        // 检查必要字段，只检查客户姓名
        if (!customer.customer_name) {
          result.failed++
          result.failedItems?.push({
            row: i + 1,
            reason: '缺少必要字段：客户姓名'
          })
          continue
        }

        // 检查是否重复，只根据姓名检查，电话可以为空
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
  
  /**
   * 更新催单状态(带缓存)
   * 如果客户当前没有催单，则添加当前时间作为催单时间；
   * 如果客户已有催单，则删除催单时间
   * 使用数据缓存服务实现UI立即更新，后台静默推送
   * @param {string} id - 客户ID
   * @returns {Customer} 更新后的客户对象
   */
  updateUrgeOrderWithCache: (id: string): Customer => {
    // 获取当前客户状态
    const customer = dataCacheService.getCustomer(id);
    if (!customer) {
      throw new Error(`Customer with id ${id} not found in cache`);
    }
    
    // 根据当前状态确定新的催单值
    const newUrgeOrderValue = customer.urge_order ? null : new Date().toISOString();
    
    // 更新本地缓存
    const updatedCustomer = {...customer, urge_order: newUrgeOrderValue};
    dataCacheService.addCustomer(updatedCustomer);
    
    // 将更新加入队列
    dataCacheService.updateCustomer(id, { urge_order: newUrgeOrderValue });
    
    return updatedCustomer;
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
    try {
      // 尝试从带有中文字段名和修改人信息的视图中获取数据
      const { data, error } = await supabase
        .from('modification_records_with_names')
        .select('*')
        .order('modified_at', { ascending: false })
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('无法从修改记录视图获取数据，使用备用方法', error)
      
      // 备用方法：从原始表获取
      const { data, error: fallbackError } = await supabase
        .from('modification_records')
        .select('*, customers(customer_name)')
        .order('modified_at', { ascending: false })
      
      if (fallbackError) throw fallbackError
      return data || []
    }
  }
}

/**
 * 删除记录相关API
 * 包含获取和恢复已删除客户的方法
 * 用于管理软删除的客户记录
 */
export const deletedRecordsApi = {
  /**
   * 获取所有已删除的客户记录
   * 从customers表中查询被标记为已删除的记录
   */
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
  
  /**
   * 恢复已删除的客户记录
   * 将客户的deleted_at字段设置为NULL
   * @param id 要恢复的客户ID
   */
  async restoreDeletedRecord(id: string) {
    try {
      console.log(`开始恢复客户(ID: ${id})`);
      const { data, error } = await supabase.rpc('restore_deleted_record', {
        customer_id: id
      });
      
      if (error) {
        console.error('恢复记录失败:', error);
        return { success: false, error };
      }
      
      // 新函数返回布尔值表示成功或失败
      if (data === true) {
        console.log(`客户(ID: ${id})恢复成功`);
        return { success: true, error: null };
      } else {
        console.error(`客户(ID: ${id})恢复失败，找不到记录或记录已被恢复`);
        return { success: false, error: '记录不存在或已被恢复' };
      }
    } catch (error) {
      console.error('恢复记录出现异常:', error);
      return { success: false, error };
    }
  },
  
  /**
   * 批量恢复已删除的客户记录
   * @param ids 要恢复的客户ID数组
   */
  async batchRestoreDeletedRecords(ids: string[]) {
    try {
      console.log(`开始批量恢复客户, 共${ids.length}个`);
      const { data, error } = await supabase.rpc('batch_restore_deleted_records', {
        customer_ids: ids
      });
      
      if (error) {
        console.error('批量恢复记录失败:', error);
        return { success: false, error, results: [] };
      }
      
      console.log(`批量恢复操作完成，结果:`, data);
      
      // 检查结果
      if (data && Array.isArray(data)) {
        const successCount = data.filter(item => item.success).length;
        const success = successCount === ids.length;
        
        console.log(`批量恢复结果: 成功=${successCount}, 总计=${ids.length}`);
        
        return { 
          success, 
          error: success ? null : '部分记录恢复失败', 
          results: data 
        };
      }
      
      return { success: false, error: '恢复操作未返回预期结果', results: [] };
    } catch (error) {
      console.error('批量恢复记录出现异常:', error);
      return { success: false, error, results: [] };
    }
  },

  /**
   * 永久删除客户记录（彻底从数据库中删除）
   * @param id 要删除的客户ID
   */
  async permanentlyDeleteRecord(id: string) {
    try {
      console.log(`开始永久删除客户(ID: ${id})`);
      const { data, error } = await supabase.rpc('permanently_delete_record', {
        customer_id: id
      });
      
      if (error) {
        console.error('永久删除记录失败:', error);
        return { success: false, error };
      }
      
      // 函数返回布尔值表示成功或失败
      if (data === true) {
        console.log(`客户(ID: ${id})永久删除成功`);
        return { success: true, error: null };
      } else {
        console.error(`客户(ID: ${id})永久删除失败，找不到记录`);
        return { success: false, error: '记录不存在' };
      }
    } catch (error) {
      console.error('永久删除记录出现异常:', error);
      return { success: false, error };
    }
  },
  
  /**
   * 批量永久删除客户记录
   * @param ids 要永久删除的客户ID数组
   */
  async batchPermanentlyDeleteRecords(ids: string[]) {
    try {
      console.log(`开始批量永久删除客户, 共${ids.length}个`);
      const { data, error } = await supabase.rpc('batch_permanently_delete_records', {
        customer_ids: ids
      });
      
      if (error) {
        console.error('批量永久删除记录失败:', error);
        return { success: false, error, results: [] };
      }
      
      console.log(`批量永久删除操作完成，结果:`, data);
      
      // 检查结果
      if (data && Array.isArray(data)) {
        const successCount = data.filter(item => item.success).length;
        const success = successCount === ids.length;
        
        console.log(`批量永久删除结果: 成功=${successCount}, 总计=${ids.length}`);
        
        return { 
          success, 
          error: success ? null : '部分记录永久删除失败', 
          results: data 
        };
      }
      
      return { success: false, error: '永久删除操作未返回预期结果', results: [] };
    } catch (error) {
      console.error('批量永久删除记录出现异常:', error);
      return { success: false, error, results: [] };
    }
  }
};

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
      console.log('获取所有来源的施工队数据');
      
      // 从user_roles表获取施工队数据
      const fromRoles = await constructionTeamApi.getFromUserRoles();
      console.log('从user_roles获取的施工队数据数量:', fromRoles.length);
      
      // 从客户记录中获取施工队数据
      const fromCustomers = await constructionTeamApi.getFromCustomers();
      console.log('从客户记录获取的施工队数据数量:', fromCustomers.length);
      
      // 合并两个来源的数据（去重）
      const uniqueTeams = new Map<string, {name: string, phone: string}>();
      
      // 添加角色数据
      if (fromRoles && fromRoles.length > 0) {
        fromRoles.forEach(team => {
          uniqueTeams.set(team.name, team);
        });
      }
      
      // 添加客户记录中的数据，如果还没有添加过的话
      if (fromCustomers && fromCustomers.length > 0) {
        fromCustomers.forEach(team => {
          if (!uniqueTeams.has(team.name)) {
            uniqueTeams.set(team.name, team);
          } else {
            // 如果已存在但电话为空，则更新电话号码
            const existing = uniqueTeams.get(team.name);
            if (existing && !existing.phone && team.phone) {
              uniqueTeams.set(team.name, {
                ...existing,
                phone: team.phone
              });
            }
          }
        });
      }
      
      // 转换回数组并按名称排序
      const allTeams = Array.from(uniqueTeams.values())
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      
      console.log('合并后的施工队数据总数:', allTeams.length);
      return allTeams;
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
        .select('name, phone, email, user_id')
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
  },
  
  /**
   * 从客户记录中提取施工队信息
   * 获取所有不同的施工队名称和电话
   * @returns {Promise<{name: string, phone: string}[]>} 施工队信息数组
   */
  getFromCustomers: async (): Promise<{name: string, phone: string}[]> => {
    try {
      console.log('从客户记录中提取施工队信息');
      
      // 查询所有客户中的施工队信息
      const { data, error } = await supabase
        .from('customers')
        .select('construction_team, construction_team_phone')
        .not('construction_team', 'is', null)
        .not('construction_team', 'eq', '')
        .order('construction_team', { ascending: true });
      
      if (error) {
        console.error('从客户记录中获取施工队数据失败:', error);
        return [];
      }
      
      // 去重并整理数据
      const uniqueTeams = new Map<string, string>();
      
      (data || []).forEach(customer => {
        if (customer.construction_team && !uniqueTeams.has(customer.construction_team)) {
          uniqueTeams.set(customer.construction_team, customer.construction_team_phone || '');
        }
      });
      
      const result = Array.from(uniqueTeams.entries()).map(([name, phone]) => ({
        name,
        phone
      }));
      
      console.log('从客户记录中提取的施工队数据:', result);
      return result;
    } catch (err) {
      console.error('从客户记录提取施工队数据时出错:', err);
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
        .select('name, phone, email, user_id')
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
  },
  
  /**
   * 从客户记录中提取踏勘员信息
   * 获取所有不同的踏勘员名称和电话
   * @returns {Promise<{name: string, phone: string}[]>} 踏勘员信息数组
   */
  getFromCustomers: async (): Promise<{name: string, phone: string}[]> => {
    try {
      console.log('从客户记录中提取踏勘员信息');
      
      // 查询所有客户中的踏勘员信息
      const { data, error } = await supabase
        .from('customers')
        .select('surveyor, surveyor_phone')
        .not('surveyor', 'is', null)
        .not('surveyor', 'eq', '')
        .order('surveyor', { ascending: true });
      
      if (error) {
        console.error('从客户记录中获取踏勘员数据失败:', error);
        return [];
      }
      
      // 去重并整理数据
      const uniqueSurveyors = new Map<string, string>();
      
      (data || []).forEach(customer => {
        if (customer.surveyor && !uniqueSurveyors.has(customer.surveyor)) {
          uniqueSurveyors.set(customer.surveyor, customer.surveyor_phone || '');
        }
      });
      
      const result = Array.from(uniqueSurveyors.entries()).map(([name, phone]) => ({
        name,
        phone
      }));
      
      console.log('从客户记录中提取的踏勘员数据:', result);
      return result;
    } catch (err) {
      console.error('从客户记录提取踏勘员数据时出错:', err);
      return [];
    }
  },
  
  /**
   * 获取所有踏勘员信息（合并从user_roles和客户记录中获取的数据）
   * @returns {Promise<{name: string, phone: string}[]>} 踏勘员信息数组
   */
  getAll: async (): Promise<{name: string, phone: string}[]> => {
    try {
      console.log('获取所有来源的踏勘员数据');
      
      // 从user_roles表获取踏勘员数据
      const fromRoles = await surveyorApi.getFromUserRoles();
      console.log('从user_roles获取的踏勘员数据数量:', fromRoles.length);
      
      // 从客户记录中获取踏勘员数据
      const fromCustomers = await surveyorApi.getFromCustomers();
      console.log('从客户记录获取的踏勘员数据数量:', fromCustomers.length);
      
      // 合并两个来源的数据（去重）
      const uniqueSurveyors = new Map<string, {name: string, phone: string}>();
      
      // 添加角色数据
      if (fromRoles && fromRoles.length > 0) {
        fromRoles.forEach(surveyor => {
          uniqueSurveyors.set(surveyor.name, surveyor);
        });
      }
      
      // 添加客户记录中的数据，如果还没有添加过的话
      if (fromCustomers && fromCustomers.length > 0) {
        fromCustomers.forEach(surveyor => {
          if (!uniqueSurveyors.has(surveyor.name)) {
            uniqueSurveyors.set(surveyor.name, surveyor);
          } else {
            // 如果已存在但电话为空，则更新电话号码
            const existing = uniqueSurveyors.get(surveyor.name);
            if (existing && !existing.phone && surveyor.phone) {
              uniqueSurveyors.set(surveyor.name, {
                ...existing,
                phone: surveyor.phone
              });
            }
          }
        });
      }
      
      // 转换回数组并按名称排序
      const allSurveyors = Array.from(uniqueSurveyors.values())
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      
      console.log('合并后的踏勘员数据总数:', allSurveyors.length);
      return allSurveyors;
    } catch (err) {
      console.error('获取踏勘员数据时出错:', err);
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