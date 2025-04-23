import { supabase } from './supabase'
import { Database } from '../../database/types'

export type ProcurementMaterial = Database['public']['Tables']['procurement_materials']['Row']

class ProcurementApi {
  // 获取所有采购材料
  async getMaterials(): Promise<ProcurementMaterial[]> {
    try {
      const { data, error } = await supabase
        .from('procurement_materials')
        .select('*')

      if (error) {
        console.error('获取采购材料失败:', error)
        throw error
      }

      // 定义材料的预期顺序
      const orderMapping: Record<string, number> = {
        '南飞锌镁铝方矩管ZM275|100*100*2.0': 1,
        '南飞锌镁铝方矩管ZM275|50*100*2.0': 2,
        '南飞锌镁铝方矩管ZM275|40*60*2.0': 3, 
        '南飞锌镁铝方矩管ZM275|40*40*2.0': 4,
        '南飞锌镁铝角钢光伏支架ZM275|40*40*2.5': 5,
        '南飞柱底钢板Q235B|200*200*6': 6,
        '南飞柱底加劲板Q235B|45*100*4.0': 7,
        '南飞不锈钢膨胀螺栓SUS304|M12*80': 8,
        '南飞U型80防水压块组合|U型螺栓:M8*50*105mm\n配套螺母\n上压块带刺片:80*52*2.5mm\n下垫板:70*28*2.5mm': 9,
        '南飞阳光房四级纵向小水槽|2360mm': 10,
        '南飞阳光房四级纵向中水槽|4000mm': 11,
        '南飞阳光房四级主水槽|4000mm': 12,
        '南飞阳光房阳光房四级横向小水槽|适用60*40檩条': 13,
        '南飞阳光房四级包边水槽|适用60*40檩条': 14,
        '南飞阳光房四级屋脊水槽|适用60*40檩条': 15
      };
      
      // 确保日志记录排序过程
      console.log('开始对材料进行排序');
      
      // 手动对材料进行排序
      if (data) {
        console.log('排序前的数据:', data);
        
        // 为每个材料生成排序键
        data.forEach(item => {
          const key = `${item.name}|${item.specs}`;
          console.log(`材料 ID ${item.id} 的键: ${key}, 顺序: ${orderMapping[key] || 999}`);
        });
        
        const sortedData = [...data].sort((a, b) => {
          const keyA = `${a.name}|${a.specs}`;
          const keyB = `${b.name}|${b.specs}`;
          
          const orderA = orderMapping[keyA] || 999;
          const orderB = orderMapping[keyB] || 999;
          
          return orderA - orderB;
        });
        
        // 检查排序后的顺序
        console.log('排序后的顺序:');
        sortedData.forEach((item, index) => {
          console.log(`${index + 1}. ${item.name} - ${item.specs}`);
        });
        
        return sortedData;
      }

      return data || []
    } catch (error) {
      console.error('获取采购材料发生错误:', error)
      return []
    }
  }

  // 更新材料信息
  async updateMaterial(id: string, updates: Partial<ProcurementMaterial>): Promise<ProcurementMaterial | null> {
    try {
      const { data, error } = await supabase
        .from('procurement_materials')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('更新材料信息失败:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('更新材料信息发生错误:', error)
      return null
    }
  }
  
  // 逐个更新材料 (替代批量更新方法)
  async updateMaterialsOneByOne(updates: { id: string, updates: Partial<ProcurementMaterial> }[]): Promise<boolean> {
    try {
      console.log('更新材料，更新数据:', updates)
      
      // 逐个更新每个材料
      for (const update of updates) {
        // 构建更新对象，只包含传入的字段
        const updateData: Partial<ProcurementMaterial> = {};
        
        // 检查并添加各个字段
        if (update.updates.per_household !== undefined) {
          updateData.per_household = update.updates.per_household;
        }
        
        if (update.updates.price !== undefined) {
          updateData.price = update.updates.price;
        }
        
        if (update.updates.warehouse_inventory !== undefined) {
          updateData.warehouse_inventory = update.updates.warehouse_inventory;
        }
        
        if (update.updates.name !== undefined) {
          updateData.name = update.updates.name;
        }
        
        if (update.updates.specs !== undefined) {
          updateData.specs = update.updates.specs;
        }
        
        const { error } = await supabase
          .from('procurement_materials')
          .update(updateData)
          .eq('id', update.id)
        
        if (error) {
          console.error(`更新材料 ${update.id} 失败:`, error)
          return false
        }
      }
      
      return true
    } catch (error) {
      console.error('更新材料信息发生错误:', error)
      return false
    }
  }

  // 创建新材料
  async createMaterial(materialData: Omit<ProcurementMaterial, 'id' | 'created_at'>): Promise<ProcurementMaterial | null> {
    try {
      console.log('创建新材料:', materialData)
      
      const { data, error } = await supabase
        .from('procurement_materials')
        .insert([materialData])
        .select()
        .single()
      
      if (error) {
        console.error('创建材料失败:', error)
        throw error
      }
      
      return data
    } catch (error) {
      console.error('创建材料发生错误:', error)
      return null
    }
  }
}

export const procurementApi = new ProcurementApi() 