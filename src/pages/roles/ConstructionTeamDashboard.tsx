import { useState, useEffect, useRef } from 'react'
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
  CheckOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import { customerApi, constructionTeamApi, verificationCodeApi } from '../../services/api'
import { Customer } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import dayjs from 'dayjs'
import Draggable from 'react-draggable'
import { supabase } from '../../services/supabase'

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

// 添加图纸变更选项
const DRAWING_CHANGE_OPTIONS = [
  { value: '未出图', label: '未出图', color: 'default' },
  { value: '变更1', label: '变更1', color: 'blue' },
  { value: '变更2', label: '变更2', color: 'purple' },
  { value: '变更3', label: '变更3', color: 'orange' },
  { value: '变更4', label: '变更4', color: 'red' },
  { value: '变更5', label: '变更5', color: 'volcano' },
];

const ConstructionTeamDashboard = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef<any>(null) // 修改类型为any以兼容InputRef
  const lastSearchTermRef = useRef<string>('')
  const [updateModalVisible, setUpdateModalVisible] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null)
  const [form] = Form.useForm()
  const { user } = useAuth()
  // 添加搜索防抖计时器引用
  
  // 抽签相关状态
  const [selectedTown, setSelectedTown] = useState<string>('')
  const [constructionTeam, setConstructionTeam] = useState<string>('')
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [drawModalVisible, setDrawModalVisible] = useState<boolean>(false)
  const [drawAnimationRunning, setDrawAnimationRunning] = useState<boolean>(false)
  // 添加编辑状态变量
  const [editingKey, setEditingKey] = useState<string>('')
  const [editingField, setEditingField] = useState<string>('')
  const [editForm] = Form.useForm()

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
      
      // 首先检查用户信息
      const currentUserEmail = user?.email || '';
      console.log('当前用户邮箱:', currentUserEmail);
      
      // 查询当前用户名称（作为施工队名称匹配）
      let currentTeamName = '';
      try {
        // 先从localStorage中获取缓存的施工队名称
        const cachedTeamName = localStorage.getItem('construction_team_name');
        if (cachedTeamName) {
          currentTeamName = cachedTeamName;
          console.log('从缓存获取到的施工队名称:', currentTeamName);
        } else {
          // 尝试从用户角色表中获取施工队名称
          const { data: userRoleData } = await supabase
            .from('user_roles')
            .select('name')
            .eq('user_id', user?.id)
            .eq('role', 'construction_team')
            .single();
            
          if (userRoleData && userRoleData.name) {
            currentTeamName = userRoleData.name;
            // 缓存施工队名称以提高性能
            localStorage.setItem('construction_team_name', currentTeamName);
            console.log('从数据库获取到的施工队名称:', currentTeamName);
          }
        }
      } catch (error) {
        console.error('获取施工队名称失败:', error);
      }
      
      // 过滤出当前施工队的客户（多种匹配方式，确保能找到对应客户）
      const teamCustomers = data.filter(customer => {
        if (!customer || typeof customer !== 'object' || !customer.id) {
          return false;
        }
        
        // 判断客户是否被删除
        if ((customer as any).deleted_at) {
          return false;
        }
        
        // 确保客户已经被派工
        if (!customer.dispatch_date) {
          return false;
        }
        
        // 多种匹配方式
        // 注意：Customer类型中可能没有construction_team_email字段
        // 尝试使用类型断言来访问可能存在的字段，避免类型错误
        const matchByEmail = (customer as any).construction_team_email === currentUserEmail;
        
        // 用当前登录的施工队账号邮箱与客户表中的施工队字段进行比较
        const matchByName = currentTeamName && customer.construction_team === currentTeamName;
        
        // 匹配用户邮箱与施工队名称（有些施工队可能直接用邮箱作为名称）
        const matchEmailAsName = customer.construction_team === currentUserEmail;
        
        // 如果有施工队名称，进行额外日志输出
        if (currentTeamName && customer.construction_team === currentTeamName) {
          console.log(`匹配到施工队名称 ${currentTeamName} 的客户: ${customer.customer_name}`);
        }
        
        // 满足任一条件即匹配成功
        return matchByEmail || matchByName || matchEmailAsName;
      });
      
      console.log(`找到当前施工队的客户数量: ${teamCustomers.length}`);
      if (teamCustomers.length > 0) {
        console.log('客户示例:', teamCustomers[0].customer_name, '施工队:', teamCustomers[0].construction_team);
      } else {
        console.log('未找到匹配的客户');
        console.log('当前用户Email:', currentUserEmail);
        console.log('当前施工队名称:', currentTeamName);
      }
      
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

  // 删除旧的搜索函数，实现新的搜索功能
  const handleSearch = (value: string) => {
    // 直接更新搜索框的值，不触发搜索
    setSearchText(value)
    
    // 如果输入为空，显示所有客户
    if (!value.trim()) {
      setFilteredCustomers(customers)
      return
    }
  }
  
  // 处理搜索按钮点击或回车键
  const executeSearch = () => {
    // 如果搜索文本和上次搜索相同，避免重复搜索
    if (searchText.trim() === lastSearchTermRef.current) {
      return
    }
    
    // 如果搜索文本为空，显示所有客户
    if (!searchText.trim()) {
      setFilteredCustomers(customers)
      return
    }
    
    // 标记搜索状态开始
    setSearchLoading(true)
    
    // 使用setTimeout使界面响应更流畅
    setTimeout(() => {
      try {
        // 将搜索文本按空格或逗号分割成关键词
        const keywords = searchText.toLowerCase().split(/[\s,，]+/).filter(k => k.trim() !== '')
        
        // 如果没有有效关键词，显示所有客户
        if (keywords.length === 0) {
          setFilteredCustomers(customers)
          setSearchLoading(false)
          return
        }
        
        console.log('搜索关键词:', keywords, '客户总数:', customers.length)
        
        // 创建匹配函数：检查字段是否包含某个关键词
        const matchesKeyword = (value: any, keyword: string): boolean => {
          if (value === null || value === undefined) return false
          return String(value).toLowerCase().includes(keyword)
        }
        
        // 对每个客户遍历搜索关键词
        const results = customers.filter(customer => {
          // 为提高性能，对每个关键词，一旦找到匹配就返回true
          return keywords.some(keyword => {
            // 检查客户各字段是否匹配关键词
            return (
              matchesKeyword(customer.customer_name, keyword) ||
              matchesKeyword(customer.phone, keyword) ||
              matchesKeyword(customer.address, keyword) ||
              matchesKeyword(customer.id_card, keyword) ||
              matchesKeyword(customer.town, keyword) ||
              matchesKeyword(customer.construction_team, keyword) ||
              matchesKeyword(customer.salesman, keyword) ||
              matchesKeyword(customer.salesman_phone, keyword) ||
              matchesKeyword(customer.main_line, keyword) ||
              matchesKeyword(customer.remarks, keyword) ||
              matchesKeyword(customer.construction_notes, keyword) ||
              matchesKeyword(customer.inverter_brand, keyword) ||
              matchesKeyword(customer.inverter_model, keyword) ||
              matchesKeyword(customer.inverter_serial, keyword) ||
              matchesKeyword(customer.drawing_change, keyword)
            )
          })
        })
        
        console.log(`搜索结果: ${results.length}条记录`)
        setFilteredCustomers(results)
        
        // 保存本次搜索关键词，用于避免重复搜索
        lastSearchTermRef.current = searchText.trim()
        
        // 如果没有搜索结果，显示提示
        if (results.length === 0 && keywords.length > 0) {
          message.info(`未找到匹配"${searchText}"的客户`)
        }
      } catch (error) {
        console.error('搜索出错:', error)
        message.error('搜索出错，请稍后重试')
      } finally {
        // 标记搜索状态结束
        setSearchLoading(false)
      }
    }, 0) // 使用0延迟，让UI更新先执行
  }
  
  // 按Enter键触发搜索
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeSearch()
    }
  }
  
  // 清除搜索
  const handleClearSearch = () => {
    setSearchText('')
    setFilteredCustomers(customers)
    lastSearchTermRef.current = ''
    // 聚焦回搜索框
    if (searchRef.current) {
      searchRef.current.focus()
    }
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
  
  // 验证验证码，但不标记为已使用
  const validateVerificationCode = async (): Promise<boolean> => {
    try {
      if (!verificationCode || verificationCode.length !== 4) {
        console.error('验证码不完整或格式不正确:', verificationCode);
        setVerificationCodeError('验证码必须是4位数字');
        return false;
      }
      
      // 直接使用输入框的验证码（已确保是4位字符串）
      console.log('验证前的验证码:', verificationCode);
      
      // 使用API验证验证码但不标记为已使用
      const result = await verificationCodeApi.validateOnly(verificationCode);
      
      console.log('验证结果:', result);
      
      if (result.valid) {
        // 验证码有效
        setVerificationCodeValid(true);
        setVerificationCodeError('');
        
        // 保存验证码ID以便后续使用
        localStorage.setItem('temp_verification_code_id', result.codeId);
        
        // 更新屏蔽业务员列表
        if (result.blockedSalesmen && Array.isArray(result.blockedSalesmen) && result.blockedSalesmen.length > 0) {
          setBlockedSalesmen(result.blockedSalesmen);
          console.log('从验证码获取到屏蔽业务员列表:', result.blockedSalesmen);
          // 在console中显示屏蔽的业务员
          console.log('已屏蔽业务员:', result.blockedSalesmen.join('、'));
          // 在用户界面提示已屏蔽的业务员
          if (result.blockedSalesmen.length > 0) {
            message.info(`当前验证码包含${result.blockedSalesmen.length}个被屏蔽的业务员，其客户将不会出现在抽签列表中`);
          }
        }
        
        return true;
      } else {
        // 验证码无效
        setVerificationCodeValid(false);
        setVerificationCodeError(result.error || '验证码无效，验证码有效期为24小时');
        return false;
      }
    } catch (error) {
      console.error('验证验证码失败:', error);
      setVerificationCodeValid(false);
      setVerificationCodeError('验证失败，请重试');
      return false;
    }
  };
  
  // 验证码输入处理函数
  const handleVerificationCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 获取用户输入的验证码（去除空格和非数字字符）
    const rawInput = e.target.value;
    // 只保留数字部分
    const numericInput = rawInput.replace(/\D/g, '');
    // 截取最多4位数字
    const code = numericInput.slice(0, 4);
    
    // 更新输入框值
    setVerificationCode(code);
    
    // 如果清空了输入，重置所有状态
    if (code.length === 0) {
      setVerificationCodeValid(false);
      setVerificationCodeError('');
      return;
    }
    
    // 如果验证码长度不足4位，不进行验证，清除错误信息
    if (code.length < 4) {
      setVerificationCodeValid(false);
      if (verificationCodeError) {
        setVerificationCodeError('');
      }
      return;
    }
    
    // 只有当验证码长度等于4位时才自动验证
    if (code.length === 4) {
      // 不显示"验证中..."
      setVerificationCodeError('');
      
      // 使用setTimeout避免UI阻塞，确保验证码状态已经完全更新
      setTimeout(async () => {
        try {
          // 使用局部变量code而不是状态值verificationCode，以避免状态更新延迟问题
          // 使用API验证验证码但不标记为已使用
          const result = await verificationCodeApi.validateOnly(code);
          
          if (result.valid) {
            // 验证码有效，但不显示提示信息
            setVerificationCodeValid(true);
            setVerificationCodeError('');
            
            // 保存验证码ID以便后续使用
            localStorage.setItem('temp_verification_code_id', result.codeId);
            
            // 更新屏蔽业务员列表
            if (result.blockedSalesmen && Array.isArray(result.blockedSalesmen) && result.blockedSalesmen.length > 0) {
              setBlockedSalesmen(result.blockedSalesmen);
              console.log('自动验证时从验证码获取到屏蔽业务员列表:', result.blockedSalesmen);
              // 在用户界面提示已屏蔽的业务员
              if (result.blockedSalesmen.length > 0) {
                message.info(`当前验证码屏蔽了${result.blockedSalesmen.length}个业务员的客户`);
              }
            }
          } else {
            // 验证码无效，只显示一次错误信息
            setVerificationCodeValid(false);
            setVerificationCodeError(result.error || '验证码无效');
          }
        } catch (error) {
          console.error('验证验证码失败:', error);
          setVerificationCodeValid(false);
          setVerificationCodeError('验证失败，请重试');
        }
      }, 200);
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
        
        // 获取最新的屏蔽业务员列表（来自验证码或localStorage）
        // 这确保我们使用最新的屏蔽列表
        let currentBlockedSalesmen = [...blockedSalesmen]; // 使用当前状态的复制
        console.log('当前屏蔽业务员列表:', currentBlockedSalesmen);
        
        // 筛选未分配施工队且有方钢出库日期的客户
        let availableCustomers = validCustomers.filter(customer => {
          // 1. 施工队字段为空
          const hasNoConstructionTeam = !customer.construction_team;
          
          // 2. 方钢出库日期存在
          const hasSquareSteelOutbound = !!customer.square_steel_outbound_date;
          
          // 3. 业务员不在屏蔽列表中
          const isSalesmanBlocked = customer.salesman && currentBlockedSalesmen.includes(customer.salesman);
          
          // 满足所有条件：未分配施工队 + 有方钢出库 + 业务员未被屏蔽
          const isEligible = hasNoConstructionTeam && hasSquareSteelOutbound && !isSalesmanBlocked;
          
          // 调试信息：如果客户被屏蔽，记录原因
          if (!isEligible && isSalesmanBlocked) {
            console.log(`客户 ${customer.customer_name} 被屏蔽，业务员: ${customer.salesman}`);
          }
          
          return isEligible;
        });
        
        // 打印屏蔽业务员信息
        if (currentBlockedSalesmen.length > 0) {
          console.log('当前屏蔽业务员:', currentBlockedSalesmen.join('、'));
          console.log(`过滤前客户数: ${validCustomers.length}, 过滤后客户数: ${availableCustomers.length}`);
          // 计算因屏蔽业务员而被过滤掉的客户数量
          const blockedCount = validCustomers.filter(c => 
            c.salesman && currentBlockedSalesmen.includes(c.salesman) && 
            !c.construction_team && !!c.square_steel_outbound_date
          ).length;
          console.log(`因业务员屏蔽被过滤掉的客户数: ${blockedCount}`);
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
          // 显示抽签结果，包括屏蔽信息
          if (currentBlockedSalesmen.length > 0) {
            message.success(`找到${customersWithIds.length}个可用客户（已屏蔽${currentBlockedSalesmen.length}个业务员的客户）`);
          } else {
            message.success(`找到${customersWithIds.length}个可用客户`);
          }
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
      message.error('验证码无效，请向派工员索取正确的验证码，验证码有效期为24小时');
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
      // let constructionTeamEmail = ""; // 删除施工队邮箱字段
      
      try {
        // 从施工队列表获取电话
        const teams = await constructionTeamApi.getFromUserRoles();
        if (teams && teams.length > 0) {
          // 查找匹配的施工队信息
          const teamInfo = teams.find(team => team.name === constructionTeam);
          if (teamInfo) {
            if (teamInfo.phone) {
              constructionTeamPhone = teamInfo.phone;
              console.log(`找到施工队 ${constructionTeam} 的电话: ${constructionTeamPhone}`);
            }
            
            // 不再使用施工队邮箱字段
            // constructionTeamEmail = user?.email || '';
            // console.log(`使用当前用户邮箱作为施工队账号: ${constructionTeamEmail}`);
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
        
        // 不再使用施工队邮箱
        // 确保有施工队邮箱，使用当前登录用户邮箱作为施工队账号标识
        // if (!constructionTeamEmail && user?.email) {
        //   constructionTeamEmail = user.email;
        //   console.log(`使用当前用户邮箱作为施工队账号: ${constructionTeamEmail}`);
        // }
      } catch (error) {
        console.error('获取施工队信息失败:', error);
        // 如果获取失败，尝试使用当前登录用户的邮箱
        // if (user?.email) {
        //   constructionTeamEmail = user.email;
        //   console.log(`使用当前用户邮箱作为施工队账号: ${constructionTeamEmail}`);
        // }
      }
      
      // 设置派工日期为当前日期
      const now = new Date().toISOString();
      const updateData = {
        construction_team: constructionTeam,
        construction_team_phone: constructionTeamPhone,
        // construction_team_email: constructionTeamEmail, // 删除不存在的字段
        dispatch_date: now.split('T')[0], // 只获取日期部分 YYYY-MM-DD
        updated_at: now // 更新时间
        // 移除数据库中不存在的字段
        // assigned_at: now, // 添加分配时间，方便后续查询
        // assigned_by: user?.email || user?.id || '未知用户' // 记录谁执行的分配操作
      };
      
      console.log('更新客户数据:', updateData);
      
      // 先标记验证码为已使用，确保验证码只能使用一次
      try {
        // 抽签成功后，标记验证码为已使用
        const verificationCodeId = localStorage.getItem('temp_verification_code_id');
        if (verificationCodeId) {
          const userName = user ? user.email || user.id || '未知用户' : '未知用户';
          console.log('正在标记验证码为已使用, ID:', verificationCodeId);
          const markResult = await verificationCodeApi.markAsUsed(verificationCodeId, userName);
          
          if (markResult.success) {
            console.log('验证码已标记为已使用');
            // 清除临时存储的验证码ID
            localStorage.removeItem('temp_verification_code_id');
            // 重置验证码状态
            setVerificationCode('');
            setVerificationCodeValid(false);
          } else {
            console.error('标记验证码为已使用失败:', markResult.error);
          }
        } else {
          console.warn('未找到验证码ID，无法标记为已使用');
        }
      } catch (markCodeError) {
        console.error('标记验证码为已使用出错:', markCodeError);
      }
      
      // 更新客户数据
      if (drawnCustomer.id) {
        try {
          await customerApi.update(drawnCustomer.id, updateData);
          message.success(`成功抽取客户: ${drawnCustomer.customer_name}，已分配给施工队: ${constructionTeam}`);
          message.destroy('drawing');
        } catch (updateError) {
          console.error('更新客户数据失败:', updateError);
          message.error('更新客户数据失败: ' + (updateError instanceof Error ? updateError.message : String(updateError)));
        }
      } else {
        message.error('客户ID不存在，无法更新');
      }
      
      // 清空抽签状态并刷新数据
      setDrawableCustomers([]);
      fetchCustomers();
      
      // 抽签完成后自动更新显示剩余可用客户
      setTimeout(() => {
        showAllAvailableCustomers();
      }, 1000);
      
    } catch (error) {
      console.error('更新客户数据失败:', error);
      message.error('更新客户数据失败: ' + (error instanceof Error ? error.message : String(error)));
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

  // 添加判断是否处于编辑状态的方法
  const isEditing = (record: Customer, field: string) => {
    return record.id === editingKey && field === editingField
  }

  // 添加开始编辑方法
  const startEdit = (record: Customer, field: string) => {
    editForm.setFieldsValue({ [field]: (record as any)[field] || '' })
    setEditingKey(record.id || '')
    setEditingField(field)
  }

  // 添加取消编辑方法
  const cancelEdit = () => {
    setEditingKey('')
    setEditingField('')
  }

  // 添加保存编辑方法
  const saveEdit = async (id: string, field: string) => {
    try {
      const value = await editForm.validateFields()
      const newValue = value[field]
      
      // 更新数据
      await customerApi.update(id, { [field]: newValue })
      message.success('更新成功')
      
      // 刷新本地数据
      const updatedCustomers = customers.map(item => {
        if (item.id === id) {
          return { ...item, [field]: newValue } as Customer
        }
        return item
      })
      setCustomers(updatedCustomers)
      
      // 同时更新过滤后的客户列表
      const updatedFilteredCustomers = filteredCustomers.map(item => {
        if (item.id === id) {
          return { ...item, [field]: newValue } as Customer
        }
        return item
      })
      setFilteredCustomers(updatedFilteredCustomers)
      
      // 结束编辑状态
      cancelEdit()
    } catch (error) {
      message.error('更新失败')
      console.error('编辑失败:', error)
    }
  }

  // 添加可编辑单元格组件
  const EditableCell = ({ value, record, dataIndex }: { 
    value: any 
    record: Customer
    dataIndex: string
    title: string
  }) => {
    const editable = isEditing(record, dataIndex)
    const [hover, setHover] = useState(false)
    
    return editable ? (
      <Form 
        form={editForm} 
        initialValues={{ [dataIndex]: value }}
        style={{ margin: 0 }}
      >
        <Form.Item
          name={dataIndex}
          style={{ margin: 0 }}
        >
          <Input 
            autoFocus 
            onPressEnter={() => record.id && saveEdit(record.id, dataIndex)}
            onBlur={() => record.id && saveEdit(record.id, dataIndex)}
          />
        </Form.Item>
      </Form>
    ) : (
      <div 
        style={{ 
          padding: '4px 0',
          borderRadius: 4,
          cursor: 'pointer',
          background: hover ? '#f0f5ff' : 'transparent',
          minHeight: '24px' 
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => record.id && startEdit(record, dataIndex)}
      >
        {value ? (
          <span>{value}</span>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        )}
      </div>
    )
  }

  // 表格列定义
  const columns = [
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 140,
      fixed: 'left' as const,
      render: (text: string) => (
        <Tooltip title={text}>
          <span className="customer-name">{text || '未知客户'}</span>
        </Tooltip>
      )
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
      render: (text: string) => text ? (
        <a href={`tel:${text}`}><PhoneOutlined /> {text}</a>
      ) : '-',
    },
    {
      title: '图纸变更',
      dataIndex: 'drawing_change',
      key: 'drawing_change',
      width: 120,
      align: 'center' as const,
      render: (value: any) => {
        // 处理布尔值转为字符串
        let textValue = value;
        if (value === true) {
          textValue = '变更1';
        } else if (value === false) {
          textValue = '未出图';
        } else if (value === null || value === undefined) {
          textValue = '未出图';
        }
        
        // 获取当前选项，默认为"未出图"
        const option = DRAWING_CHANGE_OPTIONS.find(o => o.value === textValue) || DRAWING_CHANGE_OPTIONS[0];
        
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
        const valA = typeof a.drawing_change === 'string' ? a.drawing_change : (a.drawing_change === true ? '变更1' : '未出图');
        const valB = typeof b.drawing_change === 'string' ? b.drawing_change : (b.drawing_change === true ? '变更1' : '未出图');
        return valA.localeCompare(valB);
      },
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
      width: 120,
      render: (text: any, record: Customer) => {
        if (text === true) {
          return <Tag color="green">已完工</Tag>
        }
        
        if (text && typeof text === 'string') {
          return (
            <Tag color="green">
              {dayjs(text).format('YYYY-MM-DD HH:mm')}
            </Tag>
          )
        }
        
        // 检查是否有催单
        if (record.urge_order) {
          return <Tag color="red">催单中</Tag>
        }
        
        return (
          <Button 
            type="primary"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleUpdateConstructionDate(record);
            }}
          >
            未完工
          </Button>
        )
      },
      sorter: (a: Customer, b: Customer) => {
        // 排序逻辑：先考虑施工状态
        const aStatus = a.construction_status;
        const bStatus = b.construction_status;
        
        if (!aStatus && !bStatus) return 0;
        if (!aStatus) return 1;
        if (!bStatus) return -1;
        
        // 如果都是日期字符串，按日期排序
        if (typeof aStatus === 'string' && typeof bStatus === 'string') {
          return new Date(aStatus).getTime() - new Date(bStatus).getTime();
        }
        
        return 0;
      }
    },
    {
      title: '大线',
      dataIndex: 'main_line',
      key: 'main_line',
      width: 120,
      render: (value: string, record: Customer) => (
        <EditableCell 
          value={value} 
          record={record} 
          dataIndex="main_line" 
          title="大线" 
        />
      )
    },
    {
      title: '技术审核',
      dataIndex: 'technical_review',
      key: 'technical_review',
      width: 150,
      render: (text: string) => {
        if (!text) return '-';
        return <Tag color="green" icon={<CheckCircleOutlined />}>{dayjs(text).format('YYYY-MM-DD')}</Tag>;
      }
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 150,
      ellipsis: true,
      render: (value: string, record: Customer) => (
        <EditableCell 
          value={value} 
          record={record} 
          dataIndex="remarks" 
          title="备注" 
        />
      )
    },
  ]

  // eslint-disable-next-line @typescript-eslint/no-unused-vars

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
  
  // 处理施工状态更新时间戳
  const handleUpdateConstructionDate = async (customer: Customer) => {
    try {
      if (!customer.id) {
        message.error('客户ID不存在，无法更新状态');
        return;
      }
      
      // 生成当前时间戳
      const currentDatetime = dayjs().format('YYYY-MM-DD HH:mm:ss');
      
      // 更新客户施工状态
      await customerApi.update(customer.id, {
        construction_status: currentDatetime
      });
      
      message.success('已更新施工状态');
      
      // 刷新客户数据
      fetchCustomers();
      // 清空当前选中的客户
      setCurrentCustomer(null);
    } catch (error) {
      console.error('更新施工状态失败:', error);
      message.error('更新施工状态失败');
    }
  };

  // 开始抽签按钮点击处理
  const handleDrawButtonClick = () => {
    if (drawableCustomers.length === 0) {
      message.warning('暂无可抽签的客户');
      return;
    }
    
    // 如果验证码有效，直接显示确认对话框，不再重复验证
    if (verificationCodeValid) {
      showDrawConfirmation();
    } else {
      // 验证码未验证通过，先进行验证
      validateVerificationCode().then(valid => {
        if (valid) {
          // 验证通过后显示确认对话框
          showDrawConfirmation();
        } else {
          console.log('验证码无效，无法开始抽签');
          message.error('请输入有效的验证码后再开始抽签，验证码有效期为24小时');
        }
      }).catch(error => {
        console.error('验证验证码时出错:', error);
        message.error('验证码检查失败，请重试');
      });
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
            help={verificationCodeError ? verificationCodeError : ''}
          >
            <div style={{ marginBottom: 16 }}>
              <Input
                placeholder="输入验证码"
                value={verificationCode}
                onChange={handleVerificationCodeChange}
                maxLength={4}
                style={{ width: '100%' }}
                status={verificationCodeError ? 'error' : verificationCodeValid ? undefined : undefined}
                suffix={
                  <span style={{ visibility: verificationCodeValid ? 'visible' : 'hidden' }}>
                    <CheckOutlined style={{ color: '#52c41a' }} />
                  </span>
                }
              />
            </div>
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

      <Card style={{ borderRadius: '8px', boxShadow: '0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09)', marginBottom: 0 }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Input
              ref={searchRef}
              placeholder="搜索客户姓名、电话、地址等 (多关键词用空格或逗号分隔)"
              prefix={<SearchOutlined />}
              style={{ width: 380 }}
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              allowClear
              size="large"
              disabled={searchLoading}
              suffix={
                searchText ? (
                  <CloseCircleOutlined 
                    onClick={handleClearSearch}
                    style={{ cursor: 'pointer', color: 'rgba(0, 0, 0, 0.45)' }}
                  />
                ) : null
              }
            />
            <Button 
              type="primary"
              icon={<SearchOutlined />}
              onClick={executeSearch}
              loading={searchLoading}
            >
              搜索
            </Button>
            {filteredCustomers.length < customers.length && (
              <Button 
                type="default"
                onClick={handleClearSearch}
              >
                显示全部
              </Button>
            )}
          </Space>
          <span style={{ color: '#1890ff' }}>
            共 {filteredCustomers.length} 条记录
            {filteredCustomers.length < customers.length && ` (总共 ${customers.length} 条)`}
          </span>
        </div>

        <Divider style={{ margin: '8px 0 16px' }} />

        <Table
          columns={columns}
          dataSource={filteredCustomers}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 1500, y: 'calc(100vh - 350px)' }}
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
            name="main_line"
            label="大线"
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="remarks"
            label="备注"
          >
            <TextArea rows={2} />
          </Form.Item>
          
          <Form.Item
            name="construction_notes"
            label="施工备注"
          >
            <TextArea rows={3} />
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
          }
          .completed-row:hover > td {
            background-color: #d9f7be !important;
          }
          .pending-row {
          }
          .pending-row:hover > td {
            background-color: #bae7ff !important;
          }
          .urgent-row {
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
          .custom-table .ant-table-cell-fix-right {
            background: #fff !important;
            z-index: 5;
          }
          .custom-table .ant-table-thead .ant-table-cell-fix-right {
            background: #fafafa !important;
            z-index: 5;
          }
          .custom-table .ant-table-cell-fix-left {
            background: #fff !important;
            z-index: 5;
          }
          .custom-table .ant-table-thead .ant-table-cell-fix-left {
            background: #fafafa !important;
            z-index: 5;
          }
          
          /* 确保表格内容显示正确 */
          .ant-table-cell {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          /* 确保符合条件的客户表格显示正确 */
          .ant-empty-image {
            height: 60px;
          }
          
          .ant-table-placeholder .ant-table-cell {
            border-bottom: none;
          }
          
          /* 确保最后一行完整显示 */
          .custom-table .ant-table-body {
            flex: 1;
            overflow-y: scroll !important;
            overflow-x: auto !important;
            height: auto !important;
            max-height: calc(100vh - 350px) !important;
            padding-bottom: 0;
          }
          
          /* 增加表格容器高度 */
          .custom-table {
            margin-bottom: 0;
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
          .custom-table .ant-table-body::-webkit-scrollbar-horizontal {
            display: block !important;
          }
          
          /* 主容器样式 */
          .construction-dashboard {
            padding-bottom: 0;
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          
          /* 备注单元格样式 */
          .remarks-cell {
            display: inline-block;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: rgba(0, 0, 0, 0.65);
          }
        `}
      </style>
    </div>
  )
}

export default ConstructionTeamDashboard