import { useState, useEffect, useRef, useCallback } from 'react'
import { Table, Card, Input, Button, Typography, Space, message, Tag, Modal, Form, DatePicker, Statistic, Row, Col, Tooltip, Divider, Progress } from 'antd'
import { 
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  DeleteOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import { customerApi, dataCacheService } from '../../services/api'
import { Customer } from '../../types'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabaseClient'
import { calculateAllFields } from '../../utils/calculationUtils'

/**
 * 性能优化说明：
 * 1. 使用局部状态更新代替全量数据获取，减少不必要的重渲染
 * 2. 搜索功能添加防抖，减少频繁过滤导致的性能问题
 * 3. 优化统计数据更新逻辑，避免全量重新计算
 * 4. 添加性能监控点，便于追踪耗时操作
 */

// 更新出库状态类型定义
type OutboundStatus = 'none' | 'outbound' | 'inbound' | 'returned';

const { Title, Text } = Typography
const { confirm } = Modal

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

const WarehouseManagerDashboard = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm()
  const [outboundModalVisible, setOutboundModalVisible] = useState(false)
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null)
  const { user } = useAuth()
  const navigate = useNavigate()
  
  // 添加业务员映射表状态
  const [salesmenMap, setSalesmenMap] = useState<Map<string, {name: string, phone: string}>>(new Map())
  
  // 统计数据
  const [stats, setStats] = useState({
    totalCustomers: 0,
    outboundCustomers: 0,
    pendingOutbound: 0,
    urgeOrderCount: 0,
    drawingChangeCount: 0
  })

  // 添加防抖搜索
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  
  // 使用useCallback封装搜索逻辑
  const handleSearch = useCallback((value: string) => {
    // 设置搜索文本
    setSearchText(value);
    
    // 如果已经有一个定时器在运行，清除它
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // 设置新的定时器
    debounceTimer.current = setTimeout(() => {
      const lowercasedFilter = value.toLowerCase();
      
      // 性能监控 - 开始过滤
      console.time('搜索过滤');
      
      const filtered = customers.filter(item => {
        return (
          (item.customer_name && item.customer_name.toLowerCase().includes(lowercasedFilter)) ||
          (item.phone && item.phone.toLowerCase().includes(lowercasedFilter)) ||
          (item.address && item.address.toLowerCase().includes(lowercasedFilter)) ||
          (item.salesman && item.salesman.toLowerCase().includes(lowercasedFilter)) ||
          (item.construction_team && item.construction_team.toLowerCase().includes(lowercasedFilter))
        );
      });
      
      setFilteredCustomers(filtered);
      
      // 性能监控 - 结束过滤
      console.timeEnd('搜索过滤');
    }, 300); // 300ms防抖延迟
  }, [customers]);
  
  // 清除防抖定时器
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // 初次加载时执行一次过滤
  useEffect(() => {
    handleSearch(searchText);
  }, [customers, handleSearch, searchText]);

  // 获取仓库的客户数据
  useEffect(() => {
    fetchCustomers()
    fetchSalesmenInfo() // 获取业务员信息
  }, [])

  // 获取客户数据
  const fetchCustomers = async () => {
    setLoading(true)
    try {
      // 添加性能提示 - 开始获取数据
      console.time('获取客户数据');
      
      const data = await customerApi.getAll()
      
      // 添加性能提示 - 数据获取完成
      console.timeEnd('获取客户数据');
      console.time('数据处理和渲染');
      
      // 初始化数据缓存服务
      dataCacheService.initCache(data);
      
      // 更新统计数据
      updateStats(data);
      
      // 批量更新UI状态，减少渲染次数
      setCustomers(data)
      
      // 添加性能提示 - 数据处理完成
      console.timeEnd('数据处理和渲染');
      
      setLoading(false)
    } catch (error) {
      console.error('获取客户数据失败:', error)
      message.error('获取客户数据失败')
      setLoading(false)
    }
  }

  // 添加获取业务员信息的函数
  const fetchSalesmenInfo = async () => {
    try {
      // 从user_roles表获取所有业务员信息
      const { data: salesmenData, error } = await supabase
        .from('user_roles')
        .select('user_id, email, name, phone')
        .eq('role', 'salesman');
      
      if (error) {
        console.error('获取业务员信息失败:', error);
        return;
      }
      
      // 创建邮箱到姓名的映射
      const salesmenMapping = new Map<string, {name: string, phone: string}>();
      
      if (salesmenData) {
        salesmenData.forEach(salesman => {
          if (salesman.email) {
            salesmenMapping.set(salesman.email.toLowerCase(), {
              name: salesman.name || '未知业务员',
              phone: salesman.phone || ''
            });
          }
        });
      }
      
      setSalesmenMap(salesmenMapping);
      console.log('业务员映射表已更新:', salesmenMapping);
    } catch (err) {
      console.error('获取业务员数据出错:', err);
    }
  };

  // 根据邮箱获取业务员姓名的函数
  const getSalesmanName = (email: string | null | undefined) => {
    if (!email) return '-';
    
    // 检查是否是邮箱格式
    const isEmail = typeof email === 'string' && email.includes('@');
    
    if (isEmail) {
      // 从映射表中查找业务员真实姓名
      const salesmanInfo = salesmenMap.get(email.toLowerCase());
      if (salesmanInfo) {
        return salesmanInfo.name;
      }
    }
    
    // 如果不是邮箱或找不到对应姓名，直接返回原值
    return email;
  };

  // 添加更新统计数据的函数
  const updateStats = (data: Customer[]) => {
    const totalCustomers = data.length;
    const outboundCustomers = data.filter(c => c.component_outbound_date || c.square_steel_outbound_date).length;
    const pendingOutbound = data.filter(c => !c.component_outbound_date && !c.square_steel_outbound_date).length;
    const urgeOrderCount = data.filter(c => c.urge_order).length;
    const drawingChangeCount = data.filter(c => {
      // 只有当值为"变更1"至"变更5"才计数
      if (typeof c.drawing_change === 'string') {
        return ['变更1', '变更2', '变更3', '变更4', '变更5'].includes(c.drawing_change);
      }
      return false;
    }).length;
    
    setStats({
      totalCustomers,
      outboundCustomers,
      pendingOutbound,
      urgeOrderCount,
      drawingChangeCount
    });
  };

  // 处理出库状态变更
  const handleOutboundStatusChange = async (id: string | undefined, type: 'square_steel' | 'component', status: OutboundStatus) => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }

    try {
      // 找到当前客户
      const customer = customers.find(c => c.id === id);
      if (!customer) {
        message.error('找不到客户信息');
        return;
      }

      // 准备更新数据
      const updateData: any = {};
      
      // 根据状态设置日期值和状态
      switch (status) {
        case 'outbound':
          updateData[`${type}_outbound_date`] = dayjs().format('YYYY-MM-DD');
          updateData[`${type}_status`] = 'outbound';
          // 如果从回库变为出库，清除回库日期
          updateData[`${type}_inbound_date`] = null;
          break;
        case 'inbound':
          // 标记为回库状态，设置回库日期，但保留出库日期
          updateData[`${type}_status`] = 'inbound';
          updateData[`${type}_inbound_date`] = dayjs().format('YYYY-MM-DD');
          break;
        case 'returned':
          updateData[`${type}_outbound_date`] = 'RETURNED';
          updateData[`${type}_status`] = 'returned';
          break;
        case 'none':
          updateData[`${type}_outbound_date`] = null;
          updateData[`${type}_status`] = 'none';
          updateData[`${type}_inbound_date`] = null;
          break;
        default:
          break;
      }

      // 使用缓存更新服务立即更新本地状态
      customerApi.updateWithCache(id, updateData);
      
      // 使用局部更新而不是获取所有客户数据
      setCustomers(prevCustomers => 
        prevCustomers.map(c => c.id === id ? { ...c, ...updateData } : c)
      );
      
      // 同样局部更新过滤后的列表
      setFilteredCustomers(prevFiltered => 
        prevFiltered.map(c => c.id === id ? { ...c, ...updateData } : c)
      );
      
      // 局部更新统计数据
      const isOutboundStatusChange = 
        (type === 'component' && !customer.component_outbound_date && status === 'outbound') ||
        (type === 'component' && customer.component_outbound_date && status === 'none') ||
        (type === 'square_steel' && !customer.square_steel_outbound_date && status === 'outbound') ||
        (type === 'square_steel' && customer.square_steel_outbound_date && status === 'none');
        
      if (isOutboundStatusChange) {
        setStats(prev => {
          const outboundChange = status === 'outbound' ? 1 : -1;
          
          return {
            ...prev,
            outboundCustomers: prev.outboundCustomers + outboundChange,
            pendingOutbound: prev.pendingOutbound - outboundChange
          };
        });
      }
      
      // 提示成功
      let actionText = '';
      switch (status) {
        case 'outbound':
          actionText = '已标记为出库';
          break;
        case 'inbound':
          actionText = '已标记为回库';
          break;
        case 'returned':
          actionText = '已标记为退单';
          break;
        case 'none':
          actionText = '已标记为未出库';
          break;
      }
      
      message.success(`${customer.customer_name} ${type === 'square_steel' ? '方钢' : '组件'}${actionText}`);
      
    } catch (error) {
      console.error('更新出库状态失败:', error);
      message.error('更新出库状态失败');
    }
  };

  // 处理物品出库状态切换
  const handleItemOutboundToggle = async (id: string | undefined, itemType: string, currentDate: string | null) => {
    if (!id) {
      message.error('无效的客户ID');
      return;
    }

    try {
      setLoading(true);
      
      // 找到当前客户
      const customer = customers.find(c => c.id === id);
      if (!customer) {
        message.error('找不到客户信息');
        return;
      }
      
      // 如果已有日期，则清除日期（取消出库状态）
      // 如果没有日期，则设置为当前日期（标记为已出库）
      const updateObj: Record<string, any> = {
        [`${itemType}_outbound_date`]: currentDate ? null : dayjs().format('YYYY-MM-DD')
      };
      
      // 使用缓存更新服务立即更新本地状态
      customerApi.updateWithCache(id, updateObj);
      
      // 使用局部更新而不是获取所有客户数据
      setCustomers(prevCustomers => 
        prevCustomers.map(c => c.id === id ? { ...c, ...updateObj } : c)
      );
      
      // 同样局部更新过滤后的列表
      setFilteredCustomers(prevFiltered => 
        prevFiltered.map(c => c.id === id ? { ...c, ...updateObj } : c)
      );
      
      message.success(currentDate ? `${customer.customer_name} ${itemType}已取消出库` : `${customer.customer_name} ${itemType}已标记为出库`);
      
    } catch (error) {
      console.error('更新出库状态失败:', error);
      message.error('更新出库状态失败');
    } finally {
      setLoading(false);
    }
  };

  // 显示出库模态框
  const showOutboundModal = (customer: Customer) => {
    setCurrentCustomer(customer)
    form.resetFields()
    
    // 设置默认值
    form.setFieldsValue({
      square_steel_outbound_date: customer.square_steel_outbound_date ? dayjs(customer.square_steel_outbound_date) : null,
      component_outbound_date: customer.component_outbound_date ? dayjs(customer.component_outbound_date) : null,
      module_count: customer.module_count || 0,
      inverter: customer.inverter || '',
      distribution_box: customer.distribution_box || '',
      copper_wire: customer.copper_wire || '',
      aluminum_wire: customer.aluminum_wire || '',
      construction_team: customer.construction_team || '',
      construction_team_phone: customer.construction_team_phone || '',
      remarks: customer.remarks || ''
    })
    
    setOutboundModalVisible(true)
  }

  // 提交出库信息
  const handleOutboundSubmit = async () => {
    try {
      const values = await form.validateFields()
      
      if (!currentCustomer || !currentCustomer.id) {
        message.error('客户ID无效')
        return
      }
      
      // 根据组件数量自动计算其他字段
      const moduleCount = parseInt(values.module_count);
      let formattedValues = { ...values };
      
      if (!isNaN(moduleCount) && moduleCount >= 0) {
        // 如果组件数量有效，计算相关字段
        const calculatedFields = calculateAllFields(moduleCount);
        
        // 只有当组件数量大于等于10时才更新字段
        if (moduleCount >= 10) {
          // 只有在表单中未手动修改这些字段的情况下才使用计算值
          if (!values.inverter || values.inverter === currentCustomer.inverter) {
            formattedValues.inverter = calculatedFields.inverter || '';
          }
          
          if (!values.distribution_box || values.distribution_box === currentCustomer.distribution_box) {
            formattedValues.distribution_box = calculatedFields.distribution_box || '';
          }
          
          if (!values.copper_wire || values.copper_wire === currentCustomer.copper_wire) {
            formattedValues.copper_wire = calculatedFields.copper_wire || '';
          }
          
          if (!values.aluminum_wire || values.aluminum_wire === currentCustomer.aluminum_wire) {
            formattedValues.aluminum_wire = calculatedFields.aluminum_wire || '';
          }
        }
      }
      
      // 转换日期
      formattedValues = {
        ...formattedValues,
        square_steel_outbound_date: values.square_steel_outbound_date ? values.square_steel_outbound_date.format('YYYY-MM-DD') : null,
        component_outbound_date: values.component_outbound_date ? values.component_outbound_date.format('YYYY-MM-DD') : null,
      }
      
      // 使用缓存更新服务立即更新本地状态
      customerApi.updateWithCache(currentCustomer.id, formattedValues);
      
      // 使用局部更新而不是获取所有客户数据
      setCustomers(prevCustomers => 
        prevCustomers.map(c => c.id === currentCustomer.id ? { ...c, ...formattedValues } : c)
      );
      
      // 同样局部更新过滤后的列表
      setFilteredCustomers(prevFiltered => 
        prevFiltered.map(c => c.id === currentCustomer.id ? { ...c, ...formattedValues } : c)
      );
      
      // 检查是否需要更新统计数据（仅在出库状态发生变化时）
      const isComponentStatusChange = 
        (!currentCustomer.component_outbound_date && formattedValues.component_outbound_date) || 
        (currentCustomer.component_outbound_date && !formattedValues.component_outbound_date);
        
      const isSquareSteelStatusChange = 
        (!currentCustomer.square_steel_outbound_date && formattedValues.square_steel_outbound_date) || 
        (currentCustomer.square_steel_outbound_date && !formattedValues.square_steel_outbound_date);
        
      if (isComponentStatusChange || isSquareSteelStatusChange) {
        // 计算出库状态变化
        let outboundChange = 0;
        
        // 如果之前没有任何出库但现在有一项出库了
        const wasOutbound = currentCustomer.component_outbound_date || currentCustomer.square_steel_outbound_date;
        const isOutbound = formattedValues.component_outbound_date || formattedValues.square_steel_outbound_date;
        
        if (!wasOutbound && isOutbound) {
          outboundChange = 1;
        } 
        // 如果之前有出库但现在都没有了
        else if (wasOutbound && !isOutbound) {
          outboundChange = -1;
        }
        
        if (outboundChange !== 0) {
          setStats(prev => ({
            ...prev,
            outboundCustomers: prev.outboundCustomers + outboundChange,
            pendingOutbound: prev.pendingOutbound - outboundChange
          }));
        }
      }
      
      message.success('出库信息更新成功')
      setOutboundModalVisible(false)
      
    } catch (error) {
      console.error('更新出库信息失败:', error)
      message.error('更新出库信息失败')
    }
  }

  // 导出客户数据
  const handleExport = () => {
    try {
      // 准备导出数据
      const exportData = filteredCustomers.map(customer => ({
        '客户姓名': customer.customer_name,
        '客户电话': customer.phone,
        '客户地址': customer.address,
        '业务员': customer.salesman,
        '业务员电话': customer.salesman_phone,
        '组件数量': customer.module_count,
        '逆变器': customer.inverter,
        '配电箱': customer.distribution_box,
        '铜线': customer.copper_wire,
        '铝线': customer.aluminum_wire,
        '方钢出库': customer.square_steel_outbound_date ? dayjs(customer.square_steel_outbound_date).format('YYYY-MM-DD') : '',
        '组件出库': customer.component_outbound_date ? dayjs(customer.component_outbound_date).format('YYYY-MM-DD') : '',
        '施工队': customer.construction_team || '',
        '施工队电话': customer.construction_team_phone || '',
        '施工状态': customer.construction_status ? '已完工' : '未完工',
        '图纸变更': customer.drawing_change ? '是' : '否',
        '催单': customer.urge_order ? '是' : '否',
        '大线': customer.large_cable || '',
        '公司': customer.company || '',
        '备注': customer.remarks || ''
      }))

      // 创建工作簿
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)
      XLSX.utils.book_append_sheet(wb, ws, '仓库客户数据')

      // 导出Excel文件
      XLSX.writeFile(wb, `仓库客户数据_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败')
      console.error(error)
    }
  }

  // 表格列定义
  const columns = [
    {
      title: '图纸变更',
      dataIndex: 'drawing_change',
      key: 'drawing_change',
      width: 100,
      render: (value: any) => {
        // 兼容布尔值和字符串
        if (typeof value === 'boolean') {
          return value ? <Tag color="red">变更</Tag> : "未出图";
        }
        
        if (!value || value === '未出图') {
          return "未出图";
        }
        
        // 对"变更1"至"变更5"的值使用红色标签
        if (typeof value === 'string' && ['变更1', '变更2', '变更3', '变更4', '变更5'].includes(value)) {
          return <Tag color="red">{value}</Tag>;
        }
        
        // 其他值用普通文本显示
        return value;
      },
      sorter: (a: Customer, b: Customer) => {
        // 自定义排序: 变更1-5 > 其他变更值 > 未出图
        const valA = typeof a.drawing_change === 'string' ? a.drawing_change : '';
        const valB = typeof b.drawing_change === 'string' ? b.drawing_change : '';
        
        // 检查是否为变更1-5
        const isSpecialChangeA = ['变更1', '变更2', '变更3', '变更4', '变更5'].includes(valA);
        const isSpecialChangeB = ['变更1', '变更2', '变更3', '变更4', '变更5'].includes(valB);
        
        if (isSpecialChangeA && !isSpecialChangeB) return -1;
        if (!isSpecialChangeA && isSpecialChangeB) return 1;
        return valA.localeCompare(valB);
      },
    },
    {
      title: '催单',
      dataIndex: 'urge_order',
      key: 'urge_order',
      width: 100,
      render: (text: string, record: Customer) => {
        // 如果有催单日期
        if (text) {
          return (
            <Tag color="orange">
              <ClockCircleOutlined /> {dayjs(text).format('MM-DD HH:mm')}
            </Tag>
          );
        } else {
          // 无催单时显示"-"
          return "-";
        }
      },
      sorter: (a: Customer, b: Customer) => Number(!!a.urge_order) - Number(!!b.urge_order),
    },
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 120,
      fixed: 'left' as const,
      sorter: (a: Customer, b: Customer) => a.customer_name.localeCompare(b.customer_name),
      render: (text: string) => (
        <span style={{ fontWeight: 'bold' }}>{text}</span>
      ),
    },
    {
      title: '客户电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (text: string) => text ? (
        <a href={`tel:${text}`}>{text}</a>
      ) : '-',
      sorter: (a: Customer, b: Customer) => (a.phone || '').localeCompare(b.phone || ''),
    },
    {
      title: '客户地址',
      dataIndex: 'address',
      key: 'address',
      width: 200,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text || '-'}</span>
        </Tooltip>
      ),
      sorter: (a: Customer, b: Customer) => (a.address || '').localeCompare(b.address || ''),
    },
    {
      title: '业务员',
      dataIndex: 'salesman',
      key: 'salesman',
      width: 120,
      render: (text: string) => text ? (
        <Tag color="blue">{getSalesmanName(text)}</Tag>
      ) : '-',
      sorter: (a: Customer, b: Customer) => (a.salesman || '').localeCompare(b.salesman || ''),
    },
    {
      title: '业务员电话',
      dataIndex: 'salesman_phone',
      key: 'salesman_phone',
      width: 140,
      render: (text: string, record: Customer) => {
        // 如果有业务员电话直接显示
        if (text) return <a href={`tel:${text}`}>{text}</a>;
        
        // 如果没有电话但有业务员邮箱，尝试从映射表获取
        if (record.salesman && record.salesman.includes('@')) {
          const salesmanInfo = salesmenMap.get(record.salesman.toLowerCase());
          if (salesmanInfo && salesmanInfo.phone) {
            return <a href={`tel:${salesmanInfo.phone}`}>{salesmanInfo.phone}</a>;
          }
        }
        
        return '-';
      },
    },
    {
      title: '组件数量',
      dataIndex: 'module_count',
      key: 'module_count',
      sorter: (a: Customer, b: Customer) => (a.module_count || 0) - (b.module_count || 0),
      width: 100,
      render: (value: number) => value ? (
        <Tag color="purple">{value}块</Tag>
      ) : '0块',
    },
    {
      title: '逆变器',
      dataIndex: 'inverter',
      key: 'inverter',
      width: 150,
      ellipsis: true,
      render: (text: string, record: Customer) => {
        // 如果组件数量过少，无法确定逆变器型号
        if (!record.module_count || record.module_count < 10) {
          return <span style={{ color: '#999' }}>-</span>;
        }

        // 检查是否有出库日期（时间戳）
        const outboundDate = (record as any).inverter_outbound_date ? 
          dayjs((record as any).inverter_outbound_date).format('YYYY-MM-DD') : '';
        
        // 如果text为空，根据组件数量计算正确的逆变器型号
        const calculatedInverter = text || (record.module_count ? calculateAllFields(record.module_count).inverter : '');
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出库"}>
            <Tag 
              color={(record as any).inverter_outbound_date ? "green" : "blue"}
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemOutboundToggle(record.id, 'inverter', (record as any).inverter_outbound_date)}
            >
              {calculatedInverter}
            </Tag>
          </Tooltip>
        );
      },
      sorter: (a: Customer, b: Customer) => (a.inverter || '').localeCompare(b.inverter || ''),
    },
    {
      title: '配电箱',
      dataIndex: 'distribution_box',
      key: 'distribution_box',
      width: 100,
      ellipsis: true,
      render: (text: string, record: Customer) => {
        // 如果组件数量过少，无法确定型号
        if (!record.module_count || record.module_count < 10) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        
        // 检查是否有出库日期（时间戳）
        const outboundDate = (record as any).distribution_box_outbound_date ? 
          dayjs((record as any).distribution_box_outbound_date).format('YYYY-MM-DD') : '';
        
        // 如果text为空，根据组件数量计算正确的配电箱规格
        const calculatedBox = text || (record.module_count ? calculateAllFields(record.module_count).distribution_box : '');
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出库"}>
            <Tag 
              color={(record as any).distribution_box_outbound_date ? "green" : "blue"}
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemOutboundToggle(record.id, 'distribution_box', (record as any).distribution_box_outbound_date)}
            >
              {calculatedBox}
            </Tag>
          </Tooltip>
        );
      },
      sorter: (a: Customer, b: Customer) => (a.distribution_box || '').localeCompare(b.distribution_box || ''),
    },
    {
      title: '铜线',
      dataIndex: 'copper_wire',
      key: 'copper_wire',
      width: 100,
      ellipsis: true,
      render: (text: string, record: Customer) => {
        // 如果组件数量过少，无法确定型号
        if (!record.module_count || record.module_count < 10) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        
        // 检查是否有出库日期（时间戳）
        const outboundDate = (record as any).copper_wire_outbound_date ? 
          dayjs((record as any).copper_wire_outbound_date).format('YYYY-MM-DD') : '';
        
        // 如果text为空，根据组件数量计算正确的铜线规格
        const calculatedWire = text || (record.module_count ? calculateAllFields(record.module_count).copper_wire : '');
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出库"}>
            <Tag 
              color={(record as any).copper_wire_outbound_date ? "green" : "blue"}
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemOutboundToggle(record.id, 'copper_wire', (record as any).copper_wire_outbound_date)}
            >
              {calculatedWire}
            </Tag>
          </Tooltip>
        );
      },
      sorter: (a: Customer, b: Customer) => (a.copper_wire || '').localeCompare(b.copper_wire || ''),
    },
    {
      title: '铝线',
      dataIndex: 'aluminum_wire',
      key: 'aluminum_wire',
      width: 100,
      ellipsis: true,
      render: (text: string, record: Customer) => {
        // 如果组件数量过少，无法确定型号
        if (!record.module_count || record.module_count < 10) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        
        // 检查是否有出库日期（时间戳）
        const outboundDate = (record as any).aluminum_wire_outbound_date ? 
          dayjs((record as any).aluminum_wire_outbound_date).format('YYYY-MM-DD') : '';
        
        // 如果text为空，根据组件数量计算正确的铝线规格
        const calculatedWire = text || (record.module_count ? calculateAllFields(record.module_count).aluminum_wire : '');
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出库"}>
            <Tag 
              color={(record as any).aluminum_wire_outbound_date ? "green" : "blue"}
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemOutboundToggle(record.id, 'aluminum_wire', (record as any).aluminum_wire_outbound_date)}
            >
              {calculatedWire}
            </Tag>
          </Tooltip>
        );
      },
      sorter: (a: Customer, b: Customer) => (a.aluminum_wire || '').localeCompare(b.aluminum_wire || ''),
    },
    {
      title: '方钢出库',
      dataIndex: 'square_steel_status',
      key: 'square_steel_status',
      width: 150,
      align: 'center' as const,
      render: (_: unknown, record: Customer) => {
        // 使用status来判断状态
        const status = record.square_steel_status || 'none';
        
        if (record.square_steel_outbound_date) {
          if (record.square_steel_outbound_date === 'RETURNED') {
            return (
              <Tag color="red">
                <CloseCircleOutlined /> 退单
              </Tag>
            );
          } else if (status === 'inbound') {
            // 回库状态 - 可点击变为出库状态
            const inboundDate = record.square_steel_inbound_date 
              ? dayjs(record.square_steel_inbound_date).format('YYYY-MM-DD')
              : dayjs().format('YYYY-MM-DD');
            
            return (
              <Tooltip title="点击变更状态">
                <Tag 
                  color="orange"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    confirm({
                      title: '变更方钢状态',
                      content: '请选择要变更的状态',
                      okText: '变为出库',
                      cancelText: '变为未出库',
                      onOk: () => handleOutboundStatusChange(record.id, 'square_steel', 'outbound'),
                      onCancel: () => handleOutboundStatusChange(record.id, 'square_steel', 'none')
                    });
                  }}
                >
                  <RollbackOutlined /> 回库 {inboundDate}
                </Tag>
              </Tooltip>
            );
          } else {
            // 已出库状态 - 可点击变为回库状态
            return (
              <Tooltip title="点击变更状态">
                <Tag 
                  color="green"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    confirm({
                      title: '变更方钢状态',
                      content: '请选择要变更的状态',
                      okText: '变为回库',
                      cancelText: '变为未出库',
                      onOk: () => handleOutboundStatusChange(record.id, 'square_steel', 'inbound'),
                      onCancel: () => handleOutboundStatusChange(record.id, 'square_steel', 'none')
                    });
                  }}
                >
                  {dayjs(record.square_steel_outbound_date).format('YYYY-MM-DD')}
                </Tag>
              </Tooltip>
            );
          }
        } else {
          // 未出库状态 - 显示出库按钮
          return (
            <Button 
              type="primary" 
              size="small"
              onClick={() => handleOutboundStatusChange(record.id, 'square_steel', 'outbound')}
            >
              出库
            </Button>
          );
        }
      },
      sorter: (a: Customer, b: Customer) => {
        if (!a.square_steel_outbound_date && !b.square_steel_outbound_date) return 0;
        if (!a.square_steel_outbound_date) return 1;
        if (!b.square_steel_outbound_date) return -1;
        return new Date(a.square_steel_outbound_date).getTime() - new Date(b.square_steel_outbound_date).getTime();
      },
    },
    {
      title: '组件出库',
      dataIndex: 'component_outbound_date',
      key: 'component_outbound_date',
      width: 150,
      render: (date: string | null, record: Customer) => {
        // 使用status来判断状态
        const status = record.component_status || 'none';
        
        if (date) {
          if (date === 'RETURNED') {
            return (
              <Tag color="red">
                <CloseCircleOutlined /> 退单
              </Tag>
            );
          } else if (status === 'inbound') {
            // 回库状态 - 可点击变为出库状态
            const inboundDate = record.component_inbound_date 
              ? dayjs(record.component_inbound_date).format('YYYY-MM-DD')
              : dayjs().format('YYYY-MM-DD');
            
            return (
              <Tooltip title="点击变更状态">
                <Tag 
                  color="orange"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    confirm({
                      title: '变更组件状态',
                      content: '请选择要变更的状态',
                      okText: '变为出库',
                      cancelText: '变为未出库',
                      onOk: () => handleOutboundStatusChange(record.id, 'component', 'outbound'),
                      onCancel: () => handleOutboundStatusChange(record.id, 'component', 'none')
                    });
                  }}
                >
                  <RollbackOutlined /> 回库 {inboundDate}
                </Tag>
              </Tooltip>
            );
          } else {
            // 已出库状态 - 可点击变为回库状态
            return (
              <Tooltip title="点击变更状态">
                <Tag 
                  color="green"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    confirm({
                      title: '变更组件状态',
                      content: '请选择要变更的状态',
                      okText: '变为回库',
                      cancelText: '变为未出库',
                      onOk: () => handleOutboundStatusChange(record.id, 'component', 'inbound'),
                      onCancel: () => handleOutboundStatusChange(record.id, 'component', 'none')
                    });
                  }}
                >
                  {dayjs(date).format('YYYY-MM-DD')}
                </Tag>
              </Tooltip>
            );
          }
        } else {
          // 未出库状态 - 显示出库按钮
          return (
            <Button 
              type="primary" 
              size="small"
              onClick={() => handleOutboundStatusChange(record.id, 'component', 'outbound')}
            >
              出库
            </Button>
          );
        }
      },
      sorter: (a: Customer, b: Customer) => {
        if (!a.component_outbound_date && !b.component_outbound_date) return 0;
        if (!a.component_outbound_date) return 1;
        if (!b.component_outbound_date) return -1;
        return new Date(a.component_outbound_date).getTime() - new Date(b.component_outbound_date).getTime();
      },
    },
    {
      title: '施工队',
      dataIndex: 'construction_team',
      key: 'construction_team',
      width: 120,
      render: (text: string) => text ? text : '-',
      sorter: (a: Customer, b: Customer) => (a.construction_team || '').localeCompare(b.construction_team || ''),
    },
    {
      title: '施工队电话',
      dataIndex: 'construction_team_phone',
      key: 'construction_team_phone',
      width: 140,
      render: (text: string) => text ? (
        <a href={`tel:${text}`}>{text}</a>
      ) : '-',
      sorter: (a: Customer, b: Customer) => (a.construction_team_phone || '').localeCompare(b.construction_team_phone || ''),
    },
    {
      title: '施工状态',
      dataIndex: 'construction_status',
      key: 'construction_status',
      width: 100,
      render: (value: boolean) => value ? 
        <Tag color="green">已完工</Tag> : 
        <Tag color="orange">未完工</Tag>,
      sorter: (a: Customer, b: Customer) => {
        const aValue = a.construction_status ? 1 : 0;
        const bValue = b.construction_status ? 1 : 0;
        return aValue - bValue;
      },
    },
    {
      title: '大线',
      dataIndex: 'large_cable',
      key: 'large_cable',
      width: 100,
      render: (text: string) => text || '-',
      sorter: (a: Customer, b: Customer) => {
        if (!a.large_cable && !b.large_cable) return 0;
        if (!a.large_cable) return 1;
        if (!b.large_cable) return -1;
        return a.large_cable.localeCompare(b.large_cable);
      },
    },
    {
      title: '公司',
      dataIndex: 'company',
      key: 'company',
      width: 100,
      render: (text: string) => text || '-',
      sorter: (a: Customer, b: Customer) => (a.company || '').toString().localeCompare((b.company || '').toString()),
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true,
      width: 150,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text || '-'}</span>
        </Tooltip>
      ),
      sorter: (a: Customer, b: Customer) => (a.remarks || '').localeCompare(b.remarks || ''),
    }
  ]

  return (
    <div className="warehouse-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={2}>仓库工作台</Title>
        <Space>
          <Input
            placeholder="搜索客户姓名/电话/地址"
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: 250 }}
            prefix={<SearchOutlined />}
            allowClear
          />
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchCustomers}
          >
            刷新
          </Button>
          <Button 
            type="primary" 
            icon={<ExportOutlined />}
            onClick={handleExport}
            disabled={filteredCustomers.length === 0}
          >
            导出数据
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title="催单数" 
              value={stats.urgeOrderCount} 
              suffix="户" 
              valueStyle={{ color: '#fa8c16' }}
            />
            {stats.totalCustomers > 0 && (
              <Progress 
                percent={Math.round(stats.urgeOrderCount / stats.totalCustomers * 100)} 
                showInfo={false} 
                status="active" 
                strokeColor="#fa8c16" 
                style={{ marginTop: 8 }} 
              />
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title="已出库" 
              value={stats.outboundCustomers} 
              suffix="户" 
              valueStyle={{ color: '#3f8600' }}
            />
            {stats.totalCustomers > 0 && (
              <Progress 
                percent={Math.round(stats.outboundCustomers / stats.totalCustomers * 100)} 
                strokeColor="#3f8600" 
                style={{ marginTop: 8 }} 
              />
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title="待出库" 
              value={stats.pendingOutbound} 
              suffix="户" 
              valueStyle={{ color: '#cf1322' }}
            />
            {stats.totalCustomers > 0 && (
              <Progress 
                percent={Math.round(stats.pendingOutbound / stats.totalCustomers * 100)} 
                strokeColor="#cf1322" 
                style={{ marginTop: 8 }} 
              />
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={
                <Tooltip title="仅统计图纸变更1-5的记录">
                  <span>图纸变更户数</span>
                </Tooltip>
              }
              value={stats.drawingChangeCount} 
              suffix="户" 
              valueStyle={{ color: '#9254de' }}
            />
            {stats.totalCustomers > 0 && (
              <Progress 
                percent={Math.round(stats.drawingChangeCount / stats.totalCustomers * 100)} 
                strokeColor="#9254de" 
                style={{ marginTop: 8 }} 
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 客户表格 */}
      <div className="customer-list-container" style={{ height: '100%', display: 'flex', flexDirection: 'column', marginBottom: 0, paddingBottom: 0 }}>
        <Table
          columns={columns}
          dataSource={filteredCustomers}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content', y: 'calc(100vh - 200px)' }}
          pagination={false}
          bordered
          size="middle"
          tableLayout="fixed"
          className="customer-table"
          style={{ flex: 1, overflow: 'auto' }}
          sticky={{ offsetHeader: 0 }}
        />
      </div>

      {/* 出库模态框 */}
      <Modal
        title="仓库信息编辑"
        open={outboundModalVisible}
        onOk={handleOutboundSubmit}
        onCancel={() => setOutboundModalVisible(false)}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="square_steel_outbound_date"
                label="方钢出库日期"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="component_outbound_date"
                label="组件出库日期"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="module_count"
                label="组件数量"
              >
                <Input 
                  type="number" 
                  min={0} 
                  onChange={(e) => {
                    const moduleCount = parseInt(e.target.value);
                    if (!isNaN(moduleCount) && moduleCount >= 0) {
                      const calculatedFields = calculateAllFields(moduleCount);
                      
                      // 只有当组件数量大于等于10时才更新字段，否则保留原值
                      if (moduleCount >= 10) {
                        form.setFieldsValue({
                          inverter: calculatedFields.inverter || '',
                          distribution_box: calculatedFields.distribution_box || '',
                          copper_wire: calculatedFields.copper_wire || '',
                          aluminum_wire: calculatedFields.aluminum_wire || ''
                        });
                      }
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="inverter"
                label="逆变器"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="distribution_box"
                label="配电箱"
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="copper_wire"
                label="铜线"
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="aluminum_wire"
                label="铝线"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="construction_team"
                label="施工队"
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="construction_team_phone"
                label="施工队电话"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          
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
          .warehouse-dashboard .ant-card {
            transition: all 0.3s;
          }
          .warehouse-dashboard .ant-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 2px 10px rgba(0,0,0,0.12);
          }
          .warehouse-dashboard .ant-table-thead > tr > th {
            background: #fafafa;
            font-weight: 600;
            text-align: center;
            vertical-align: middle;
          }
          .customer-table .ant-table-cell {
            vertical-align: middle;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 80px;
          }
          
          /* 主容器样式 */
          .warehouse-dashboard {
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
          .customer-table .ant-table-cell-fix-right {
            background: #fff !important;
            z-index: 5;
          }
          .customer-table .ant-table-thead .ant-table-cell-fix-right {
            background: #fafafa !important;
            z-index: 5;
          }
          .customer-table .ant-table-cell-fix-left {
            background: #fff !important;
            z-index: 5;
          }
          .customer-table .ant-table-thead .ant-table-cell-fix-left {
            background: #fafafa !important;
            z-index: 5;
          }
          
          /* 客户列表容器 */
          .customer-list-container {
            overflow: auto;
            flex: 1;
            display: flex;
            flex-direction: column;
            margin-bottom: 0;
            padding-bottom: 0;
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
            height: auto !important;
            max-height: none !important;
          }
          
          .customer-table .ant-table-thead > tr > th {
            padding: 12px 16px;
            font-weight: bold;
            white-space: nowrap;
            background-color: #f0f5ff;
            text-align: center;
          }
          
          .customer-table .ant-table-sticky-holder {
            z-index: 9;
          }
          
          .customer-table .ant-table-sticky-scroll {
            z-index: 9;
            bottom: 0;
          }
        `}
      </style>
    </div>
  )
}

export default WarehouseManagerDashboard