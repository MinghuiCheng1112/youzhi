import { useState, useEffect } from 'react'
import { Table, Card, Button, message, Input, Tag, Space, Row, Col, Statistic, Tabs, Tooltip, Typography, Progress, Divider, Modal, InputNumber, Radio } from 'antd'
import { 
  ReloadOutlined, 
  ExportOutlined,
  PhoneOutlined,
  HomeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  ToolOutlined,
  BulbOutlined,
  NodeIndexOutlined,
  DashboardOutlined
} from '@ant-design/icons'
import { customerApi } from '../../services/api'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

const { Search } = Input
const { Title, Text } = Typography
const { TabPane } = Tabs

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

const GridConnectionDashboard = () => {
  const [customers, setCustomers] = useState<any[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCustomers()
  }, [])

  useEffect(() => {
    // 应用搜索过滤
    handleSearch(searchText)
  }, [searchText, customers])

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      // 获取所有客户数据
      const data = await customerApi.getAll();
      setCustomers(data);
      setFilteredCustomers(data);
    } catch (error) {
      console.error('获取客户数据失败:', error);
      message.error('获取客户数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索功能
  const handleSearch = (value: string) => {
    setSearchText(value);
    if (!value.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    // 先应用搜索过滤
    let filtered = applySearchFilter(customers, value)
    
    setFilteredCustomers(filtered)
  };

  // 模糊搜索逻辑
  const applySearchFilter = (data: any[], value: string) => {
    if (!value.trim()) return data
    
    const searchValue = value.toLowerCase();
    return data.filter(customer => (
      customer.customer_name?.toLowerCase().includes(searchValue) ||
      customer.phone?.toLowerCase().includes(searchValue) ||
      customer.address?.toLowerCase().includes(searchValue) ||
      customer.salesman?.toLowerCase().includes(searchValue) ||
      customer.salesman_phone?.toLowerCase().includes(searchValue) ||
      customer.construction_team?.toLowerCase().includes(searchValue) ||
      (customer.construction_team_phone && customer.construction_team_phone.toLowerCase().includes(searchValue))
    ));
  }

  // 导出客户数据
  const handleExport = () => {
    try {
      // 准备导出数据
      const exportData = filteredCustomers.map(customer => ({
        '登记日期': customer.register_date ? dayjs(customer.register_date).format('YYYY-MM-DD') : '',
        '客户姓名': customer.customer_name,
        '客户电话': customer.phone,
        '客户地址': customer.address,
        '业务员': customer.salesman,
        '业务员电话': customer.salesman_phone || '',
        '施工队': customer.construction_team || '',
        '施工队电话': customer.construction_team_phone || '',
        '逆变器': customer.inverter || '',
        '施工状态': customer.construction_status ? dayjs(customer.construction_status).format('YYYY-MM-DD') : '未完工',
        '建设验收': customer.construction_acceptance ? dayjs(customer.construction_acceptance).format('YYYY-MM-DD') : '',
        '挂表日期': customer.meter_installation_date ? dayjs(customer.meter_installation_date).format('YYYY-MM-DD') : ''
      }))

      // 创建工作簿
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)
      XLSX.utils.book_append_sheet(wb, ws, '客户数据')

      // 导出Excel文件
      XLSX.writeFile(wb, `并网客户数据_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败')
      console.error(error)
    }
  }

  // 计算统计数据
  const getStatistics = () => {
    const total = customers.length
    const verifiedCount = customers.filter(c => c.construction_acceptance).length
    const pendingVerificationCount = customers.filter(c => c.construction_status && !c.construction_acceptance).length
    const meterInstalledCount = customers.filter(c => c.meter_installation_date).length
    const pendingMeterCount = customers.filter(c => c.construction_acceptance && !c.meter_installation_date).length
    
    return { 
      total, 
      verifiedCount, 
      pendingVerificationCount, 
      meterInstalledCount, 
      pendingMeterCount 
    }
  }

  const stats = getStatistics()

  const columns = [
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      fixed: 'left' as const,
      width: 120,
      sorter: (a: any, b: any) => a.customer_name.localeCompare(b.customer_name),
      render: (text: string) => <b>{text}</b>
    },
    {
      title: '客户电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      render: (text: string) => (
        <a href={`tel:${text}`}><PhoneOutlined /> {text}</a>
      ),
    },
    {
      title: '客户地址',
      dataIndex: 'address',
      key: 'address',
      width: 150,
      ellipsis: true,
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
      render: (text: string) => (
        <span><TeamOutlined /> {text}</span>
      )
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
      title: '施工队',
      dataIndex: 'construction_team',
      key: 'construction_team',
      width: 120,
      render: (text: string) => text ? (
        <span><ToolOutlined /> {text}</span>
      ) : '-',
    },
    {
      title: '施工队电话',
      dataIndex: 'construction_team_phone',
      key: 'construction_team_phone',
      width: 120,
      render: (text: string) => text ? (
        <a href={`tel:${text}`}><PhoneOutlined /> {text}</a>
      ) : '-',
    },
    {
      title: '逆变器',
      dataIndex: 'inverter',
      key: 'inverter',
      width: 150,
      ellipsis: true,
      render: (text: string) => text ? (
        <Tooltip title={text}>
          <span><BulbOutlined /> {text}</span>
        </Tooltip>
      ) : '-',
    },
    {
      title: '施工状态',
      dataIndex: 'construction_status',
      key: 'construction_status',
      width: 120,
      render: (text: any) => text ? 
        <Tag color="green"><CheckCircleOutlined /> {dayjs(text).format('YYYY-MM-DD')}</Tag> : 
        <Tag color="orange"><ClockCircleOutlined /> 未完工</Tag>,
      sorter: (a: any, b: any) => {
        if (!a.construction_status) return -1
        if (!b.construction_status) return 1
        return dayjs(a.construction_status).unix() - dayjs(b.construction_status).unix()
      }
    },
    {
      title: '建设验收',
      dataIndex: 'construction_acceptance',
      key: 'construction_acceptance',
      width: 120,
      render: (text: any, record: any) => {
        // 检查是否是等待状态
        if (text && typeof text === 'string' && text.startsWith('waiting:')) {
          try {
            // 解析等待天数和开始日期
            const [, waitDays, startDate] = text.split(':');
            const days = parseInt(waitDays, 10);
            const start = dayjs(startDate);
            const today = dayjs();
            const daysPassed = today.diff(start, 'day');
            const daysLeft = Math.max(0, days - daysPassed);
            
            return (
              <Tooltip title={`开始日期: ${startDate}, 等待天数: ${waitDays}`}>
                <Tag color="processing" style={{ cursor: 'pointer' }} onClick={() => handleConstructionAcceptanceChange(record.id, text)}>
                  <ClockCircleOutlined /> 等待中 ({daysLeft}天)
                </Tag>
              </Tooltip>
            );
          } catch (e) {
            console.error('解析等待状态失败:', e);
            return <Tag color="orange"><ClockCircleOutlined /> 未验收</Tag>;
          }
        } else {
          return text ? 
            <Tag color="green" style={{ cursor: 'pointer' }} onClick={() => handleConstructionAcceptanceChange(record.id, text)}>
              <CheckCircleOutlined /> {dayjs(text).format('YYYY-MM-DD')}
            </Tag> : 
            <Tag color="orange" style={{ cursor: 'pointer' }} onClick={() => showConstructionAcceptanceOptions(record.id)}>
              <ClockCircleOutlined /> 未验收
            </Tag>;
        }
      },
    },
    {
      title: '挂表日期',
      dataIndex: 'meter_installation_date',
      key: 'meter_installation_date',
      width: 120,
      render: (text: any, record: any) => text ? 
        <Tag color="green" style={{ cursor: 'pointer' }} onClick={() => handleMeterInstallationDateChange(record.id, text)}>
          <NodeIndexOutlined /> {dayjs(text).format('YYYY-MM-DD')}
        </Tag> : 
        <Tag color="orange" style={{ cursor: 'pointer' }} onClick={() => handleMeterInstallationDateChange(record.id, text)}>
          <ClockCircleOutlined /> 未挂表
        </Tag>,
    },
  ]

  // 处理建设验收状态变更
  const handleConstructionAcceptanceChange = async (id: string | undefined, currentStatus: string | null, days?: number) => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }
    
    try {
      setLoading(true);
      
      let updateObj: Record<string, any> = {};
      
      if (!currentStatus) {
        if (days !== undefined) {
          // 设置等待状态
          // 将等待天数和开始日期保存在状态值中，格式为: "waiting:天数:开始日期"
          const startDate = dayjs().format('YYYY-MM-DD');
          updateObj.construction_acceptance = `waiting:${days}:${startDate}`;
        } else {
          // 直接设置为已验收状态
          updateObj.construction_acceptance = new Date().toISOString();
        }
      } else {
        // 恢复为未验收状态
        updateObj.construction_acceptance = null;
      }
      
      await customerApi.update(id, updateObj);
      
      if (currentStatus) {
        message.success('已恢复为未验收状态');
      } else if (days !== undefined) {
        message.success(`已设置为等待天数: ${days}`);
      } else {
        message.success('已标记为已验收状态');
      }
      
      fetchCustomers(); // 刷新数据
    } catch (error) {
      console.error('更新建设验收状态失败:', error);
      message.error('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 显示建设验收选项对话框
  const showConstructionAcceptanceOptions = (id: string | undefined) => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }

    let radioValue = 'now';
    let waitDays = 7;
    
    Modal.confirm({
      title: '设置建设验收状态',
      width: 400,
      icon: null,
      content: (
        <div>
          <Radio.Group 
            defaultValue="now" 
            onChange={(e) => {
              radioValue = e.target.value;
              // 通过DOM更新输入框的显示/隐藏状态
              const element = document.getElementById('waitDaysInputContainer');
              if (element) {
                element.style.display = radioValue === 'wait' ? 'block' : 'none';
              }
            }}
          >
            <Space direction="vertical">
              <Radio value="now">立即标记为已验收</Radio>
              <Radio value="wait">等待天数</Radio>
            </Space>
          </Radio.Group>
          <div id="waitDaysInputContainer" style={{ marginLeft: 24, marginTop: 10, display: 'none' }}>
            <InputNumber 
              min={1} 
              max={999} 
              defaultValue={7}
              onChange={(value: number | null) => { 
                waitDays = value ?? 7;
              }}
            /> 天
          </div>
        </div>
      ),
      async onOk() {
        try {
          if (radioValue === 'wait') {
            await handleConstructionAcceptanceChange(id, null, waitDays);
          } else {
            await handleConstructionAcceptanceChange(id, null);
          }
          return Promise.resolve();
        } catch (error) {
          return Promise.reject();
        }
      }
    });
  };

  // 处理挂表日期状态变更
  const handleMeterInstallationDateChange = async (id: string | undefined, currentStatus: string | null) => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }
    
    try {
      setLoading(true);
      
      // 如果当前有状态（已挂表），则恢复为未挂表
      // 如果当前没有状态（未挂表），则标记为已挂表
      const updateObj = {
        meter_installation_date: currentStatus ? null : new Date().toISOString()
      };
      
      await customerApi.update(id, updateObj);
      
      message.success(currentStatus ? '已恢复为未挂表状态' : '已标记为已挂表状态');
      fetchCustomers(); // 刷新数据
    } catch (error) {
      console.error('更新挂表日期状态失败:', error);
      message.error('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid-connection-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={2}>
          <DashboardOutlined style={{ marginRight: 12 }} />
          并网工作台
        </Title>
      </div>
      
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff' }}><TeamOutlined /> 所有客户</div>} 
              value={stats.total} 
              valueStyle={{ color: '#1890ff' }}
              suffix="户"
            />
            {stats.total > 0 && (
              <Progress percent={100} showInfo={false} status="active" strokeColor="#1890ff" style={{ marginTop: 8 }} />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div style={{ fontSize: '16px', fontWeight: 'bold', color: '#52c41a' }}><CheckCircleOutlined /> 已验收</div>} 
              value={stats.verifiedCount} 
              valueStyle={{ color: '#52c41a' }}
              suffix="户"
            />
            {stats.total > 0 && (
              <>
                <Progress percent={Math.round((stats.verifiedCount / stats.total) * 100)} strokeColor="#52c41a" style={{ marginTop: 8 }} />
                <div style={{ textAlign: 'center', fontSize: '12px', color: '#52c41a' }}>
                  {Math.round((stats.verifiedCount / stats.total) * 100)}%
                </div>
              </>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fa8c16' }}><ClockCircleOutlined /> 待验收</div>} 
              value={stats.pendingVerificationCount} 
              valueStyle={{ color: '#fa8c16' }}
              suffix="户"
            />
            {stats.total > 0 && (
              <>
                <Progress percent={Math.round((stats.pendingVerificationCount / stats.total) * 100)} strokeColor="#fa8c16" style={{ marginTop: 8 }} />
                <div style={{ textAlign: 'center', fontSize: '12px', color: '#fa8c16' }}>
                  {Math.round((stats.pendingVerificationCount / stats.total) * 100)}%
                </div>
              </>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div style={{ fontSize: '16px', fontWeight: 'bold', color: '#13c2c2' }}><NodeIndexOutlined /> 已挂表</div>} 
              value={stats.meterInstalledCount} 
              valueStyle={{ color: '#13c2c2' }}
              suffix="户"
            />
            {stats.total > 0 && (
              <>
                <Progress percent={Math.round((stats.meterInstalledCount / stats.total) * 100)} strokeColor="#13c2c2" style={{ marginTop: 8 }} />
                <div style={{ textAlign: 'center', fontSize: '12px', color: '#13c2c2' }}>
                  {Math.round((stats.meterInstalledCount / stats.total) * 100)}%
                </div>
              </>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div style={{ fontSize: '16px', fontWeight: 'bold', color: '#722ed1' }}><ClockCircleOutlined /> 待挂表</div>} 
              value={stats.pendingMeterCount} 
              valueStyle={{ color: '#722ed1' }}
              suffix="户"
            />
            {stats.total > 0 && (
              <>
                <Progress percent={Math.round((stats.pendingMeterCount / stats.total) * 100)} strokeColor="#722ed1" style={{ marginTop: 8 }} />
                <div style={{ textAlign: 'center', fontSize: '12px', color: '#722ed1' }}>
                  {Math.round((stats.pendingMeterCount / stats.total) * 100)}%
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>
      
      <Card 
        className="main-card"
        style={{ 
          boxShadow: '0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09)',
          borderRadius: '8px'
        }}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Search
            placeholder="搜索客户姓名、电话、地址"
            style={{ width: 300 }}
            onSearch={handleSearch}
            onChange={(e) => handleSearch(e.target.value)}
            value={searchText}
            allowClear
            size="large"
          />
          <Space>
            <Button 
              type="primary"
              icon={<ExportOutlined />}
              onClick={handleExport}
              size="large"
            >
              导出客户
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchCustomers}
              size="large"
            >
              刷新
            </Button>
          </Space>
        </div>
        
        <Divider style={{ margin: '16px 0' }} />
        
        <Table
          columns={columns}
          dataSource={filteredCustomers}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content', y: 'calc(100vh - 350px)' }}
          pagination={false}
          sticky
          className="custom-table"
          rowClassName={(record) => {
            if (record.meter_installation_date) return 'meter-row';
            if (record.construction_acceptance) return 'verified-row';
            if (record.construction_status) return 'pending-row';
            return 'table-row';
          }}
        />
      </Card>

      <style>
        {`
          .grid-connection-dashboard .ant-card {
            transition: all 0.3s;
            margin-bottom: 16px;
          }
          .grid-connection-dashboard .ant-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 2px 10px rgba(0,0,0,0.12);
          }
          .grid-connection-dashboard .main-card:hover {
            transform: none;
          }
          .custom-tabs .ant-tabs-tab {
            padding: 12px 24px;
            transition: all 0.3s;
          }
          .custom-tabs .ant-tabs-tab:hover {
            color: #1890ff;
          }
          .custom-tabs .ant-tabs-tab-active {
            background: #e6f7ff;
            border-radius: 4px 4px 0 0;
          }
          .ant-table-thead > tr > th {
            background: #f0f5ff;
            font-weight: 600;
          }
          .custom-table .ant-table-cell {
            padding: 12px 16px;
          }
          .table-row:hover {
            background-color: #f0f5ff;
          }
          .verified-row {
            background-color: #f6ffed;
          }
          .verified-row:hover {
            background-color: #d9f7be;
          }
          .pending-row {
            background-color: #fff7e6;
          }
          .pending-row:hover {
            background-color: #ffe7ba;
          }
          .meter-row {
            background-color: #e6fffb;
          }
          .meter-row:hover {
            background-color: #b5f5ec;
          }
          .pending-meter-row {
            background-color: #f9f0ff;
          }
          .pending-meter-row:hover {
            background-color: #efdbff;
          }
        `}
      </style>
    </div>
  )
}

export default GridConnectionDashboard