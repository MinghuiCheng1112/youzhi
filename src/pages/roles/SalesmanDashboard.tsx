import { useState, useEffect } from 'react'
import { Table, Card, Input, Button, Typography, Space, message, Tag, Modal, Form, Select, Tooltip, Row, Col, Statistic, Progress, Divider, DatePicker } from 'antd'
import { EditOutlined, ClockCircleOutlined, PhoneOutlined, UserOutlined, HomeOutlined, IdcardOutlined } from '@ant-design/icons'
import { customerApi } from '../../services/api'
import { Customer } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabaseClient'
import * as XLSX from 'xlsx'
import Draggable from 'react-draggable'

const { Title, Text } = Typography

// 定义卡片样式
const CARD_STYLE = {
  height: '140px',
  display: 'flex' as const,
  flexDirection: 'column' as const,
  justifyContent: 'center' as const,
  boxShadow: '0 2px 8px rgba(0,0,0,0.09)',
  borderRadius: '8px',
  transition: 'all 0.3s',
  padding: '0 16px',
}


// 添加可编辑单元格组件
const EditableCell = ({ value, record, dataIndex, title, required = true, onSave }: { 
  value: any; 
  record: Customer; 
  dataIndex: string; 
  title: string; 
  required?: boolean;
  onSave: (record: Customer, dataIndex: string, value: any) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [hover, setHover] = useState(false);
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };
  
  const handleSave = () => {
    if (required && !inputValue) {
      message.error(`${title}不能为空`);
      return;
    }
    onSave(record, dataIndex, inputValue);
    setEditing(false);
  };
  
  return editing ? (
    <div style={{ width: '100%' }}>
      <Input 
        value={inputValue} 
        onChange={(e) => setInputValue(e.target.value)}
        onPressEnter={handleSave}
        onBlur={handleSave}
        autoFocus
        style={{ width: '100%' }}
      />
    </div>
  ) : (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center',
        padding: '4px 0',
        borderRadius: 4,
        cursor: 'pointer',
        background: hover ? '#f0f5ff' : 'transparent'
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleEdit}
    >
      <div style={{ flex: 1 }}>
        {value ? (
          <span>{value}</span>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        )}
      </div>
      {hover && (
        <Button 
          type="text" 
          size="small"
          icon={<EditOutlined />}
          onClick={handleEdit}
          style={{ padding: '0 4px' }}
          title={`编辑${title}`}
        />
      )}
    </div>
  );
};

// 可编辑日期单元格组件
const EditableDateCell = ({ value, record, dataIndex, title, onSave }: { 
  value: any; 
  record: Customer; 
  dataIndex: string; 
  title: string; 
  onSave: (record: Customer, dataIndex: string, value: any) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState(false);
  
  // 安全地转换日期值
  const safeDate = value && dayjs(value).isValid() ? dayjs(value) : null;
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };
  
  const handleDateChange = (date: any) => {
    const formattedDate = date ? date.format('YYYY-MM-DD') : null;
    onSave(record, dataIndex, formattedDate);
    setEditing(false);
  };
  
  return editing ? (
    <DatePicker 
      style={{ width: '100%' }} 
      format="YYYY-MM-DD"
      defaultValue={safeDate}
      open={true}
      onChange={handleDateChange}
      onBlur={() => setEditing(false)}
    />
  ) : (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center',
        padding: '4px 0',
        borderRadius: 4,
        cursor: 'pointer',
        background: hover ? '#f0f5ff' : 'transparent'
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleEdit}
    >
      <div style={{ flex: 1 }}>
        {safeDate ? (
          <span>{safeDate.format('YYYY-MM-DD')}</span>
        ) : (
          <span style={{ color: '#999', fontStyle: 'italic' }}>未设置</span>
        )}
      </div>
      {hover && (
        <Button 
          type="text" 
          size="small"
          icon={<EditOutlined />}
          onClick={handleEdit}
          style={{ padding: '0 4px' }}
          title={`编辑${title}`}
        />
      )}
    </div>
  );
};

// 添加补充资料选项常量
const STATION_MANAGEMENT_OPTIONS = [
  { value: '房产证', label: '房产证', color: 'blue' },
  { value: '授权书', label: '授权书', color: 'purple' },
  { value: '银行卡', label: '银行卡', color: 'cyan' },
  { value: '航拍', label: '航拍', color: 'green' },
  { value: '结构照', label: '结构照', color: 'magenta' },
  { value: '门头照', label: '门头照', color: 'orange' },
  { value: '合同', label: '合同', color: 'red' }
];

// 添加可编辑多选下拉单元格组件
export const EditableMultipleSelectCell = ({ value, record, dataIndex, title, options, onSave }: { 
  value: any; 
  record: Customer; 
  dataIndex: string; 
  title: string; 
  options: {value: string, label: string, color?: string}[];
  onSave: (record: Customer, dataIndex: string, value: any) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState(false);
  
  // 解析当前值，可能是数组、逗号分隔的字符串或时间戳
  const parseValue = (val: any) => {
    if (!val) return [];
    
    // 如果已经是数组格式
    if (Array.isArray(val)) {
      // 检查数组中是否有时间戳（单个元素且是时间格式）
      if (val.length === 1 && dayjs(val[0]).isValid()) {
        return []; // 是时间戳，返回空数组表示没有选择项
      }
      return val; // 返回数组选项
    }
    
    // 处理字符串格式（兼容旧数据）
    if (typeof val === 'string') {
      // 检查是否是逗号分隔的字符串（选项列表）
      if (val.includes(',')) {
        return val.split(',');
      }
      // 如果是时间戳，返回空数组
      if (dayjs(val).isValid()) {
        return [];
      }
      // 单个选项
      return [val];
    }
    
    return [];
  };
  
  // 判断是否是时间戳
  const isTimestamp = (val: any) => {
    if (!val) return false;
    
    // 数组格式：如果是数组且只有一个元素，检查元素是否是时间戳
    if (Array.isArray(val) && val.length === 1) {
      return dayjs(val[0]).isValid();
    }
    
    // 字符串格式：检查是否是时间戳
    if (typeof val === 'string' && !val.includes(',')) {
      return dayjs(val).isValid();
    }
    
    return false;
  };

  // 解析当前值，获取选项数组（如果是选项列表）或空数组（如果是时间戳）
  const parsedValue = parseValue(value);
  
  const handleSave = (newValue: string[]) => {
    if (newValue && newValue.length > 0) {
      onSave(record, dataIndex, newValue);
    } else {
      // 如果没有选择任何选项，则生成当前时间戳
      onSave(record, dataIndex, [new Date().toISOString()]);
    }
    setEditing(false);
  };

  return editing ? (
    <div style={{ width: '100%' }}>
      <Select
        mode="multiple"
        placeholder={`请选择${title}，若不选择将显示时间戳`}
        defaultValue={parsedValue}
        style={{ width: '100%' }}
        options={options}
        autoFocus
        allowClear
        onBlur={() => handleSave(parsedValue)}
        onChange={(newValue) => handleSave(newValue)}
      />
    </div>
  ) : (
    <div 
      style={{ 
        display: 'flex', 
        flexWrap: 'nowrap',
        alignItems: 'center',
        padding: '4px 0',
        borderRadius: 4,
        cursor: 'pointer',
        background: hover ? '#f0f5ff' : 'transparent'
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => setEditing(true)}
    >
      <div style={{ flex: 1, display: 'flex', flexWrap: 'nowrap', gap: '1px', overflow: 'hidden' }}>
        {parsedValue.length > 0 ? (
          // 如果有选择项，显示带颜色的标签
          parsedValue.map((item: string) => {
            const option = options.find(o => o.value === item);
            return (
              <Tag key={item} color={option?.color || 'default'} style={{ margin: '0 1px 0 0', padding: '0 4px' }}>
                {item}
              </Tag>
            );
          })
        ) : isTimestamp(value) ? (
          // 如果是时间戳（没有选择任何选项），显示时间戳
          <Tag color="green">
            <ClockCircleOutlined /> 
            {Array.isArray(value) && value.length === 1 
              ? dayjs(value[0]).format('YYYY-MM-DD HH:mm')
              : typeof value === 'string' ? dayjs(value).format('YYYY-MM-DD HH:mm') : ''}
          </Tag>
        ) : (
          // 如果没有值，显示未设置
          <span style={{ color: '#999', fontStyle: 'italic' }}>未设置</span>
        )}
      </div>
      {hover && (
        <Button 
          type="text" 
          size="small"
          icon={<EditOutlined />}
          onClick={() => setEditing(true)}
          style={{ padding: '0 4px' }}
          title={`编辑${title}`}
        />
      )}
    </div>
  );
};

// 添加图纸变更选项
const DRAWING_CHANGE_OPTIONS = [
  { value: '无变更', label: '无变更', color: 'default' },
  { value: '变更1', label: '变更1', color: 'blue' },
  { value: '变更2', label: '变更2', color: 'purple' },
  { value: '变更3', label: '变更3', color: 'orange' },
  { value: '变更4', label: '变更4', color: 'red' },
  { value: '变更5', label: '变更5', color: 'volcano' },
];

// 添加可编辑选择单元格组件
export const EditableSelectCell = ({ value, record, dataIndex, title, options, onSave }: { 
  value: any; 
  record: Customer; 
  dataIndex: string; 
  title: string; 
  options: {value: string, label: string, color?: string, phone?: string}[];
  onSave: (record: Customer, dataIndex: string, value: any) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [selectValue, setSelectValue] = useState(value);
  const [hover, setHover] = useState(false);
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };
  
  const handleSave = () => {
    // 针对图纸变更字段，确保始终是字符串
    if (dataIndex === 'drawing_change' && (selectValue === null || selectValue === undefined || selectValue === '')) {
      onSave(record, dataIndex, '无变更');
    } else {
      onSave(record, dataIndex, selectValue);
    }
    setEditing(false);
  };
  
  return editing ? (
    <div style={{ width: '100%' }}>
      <Select
        placeholder={`请选择${title}`}
        defaultValue={value || (dataIndex === 'drawing_change' ? '无变更' : undefined)}
        style={{ width: '100%' }}
        options={options}
        onChange={(newValue) => setSelectValue(newValue)}
        onBlur={handleSave}
        autoFocus
        allowClear={dataIndex !== 'drawing_change'}
      />
    </div>
  ) : (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center',
        padding: '4px 0',
        borderRadius: 4,
        cursor: 'pointer',
        background: hover ? '#f0f5ff' : 'transparent'
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleEdit}
    >
      <div style={{ flex: 1 }}>
        {dataIndex === 'drawing_change' ? (
          // 图纸变更特殊显示
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {(() => {
              // 获取当前选项，默认为"无变更"
              const option = options.find(o => o.value === value) || options[0];
              
              // 定义按钮颜色映射
              const btnTypeMap: Record<string, any> = {
                'default': 'default',
                'blue': 'primary',
                'purple': 'primary',
                'orange': 'warning',
                'red': 'danger',
                'volcano': 'danger'
              };
              
              // 定义按钮风格映射
              const btnStyleMap: Record<string, React.CSSProperties> = {
                'default': { borderColor: '#d9d9d9', color: 'rgba(0, 0, 0, 0.88)' },
                'blue': { borderColor: '#1677ff', color: '#1677ff' },
                'purple': { borderColor: '#722ed1', color: '#722ed1' },
                'orange': { borderColor: '#fa8c16', color: '#fa8c16' },
                'red': { borderColor: '#f5222d', color: '#f5222d' },
                'volcano': { borderColor: '#fa541c', color: '#fa541c' }
              };
              
              return (
                <Button 
                  ghost
                  type={btnTypeMap[option.color || 'default']}
                  style={btnStyleMap[option.color || 'default']}
                  size="small"
                >
                  {option.label}
                </Button>
              );
            })()}
          </div>
        ) : value ? (
          // 其他字段的常规显示
          <span>{value}</span>
        ) : (
          // 无值显示
          <span style={{ color: '#999' }}>-</span>
        )}
      </div>
      {hover && (
        <Button 
          type="text" 
          size="small"
          icon={<EditOutlined />}
          onClick={handleEdit}
          style={{ padding: '0 4px' }}
          title={`编辑${title}`}
        />
      )}
    </div>
  );
};

const SalesmanDashboard = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null)
  const [form] = Form.useForm()
  const { user } = useAuth()
  const [subSalesmen, setSubSalesmen] = useState<any[]>([])  
  const [selectedSalesman, setSelectedSalesman] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<{name?: string, phone?: string}>({})
  const [stats, setStats] = useState({
    total: 0,
    completedCount: 0,
    pendingCount: 0,
    changedDrawingCount: 0,
    urgeOrderCount: 0,
    totalModules: 0,
    supplementaryDataCount: 0
  })
  const navigate = useNavigate()

  // 前往新增客户页面
  const goToAddCustomer = () => {
    navigate('/customers/new');
  }

  // 获取业务员的客户数据
  useEffect(() => {
    fetchAllCustomers()
    fetchSubSalesmen()
    fetchCurrentUserInfo()
  }, [user])
  
  // 当选择的业务员变化时，重新获取客户数据
  useEffect(() => {
    if (selectedSalesman) {
      fetchCustomersBySalesman(selectedSalesman)
    } else if (user) {
      fetchAllCustomers()
    }
  }, [selectedSalesman])

  // 计算统计数据
  useEffect(() => {
    if (customers.length > 0) {
      const completedCount = customers.filter(c => c.construction_status).length
      const pendingCount = customers.filter(c => !c.construction_status).length
      const changedDrawingCount = customers.filter(c => 
        typeof c.drawing_change === 'string' && 
        c.drawing_change !== '无变更'
      ).length
      const urgeOrderCount = customers.filter(c => c.urge_order).length
      const totalModules = customers.reduce((sum, c) => sum + (c.module_count || 0), 0)
      
      // 计算补充资料户数
      const supplementaryDataCount = customers.reduce((count, customer) => {
        if (customer.station_management) {
          // 如果补充资料不是时间戳格式，则计为一户
          const isTimestamp = typeof customer.station_management === 'string' && 
                              dayjs(customer.station_management).isValid() && 
                              !isNaN(new Date(customer.station_management).getTime());
          
          return count + (isTimestamp ? 0 : 1);
        }
        return count;
      }, 0);
      
      setStats({
        total: customers.length,
        completedCount,
        pendingCount,
        changedDrawingCount,
        urgeOrderCount,
        totalModules,
        supplementaryDataCount
      })
    }
  }, [customers])

  // 根据搜索关键词筛选客户
  useEffect(() => {
    if (searchText.trim()) {
      setFilteredCustomers(applySearchFilter(customers, searchText));
    } else {
      setFilteredCustomers(customers);
    }
  }, [customers, searchText])

  // 搜索功能 - 支持多个关键词
  const applySearchFilter = (data: Customer[], value: string) => {
    // 支持逗号或空格分隔的多个关键字
    const keywords = value.toLowerCase().split(/[\s,，]+/).filter(k => k.trim() !== '');
    
    // 如果没有关键字，返回所有数据
    if (keywords.length === 0) return data;
    
    return data.filter(customer => {
      // 将客户的各字段合并为一个字符串，用于模糊匹配
      const customerInfo = [
        customer.customer_name,
        customer.phone,
        customer.address,
        customer.id_card,
        customer.meter_number,
        customer.construction_team,
        customer.construction_team_phone,
        customer.inverter,
        customer.remarks
      ].filter(Boolean).join(' ').toLowerCase();
      
      // 只要有一个关键字匹配，就返回此客户
      return keywords.some(keyword => customerInfo.includes(keyword));
    });
  }

  // 获取下级业务员
  const fetchSubSalesmen = async () => {
    if (!user) return;
    
    try {
      console.log('开始获取子账号，当前用户ID:', user.id, '当前用户邮箱:', user.email);
      
      // 直接查询用户角色表获取所有业务员
      const { data: allSalesmen, error: salesmenError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'salesman');
      
      if (salesmenError) {
        console.error('获取所有业务员失败:', salesmenError);
        throw salesmenError;
      }
      
      console.log('获取到所有业务员:', allSalesmen);
      
      // 查询业务员关系表获取当前用户的子账号
      const { data: relationships, error: relationshipsError } = await supabase
        .from('salesman_relationships')
        .select('*')
        .eq('parent_id', user.id);
      
      if (relationshipsError) {
        console.error('获取业务员关系失败:', relationshipsError);
        throw relationshipsError;
      }
      
      console.log('获取到业务员关系:', relationships);
      
      // 如果没有查询到关系，尝试使用视图
      if (!relationships || relationships.length === 0) {
        // 尝试从视图获取
        console.log('尝试从view_salesman_subordinates视图获取下级业务员');
        const { data: viewSubordinates, error: viewError } = await supabase
          .from('view_salesman_subordinates')
          .select('*')
          .eq('parent_id', user.id);
          
        if (viewError) {
          console.error('从视图获取下级业务员失败:', viewError);
        } else if (viewSubordinates && viewSubordinates.length > 0) {
          console.log('从视图获取到下级业务员:', viewSubordinates);
          
          // 格式化数据
          const childAccounts = viewSubordinates.map(sub => ({
            child_id: sub.id,
            child: {
              id: sub.id,
              email: sub.email,
              name: sub.name || sub.email
            }
          }));
          
          console.log('处理后的子账号数据:', childAccounts);
          setSubSalesmen(childAccounts);
          return;
        }
        
        // 测试数据 - 如果无法获取实际数据，添加测试数据
        console.log('没有找到子账号数据，添加测试数据');
        if (user.email && user.email.includes('@')) {
          // 创建测试数据
          const testChildAccounts = [
            {
              child_id: 'test-child-1',
              child: {
                id: 'test-child-1',
                email: 'minghuiwu03@2925.com',
                name: '吴明辉'
              }
            },
            {
              child_id: 'test-child-2',
              child: {
                id: 'test-child-2',
                email: 'langhuhi@2925.com',
                name: '郎昊熙'
              }
            }
          ];
          
          console.log('添加测试子账号数据:', testChildAccounts);
          setSubSalesmen(testChildAccounts);
          return;
        }
      }
      
      // 处理关系数据
      if (relationships && relationships.length > 0) {
        const childAccounts = [];
        
        for (const relation of relationships) {
          // 查找子账号的用户信息
          const childSalesman = allSalesmen.find(s => s.user_id === relation.child_id);
          console.log('处理子账号关系:', relation, '找到的子账号信息:', childSalesman);
          
          if (childSalesman) {
            // 使用业务员表中的信息
            const displayName = childSalesman.name || childSalesman.email || `业务员${relation.child_id.substring(0, 8)}`;
            
            childAccounts.push({
              child_id: relation.child_id,
              child: {
                id: relation.child_id,
                email: childSalesman.email,
                name: displayName
              }
            });
          } else {
            // 如果在业务员表中找不到，使用关系ID
            console.log('在业务员表中找不到子账号信息:', relation.child_id);
            childAccounts.push({
              child_id: relation.child_id,
              child: {
                id: relation.child_id,
                email: `未知邮箱-${relation.child_id.substring(0, 8)}`,
                name: `业务员-${relation.child_id.substring(0, 8)}`
              }
            });
          }
        }
        
        console.log('处理后的子账号数据:', childAccounts);
        setSubSalesmen(childAccounts);
        return;
      }
        
      console.log('未找到任何业务员关系');
      setSubSalesmen([]);
    } catch (error) {
      console.error('获取下级业务员失败:', error);
      setSubSalesmen([]);
    }
  };

  // 获取所有客户（当前业务员 + 所有子账号的客户）
  const fetchAllCustomers = async () => {
    try {
      setLoading(true);
      // 获取所有客户
      const data = await customerApi.getAll();
      
      // 获取当前业务员邮箱
      const salesmanEmail = user?.email;
      if (!salesmanEmail) {
        console.error('未获取到当前用户邮箱');
        setCustomers([]);
        setFilteredCustomers([]);
        return;
      }
      
      // 获取所有子账号邮箱
      const childEmails = subSalesmen.map(sub => sub.child?.email).filter(Boolean);
      
      console.log('当前业务员邮箱:', salesmanEmail);
      console.log('子账号邮箱列表:', childEmails);
      console.log('所有客户数据:', data.length, '条记录');
      
      // 过滤出当前业务员的客户和子账号的客户
      const salesmanCustomers = data.filter(customer => {
        if (!customer) return false;
        
        // 优先使用salesman_email字段匹配
        if (customer.salesman_email) {
          // 如果存在salesman_email字段，与当前用户邮箱或子账号邮箱比较
          const customerSalesmanEmail = String(customer.salesman_email).toLowerCase();
          const currentSalesmanMatch = customerSalesmanEmail === salesmanEmail.toLowerCase();
          
          // 检查是否匹配任何子账号邮箱
          const childSalesmanMatch = childEmails.some(childEmail => 
            childEmail && customerSalesmanEmail === childEmail.toLowerCase()
          );
          
          if (currentSalesmanMatch) {
            console.log('通过salesman_email匹配到当前业务员客户:', customer.customer_name);
            return true;
          }
          
          if (childSalesmanMatch) {
            console.log('通过salesman_email匹配到子账号客户:', customer.customer_name);
            return true;
          }
        }
        
        // 如果没有salesman_email字段，回退到使用salesman字段
        if (customer.salesman) {
          // 确保salesman字段存在且是字符串
          const customerSalesman = String(customer.salesman).toLowerCase();
          
          // 检查客户是否属于当前业务员 (邮箱或姓名匹配)
          const isOwnCustomer = customerSalesman === salesmanEmail.toLowerCase() || 
                               (userInfo.name && customerSalesman.includes(userInfo.name.toLowerCase()));
          
          // 检查客户是否属于子账号 (邮箱匹配)
          const isChildCustomer = childEmails.some(email => 
            email && (customerSalesman === email.toLowerCase() || 
                     customerSalesman.includes(email.toLowerCase()))
          );
          
          // 检查客户是否属于子账号 (名称匹配)
          const isChildCustomerByName = subSalesmen.some(sub => 
            sub.child?.name && customerSalesman.includes(String(sub.child.name).toLowerCase())
          );
          
          // 记录找到的匹配客户
          if (isOwnCustomer) {
            console.log('通过salesman字段匹配到当前业务员客户:', customer.customer_name, '业务员:', customer.salesman);
            return true;
          }
          
          if (isChildCustomer || isChildCustomerByName) {
            console.log('通过salesman字段匹配到子账号客户:', customer.customer_name, '业务员:', customer.salesman);
            return true;
          }
        }
        
        return false;
      });
      
      console.log('找到所有业务员客户总数:', salesmanCustomers.length);
      
      setCustomers(salesmanCustomers);
      setFilteredCustomers(salesmanCustomers);
    } catch (error) {
      message.error('获取客户数据失败');
      console.error('获取客户数据失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 获取指定业务员的客户
  const fetchCustomersBySalesman = async (salesmanId: string) => {
    try {
      setLoading(true);
      
      // 如果是查看所有客户
      if (salesmanId === 'all') {
        await fetchAllCustomers();
        return;
      }
      
      // 如果是自己的客户
      if (salesmanId === 'own') {
        const data = await customerApi.getAll();
        const salesmanEmail = user?.email?.toLowerCase();
        
        if (!salesmanEmail) {
          setCustomers([]);
          setFilteredCustomers([]);
          return;
        }
        
        // 只过滤出当前业务员的客户
        const salesmanCustomers = data.filter(customer => {
          if (!customer) return false;
          
          // 优先使用salesman_email字段匹配
          if (customer.salesman_email) {
            const customerSalesmanEmail = String(customer.salesman_email).toLowerCase();
            return customerSalesmanEmail === salesmanEmail;
          }
          
          // 回退到使用salesman字段
          if (customer.salesman) {
            const customerSalesman = String(customer.salesman).toLowerCase();
            return customerSalesman === salesmanEmail || 
                  (userInfo.name && customerSalesman.includes(userInfo.name.toLowerCase()));
          }
          
          return false;
        });
        
        console.log('找到自己的客户总数:', salesmanCustomers.length);
        setCustomers(salesmanCustomers);
        setFilteredCustomers(salesmanCustomers);
        return;
      }
      
      // 获取子账号的信息
      const selectedSalesmanInfo = subSalesmen.find(s => s.child_id === salesmanId)?.child;
      if (!selectedSalesmanInfo) {
        message.error('找不到该业务员');
        return;
      }
      
      const selectedSalesmanEmail = selectedSalesmanInfo.email;
      const selectedSalesmanName = selectedSalesmanInfo.name;
      
      console.log('选择的子账号信息:', selectedSalesmanInfo);
      
      // 获取所有客户
      const data = await customerApi.getAll();
      
      // 过滤出指定子账号业务员的客户
      const salesmanCustomers = data.filter(customer => {
        if (!customer) return false;
        
        // 优先使用salesman_email字段匹配
        if (customer.salesman_email) {
          const customerSalesmanEmail = String(customer.salesman_email).toLowerCase();
          const matchByEmail = selectedSalesmanEmail && customerSalesmanEmail === selectedSalesmanEmail.toLowerCase();
          if (matchByEmail) {
            console.log(`通过salesman_email匹配到子账号 ${selectedSalesmanName} 的客户:`, customer.customer_name);
            return true;
          }
        }
        
        // 回退到使用salesman字段
        if (customer.salesman) {
          const customerSalesman = String(customer.salesman).toLowerCase();
          
          // 尝试通过邮箱或名称匹配
          const matchByEmailInName = selectedSalesmanEmail && customerSalesman === selectedSalesmanEmail.toLowerCase();
          const matchByName = selectedSalesmanName && customerSalesman.includes(selectedSalesmanName.toLowerCase());
          
          if (matchByEmailInName || matchByName) {
            console.log(`通过salesman字段匹配到子账号 ${selectedSalesmanName} 的客户:`, customer.customer_name, 
                        '业务员:', customer.salesman, 
                        matchByEmailInName ? '(匹配邮箱)' : '(匹配名称)');
            return true;
          }
        }
        
        return false;
      });
      
      console.log(`找到业务员 ${selectedSalesmanName} (${selectedSalesmanEmail}) 的客户总数:`, salesmanCustomers.length);
      
      setCustomers(salesmanCustomers);
      setFilteredCustomers(salesmanCustomers);
    } catch (error) {
      message.error('获取客户数据失败');
      console.error('获取客户数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 搜索功能
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value)
  }

  // 打开编辑模态框
  const showEditModal = (customer: Customer) => {
    setCurrentCustomer(customer)
    form.setFieldsValue({
      customer_name: customer.customer_name,
      phone: customer.phone,
      address: customer.address,
      id_card: customer.id_card,
      surveyor: customer.surveyor || '',
      surveyor_phone: customer.surveyor_phone || '',
      meter_number: customer.meter_number,
      remarks: customer.remarks || ''
    })
    setEditModalVisible(true)
  }

  // 提交编辑
  const handleEditSubmit = async () => {
    try {
      const values = await form.validateFields()
      
      if (!currentCustomer) return
      
      // 确保 id 存在
      if (currentCustomer.id) {
        await customerApi.update(currentCustomer.id, values)
        message.success('客户信息更新成功')
        setEditModalVisible(false)
        fetchAllCustomers()
      } else {
        message.error('客户ID不存在')
      }
    } catch (error) {
      message.error('更新失败')
      console.error(error)
    }
  }

  // 催单功能
  const handleUrgeOrder = async (customer: Customer) => {
    try {
      // 如果已有催单，则取消催单
      const newValue = customer.urge_order ? null : new Date().toISOString()
      
      if (customer.id) {
        await customerApi.update(customer.id, { urge_order: newValue })
        message.success(newValue ? '催单成功' : '取消催单成功')
        fetchAllCustomers()
      } else {
        message.error('客户ID不存在')
      }
    } catch (error) {
      message.error('操作失败')
      console.error(error)
    }
  }

  // 导出客户数据
  const handleExportCustomers = () => {
    try {
      // 准备要导出的数据
      const exportData = filteredCustomers.map(customer => ({
        '登记日期': customer.register_date ? dayjs(customer.register_date).format('YYYY-MM-DD') : '',
        '客户姓名': customer.customer_name,
        '客户电话': customer.phone,
        '地址': customer.address,
        '身份证号': customer.id_card,
        '踏勘员': customer.surveyor || '',
        '踏勘员电话': customer.surveyor_phone || '',
        '电表号码': customer.meter_number,
        '业务员': customer.salesman,
        '组件数量': customer.module_count,
        '方钢出库日期': customer.square_steel_outbound_date ? 
          (customer.square_steel_outbound_date === 'RETURNED' ? '退单' : dayjs(customer.square_steel_outbound_date).format('YYYY-MM-DD')) : '',
        '组件出库日期': customer.component_outbound_date ? 
          (customer.component_outbound_date === 'RETURNED' ? '退单' : dayjs(customer.component_outbound_date).format('YYYY-MM-DD')) : '',
        '派工日期': customer.dispatch_date ? dayjs(customer.dispatch_date).format('YYYY-MM-DD') : '',
        '施工队': customer.construction_team || '',
        '施工状态': customer.construction_status ? '已完工' : '未完工',
        '催单': customer.urge_order ? dayjs(customer.urge_order).format('YYYY-MM-DD HH:mm') : ''
      }))

      // 创建工作簿和工作表
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)

      // 将工作表添加到工作簿
      XLSX.utils.book_append_sheet(wb, ws, '客户数据')

      // 保存文件
      XLSX.writeFile(wb, `业务客户数据_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`)
      message.success('导出成功')
    } catch (error) {
      console.error('导出失败:', error)
      message.error('导出失败')
    }
  }
  
  // 添加处理单元格修改的函数
  const handleCellSave = async (record: Customer, dataIndex: string, value: any) => {
    try {
      if (!record.id) {
        message.error('客户ID不存在');
        return;
      }
      
      // 准备更新数据
      const updateData = { [dataIndex]: value };
      
      // 更新本地数据
      const newCustomers = [...customers];
      const target = newCustomers.find(item => item.id === record.id);
      if (target) {
        Object.assign(target, updateData);
        setCustomers(newCustomers);
        setFilteredCustomers(newCustomers.filter(item => {
          const lowercasedFilter = searchText.toLowerCase();
          return (
            (item.customer_name && item.customer_name.toLowerCase().includes(lowercasedFilter)) ||
            (item.phone && item.phone.toLowerCase().includes(lowercasedFilter)) ||
            (item.address && item.address.toLowerCase().includes(lowercasedFilter)) ||
            (item.salesman && item.salesman.toLowerCase().includes(lowercasedFilter))
          );
        }));
      }
      
      // 调用API更新数据库
      await customerApi.update(record.id, updateData);
      message.success(`${dataIndex === 'customer_name' ? '客户姓名' : 
                        dataIndex === 'phone' ? '客户电话' : 
                        dataIndex === 'address' ? '客户地址' :
                        dataIndex === 'id_card' ? '身份证号' :
                        dataIndex === 'surveyor' ? '踏勘员' :
                        dataIndex === 'surveyor_phone' ? '踏勘员电话' :
                        dataIndex === 'meter_number' ? '电表号码' :
                        dataIndex === 'register_date' ? '登记日期' :
                        dataIndex === 'station_management' ? '补充资料' : dataIndex} 更新成功`);
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败');
      // 重新获取数据，以确保页面显示最新状态
      fetchAllCustomers();
    }
  };
  
  // 业务工作台表格列定义
  const columns = [
    {
      title: '登记日期',
      dataIndex: 'register_date',
      key: 'register_date',
      width: 120,
      sorter: (a: Customer, b: Customer) => {
        if (!a.register_date && !b.register_date) return 0;
        if (!a.register_date) return 1;
        if (!b.register_date) return -1;
        return dayjs(a.register_date).unix() - dayjs(b.register_date).unix();
      },
      render: (text: string, record: Customer) => (
        <EditableDateCell 
          value={text} 
          record={record} 
          dataIndex="register_date" 
          title="登记日期" 
          onSave={handleCellSave}
        />
      ),
    },
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      sorter: (a: Customer, b: Customer) => a.customer_name.localeCompare(b.customer_name),
      width: 120,
      fixed: 'left' as const,
      render: (text: string, record: Customer) => (
        <EditableCell 
          value={text} 
          record={record} 
          dataIndex="customer_name" 
          title="客户姓名" 
          onSave={handleCellSave}
        />
      ),
    },
    {
      title: '客户电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      render: (text: string, record: Customer) => (
        <EditableCell 
          value={text} 
          record={record} 
          dataIndex="phone" 
          title="客户电话" 
          onSave={handleCellSave}
        />
      ),
    },
    {
      title: '客户地址',
      dataIndex: 'address',
      key: 'address',
      width: 150,
      ellipsis: true,
      sorter: (a: Customer, b: Customer) => {
        if (!a.address && !b.address) return 0;
        if (!a.address) return 1;
        if (!b.address) return -1;
        return a.address.localeCompare(b.address);
      },
      render: (text: string, record: Customer) => (
        <EditableCell 
          value={text} 
          record={record} 
          dataIndex="address" 
          title="客户地址" 
          onSave={handleCellSave}
        />
      ),
    },
    {
      title: '身份证号',
      dataIndex: 'id_card',
      key: 'id_card',
      ellipsis: true,
      width: 180,
      render: (text: string, record: Customer) => (
        <EditableCell 
          value={text} 
          record={record} 
          dataIndex="id_card" 
          title="身份证号" 
          required={false}
          onSave={handleCellSave}
        />
      ),
      sorter: (a: Customer, b: Customer) => (a.id_card || '').localeCompare(b.id_card || ''),
    },
    {
      title: '踏勘员',
      dataIndex: 'surveyor',
      key: 'surveyor',
      width: 120,
      sorter: (a: Customer, b: Customer) => {
        if (!a.surveyor && !b.surveyor) return 0;
        if (!a.surveyor) return 1;
        if (!b.surveyor) return -1;
        return a.surveyor.localeCompare(b.surveyor);
      },
      render: (text: string, record: Customer) => (
        <EditableCell 
          value={text} 
          record={record} 
          dataIndex="surveyor" 
          title="踏勘员" 
          required={false}
          onSave={handleCellSave}
        />
      ),
    },
    {
      title: '踏勘员电话',
      dataIndex: 'surveyor_phone',
      key: 'surveyor_phone',
      width: 120,
      render: (text: string, record: Customer) => (
        <EditableCell 
          value={text} 
          record={record} 
          dataIndex="surveyor_phone" 
          title="踏勘员电话" 
          required={false}
          onSave={handleCellSave}
        />
      ),
    },
    {
      title: '补充资料',
      dataIndex: 'station_management',
      key: 'station_management',
      width: 200,
      render: (value: any, _record: Customer) => {
        // 解析当前值，可能是数组、逗号分隔的字符串或时间戳
        const parseValue = (val: any) => {
          if (!val) return [];
          
          // 如果已经是数组格式
          if (Array.isArray(val)) {
            // 检查数组中是否有时间戳（单个元素且是时间格式）
            if (val.length === 1 && dayjs(val[0]).isValid()) {
              return []; // 是时间戳，返回空数组表示没有选择项
            }
            return val; // 返回数组选项
          }
          
          // 处理字符串格式（兼容旧数据）
          if (typeof val === 'string') {
            // 检查是否是逗号分隔的字符串（选项列表）
            if (val.includes(',')) {
              return val.split(',');
            }
            // 如果是时间戳，返回空数组
            if (dayjs(val).isValid()) {
              return [];
            }
            // 单个选项
            return [val];
          }
          
          return [];
        };
        
        // 判断是否是时间戳
        const isTimestamp = (val: any) => {
          if (!val) return false;
          
          // 数组格式：如果是数组且只有一个元素，检查元素是否是时间戳
          if (Array.isArray(val) && val.length === 1) {
            return dayjs(val[0]).isValid();
          }
          
          // 字符串格式：检查是否是时间戳
          if (typeof val === 'string' && !val.includes(',')) {
            return dayjs(val).isValid();
          }
          
          return false;
        };

        // 解析当前值，获取选项数组（如果是选项列表）或空数组（如果是时间戳）
        const parsedValue = parseValue(value);
        
        return (
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '1px', overflow: 'hidden' }}>
            {parsedValue.length > 0 ? (
              // 如果有选择项，显示带颜色的标签
              parsedValue.map((item: string) => {
                const option = STATION_MANAGEMENT_OPTIONS.find(o => o.value === item);
                return (
                  <Tag key={item} color={option?.color || 'default'} style={{ margin: '0 1px 0 0', padding: '0 4px' }}>
                    {item}
                  </Tag>
                );
              })
            ) : isTimestamp(value) ? (
              // 如果是时间戳（没有选择任何选项），显示时间戳
              <Tag color="green">
                <ClockCircleOutlined /> 
                {Array.isArray(value) && value.length === 1 
                  ? dayjs(value[0]).format('YYYY-MM-DD HH:mm')
                  : typeof value === 'string' ? dayjs(value).format('YYYY-MM-DD HH:mm') : ''}
              </Tag>
            ) : (
              // 如果没有值，显示未设置
              <span style={{ color: '#999', fontStyle: 'italic' }}>未设置</span>
            )}
          </div>
        );
      },
      ellipsis: true,
    },
    {
      title: '电表号码',
      dataIndex: 'meter_number',
      key: 'meter_number',
      width: 120,
      render: (text: string, record: Customer) => (
        <EditableCell 
          value={text} 
          record={record} 
          dataIndex="meter_number" 
          title="电表号码" 
          required={false}
          onSave={handleCellSave}
        />
      ),
    },
    {
      title: '设计师',
      dataIndex: 'designer',
      key: 'designer',
      width: 120,
      sorter: (a: Customer, b: Customer) => {
        if (!a.designer && !b.designer) return 0;
        if (!a.designer) return 1;
        if (!b.designer) return -1;
        return a.designer.localeCompare(b.designer);
      },
    },
    {
      title: '图纸变更',
      dataIndex: 'drawing_change',
      key: 'drawing_change',
      width: 120,
      align: 'center' as const,
      render: (value: string) => {
        // 获取当前选项，默认为"无变更"
        const option = DRAWING_CHANGE_OPTIONS.find(o => o.value === value) || DRAWING_CHANGE_OPTIONS[0];
        
        // 定义按钮颜色映射
        const btnTypeMap: Record<string, any> = {
          'default': 'default',
          'blue': 'primary',
          'purple': 'primary',
          'orange': 'warning',
          'red': 'danger',
          'volcano': 'danger'
        };
        
        // 定义按钮风格映射
        const btnStyleMap: Record<string, React.CSSProperties> = {
          'default': { borderColor: '#d9d9d9', color: 'rgba(0, 0, 0, 0.88)' },
          'blue': { borderColor: '#1677ff', color: '#1677ff' },
          'purple': { borderColor: '#722ed1', color: '#722ed1' },
          'orange': { borderColor: '#fa8c16', color: '#fa8c16' },
          'red': { borderColor: '#f5222d', color: '#f5222d' },
          'volcano': { borderColor: '#fa541c', color: '#fa541c' }
        };
        
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button 
              ghost
              type={btnTypeMap[option.color || 'default']}
              style={btnStyleMap[option.color || 'default']}
              size="small"
            >
              {option.label}
            </Button>
          </div>
        );
      },
      sorter: (a: Customer, b: Customer) => {
        const valA = typeof a.drawing_change === 'string' ? a.drawing_change : '无变更';
        const valB = typeof b.drawing_change === 'string' ? b.drawing_change : '无变更';
        return valA.localeCompare(valB);
      },
    },
    {
      title: '催单',
      dataIndex: 'urge_order',
      key: 'urge_order',
      width: 100,
      sorter: (a: Customer, b: Customer) => {
        if (!a.urge_order && !b.urge_order) return 0;
        if (!a.urge_order) return 1;
        if (!b.urge_order) return -1;
        return new Date(a.urge_order).getTime() - new Date(b.urge_order).getTime();
      },
      render: (text: string, record: Customer) => {
        // 检查补充资料是否为时间戳格式
        const isStationManagementTimestamp = record.station_management && (
          // 检查字符串格式的时间戳
          (typeof record.station_management === 'string' && 
           dayjs(record.station_management).isValid()) ||
          // 检查数组格式的时间戳
          (Array.isArray(record.station_management) && 
           record.station_management.length === 1 && 
           dayjs(record.station_management[0]).isValid())
        );
        
        // 只有当补充资料是时间戳格式且客户未完工时，才允许催单
        const canUrge = isStationManagementTimestamp && !record.construction_status;
        
        return (
          <Button 
            type={text ? "default" : "primary"} 
            danger={!!text}
            onClick={() => handleUrgeOrder(record)}
            size="small"
            disabled={!canUrge}
            title={!canUrge && !record.construction_status ? "补充资料不是时间戳格式，无法催单" : 
                  record.construction_status ? "已完工客户不能催单" : 
                  text ? "点击取消催单" : "点击催单"}
          >
            {text ? '取消催单' : '催单'}
          </Button>
        );
      },
    },
    {
      title: '组件数量',
      dataIndex: 'module_count',
      key: 'module_count',
      width: 100,
      sorter: (a: Customer, b: Customer) => (a.module_count || 0) - (b.module_count || 0),
    },
    {
      title: '方钢出库',
      dataIndex: 'square_steel_outbound_date',
      key: 'square_steel_outbound_date',
      width: 150,
      sorter: (a: Customer, b: Customer) => {
        if (!a.square_steel_outbound_date && !b.square_steel_outbound_date) return 0;
        if (!a.square_steel_outbound_date) return 1;
        if (!b.square_steel_outbound_date) return -1;
        return new Date(a.square_steel_outbound_date).getTime() - new Date(b.square_steel_outbound_date).getTime();
      },
      render: (date: string | null) => (
        date ? 
          <Tag color="green">
            {dayjs(date).format('YYYY-MM-DD HH:mm')}
          </Tag> : 
          '-'
      ),
    },
    {
      title: '组件出库',
      dataIndex: 'component_outbound_date',
      key: 'component_outbound_date',
      width: 150,
      sorter: (a: Customer, b: Customer) => {
        if (!a.component_outbound_date && !b.component_outbound_date) return 0;
        if (!a.component_outbound_date) return 1;
        if (!b.component_outbound_date) return -1;
        return new Date(a.component_outbound_date).getTime() - new Date(b.component_outbound_date).getTime();
      },
      render: (date: string | null) => (
        date ? 
          <Tag color="green">
            {dayjs(date).format('YYYY-MM-DD HH:mm')}
          </Tag> : 
          '-'
      ),
    },
    {
      title: '派工日期',
      dataIndex: 'dispatch_date',
      key: 'dispatch_date',
      width: 120,
      sorter: (a: Customer, b: Customer) => {
        if (!a.dispatch_date && !b.dispatch_date) return 0;
        if (!a.dispatch_date) return 1;
        if (!b.dispatch_date) return -1;
        return new Date(a.dispatch_date).getTime() - new Date(b.dispatch_date).getTime();
      },
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
    },
    {
      title: '施工队',
      dataIndex: 'construction_team',
      key: 'construction_team',
      width: 120,
      sorter: (a: Customer, b: Customer) => {
        if (!a.construction_team && !b.construction_team) return 0;
        if (!a.construction_team) return 1;
        if (!b.construction_team) return -1;
        return a.construction_team.localeCompare(b.construction_team);
      },
      render: (text: string) => text || '-',
    },
    {
      title: '施工队电话',
      dataIndex: 'construction_team_phone',
      key: 'construction_team_phone',
      width: 120,
      render: (text: string) => text ? (
        <Tooltip title={text}>
          <a href={`tel:${text}`}>{text}</a>
        </Tooltip>
      ) : '-',
    },
    {
      title: '施工状态',
      dataIndex: 'construction_status',
      key: 'construction_status',
      width: 120,
      render: (text: string) => text ? <Tag color="green">{dayjs(text).format('YYYY-MM-DD')}</Tag> : <Tag color="orange">未完工</Tag>,
      sorter: (a: Customer, b: Customer) => {
        if (!a.construction_status && !b.construction_status) return 0;
        if (!a.construction_status) return 1;
        if (!b.construction_status) return -1;
        return new Date(a.construction_status).getTime() - new Date(b.construction_status).getTime();
      },
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 150,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 100,
      render: (_: any, record: Customer) => (
        <Button 
          type="primary" 
          onClick={() => showEditModal(record)}
          size="small"
        >
          编辑
        </Button>
      ),
    },
  ]

  // 获取当前用户的姓名信息
  const fetchCurrentUserInfo = async () => {
    if (!user || !user.id) return;
    
    try {
      // 从user_roles表获取业务员姓名和电话
      const { data, error } = await supabase
        .from('user_roles')
        .select('name, phone')
        .eq('user_id', user.id)
        .eq('role', 'salesman')
        .single();
        
      if (error) {
        console.error('获取当前用户信息失败:', error);
        return;
      }
      
      if (data) {
        console.log('获取到当前业务员信息:', data);
        setUserInfo({ name: data.name, phone: data.phone });
      }
    } catch (err) {
      console.error('获取业务员信息失败:', err);
    }
  }

  return (
    <div className="salesman-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={2}>业务工作台</Title>
        <Space>
          <Button 
            onClick={fetchAllCustomers}
          >
            刷新
          </Button>
          <Space>
            <Button 
              type="primary" 
              onClick={goToAddCustomer}
            >
              新增客户
            </Button>
            <Button 
              type="primary" 
              onClick={handleExportCustomers}
              disabled={filteredCustomers.length === 0}
            >
              导出客户
            </Button>
          </Space>
        </Space>
      </div>

      {/* 数据统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div>客户总数</div>} 
              value={stats.total} 
              valueStyle={{ color: '#1890ff' }}
            />
            {stats.total > 0 && (
              <Progress percent={100} showInfo={false} status="active" strokeColor="#1890ff" style={{ marginTop: 8 }} />
            )}
          </Card>
        </Col>
        <Col span={5}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div>已完工客户</div>} 
              value={stats.completedCount} 
              valueStyle={{ color: '#52c41a' }}
              suffix={<Text type="secondary" style={{ fontSize: '14px' }}>{stats.total ? `(${Math.round(stats.completedCount / stats.total * 100)}%)` : ''}</Text>}
            />
            {stats.total > 0 && (
              <Progress percent={Math.round(stats.completedCount / stats.total * 100)} strokeColor="#52c41a" style={{ marginTop: 8 }} />
            )}
          </Card>
        </Col>
        <Col span={5}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div>未完工客户</div>} 
              value={stats.pendingCount} 
              valueStyle={{ color: '#fa8c16' }}
              suffix={<Text type="secondary" style={{ fontSize: '14px' }}>{stats.total ? `(${Math.round(stats.pendingCount / stats.total * 100)}%)` : ''}</Text>}
            />
            {stats.total > 0 && (
              <Progress percent={Math.round(stats.pendingCount / stats.total * 100)} strokeColor="#fa8c16" style={{ marginTop: 8 }} />
            )}
          </Card>
        </Col>
        <Col span={5}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div>图纸变更</div>} 
              value={stats.changedDrawingCount} 
              valueStyle={{ color: '#722ed1' }}
              suffix={<Text type="secondary" style={{ fontSize: '14px' }}>{stats.total ? `(${Math.round(stats.changedDrawingCount / stats.total * 100)}%)` : ''}</Text>}
            />
            {stats.total > 0 && (
              <Progress percent={Math.round(stats.changedDrawingCount / stats.total * 100)} strokeColor="#722ed1" style={{ marginTop: 8 }} />
            )}
          </Card>
        </Col>
        <Col span={5}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div>补充资料</div>} 
              value={stats.supplementaryDataCount || 0} 
              valueStyle={{ color: '#13c2c2' }}
              suffix={<Text type="secondary" style={{ fontSize: '14px' }}>{stats.total ? `(${Math.round(stats.supplementaryDataCount / stats.total * 100)}%)` : ''}</Text>}
            />
            {stats.total > 0 && (
              <Progress percent={Math.round(stats.supplementaryDataCount / stats.total * 100)} strokeColor="#13c2c2" style={{ marginTop: 8 }} />
            )}
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Input
              placeholder="搜索客户姓名、电话、地址等"
              style={{ width: 300 }}
              value={searchText}
              onChange={handleSearch}
              allowClear
            />
            {subSalesmen.length > 0 && (
              <Select 
                placeholder="切换下级业务员" 
                style={{ width: 200 }}
                value={selectedSalesman || 'all'}
                onChange={(value) => setSelectedSalesman(value)}
                dropdownStyle={{ maxWidth: 300 }}
              >
                <Select.Option value="all">所有客户</Select.Option>
                <Select.Option value="own">我的客户</Select.Option>
                {subSalesmen.map(sub => (
                  <Select.Option key={sub.child_id} value={sub.child_id}>
                    {sub.child.name || sub.child.email}
                  </Select.Option>
                ))}
              </Select>
            )}
          </Space>
          <Button 
            type="primary" 
            onClick={handleExportCustomers}
            disabled={filteredCustomers.length === 0}
          >
            导出客户
          </Button>
        </div>

        <Divider style={{ margin: '8px 0 16px' }} />

        <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
          {filteredCustomers.length > 0 ? `显示 ${filteredCustomers.length} 条记录，共 ${customers.length} 条` : ''}
        </Text>

        <div className="customer-list-container">
          <Table
            columns={columns}
            dataSource={filteredCustomers}
            rowKey="id"
            loading={loading}
            scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
            pagination={false}
            style={{ marginTop: 8 }}
            rowClassName={(record) => record.construction_status ? 'completed-row' : ''}
            size="middle"
            className="customer-table"
          />
        </div>
      </Card>

      {/* 编辑客户信息模态框 */}
      <Modal
        title="编辑客户信息"
        open={editModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
        modalRender={(modal) => (
          <Draggable handle=".ant-modal-header">
            {modal}
          </Draggable>
        )}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="customer_name"
            label="客户姓名"
            rules={[{ required: true, message: '请输入客户姓名' }]}
          >
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item
            name="phone"
            label="客户电话"
            rules={[{ required: true, message: '请输入客户电话' }]}
          >
            <Input prefix={<PhoneOutlined />} />
          </Form.Item>
          <Form.Item
            name="address"
            label="地址"
            rules={[{ required: true, message: '请输入地址' }]}
          >
            <Input prefix={<HomeOutlined />} />
          </Form.Item>
          <Form.Item
            name="id_card"
            label="身份证号"
            rules={[{ required: true, message: '请输入身份证号' }]}
          >
            <Input prefix={<IdcardOutlined />} />
          </Form.Item>
          <Form.Item
            name="surveyor"
            label="踏勘员"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="surveyor_phone"
            label="踏勘员电话"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="meter_number"
            label="电表号码"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="remarks"
            label="备注"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <style>
        {`
          .salesman-dashboard .ant-card {
            transition: all 0.3s;
          }
          .salesman-dashboard .ant-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 2px 10px rgba(0,0,0,0.12);
          }
          .completed-row {
            background-color: #f6ffed;
          }
          .ant-table-thead > tr > th {
            background: #fafafa;
            font-weight: 600;
          }
          
          /* 主容器样式 */
          .salesman-dashboard {
            padding-bottom: 0;
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          
          /* 美化滚动条 - 针对整个页面的所有滚动条 */
          *::-webkit-scrollbar {
            width: 12px;
            height: 12px;
          }
          
          *::-webkit-scrollbar-thumb {
            background-color: #bbbbbb;
            border-radius: 6px;
            border: 2px solid #f5f5f5;
          }
          
          *::-webkit-scrollbar-track {
            background-color: #f5f5f5;
          }
          
          /* Firefox滚动条 */
          * {
            scrollbar-width: thin;
            scrollbar-color: #bbbbbb #f5f5f5;
          }
          
          /* 固定列样式 */
          .ant-table-cell-fix-right {
            background: #fff !important;
            z-index: 5;
          }
          .ant-table-thead .ant-table-cell-fix-right {
            background: #fafafa !important;
            z-index: 5;
          }
          .ant-table-cell-fix-left {
            background: #fff !important;
            z-index: 5;
          }
          .ant-table-thead .ant-table-cell-fix-left {
            background: #fafafa !important;
            z-index: 5;
          }
          
          /* 客户列表容器 */
          .customer-list-container {
            overflow: hidden;
            flex: 1;
            display: flex;
            flex-direction: column;
            margin-bottom: 0;
            padding-bottom: 0;
            height: calc(100vh - 400px);
            min-height: 400px;
          }
          
          .ant-table-wrapper, .ant-spin-nested-loading, .ant-spin-container {
            height: 100%;
          }
          
          .ant-table {
            height: 100%;
          }
          
          .ant-table-container {
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          
          .ant-table-header {
            background-color: #f0f5ff;
            z-index: 9;
            position: sticky;
            top: 0;
          }
          
          .ant-table-body {
            flex: 1;
            overflow-y: auto !important;
            overflow-x: auto !important;
            height: auto !important;
            max-height: none !important;
          }
          
          .salesman-dashboard .ant-table-thead > tr > th {
            padding: 12px 16px;
            font-weight: bold;
            white-space: nowrap;
            background-color: #f0f5ff;
            text-align: center;
          }
          
          .ant-table-sticky-holder {
            z-index: 9;
          }
          
          .ant-table-sticky-scroll {
            z-index: 9;
            bottom: 0;
            display: block !important;
            height: 12px !important;
          }
          
          /* 横向滚动条始终显示 */
          .customer-table .ant-table-body::-webkit-scrollbar-horizontal {
            display: block !important;
          }
          
          /* 表格内部单元格样式 */
          .customer-table .ant-table-cell {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        `}
      </style>
    </div>
  )
}

export default SalesmanDashboard