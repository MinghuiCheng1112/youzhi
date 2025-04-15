import { Customer } from '../../types';

// 通用的排序和筛选函数类型
export interface TableHeaderConfig {
  title: string;
  dataIndex: string;
  getValues: (customers: Customer[]) => string[];
  onSort: (direction: 'ascend' | 'descend' | null, customers: Customer[], filteredCustomers: Customer[]) => Customer[];
  onFilter: (selectedValues: string[], customers: Customer[]) => Customer[];
}

// 检查值是否为空
const isEmptyValue = (value: any): boolean => {
  return value === null || value === undefined || value === '';
};

// 创建通用的表头配置
export const createTableHeaderConfig = (
  title: string,
  dataIndex: string
): TableHeaderConfig => {
  return {
    title,
    dataIndex,
    // 获取该列所有唯一值并排序
    getValues: (customers: Customer[]) => {
      // 确保使用所有客户数据而不仅是当前页
      return Array.from(new Set(customers.map(item => {
        const value = item[dataIndex as keyof Customer];
        return typeof value === 'string' ? value : '';
      }))).sort((a, b) => {
        // 对于数字字符串，按数字大小排序
        if (!isNaN(Number(a)) && !isNaN(Number(b))) {
          return Number(a) - Number(b);
        }
        // 字符串按字母排序
        return a.localeCompare(b);
      });
    },
    // 通用排序逻辑
    onSort: (direction, customers, filteredCustomers) => {
      if (direction === 'ascend') {
        // 对所有客户数据进行排序
        return [...customers].sort((a, b) => {
          const aValue = (a[dataIndex as keyof Customer] as string) || '';
          const bValue = (b[dataIndex as keyof Customer] as string) || '';
          
          // 对于数字字符串，按数字大小排序
          if (!isNaN(Number(aValue)) && !isNaN(Number(bValue))) {
            return Number(aValue) - Number(bValue);
          }
          
          return aValue.localeCompare(bValue);
        });
      } else if (direction === 'descend') {
        // 对所有客户数据进行排序
        return [...customers].sort((a, b) => {
          const aValue = (a[dataIndex as keyof Customer] as string) || '';
          const bValue = (b[dataIndex as keyof Customer] as string) || '';
          
          // 对于数字字符串，按数字大小排序
          if (!isNaN(Number(aValue)) && !isNaN(Number(bValue))) {
            return Number(bValue) - Number(aValue);
          }
          
          return bValue.localeCompare(aValue);
        });
      }
      // 默认返回原始数据
      return [...customers];
    },
    // 通用筛选逻辑
    onFilter: (selectedValues, customers) => {
      if (selectedValues.length === 0) {
        return [...customers];
      }
      
      // 对所有客户数据进行筛选
      return customers.filter(customer => {
        const value = customer[dataIndex as keyof Customer];
        // 处理空值的特殊情况
        if (isEmptyValue(value) && selectedValues.some(v => isEmptyValue(v))) {
          return true;
        }
        const stringValue = typeof value === 'string' ? value : '';
        return selectedValues.includes(stringValue);
      });
    }
  };
};

// 预定义的表头配置
export const tableHeaderConfigs: Record<string, TableHeaderConfig> = {
  customer_name: createTableHeaderConfig('客户姓名', 'customer_name'),
  address: createTableHeaderConfig('客户地址', 'address'),
  salesman: createTableHeaderConfig('业务员', 'salesman'),
  designer: createTableHeaderConfig('设计师', 'designer'),
  surveyor: createTableHeaderConfig('踏勘员', 'surveyor'),
  module_count: createTableHeaderConfig('组件数量', 'module_count'),
  inverter: createTableHeaderConfig('逆变器', 'inverter'),
  distribution_box: createTableHeaderConfig('配电箱', 'distribution_box'),
  construction_team: createTableHeaderConfig('施工队', 'construction_team'),
  price: createTableHeaderConfig('价格', 'price'),
  remarks: createTableHeaderConfig('备注', 'remarks'),
  status: createTableHeaderConfig('状态', 'status')
};

export default tableHeaderConfigs; 