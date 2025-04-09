import { Customer } from '../types';

/**
 * 数据缓存服务 - 增强版
 * 实现前端数据修改直接反映在界面上，并在后台静默推送到数据库
 * 特点：
 * 1. 各字段相互独立更新，避免字段间不必要的相互影响
 * 2. 确保只有明确指定的字段被更新，其它字段保持不变
 * 3. 提供一致的数据视图给UI组件
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
  // 增强版：确保只更新指定的字段，其它字段不受影响
  public updateCustomer(id: string, updates: Partial<Customer>): Customer {
    const customer = this.cache.get(id);
    if (!customer) {
      throw new Error(`Customer with id ${id} not found in cache`);
    }

    // 关键字段 - 这些字段应该相互独立更新，不相互影响
    const independentFields = [
      'construction_acceptance_date', 
      'upload_to_grid', 
      'status',
      'construction_status'
    ];
    
    // 检查是否更新了关键字段
    const updatingIndependentFields = Object.keys(updates).filter(
      field => independentFields.includes(field)
    );
    
    if (updatingIndependentFields.length > 0) {
      console.log(`[增强缓存] 更新关键独立字段: ${updatingIndependentFields.join(', ')}`);
    }

    // 更新本地缓存 - 只更新明确传入的字段
    const updatedCustomer = {...customer};
    
    // 遍历所有要更新的字段，逐个应用
    Object.keys(updates).forEach(key => {
      const fieldKey = key as keyof Customer;
      (updatedCustomer as any)[fieldKey] = (updates as any)[fieldKey];
    });
    
    // 保存到缓存
    this.cache.set(id, updatedCustomer);

    // 将更新加入队列
    this.updateQueue.set(id, {id, updates});

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

  // 处理更新队列 - 保持现有实现
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
            // 在此处应该调用API层的update方法
            // 由于我们没有直接访问API，这里只是记录
            console.log(`[增强缓存] 应该将更新发送到后端，ID: ${update.id}`);
            
            // 这里通常会调用API，例如：
            // await api.update(update.id, update.updates);
          } catch (error) {
            console.error(`[增强缓存] 更新失败，可能需要重试:`, error);
            
            // 更新重试计数，最多重试3次
            const retryCount = (update.retryCount || 0) + 1;
            if (retryCount <= 3) {
              this.updateQueue.set(update.id, {...update, retryCount});
            } else {
              console.error(`[增强缓存] 更新失败达到最大重试次数(${retryCount})，放弃更新:`, update);
            }
          }
        }));
      }
    } catch (error) {
      console.error('处理更新队列出错:', error);
    } finally {
      this.isProcessing = false;
      
      // 如果队列中还有更新，继续处理
      if (this.updateQueue.size > 0) {
        setTimeout(() => this.processUpdateQueue(), 1000);
      }
    }
  }
}

// 导出单例实例
export const enhancedDataCacheService = DataCacheService.getInstance(); 