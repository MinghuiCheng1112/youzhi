import { useState, useEffect } from 'react'
import { Table, Card, Input, Button, Typography, Space, message, Tag, Modal, Form, DatePicker, Statistic, Row, Col, Tooltip, Divider, Progress } from 'antd'
import { SearchOutlined, ReloadOutlined, ExportOutlined, DownloadOutlined, UploadOutlined, CheckCircleOutlined, ClockCircleOutlined, PhoneOutlined, HomeOutlined, UserOutlined, BuildOutlined, DollarOutlined } from '@ant-design/icons'
import { customerApi } from '../../services/api'
import { Customer } from '../../types'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

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

const WarehouseManagerDashboard = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [outboundModalVisible, setOutboundModalVisible] = useState(false)
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null)
  const [form] = Form.useForm()
  const [stats, setStats] = useState({
    totalCustomers: 0,
    outboundCustomers: 0,
    pendingOutbound: 0,
    totalModules: 0
  })

  // 获取客户数据
  useEffect(() => {
    fetchCustomers()
  }, [])

  // 计算统计数据
  useEffect(() => {
    if (customers.length > 0) {
      const outboundCount = customers.filter(c => c.outbound_date).length
      const pendingCount = customers.filter(c => !c.outbound_date).length
      const totalModules = customers.reduce((sum, c) => sum + (c.module_count || 0), 0)
      
      setStats({
        totalCustomers: customers.length,
        outboundCustomers: outboundCount,
        pendingOutbound: pendingCount,
        totalModules: totalModules
      })
    }
  }, [customers])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      // 获取所有客户
      const data = await customerApi.getAll()
      
      // 过滤出未删除的客户 (按条件过滤，不依赖 deleted_at 属性)
      const activeCustomers = data.filter(customer => customer.status !== 'deleted')
      
      setCustomers(activeCustomers)
      setFilteredCustomers(activeCustomers)
    } catch (error) {
      message.error('获取客户数据失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
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
        (customer.salesman && customer.salesman.toLowerCase().includes(searchValue))
      )
    })

    setFilteredCustomers(filtered)
  }

  // 打开出库模态框
  const showOutboundModal = (customer: Customer) => {
    setCurrentCustomer(customer)
    form.setFieldsValue({
      outbound_date: customer.outbound_date ? dayjs(customer.outbound_date) : dayjs(),
      module_count: customer.module_count || 0,
      inverter_count: (customer as any).inverter_count || 1,
      outbound_notes: (customer as any).outbound_notes || ''
    })
    setOutboundModalVisible(true)
  }

  // 提交出库
  const handleOutboundSubmit = async () => {
    try {
      const values = await form.validateFields()
      
      if (!currentCustomer) return
      
      // 转换日期格式
      if (values.outbound_date) {
        values.outbound_date = values.outbound_date.format('YYYY-MM-DD')
      }
      
      // 确保 id 存在且为字符串类型
      if (currentCustomer?.id) {
        await customerApi.update(currentCustomer.id, values)
      }
      message.success('出库信息更新成功')
      setOutboundModalVisible(false)
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
        '电表号码': customer.meter_number,
        '业务员': customer.salesman,
        '组件数量': customer.module_count,
        '容量(KW)': customer.capacity,
        '出库日期': customer.outbound_date ? dayjs(customer.outbound_date).format('YYYY-MM-DD') : '',
        '派工日期': customer.dispatch_date ? dayjs(customer.dispatch_date).format('YYYY-MM-DD') : '',
        '施工队': customer.construction_team || '',
        '施工状态': customer.construction_status ? '已完工' : '未完工'
      }))

      // 创建工作簿
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)
      XLSX.utils.book_append_sheet(wb, ws, '客户数据')

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
      title: '催单',
      dataIndex: 'urge_order',
      key: 'urge_order',
      render: (text: string) => text ? <Tag color="orange"><ClockCircleOutlined /> {dayjs(text).format('YYYY-MM-DD HH:mm')}</Tag> : '-',
      sorter: (a: Customer, b: Customer) => {
        if (!a.urge_order && !b.urge_order) return 0
        if (!a.urge_order) return -1
        if (!b.urge_order) return 1
        return new Date(a.urge_order).getTime() - new Date(b.urge_order).getTime()
      },
      width: 150,
    },
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
      render: (text: string) => text ? (
        <span><UserOutlined /> {text}</span>
      ) : '-',
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
        <span><BuildOutlined /> {text}</span>
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
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text || '-'}</span>
        </Tooltip>
      ),
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
      title: '方钢出库',
      dataIndex: 'square_steel_outbound_date',
      key: 'square_steel_outbound_date',
      width: 150,
      render: (date: string | null) => (
        date ? 
          <Tag color="green">
            <CheckCircleOutlined /> {dayjs(date).format('YYYY-MM-DD')}
          </Tag> : 
          <Tag color="orange" icon={<ClockCircleOutlined />}>未出库</Tag>
      ),
    },
    {
      title: '组件出库',
      dataIndex: 'component_outbound_date',
      key: 'component_outbound_date',
      width: 150,
      render: (date: string | null) => (
        date ? 
          <Tag color="green">
            <CheckCircleOutlined /> {dayjs(date).format('YYYY-MM-DD')}
          </Tag> : 
          <Tag color="orange" icon={<ClockCircleOutlined />}>未出库</Tag>
      ),
    },
    {
      title: '图纸变更',
      dataIndex: 'drawing_change',
      key: 'drawing_change',
      width: 100,
      render: (value: boolean) => value ? <Tag color="red">变更</Tag> : '无',
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
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 120,
      render: (_: any, record: Customer) => (
        <Button 
          type={record.outbound_date ? "default" : "primary"} 
          icon={record.outbound_date ? <DownloadOutlined /> : <UploadOutlined />} 
          onClick={() => showOutboundModal(record)}
          size="small"
        >
          {record.outbound_date ? '修改出库' : '出库'}
        </Button>
      ),
    },
  ]

  return (
    <div className="warehouse-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={2}>仓库工作台</Title>
        <Space>
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
          <Card>
            <Statistic 
              title="客户总数" 
              value={stats.totalCustomers} 
              suffix="户" 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="已出库" 
              value={stats.outboundCustomers} 
              suffix="户" 
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="待出库" 
              value={stats.pendingOutbound} 
              suffix="户" 
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="组件总数" 
              value={stats.totalModules} 
              suffix="块" 
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Input
              placeholder="搜索客户姓名、电话、地址、业务员等"
              prefix={<SearchOutlined />}
              style={{ width: 300 }}
              value={searchText}
              onChange={e => handleSearch(e.target.value)}
              allowClear
            />
            <Text type="secondary">
              {filteredCustomers.length > 0 && `显示 ${filteredCustomers.length} 条记录，共 ${customers.length} 条`}
            </Text>
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
            showTotal: (total) => `共 ${total} 条记录`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          scroll={{ x: 1500 }}
          rowClassName={(record) => record.outbound_date ? 'outbound-row' : 'pending-outbound-row'}
          size="middle"
        />
      </Card>

      {/* 出库模态框 */}
      <Modal
        title={currentCustomer?.outbound_date ? "修改出库信息" : "出库登记"}
        open={outboundModalVisible}
        onOk={handleOutboundSubmit}
        onCancel={() => setOutboundModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="outbound_date"
            label="出库日期"
            rules={[{ required: true, message: '请选择出库日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="module_count"
            label="组件数量"
            rules={[{ required: true, message: '请输入组件数量' }]}
          >
            <Input type="number" min={0} />
          </Form.Item>
          
          <Form.Item
            name="inverter_count"
            label="逆变器数量"
          >
            <Input type="number" min={0} />
          </Form.Item>
          
          <Form.Item
            name="outbound_notes"
            label="出库备注"
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
          .outbound-row {
            background-color: #f6ffed;
          }
          .pending-outbound-row {
            background-color: #fff7e6;
          }
          .ant-table-thead > tr > th {
            background: #fafafa;
            font-weight: 600;
          }
        `}
      </style>
    </div>
  )
}

export default WarehouseManagerDashboard