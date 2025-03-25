import { useState, useEffect } from 'react'
import { Table, Card, Input, Button, Typography, Space, message, Tag, Modal, Form, Select, DatePicker, Empty, Divider, Tooltip, Statistic, Row, Col, Progress, Spin, Alert } from 'antd'
import { 
  SearchOutlined, 
  ReloadOutlined, 
  ToolOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  UserOutlined,
  PhoneOutlined,
  HomeOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  KeyOutlined,
  CheckOutlined
} from '@ant-design/icons'
import { customerApi, constructionTeamApi, verificationCodeApi } from '../../services/api'
import { Customer } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import dayjs from 'dayjs'
import Draggable from 'react-draggable'

const { Title } = Typography
const { Option } = Select
const { TextArea } = Input

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

const ConstructionTeamDashboard = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [updateModalVisible, setUpdateModalVisible] = useState(false)
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null)
  const [form] = Form.useForm()
  const { user } = useAuth()
  
  // 抽签相关状态
  const [selectedTown, setSelectedTown] = useState<string>('')
  const [constructionTeam, setConstructionTeam] = useState<string>('')
  const [] = useState<string>('')
  const [isDrawing, setIsDrawing] = useState(false)
  const [] = useState<Customer | null>(null)
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [verificationCodeValid, setVerificationCodeValid] = useState(false)
  const [verificationCodeError, setVerificationCodeError] = useState<string>('')
  const [drawableCustomers, setDrawableCustomers] = useState<Customer[]>([])
  const [] = useState(false)
  const [] = useState<string>('today')
  const [blockedSalesmen, setBlockedSalesmen] = useState<string[]>([]) // 存储屏蔽的业务员列表
  const [towns, setTowns] = useState<string[]>([]) // 乡镇列表
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [drawAnimationRunning, setDrawAnimationRunning] = useState(false);
  const [drawModalVisible, setDrawModalVisible] = useState(false);

  // 获取施工队的客户数据
  useEffect(() => {
    fetchCustomers()
    fetchTowns() // 获取乡镇列表
    // 页面加载时自动显示所有可用客户
    showAllAvailableCustomers()
    
    // 从localStorage读取被屏蔽的业务员列表
    const savedBlockedSalesmen = localStorage.getItem('blocked_salesmen')
    if (savedBlockedSalesmen) {
      try {
        const parsedBlockedSalesmen = JSON.parse(savedBlockedSalesmen)
        if (Array.isArray(parsedBlockedSalesmen)) {
          setBlockedSalesmen(parsedBlockedSalesmen)
          console.log('已加载屏蔽业务员列表:', parsedBlockedSalesmen)
        }
      } catch (error) {
        console.error('解析保存的屏蔽业务员列表失败:', error)
      }
    }
  }, [])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      // 获取所有客户
      const data = await customerApi.getAll()
      
      if (!Array.isArray(data)) {
        console.error('API返回的数据不是数组:', data);
        message.error('获取客户数据失败: 返回数据格式错误');
        return;
      }
      
      // 过滤出当前施工队的客户
      const teamCustomers = data.filter(customer => 
        customer && typeof customer === 'object' && customer.id &&
        customer.construction_team === user?.email && 
        customer.dispatch_date && 
!(customer as any).deleted_at
      )
      
      setCustomers(teamCustomers)
      setFilteredCustomers(teamCustomers)
    } catch (error) {
      message.error('获取客户数据失败: ' + (error instanceof Error ? error.message : String(error)))
      console.error(error)
    } finally {
      setLoading(false)
    }
  }
  
  // 获取乡镇列表
  const fetchTowns = async () => {
    try {
      // 获取所有客户
      
      // 提取不重复的乡镇
      
      // 无论如何都设置完整的14个乡镇列表
      const defaultTowns = ['舞泉镇', '吴城镇', '北舞渡镇', '莲花镇', '辛安镇', '孟寨镇', '太尉镇', '侯集镇', '九街镇', '文峰乡', '保和乡', '马村乡', '姜店乡', '章化镇']
      setTowns(defaultTowns)
    } catch (error) {
      message.error('获取乡镇列表失败')
      console.error(error)
      // 发生错误时设置默认乡镇
      setTowns(['舞泉镇', '吴城镇', '北舞渡镇', '莲花镇', '辛安镇', '孟寨镇', '太尉镇', '侯集镇', '九街镇', '文峰乡', '保和乡', '马村乡', '姜店乡', '章化镇'])
    }
  }

  const handleSearch = (value: string) => {
    setSearchText(value)
    if (!value.trim()) {
      setFilteredCustomers(customers)
      return
    }

    // 模糊搜索
    const filtered = customers.filter(customer => {
      const searchValue = value.toLowerCase()
      return (
        customer.customer_name?.toLowerCase().includes(searchValue) ||
        customer.phone?.toLowerCase().includes(searchValue) ||
        customer.address?.toLowerCase().includes(searchValue) ||
        customer.id_card?.toLowerCase().includes(searchValue) ||
        (customer.town && customer.town.toLowerCase().includes(searchValue))
      )
    })

    setFilteredCustomers(filtered)
  }
  
  // 处理乡镇选择
  const handleTownChange = (value: string) => {
    setSelectedTown(value);
    // 当选择乡镇后，自动筛选并显示符合条件的客户
    if (value) {
      showAllAvailableCustomers(value);
    } else {
      // 如果清除乡镇选择，显示所有可用客户
      showAllAvailableCustomers();
    }
  }

  // 处理施工队输入
  const handleConstructionTeamChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConstructionTeam(e.target.value)
  }
  
  // 验证验证码
  const validateVerificationCode = async (): Promise<boolean> => {
    try {
      if (!verificationCode) return false;
      
      // 使用API验证验证码 - 不要在这里调用useAuth Hook
      const userName = user ? user.email || user.id || '未知用户' : '未知用户';
      
      const result = await verificationCodeApi.validate(verificationCode, userName);
      
      if (result.valid) {
        // 验证码有效
        setVerificationCodeValid(true);
        setVerificationCodeError('');
        
        // 更新屏蔽业务员列表
        if (result.blockedSalesmen && Array.isArray(result.blockedSalesmen) && result.blockedSalesmen.length > 0) {
          setBlockedSalesmen(result.blockedSalesmen);
          console.log('从验证码获取到屏蔽业务员列表:', result.blockedSalesmen);
        }
        
        return true;
      } else {
        // 验证码无效
        setVerificationCodeValid(false);
        setVerificationCodeError(result.error || '验证码无效');
        return false;
      }
    } catch (error) {
      console.error('验证验证码失败:', error);
      setVerificationCodeValid(false);
      setVerificationCodeError('验证失败，请重试');
      return false;
    }
  };
  
  // 修改处理验证码输入的函数，输入后立即验证
  const handleVerificationCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 获取用户输入的验证码（去除空格）
    const code = e.target.value.trim();
    setVerificationCode(code);
    
    // 清除错误状态
    if (verificationCodeError) {
      setVerificationCodeError('');
    }
    
    // 如果输入长度为4位，则自动验证
    if (code.length === 4) {
      console.log('自动验证验证码:', code);
      
      // 显示验证中状态
      setVerificationCodeError('验证中...');
      
      // 使用setTimeout避免UI阻塞
      setTimeout(async () => {
        const result = await validateVerificationCode();
        if (result) {
          message.success('验证码有效，可以开始抽签');
          setVerificationCodeValid(true);
        }
      }, 500);
    } else {
      setVerificationCodeValid(false);
    }
  };
  
  // 添加一个快速显示所有可用客户的功能
  const showAllAvailableCustomers = async (townFilter?: string) => {
    try {
      setIsDrawing(true);
      message.loading({ content: '正在获取客户数据...', key: 'loading' });
      
      try {
        // 从全部客户中获取符合条件的客户
        const allCustomers = await customerApi.getAll();
        console.log('获取的客户总数:', allCustomers.length);
        
        if (!Array.isArray(allCustomers)) {
          console.error('API返回的数据不是数组:', allCustomers);
          message.error('获取客户数据失败: 返回数据格式错误');
          return;
        }
        
        // 确保所有客户数据都有效 
        const validCustomers = allCustomers.filter(customer => 
          customer && typeof customer === 'object' && customer.id
        );
        
        // 调试信息：打印一些客户数据示例
        if (validCustomers.length > 0) {
          console.log('客户数据示例:', validCustomers[0]);
        }
        
        // 筛选未分配施工队且有方钢出库日期的客户
        let availableCustomers = validCustomers.filter(customer => {
          const hasNoConstructionTeam = !customer.construction_team;
          const hasSquareSteelOutbound = !!customer.square_steel_outbound_date;
          // 检查客户业务员是否在屏蔽列表中
          const isSalesmanBlocked = customer.salesman && blockedSalesmen.includes(customer.salesman);
          
          return hasNoConstructionTeam && hasSquareSteelOutbound && !isSalesmanBlocked;
        });
        
        // 打印屏蔽业务员信息
        if (blockedSalesmen.length > 0) {
          console.log('当前屏蔽业务员:', blockedSalesmen);
          console.log('过滤前客户数:', validCustomers.length, '过滤后客户数:', availableCustomers.length);
        }
        
        // 如果选择了乡镇，进一步筛选该乡镇的客户
        const townToFilter = townFilter || selectedTown;
        if (townToFilter) {
          const filteredByTown = availableCustomers.filter(customer => {
            const town = extractTownFromAddress(customer.address);
            return town === townToFilter;
          });
          
          if (filteredByTown.length > 0) {
            availableCustomers = filteredByTown;
            console.log(`根据乡镇 ${townToFilter} 筛选后剩余客户数量:`, filteredByTown.length);
          } else {
            console.log(`在乡镇 ${townToFilter} 中未找到符合条件的客户`);
            message.info(`在${townToFilter}未找到符合条件的客户`);
            setDrawableCustomers([]);
            message.destroy('loading');
            setIsDrawing(false);
            return;
          }
        }
        
        if (availableCustomers.length === 0) {
          message.info(townToFilter ? `在${townToFilter}未找到可用客户` : '暂无可用客户');
          setDrawableCustomers([]);
          message.destroy('loading');
          setIsDrawing(false);
          return;
        } else {
          // 确保客户数据中包含id字段
          const customersWithIds = availableCustomers.map(customer => ({
            ...customer,
            key: customer.id || `${Math.random()}`
          }));
          setDrawableCustomers(customersWithIds);
          message.success(`找到${customersWithIds.length}个可用客户`);
        }
      } catch (apiError) {
        console.error('API错误:', apiError);
        message.error('API错误: ' + (apiError instanceof Error ? apiError.message : String(apiError)));
      }
      
      message.destroy('loading');
    } catch (error) {
      console.error('获取客户失败:', error);
      message.error('获取客户失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsDrawing(false);
    }
  };

  // 开始抽签
  const handleStartDraw = async () => {
    if (!constructionTeam) {
      message.warning('请输入施工队名称');
      return;
    }
    
    if (!verificationCode) {
      message.warning('请输入验证码');
      return;
    }

    // 验证验证码
    const isCodeValid = await validateVerificationCode();
    if (!isCodeValid) {
      message.error('验证码无效，请向派工员索取正确的验证码');
      return;
    }

    setIsDrawing(true);
    message.loading({ content: '正在查询符合条件的客户...', key: 'loading' });
    
    try {
      // 先检查是否已有符合条件的客户在列表中
      if (drawableCustomers.length > 0) {
        message.success(`已有${drawableCustomers.length}个符合条件的客户`);
        message.destroy('loading');
        
        // 直接执行抽签操作
        message.loading({ content: '正在抽签中...', key: 'drawing' });
        
        // 先显示抽签动画
        setDrawAnimationRunning(true);
        setDrawModalVisible(true);
        
        // 模拟抽签过程（动画效果）
        let count = 0;
        const interval = setInterval(() => {
          const randomIndex = Math.floor(Math.random() * drawableCustomers.length);
          setSelectedCustomer(drawableCustomers[randomIndex]);
          count++;
          
          if (count > 10) {
            clearInterval(interval);
            setDrawAnimationRunning(false);
            
            // 随机选择一个客户
            const randomFinalIndex = Math.floor(Math.random() * drawableCustomers.length);
            const drawnCustomer = drawableCustomers[randomFinalIndex];
            setSelectedCustomer(drawnCustomer);
            
            // 设置派工日期为当前日期并更新客户数据
            performDrawUpdate(drawnCustomer);
          }
        }, 150);
        
        return;
      }
      
      // 如果没有符合条件的客户，重新获取
      // 从全部客户中获取符合条件的客户
      const allCustomers = await customerApi.getAll();
      console.log('获取的客户总数:', allCustomers.length);
      
      // 确保所有客户数据都有效 
      const validCustomers = allCustomers.filter(customer => 
        customer && typeof customer === 'object' && customer.id
      );
      console.log('有效客户数:', validCustomers.length);
      
      // 从localStorage再次获取最新的屏蔽业务员列表
      const savedBlockedSalesmen = localStorage.getItem('blocked_salesmen')
      if (savedBlockedSalesmen) {
        try {
          const parsedBlockedSalesmen = JSON.parse(savedBlockedSalesmen)
          if (Array.isArray(parsedBlockedSalesmen)) {
            setBlockedSalesmen(parsedBlockedSalesmen)
            console.log('已更新屏蔽业务员列表:', parsedBlockedSalesmen)
          }
        } catch (error) {
          console.error('解析保存的屏蔽业务员列表失败:', error)
        }
      }
      
      // 直接使用简化条件筛选客户
      let eligibleCustomers = validCustomers.filter(customer => {
        // 1. 施工队字段为空
        const hasNoConstructionTeam = !customer.construction_team;
        
        // 2. 方钢出库日期存在
        const hasSquareSteelOutbound = !!customer.square_steel_outbound_date;
        
        // 3. 业务员不在屏蔽列表中
        const isSalesmanBlocked = customer.salesman && blockedSalesmen.includes(customer.salesman);
          
        return hasNoConstructionTeam && hasSquareSteelOutbound && !isSalesmanBlocked;
      });
      
      console.log('符合基本条件的客户数量:', eligibleCustomers.length);
      
      // 如果有屏蔽业务员，显示相关信息
      if (blockedSalesmen.length > 0) {
        console.log('当前屏蔽业务员:', blockedSalesmen.join('、'));
      }
      
      // 如果选择了乡镇，进一步筛选该乡镇的客户
      if (selectedTown) {
        const filteredByTown = eligibleCustomers.filter(customer => {
          const town = extractTownFromAddress(customer.address);
          return town === selectedTown;
        });
        
        if (filteredByTown.length > 0) {
          eligibleCustomers = filteredByTown;
          console.log(`根据乡镇 ${selectedTown} 筛选后剩余客户数量:`, filteredByTown.length);
        } else {
          console.log(`在乡镇 ${selectedTown} 中未找到符合条件的客户`);
          message.info(`在${selectedTown}未找到符合条件的客户`);
          setDrawableCustomers([]);
          message.destroy('loading');
          setIsDrawing(false);
          return;
        }
      }
      
      if (eligibleCustomers.length === 0) {
        message.info(selectedTown ? `在${selectedTown}未找到符合条件的客户` : '暂无符合条件的客户');
        setDrawableCustomers([]);
        message.destroy('loading');
        setIsDrawing(false);
        return;
      } else {
        // 确保客户数据中包含id字段，添加key字段避免表格警告
        const customersWithIds = eligibleCustomers.map(customer => ({
          ...customer,
          key: customer.id || `${Math.random()}`
        }));
        setDrawableCustomers(customersWithIds);
        message.success(`找到${customersWithIds.length}个符合条件的客户`);
      }
      
      message.destroy('loading');
      
      // 直接执行抽签操作
      if (eligibleCustomers.length > 0) {
        message.loading({ content: '正在抽签中...', key: 'drawing' });
        
        // 先显示抽签动画
        setDrawAnimationRunning(true);
        setDrawModalVisible(true);
        
        // 模拟抽签过程（动画效果）
        let count = 0;
        const interval = setInterval(() => {
          const randomIndex = Math.floor(Math.random() * eligibleCustomers.length);
          setSelectedCustomer(eligibleCustomers[randomIndex]);
          count++;
          
          if (count > 10) {
            clearInterval(interval);
            setDrawAnimationRunning(false);
            
            // 随机选择一个客户
            const randomFinalIndex = Math.floor(Math.random() * eligibleCustomers.length);
            const drawnCustomer = eligibleCustomers[randomFinalIndex];
            setSelectedCustomer(drawnCustomer);
            
            // 设置派工日期为当前日期并更新客户数据
            performDrawUpdate(drawnCustomer);
          }
        }, 150);
      }
      
    } catch (error) {
      console.error('抽签失败:', error);
      message.error('抽签失败: ' + (error instanceof Error ? error.message : String(error)));
      setIsDrawing(false);
    }
  };
  
  // 执行客户更新
  const performDrawUpdate = async (drawnCustomer: Customer) => {
    try {
      // 获取施工队电话
      let constructionTeamPhone = "";
      
      try {
        // 从施工队列表获取电话
        const teams = await constructionTeamApi.getFromUserRoles();
        if (teams && teams.length > 0) {
          // 查找匹配的施工队信息
          const teamInfo = teams.find(team => team.name === constructionTeam);
          if (teamInfo && teamInfo.phone) {
            constructionTeamPhone = teamInfo.phone;
            console.log(`找到施工队 ${constructionTeam} 的电话: ${constructionTeamPhone}`);
          }
        }
        
        // 如果无法从API获取，使用默认值或备用方案
        if (!constructionTeamPhone) {
          if (constructionTeam === "北城施工队") {
            constructionTeamPhone = "13800138001";
          } else if (constructionTeam === "西城施工队") {
            constructionTeamPhone = "13800138002";
          } else {
            console.log(`未找到施工队 ${constructionTeam} 的电话信息`);
          }
        }
      } catch (error) {
        console.error('获取施工队电话失败:', error);
      }
      
      // 设置派工日期为当前日期
      const now = new Date().toISOString();
      const updateData = {
        construction_team: constructionTeam,
        construction_team_phone: constructionTeamPhone, // 使用获取到的电话
        dispatch_date: now.split('T')[0] // 只获取日期部分 YYYY-MM-DD
      };
      
      // 更新客户数据
      if (drawnCustomer.id) {
        await customerApi.update(drawnCustomer.id, updateData);
        
        // 抽签成功后立即清除验证码，确保验证码只能使用一次
        localStorage.removeItem('dispatch_verification_code');
        localStorage.removeItem('dispatch_verification_code_time');
        
        message.success(`成功抽取客户: ${drawnCustomer.customer_name}`);
        message.destroy('drawing');
      } else {
        message.error('客户ID不存在，无法更新');
      }
      
      // 清空抽签状态并刷新数据
      setVerificationCode('');
      setVerificationCodeValid(false);
      setDrawableCustomers([]);
      fetchCustomers();
      
      // 抽签完成后自动更新显示剩余可用客户
      setTimeout(() => {
        showAllAvailableCustomers();
      }, 1000);
      
    } catch (error) {
      message.error('更新客户数据失败');
      console.error(error);
    } finally {
      setIsDrawing(false);
    }
  };

  // 从地址中提取乡镇名称
  const extractTownFromAddress = (address: string | undefined | null): string | null => {
    // 如果地址为空，直接返回null
    if (!address) return null;
    
    const townNames = [
      '舞泉镇', '吴城镇', '北舞渡镇', '莲花镇', '辛安镇', '孟寨镇', 
      '太尉镇', '侯集镇', '九街镇', '文峰乡', '保和乡', '马村乡', 
      '姜店乡', '章化镇'
    ];
    
    // 先尝试完整匹配
    for (const town of townNames) {
      if (address.includes(town)) {
        return town;
      }
    }
    
    // 如果没有完整匹配，尝试简化匹配
    const simplifiedTownMap: Record<string, string> = {
      '舞泉': '舞泉镇',
      '吴城': '吴城镇',
      '北舞渡': '北舞渡镇',
      '北舞': '北舞渡镇',
      '莲花': '莲花镇',
      '辛安': '辛安镇',
      '孟寨': '孟寨镇',
      '太尉': '太尉镇',
      '侯集': '侯集镇',
      '九街': '九街镇',
      '文峰': '文峰乡',
      '保和': '保和乡',
      '马村': '马村乡',
      '姜店': '姜店乡',
      '章化': '章化镇'
    };
    
    for (const [key, value] of Object.entries(simplifiedTownMap)) {
      if (address.includes(key)) {
        return value;
      }
    }
    
    return null;
  }

  // 抽签客户的表格列定义

  // 表格列定义
  const columns = [
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      fixed: 'left' as const,
      width: 120,
      render: (text: string) => <strong>{text}</strong>,
      sorter: (a: Customer, b: Customer) => a.customer_name.localeCompare(b.customer_name),
    },
    {
      title: '客户电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      render: (text: string) => text ? (
        <a href={`tel:${text}`}><PhoneOutlined /> {text}</a>
      ) : '-',
    },
    {
      title: '客户地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      width: 150,
      render: (text: string) => (
        <Tooltip title={text}>
          <span><HomeOutlined /> {text}</span>
        </Tooltip>
      ),
    },
    {
      title: '业务员',
      dataIndex: 'salesman',
      key: 'salesman',
      width: 120,
    },
    {
      title: '业务员电话',
      dataIndex: 'salesman_phone',
      key: 'salesman_phone',
      width: 120,
    },
    {
      title: '图纸变更',
      dataIndex: 'drawing_change',
      key: 'drawing_change',
      width: 100,
      render: (value: boolean) => value ? <Tag color="red">变更</Tag> : '无',
    },
    {
      title: '组件数量',
      dataIndex: 'module_count',
      key: 'module_count',
      sorter: (a: Customer, b: Customer) => (a.module_count || 0) - (b.module_count || 0),
      width: 120,
    },
    {
      title: '逆变器',
      dataIndex: 'inverter',
      key: 'inverter',
      width: 150,
      ellipsis: true,
    },
    {
      title: '配电箱',
      dataIndex: 'distribution_box',
      key: 'distribution_box',
      width: 100,
    },
    {
      title: '铜线',
      dataIndex: 'copper_wire',
      key: 'copper_wire',
      width: 100,
    },
    {
      title: '铝线',
      dataIndex: 'aluminum_wire',
      key: 'aluminum_wire',
      width: 100,
    },
    {
      title: '组件出库',
      dataIndex: 'component_outbound_date',
      key: 'component_outbound_date',
      width: 150,
      render: (date: string | null) => (
        date ? 
          <Tag color="green">
            {dayjs(date).format('YYYY-MM-DD HH:mm')}
          </Tag> : 
          <Tag color="orange" icon={<ClockCircleOutlined />}>未出库</Tag>
      ),
    },
    {
      title: '派工日期',
      dataIndex: 'dispatch_date',
      key: 'dispatch_date',
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
      width: 120,
    },
    {
      title: '施工状态',
      dataIndex: 'construction_status',
      key: 'construction_status',
      render: (text: boolean, record: Customer) => {
        if (text) {
          return <Tag color="green" icon={<CheckCircleOutlined />}>已完工</Tag>
        }
        
        // 检查是否有催单
        if (record.urge_order) {
          return <Tag color="red" icon={<ClockCircleOutlined />}>催单中</Tag>
        }
        
        return <Tag color="orange" icon={<ClockCircleOutlined />}>未完工</Tag>
      },
      sorter: (a: Customer, b: Customer) => {
        // 催单的排在最前面，然后是未完工，最后是已完工
        const getOrderValue = (customer: Customer) => {
          if (customer.urge_order) return 0
          if (!customer.construction_status) return 1
          return 2
        }
        return getOrderValue(a) - getOrderValue(b)
      },
      width: 120,
    },
    {
      title: '大线',
      dataIndex: 'main_line',
      key: 'main_line',
      width: 100,
    },
    {
      title: '技术审核',
      dataIndex: 'technical_review',
      key: 'technical_review',
      render: (text: string) => text ? <Tag color="green"><ClockCircleOutlined /> {dayjs(text).format('YYYY-MM-DD HH:mm')}</Tag> : '驳回',
      width: 150,
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true,
      width: 150,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 120,
      render: (_: any, record: Customer) => (
        <Button 
          type="primary" 
          icon={<ToolOutlined />} 
          onClick={() => showUpdateModal(record)}
          size="small"
        >
          更新施工状态
        </Button>
      ),
    },
  ]

  const showUpdateModal = (customer: Customer) => {
    setCurrentCustomer(customer)
    form.setFieldsValue({
      construction_status: customer.construction_status,
      construction_date: customer.construction_date ? dayjs(customer.construction_date) : null,
      inverter_brand: customer.inverter_brand || '',
      inverter_model: customer.inverter_model || '',
      inverter_serial: customer.inverter_serial || '',
      construction_notes: customer.construction_notes || ''
    })
    setUpdateModalVisible(true)
  }

  // 提交更新
  const handleUpdateSubmit = async () => {
    try {
      const values = await form.validateFields()
      
      if (!currentCustomer) return
      
      // 转换日期格式
      if (values.construction_date) {
        values.construction_date = values.construction_date.format('YYYY-MM-DD')
      }
      
      // 确保 id 和 email 都有值
      if (!currentCustomer.id) throw new Error('客户ID不能为空')
      await customerApi.update(currentCustomer.id, values)
      message.success('施工状态更新成功')
      setUpdateModalVisible(false)
      fetchCustomers()
    } catch (error) {
      message.error('更新失败')
      console.error(error)
    }
  }

  // 计算统计数据
  const getStatistics = () => {
    const total = customers.length
    const completedCount = customers.filter(c => c.construction_status).length
    const pendingCount = customers.filter(c => !c.construction_status).length
    const urgentCount = customers.filter(c => c.urge_order).length
    
    return { 
      total, 
      completedCount, 
      pendingCount,
      urgentCount
    }
  }

  const stats = getStatistics()

  // 开始抽签按钮点击处理
  const handleDrawButtonClick = () => {
    if (drawableCustomers.length === 0) {
      message.warning('暂无可抽签的客户');
      return;
    }
    
    // 如果验证码还未验证，先进行验证
    if (!verificationCodeValid) {
      validateVerificationCode().then(valid => {
        if (valid) {
          // 验证通过后显示确认对话框
          showDrawConfirmation();
        } else {
          console.log('验证码无效，无法开始抽签');
          message.error('请输入有效的验证码后再开始抽签');
        }
      }).catch(error => {
        console.error('验证验证码时出错:', error);
        message.error('验证码检查失败，请重试');
      });
    } else {
      // 验证码已验证通过，直接显示确认对话框
      showDrawConfirmation();
    }
  };
  
  // 显示抽签确认对话框
  const showDrawConfirmation = () => {
    Modal.confirm({
      title: '确认抽签',
      content: (
        <div>
          <p>您确定要从<strong>"{selectedTown}"</strong>抽取一名客户吗？</p>
          <p>抽中的客户将自动分配给<strong>"{constructionTeam}"</strong>施工队。</p>
          <p style={{ color: '#ff4d4f' }}>注意：本次抽签将使用验证码<strong>"{verificationCode}"</strong>，抽签后验证码将失效！</p>
        </div>
      ),
      okText: '确认抽签',
      cancelText: '取消',
      onOk: handleStartDraw
    });
  };

  return (
    <div className="construction-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={2}>
          <ToolOutlined style={{ marginRight: 12 }} />
          施工工作台
        </Title>
        <Space size="middle">
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchCustomers}
            size="large"
          >
            刷新数据
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff' }}><UserOutlined /> 客户总数</div>} 
              value={stats.total} 
              valueStyle={{ color: '#1890ff', fontSize: '24px' }}
              suffix="户"
            />
            {stats.total > 0 && (
              <Progress percent={100} showInfo={false} status="active" strokeColor="#1890ff" style={{ marginTop: 8 }} />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div style={{ fontSize: '16px', fontWeight: 'bold', color: '#3f8600' }}><CheckCircleOutlined /> 已完工</div>} 
              value={stats.completedCount} 
              valueStyle={{ color: '#3f8600', fontSize: '24px' }}
              suffix="户"
            />
            {stats.total > 0 && (
              <>
                <Progress percent={Math.round(stats.completedCount / stats.total * 100)} strokeColor="#3f8600" style={{ marginTop: 8 }} />
                <div style={{ textAlign: 'center', fontSize: '12px', color: '#3f8600' }}>
                  {Math.round(stats.completedCount / stats.total * 100)}%
                </div>
              </>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1677ff' }}><ToolOutlined /> 施工中</div>} 
              value={stats.pendingCount} 
              valueStyle={{ color: '#1677ff', fontSize: '24px' }}
              suffix="户"
            />
            {stats.total > 0 && (
              <>
                <Progress percent={Math.round(stats.pendingCount / stats.total * 100)} strokeColor="#1677ff" style={{ marginTop: 8 }} />
                <div style={{ textAlign: 'center', fontSize: '12px', color: '#1677ff' }}>
                  {Math.round(stats.pendingCount / stats.total * 100)}%
                </div>
              </>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div style={{ fontSize: '16px', fontWeight: 'bold', color: '#cf1322' }}><ClockCircleOutlined /> 催单中</div>} 
              value={stats.urgentCount} 
              valueStyle={{ color: '#cf1322', fontSize: '24px' }}
              suffix="户"
            />
            {stats.total > 0 && (
              <>
                <Progress percent={Math.round(stats.urgentCount / stats.total * 100)} strokeColor="#cf1322" style={{ marginTop: 8 }} />
                <div style={{ textAlign: 'center', fontSize: '12px', color: '#cf1322' }}>
                  {Math.round(stats.urgentCount / stats.total * 100)}%
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* 抽签设置区域 */}
      <Card style={{ marginBottom: 24, borderRadius: '8px', boxShadow: '0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={4}>抽签设置</Title>
        </div>
        
        <Alert
          message="操作提示"
          description={
            <ol>
              <li>选择一个乡镇后，系统将自动显示该乡镇内符合条件的客户。</li>
              <li>输入施工队名称和验证证码，点击"开始抽签"按钮。</li>
              <li>系统会从已显示的客户中随机抽取一名客户。</li>
              <li>抽中的客户将自动分配给当前施工队，无需额外操作。</li>
            </ol>
          }
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />
        
        <Form layout="inline">
          <Form.Item 
            label={<><EnvironmentOutlined /> 选择乡镇</>} 
            style={{ marginBottom: 16 }}
            validateStatus={selectedTown ? 'success' : undefined}
          >
            <Select
              placeholder="选择乡镇(可选)"
              style={{ width: 200 }}
              value={selectedTown || undefined}
              onChange={handleTownChange}
              disabled={isDrawing}
              allowClear
            >
              {towns.map(town => (
                <Option key={town} value={town}>{town}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item 
            label={<><TeamOutlined /> 施工队</>} 
            required
            style={{ marginBottom: 16 }}
            validateStatus={constructionTeam ? 'success' : undefined}
          >
            <Input
              placeholder="请输入施工队名称"
              style={{ width: 200 }}
              value={constructionTeam}
              onChange={handleConstructionTeamChange}
              disabled={isDrawing}
            />
          </Form.Item>
          
          <Form.Item 
            label={<><KeyOutlined /> 验证码</>} 
            required
            style={{ marginBottom: 16 }}
            validateStatus={verificationCodeError ? 'error' : (verificationCodeValid ? 'success' : undefined)}
            help={verificationCodeError || (verificationCodeValid ? '验证码正确' : undefined)}
          >
            <div style={{ marginBottom: 16 }}>
              <Input
                placeholder="输入验证码"
                value={verificationCode}
                onChange={handleVerificationCodeChange}
                maxLength={4}
                style={{ width: '70%' }}
                status={verificationCodeError ? 'error' : undefined}
                suffix={
                  verificationCodeValid ? 
                    <CheckOutlined style={{ color: '#52c41a' }} /> : 
                    null
                }
              />
              <Button 
                type="primary" 
                onClick={() => validateVerificationCode()}
                disabled={!verificationCode || verificationCode.length !== 4}
                style={{ marginLeft: 8 }}
              >
                验证
              </Button>
            </div>
            {verificationCodeError && (
              <div style={{ color: '#ff4d4f', marginBottom: 16 }}>
                {verificationCodeError}
              </div>
            )}
            {verificationCodeValid && (
              <div style={{ color: '#52c41a', marginBottom: 16 }}>
                验证码有效，可以开始抽签
              </div>
            )}
          </Form.Item>
          
          <Form.Item style={{ marginBottom: 16 }}>
            <Button 
              type="primary" 
              onClick={handleDrawButtonClick}
              loading={isDrawing}
              disabled={!constructionTeam || !verificationCode || !verificationCodeValid || isDrawing}
            >
              开始抽签
            </Button>
          </Form.Item>
        </Form>
        
        <Divider />
        
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={5}>符合条件的客户 ({drawableCustomers.length})</Title>
            {selectedTown && (
              <Tag color="blue">当前筛选: {selectedTown}</Tag>
            )}
          </div>
          
          {isDrawing ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <Spin tip="正在加载数据..." />
            </div>
          ) : drawableCustomers.length > 0 ? (
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {drawableCustomers.map(customer => (
                  <Tag 
                    key={customer.id} 
                    color="blue"
                    style={{ 
                      fontSize: '14px', 
                      padding: '8px 12px', 
                      margin: '4px',
                      borderRadius: '4px'
                    }}
                  >
                    {customer.customer_name || '无名称'}
                  </Tag>
                ))}
              </div>
            </div>
          ) : (
            <Empty description={
              <div>
                {selectedTown ? (
                  <p>在{selectedTown}未找到符合条件的客户</p>
                ) : (
                  <p>暂无符合条件的客户</p>
                )}
                <small style={{color: '#999'}}>
                  请选择不同的乡镇查询
                </small>
              </div>
            } />
          )}
        </div>
      </Card>

      <Card style={{ borderRadius: '8px', boxShadow: '0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09)' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Input
              placeholder="搜索客户姓名、电话、地址等"
              prefix={<SearchOutlined />}
              style={{ width: 300 }}
              value={searchText}
              onChange={e => handleSearch(e.target.value)}
              allowClear
              size="large"
            />
          </Space>
        </div>

        <Divider style={{ margin: '8px 0 16px' }} />

        <Table
          columns={columns}
          dataSource={filteredCustomers}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
          scroll={{ x: 1500, y: 'calc(100vh - 430px)' }}
          rowClassName={(record) => record.construction_status ? 'completed-row' : (record.urge_order ? 'urgent-row' : 'pending-row')}
          size="middle"
          locale={{ emptyText: '' }}
          sticky={true}
          className="custom-table"
        />
      </Card>

      {/* 更新施工状态模态框 */}
      <Modal
        title={
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
            <ToolOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            {currentCustomer?.customer_name ? `更新施工状态 - ${currentCustomer.customer_name}` : '更新施工状态'}
          </div>
        }
        open={updateModalVisible}
        onOk={handleUpdateSubmit}
        onCancel={() => setUpdateModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={520}
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
            name="construction_status"
            label="施工状态"
            valuePropName="checked"
          >
            <Select>
              <Option value={false}>未完工</Option>
              <Option value={true}>已完工</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="construction_date"
            label="施工日期"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="inverter_brand"
            label="逆变器品牌"
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="inverter_model"
            label="逆变器型号"
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="inverter_serial"
            label="逆变器序列号"
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="construction_notes"
            label="施工备注"
          >
            <TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 抽签结果对话框 */}
      <Modal
        title={
          <div style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}>
            <ToolOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            抽签结果
          </div>
        }
        open={drawModalVisible}
        onCancel={() => {
          if (!drawAnimationRunning) {
            setDrawModalVisible(false);
            setSelectedCustomer(null);
          }
        }}
        footer={[
          <Button 
            key="close" 
            type="primary"
            onClick={() => {
              setDrawModalVisible(false);
              setSelectedCustomer(null);
            }}
            disabled={drawAnimationRunning}
          >
            确认
          </Button>
        ]}
        width={500}
        centered
        maskClosable={false}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          {drawAnimationRunning ? (
            <>
              <div style={{ fontSize: '18px', marginBottom: '20px' }}>正在抽签中...</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff', marginBottom: '20px' }}>
                {selectedCustomer?.customer_name || ''}
              </div>
            </>
          ) : selectedCustomer ? (
            <>
              <div style={{ fontSize: '18px', marginBottom: '20px' }}>恭喜抽中客户：</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1890ff', marginBottom: '30px' }}>
                {selectedCustomer.customer_name || '未知客户'}
              </div>
              <div style={{ fontSize: '16px', marginBottom: '10px' }}>
                <PhoneOutlined style={{ marginRight: 8 }} /> 
                电话：{selectedCustomer.phone || '无'}
              </div>
              <div style={{ fontSize: '16px', marginBottom: '10px' }}>
                <HomeOutlined style={{ marginRight: 8 }} /> 
                地址：{selectedCustomer.address || '无'}
              </div>
              <div style={{ fontSize: '16px', marginBottom: '20px' }}>
                <EnvironmentOutlined style={{ marginRight: 8 }} /> 
                乡镇：{extractTownFromAddress(selectedCustomer.address) || '无'}
              </div>
              
              <div style={{ backgroundColor: '#f6ffed', padding: '10px', borderRadius: '4px', fontSize: '14px', color: '#389e0d' }}>
                <CheckCircleOutlined style={{ marginRight: 8 }} />
                验证码已使用并失效，下次抽签需要重新获取验证码
              </div>
            </>
          ) : (
            <div style={{ fontSize: '18px' }}>暂无抽签结果</div>
          )}
        </div>
      </Modal>

      <style>
        {`
          .construction-dashboard .ant-card {
            transition: all 0.3s;
          }
          .construction-dashboard .ant-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 2px 10px rgba(0,0,0,0.12);
          }
          .completed-row {
            background-color: #f6ffed;
          }
          .completed-row:hover > td {
            background-color: #d9f7be !important;
          }
          .pending-row {
            background-color: #e6f7ff;
          }
          .pending-row:hover > td {
            background-color: #bae7ff !important;
          }
          .urgent-row {
            background-color: #fff1f0;
          }
          .urgent-row:hover > td {
            background-color: #ffccc7 !important;
          }
          .custom-table .ant-table-thead > tr > th {
            background-color: #f0f5ff !important;
            color: #1890ff;
            font-weight: bold;
          }
          .custom-table .ant-table-thead > tr > th.ant-table-column-sort {
            background-color: #e6f7ff !important;
          }
          .custom-table .ant-table-tbody > tr.ant-table-row:hover > td {
            transition: background-color 0.3s;
          }
          .custom-table .ant-table-body::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          .custom-table .ant-table-body::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
          }
          .custom-table .ant-table-body::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 4px;
          }
          .custom-table .ant-table-body::-webkit-scrollbar-thumb:hover {
            background: #a1a1a1;
          }
          
          /* 确保表格内容显示正确 */
          .ant-table-cell {
            word-break: break-all;
            white-space: normal;
          }
          
          /* 确保符合条件的客户表格显示正确 */
          .ant-empty-image {
            height: 60px;
          }
          
          .ant-table-placeholder .ant-table-cell {
            border-bottom: none;
          }
        `}
      </style>
    </div>
  )
}

export default ConstructionTeamDashboard