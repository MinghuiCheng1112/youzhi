import { useState, useEffect } from 'react'
import { Table, Card, Input, Button, Typography, Space, message, Tag, Modal, Form, Select, DatePicker, Statistic, Row, Col, Divider, Progress, Alert } from 'antd'
import { SearchOutlined, ReloadOutlined, ExportOutlined, SendOutlined, KeyOutlined, DashboardOutlined, CheckOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { customerApi, constructionTeamApi, verificationCodeApi } from '../../services/api'
import { Customer } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import Draggable from 'react-draggable'
import { supabase } from '../../services/supabaseClient'

const { Title } = Typography
const { Option } = Select

// 卡片样式
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

// 定义抽签记录接口
interface DrawRecord {
  id: string
  customer_id: string
  township: string
  random_code: string
  construction_team: string
  draw_date: string
  drawn_by: string
}

const DispatchManagerDashboard = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [dispatchModalVisible, setDispatchModalVisible] = useState(false)
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null)
  const [constructionTeams, setConstructionTeams] = useState<string[]>([])
  const [form] = Form.useForm()
  const [stats, setStats] = useState({
    totalOutbound: 0,
    dispatched: 0,
    pendingDispatch: 0,
    urgeOrderCount: 0
  })
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [codeVisible, setCodeVisible] = useState<boolean>(false)
  const [, setDrawRecords] = useState<DrawRecord[]>([])
  const [salesmen, setSalesmen] = useState<string[]>([])
  const [blockedSalesmen, setBlockedSalesmen] = useState<string[]>([])
  const { user } = useAuth()
  const [salesmenMap, setSalesmenMap] = useState<Map<string, {name: string, phone: string}>>(new Map())

  // 获取客户数据、施工队列表和抽签记录
  useEffect(() => {
    fetchCustomers()
    fetchConstructionTeams()
    fetchDrawRecords()
    // 从localStorage读取被屏蔽的业务员列表
    const savedBlockedSalesmen = localStorage.getItem('blocked_salesmen')
    if (savedBlockedSalesmen) {
      try {
        const parsedBlockedSalesmen = JSON.parse(savedBlockedSalesmen)
        if (Array.isArray(parsedBlockedSalesmen)) {
          setBlockedSalesmen(parsedBlockedSalesmen)
        }
      } catch (error) {
        console.error('解析保存的屏蔽业务员列表失败:', error)
      }
    }
    fetchSalesmenInfo()
  }, [])

  // 计算统计数据
  useEffect(() => {
    if (customers.length > 0) {
      const squareSteelOutboundCount = customers.filter(c => c.square_steel_outbound_date).length
      const dispatchedCount = customers.filter(c => c.dispatch_date).length
      const pendingCount = customers.filter(c => (c.component_outbound_date || c.square_steel_outbound_date) && !c.dispatch_date).length
      
      setStats({
        totalOutbound: customers.length,
        dispatched: dispatchedCount,
        pendingDispatch: pendingCount,
        urgeOrderCount: squareSteelOutboundCount
      })
    }
  }, [customers])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      // 获取所有客户
      const data = await customerApi.getAll()
      
      // 过滤出方钢已出库的客户（排除特殊值'RETURNED'退单的情况）
      const outboundCustomers = data.filter(customer => 
        customer.square_steel_outbound_date && customer.square_steel_outbound_date !== 'RETURNED'
      )
      
      setCustomers(outboundCustomers)
      setFilteredCustomers(outboundCustomers)
      
      // 提取所有业务员名称
      const allSalesmen = [...new Set(data
        .filter(c => c.salesman && c.salesman.trim() !== '')
        .map(c => c.salesman))]
        .filter((salesman): salesman is string => salesman !== undefined)
        .sort()
      
      setSalesmen(allSalesmen)
    } catch (error) {
      message.error('获取客户数据失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // 获取施工队列表
  const fetchConstructionTeams = async () => {
    try {
      // 添加日志
      console.log('开始获取施工队列表...');
      
      // 从user_roles表获取施工队数据
      const teams = await constructionTeamApi.getFromUserRoles();
      console.log('从user_roles获取到的施工队数据:', teams);
      
      // 如果使用API返回的数据为空，使用备用方案：从客户数据中收集施工队信息
      if (!teams || teams.length === 0) {
        console.log('API返回施工队数据为空，使用备用方案');
        // 从客户数据中提取施工队信息
        const uniqueTeams = [...new Set(customers
          .filter(c => c.construction_team && c.construction_team.trim() !== '')
          .map(c => c.construction_team))]
          .filter((team): team is string => team !== undefined);
        console.log('从客户数据中提取的施工队:', uniqueTeams);
        
        if (uniqueTeams.length > 0) {
          setConstructionTeams(uniqueTeams);
          return;
        }
        
        // 如果客户数据中也没有施工队信息，使用硬编码值作为最后备选
        setConstructionTeams(['北城施工队', '西城施工队']);
        console.log('使用默认施工队数据');
        return;
      }
      
      // 从API返回的数据中提取施工队名称
      const teamNames = teams
        .map(team => team.name || '未命名施工队')
        .filter((name): name is string => name !== undefined);
      console.log('处理后的施工队名称列表:', teamNames);
      setConstructionTeams(teamNames);
    } catch (error) {
      console.error('获取施工队列表失败:', error);
      message.error('获取施工队列表失败');
      
      // 发生错误时使用备用方案
      const backupTeams = ['北城施工队', '西城施工队'];
      console.log('发生错误，使用备用施工队数据');
      setConstructionTeams(backupTeams);
    }
  }

  // 获取抽签记录
  const fetchDrawRecords = async () => {
    try {
      const response = await fetch('/api/draw-records')
      if (response.ok) {
        const data = await response.json()
        setDrawRecords(data)
      } else {
        console.error('获取抽签记录失败')
      }
    } catch (error) {
      console.error('获取抽签记录失败:', error)
    }
  }

  // 检查客户是否已抽签
  const isCustomerDrawn = (customerId: string | undefined, record: Customer) => {
    if (!customerId) return false;
    // 如果客户有施工队信息，则认为已抽签
    return !!record.construction_team;
  }

  // 搜索功能
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
        customer.meter_number?.toLowerCase().includes(searchValue) ||
        (customer.salesman && customer.salesman.toLowerCase().includes(searchValue)) ||
        (customer.construction_team && customer.construction_team.toLowerCase().includes(searchValue))
      )
    })

    setFilteredCustomers(filtered)
  }

  // 打开派工模态框
  const showDispatchModal = (customer: Customer) => {
    setCurrentCustomer(customer)
    form.setFieldsValue({
      construction_team: customer.construction_team || undefined,
      dispatch_date: customer.construction_team && customer.dispatch_date ? dayjs(customer.dispatch_date) : undefined,
      dispatch_notes: ''
    })
    setDispatchModalVisible(true)
  }

  // 提交派工
  const handleDispatchSubmit = async () => {
    try {
      const values = await form.validateFields()
      
      if (!currentCustomer) return
      
      // 如果施工队为空，确保派工日期也为空
      if (!values.construction_team) {
        values.dispatch_date = null;
        console.log('施工队为空，派工日期设置为null');
      } else {
        // 如果施工队有数据，则设置派工日期为当前时间
        values.dispatch_date = values.dispatch_date ? values.dispatch_date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
        console.log('施工队有值，派工日期设置为:', values.dispatch_date);
      }
      
      // 如果是派工，同时清除催单标记
      if (!currentCustomer.dispatch_date) {
        values.urge_order = null
      }
      
      // 移除不存在的字段
      delete values.dispatch_notes;
      
      console.log('派工更新数据:', values);
      
      // 确保 id 存在后再调用 update
      if (currentCustomer?.id) {
        await customerApi.update(currentCustomer.id, values)
      } else {
        throw new Error('客户ID不存在')
      }
      message.success('派工信息更新成功')
      setDispatchModalVisible(false)
      fetchCustomers()
    } catch (error) {
      message.error('更新失败')
      console.error(error)
    }
  }

  // 导出客户数据
  const handleExport = () => {
    try {
      // 准备导出数据
      const exportData = filteredCustomers.map(customer => ({
        '登记日期': customer.register_date ? dayjs(customer.register_date).format('YYYY-MM-DD') : '',
        '客户姓名': customer.customer_name,
        '客户电话': customer.phone,
        '地址': customer.address,
        '身份证号': customer.id_card,
        '业务员': customer.salesman,
        '组件数量': customer.module_count,
        '容量(KW)': customer.capacity,
        '方钢出库日期': customer.square_steel_outbound_date ? 
          (customer.square_steel_outbound_date === 'RETURNED' ? '退单' : dayjs(customer.square_steel_outbound_date).format('YYYY-MM-DD')) : '',
        '组件出库日期': customer.component_outbound_date ? 
          (customer.component_outbound_date === 'RETURNED' ? '退单' : dayjs(customer.component_outbound_date).format('YYYY-MM-DD')) : '',
        '派工日期': customer.dispatch_date ? dayjs(customer.dispatch_date).format('YYYY-MM-DD') : '',
        '施工队': customer.construction_team || '',
        '施工队电话': customer.construction_team_phone || '',
        '施工状态': customer.construction_status ? '已完工' : '未完工'
      }))

      // 创建工作簿
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)
      XLSX.utils.book_append_sheet(wb, ws, '客户数据')

      // 导出Excel文件
      XLSX.writeFile(wb, `派工客户数据_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败')
      console.error(error)
    }
  }

  // 处理屏蔽业务员变更
  const handleBlockedSalesmenChange = (selectedSalesmen: string[]) => {
    setBlockedSalesmen(selectedSalesmen)
    // 保存到localStorage
    localStorage.setItem('blocked_salesmen', JSON.stringify(selectedSalesmen))
    message.success(`已更新屏蔽业务员名单：${selectedSalesmen.length ? selectedSalesmen.join('、') : '无'}`)
  }

  // 添加生成随机4位数验证码的函数
  const generateVerificationCode = async () => {
    try {
      message.loading({ content: '正在生成验证码...', key: 'generating' });
      
      // 使用API生成验证码并存储到数据库
      const userName = user ? user.email || '未知用户' : '未知用户';
      
      const result = await verificationCodeApi.generate(userName, blockedSalesmen);
      
      if (result.success && result.code) {
        setVerificationCode(result.code);
        setCodeVisible(true);
        message.success('验证码已生成，此验证码只能使用一次');
      } else {
        message.error(`生成验证码失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('生成验证码出错:', error);
      message.error('生成验证码失败，请重试');
    } finally {
      message.destroy('generating');
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

  // 表格列定义
  const columns = [
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      sorter: (a: Customer, b: Customer) => (a.customer_name || '').localeCompare(b.customer_name || ''),
    },
    {
      title: '客户地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      sorter: (a: Customer, b: Customer) => (a.address || '').localeCompare(b.address || ''),
    },
    {
      title: '业务员',
      dataIndex: 'salesman',
      key: 'salesman',
      render: (text: string) => getSalesmanName(text),
      sorter: (a: Customer, b: Customer) => (a.salesman || '').localeCompare(b.salesman || ''),
    },
    {
      title: '业务员电话',
      dataIndex: 'salesman_phone',
      key: 'salesman_phone',
      sorter: (a: Customer, b: Customer) => (a.salesman_phone || '').localeCompare(b.salesman_phone || ''),
      render: (text: string, record: Customer) => {
        // 如果有业务员电话直接显示
        if (text) return text;
        
        // 如果没有电话但有业务员邮箱，尝试从映射表获取
        if (record.salesman && record.salesman.includes('@')) {
          const salesmanInfo = salesmenMap.get(record.salesman.toLowerCase());
          if (salesmanInfo && salesmanInfo.phone) {
            return salesmanInfo.phone;
          }
        }
        
        return '-';
      },
    },
    {
      title: '方钢出库',
      dataIndex: 'square_steel_outbound_date',
      key: 'square_steel_outbound_date',
      render: (date: string | null) => (
        date ? 
          <Tag color="green">
            {dayjs(date).format('YYYY-MM-DD HH:mm')}
          </Tag> : 
          <Tag color="orange">未出库</Tag>
      ),
      sorter: (a: Customer, b: Customer) => {
        if (!a.square_steel_outbound_date && !b.square_steel_outbound_date) return 0;
        if (!a.square_steel_outbound_date) return -1;
        if (!b.square_steel_outbound_date) return 1;
        return new Date(a.square_steel_outbound_date).getTime() - new Date(b.square_steel_outbound_date).getTime();
      },
    },
    {
      title: '组件出库',
      dataIndex: 'component_outbound_date',
      key: 'component_outbound_date',
      render: (date: string | null) => (
        date ? 
          <Tag color="green">
            {dayjs(date).format('YYYY-MM-DD HH:mm')}
          </Tag> : 
          <Tag color="orange">未出库</Tag>
      ),
      sorter: (a: Customer, b: Customer) => {
        if (!a.component_outbound_date && !b.component_outbound_date) return 0;
        if (!a.component_outbound_date) return -1;
        if (!b.component_outbound_date) return 1;
        return new Date(a.component_outbound_date).getTime() - new Date(b.component_outbound_date).getTime();
      },
    },
    {
      title: '派工日期',
      dataIndex: 'dispatch_date',
      key: 'dispatch_date',
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
      sorter: (a: Customer, b: Customer) => {
        if (!a.dispatch_date && !b.dispatch_date) return 0;
        if (!a.dispatch_date) return -1;
        if (!b.dispatch_date) return 1;
        return new Date(a.dispatch_date).getTime() - new Date(b.dispatch_date).getTime();
      },
    },
    {
      title: '施工队',
      dataIndex: 'construction_team',
      key: 'construction_team',
      render: (text: string | null) => text || '-',
      sorter: (a: Customer, b: Customer) => (a.construction_team || '').localeCompare(b.construction_team || ''),
    },
    {
      title: '施工队电话',
      dataIndex: 'construction_team_phone',
      key: 'construction_team_phone',
      render: (text: string | null) => text || '-',
      sorter: (a: Customer, b: Customer) => (a.construction_team_phone || '').localeCompare(b.construction_team_phone || ''),
    },
    {
      title: '抽签状态',
      key: 'draw_status',
      render: (_: any, record: Customer) => {
        const isDrawn = isCustomerDrawn(record.id, record)
        return isDrawn ? 
          <Tag color="green">已抽签</Tag> : 
          <Tag color="orange">未抽签</Tag>
      },
      sorter: (a: Customer, b: Customer) => {
        const aDrawn = isCustomerDrawn(a.id, a) ? 1 : 0
        const bDrawn = isCustomerDrawn(b.id, b) ? 1 : 0
        return aDrawn - bDrawn
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Customer) => (
        <Button 
          type={record.dispatch_date ? "default" : "primary"} 
          icon={<SendOutlined />} 
          onClick={() => showDispatchModal(record)}
          size="small"
          danger={!!record.urge_order}
        >
          {record.construction_team ? '修改派工状态' : (record.dispatch_date ? '修改派工' : '派工')}
          {record.urge_order ? ' (催单)' : ''}
        </Button>
      ),
    },
  ]

  return (
    <div className="dispatch-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={2}>
          <DashboardOutlined style={{ marginRight: 12 }} />
          派工管理
        </Title>
      </div>
      
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card style={CARD_STYLE} hoverable>
            <Statistic 
              title={<div style={{ fontSize: '16px', fontWeight: 'bold', color: '#722ed1' }}><ExportOutlined /> 方钢出库订单</div>}
              value={stats.urgeOrderCount}
              valueStyle={{ color: '#722ed1', fontSize: '24px' }}
              suffix="单"
            />
            {stats.totalOutbound > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>占比</div>
                <Progress percent={Math.round((stats.urgeOrderCount / stats.totalOutbound) * 100)} size="small" status="active" strokeColor="#722ed1" />
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={CARD_STYLE} hoverable>
            <Statistic 
              title={<div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff' }}><ExportOutlined /> 组件出库订单</div>}
              value={stats.totalOutbound}
              valueStyle={{ color: '#1890ff', fontSize: '24px' }}
              suffix="单"
            />
            {stats.totalOutbound > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>占比</div>
                <Progress percent={100} size="small" status="active" strokeColor="#1890ff" />
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={CARD_STYLE} hoverable>
            <Statistic 
              title={<div style={{ fontSize: '16px', fontWeight: 'bold', color: '#3f8600' }}><CheckOutlined /> 已派工订单</div>}
              value={stats.dispatched}
              valueStyle={{ color: '#3f8600', fontSize: '24px' }}
              suffix="单"
            />
            {stats.totalOutbound > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>占比</div>
                <Progress percent={Math.round((stats.dispatched / stats.totalOutbound) * 100)} size="small" status="active" strokeColor="#3f8600" />
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={CARD_STYLE} hoverable>
            <Statistic 
              title={<div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fa8c16' }}><ClockCircleOutlined /> 待派工订单</div>}
              value={stats.pendingDispatch}
              valueStyle={{ color: '#fa8c16', fontSize: '24px' }}
              suffix="单"
            />
            {stats.totalOutbound > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>占比</div>
                <Progress percent={Math.round((stats.pendingDispatch / stats.totalOutbound) * 100)} size="small" status="exception" strokeColor="#fa8c16" />
              </div>
            )}
          </Card>
        </Col>
      </Row>
      
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="抽签设置" style={{ borderRadius: '8px' }}>
            <Row gutter={16}>
              <Col span={18}>
                <Form.Item label="屏蔽业务员" help="选中的业务员所属客户将不参与施工队抽签">
                  <Select
                    mode="multiple"
                    placeholder="选择要屏蔽的业务员"
                    style={{ width: '100%' }}
                    value={blockedSalesmen}
                    onChange={handleBlockedSalesmenChange}
                    maxTagCount={5}
                  >
                    {salesmen.map(salesman => (
                      <Option key={salesman} value={salesman}>{salesman}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="操作">
                  <Button 
                    type="primary" 
                    icon={<KeyOutlined />}
                    onClick={generateVerificationCode}
                    style={{ width: '100%' }}
                  >
                    生成抽签验证码
                  </Button>
                </Form.Item>
              </Col>
            </Row>
            
            {codeVisible && (
              <Alert
                message="抽签验证码"
                description={
                  <div>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center', marginBottom: '10px' }}>
                      {verificationCode}
                    </p>
                    <p>此验证码有效期为24小时，且只能使用一次。</p>
                    <p>当前已屏蔽业务员：{blockedSalesmen.length ? blockedSalesmen.join('、') : '无'}</p>
                  </div>
                }
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
          </Card>
        </Col>
      </Row>
      
      <Card 
        className="main-card"
        style={{ 
          marginBottom: 24, 
          boxShadow: '0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09)',
          borderRadius: '8px'
        }}
      >
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space size="middle">
            <Input
              placeholder="搜索客户姓名/地址/电话"
              value={searchText}
              onChange={e => handleSearch(e.target.value)}
              style={{ width: 300 }}
              prefix={<SearchOutlined />}
              allowClear
              size="large"
            />
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchCustomers}
              loading={loading}
              size="large"
            >
              刷新数据
            </Button>
          </Space>
          <Space size="middle">
            <Button 
              icon={<ExportOutlined />} 
              onClick={handleExport}
              disabled={false}
              size="large"
              type="default"
            >
              导出数据
            </Button>
          </Space>
        </Space>

        <Divider style={{ margin: '12px 0' }} />
        
        <Table
          columns={columns}
          dataSource={filteredCustomers}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
          scroll={{ x: 'max-content', y: 'calc(100vh - 380px)' }}
          className="custom-table"
        />
      </Card>
      
      {/* 派工模态框 */}
      <Modal
        title={
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
            <SendOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            {currentCustomer?.customer_name ? `派工信息 - ${currentCustomer.customer_name}` : '派工信息'}
          </div>
        }
        open={dispatchModalVisible}
        onOk={handleDispatchSubmit}
        onCancel={() => setDispatchModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={520}
        modalRender={(modal) => (
          <Draggable handle=".ant-modal-header">
            {modal}
          </Draggable>
        )}
      >
        {currentCustomer && (
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
            <div><strong>客户地址:</strong> {currentCustomer.address}</div>
            {currentCustomer.phone && <div><strong>联系电话:</strong> {currentCustomer.phone}</div>}
          </div>
        )}
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="construction_team"
            label="施工队"
            rules={[{ required: true, message: '请选择施工队' }]}
          >
            <Select placeholder="选择施工队" size="large">
              {constructionTeams.map(team => (
                <Option key={team} value={team}>{team}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="dispatch_date"
            label="派工日期"
            rules={[{ required: true, message: '请选择派工日期' }]}
          >
            <DatePicker style={{ width: '100%' }} size="large" />
          </Form.Item>
          
          <Form.Item
            name="dispatch_notes"
            label="派工备注"
          >
            <Input.TextArea rows={4} placeholder="可输入派工备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* CSS样式 */}
      <style>
        {`
          .dispatch-dashboard .ant-card {
            transition: all 0.3s;
          }
          
          .dispatch-dashboard .ant-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 3px 10px rgba(0,0,0,0.15);
          }
          
          .dispatch-dashboard .main-card {
            background-color: #ffffff;
          }
          
          .dispatch-dashboard .custom-table .ant-table-thead > tr > th {
            background-color: transparent;
            color: rgba(0, 0, 0, 0.85);
            font-weight: bold;
            white-space: nowrap;
          }
          
          .dispatch-dashboard .custom-table .ant-table-thead > tr > th.ant-table-column-sort {
            background-color: transparent;
          }
          
          .dispatch-dashboard .custom-table .ant-table-tbody > tr.ant-table-row:hover > td {
            background-color: #f5f5f5;
          }
          
          .dispatch-dashboard .ant-table-body {
            overflow-y: auto !important;
            overflow-x: auto !important;
            max-height: calc(100vh - 380px);
          }
          
          /* 自定义滚动条样式 */
          .dispatch-dashboard .ant-table-body::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          
          .dispatch-dashboard .ant-table-body::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
          }
          
          .dispatch-dashboard .ant-table-body::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 4px;
          }
          
          .dispatch-dashboard .ant-table-body::-webkit-scrollbar-thumb:hover {
            background: #a1a1a1;
          }

          .ant-table-cell {
            white-space: nowrap;
          }
        `}
      </style>
    </div>
  )
}

export default DispatchManagerDashboard