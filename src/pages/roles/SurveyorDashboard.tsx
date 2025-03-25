import { useState, useEffect } from 'react'
import { Table, Card, Button, message, Input, Tag, Space, Row, Col, Statistic, Tooltip, Typography, Progress, Divider, Modal, Form, Select, Checkbox } from 'antd'
import { 
  ReloadOutlined, 
  SearchOutlined, 
  ClockCircleOutlined, 
  WarningOutlined, 
  ExportOutlined, 
  PhoneOutlined,
  HomeOutlined,
  IdcardOutlined,
  TeamOutlined,
  ToolOutlined,
  BulbOutlined,
  UserOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  EditOutlined,
  SaveOutlined
} from '@ant-design/icons'
import { customerApi } from '../../services/api'
import { Customer } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'

const { Title, Text } = Typography
const { TextArea } = Input
const { Group } = Checkbox

// 编辑单元格组件
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

const CARD_STYLE = {
  height: '100%',
  borderRadius: 8,
  boxShadow: '0 1px 2px -2px rgba(0,0,0,0.16), 0 3px 6px 0 rgba(0,0,0,0.12)',
}

const SurveyorDashboard = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [form] = Form.useForm()
  const { user } = useAuth()
  const navigate = useNavigate()

  // 获取统计数据的计算属性
  const getStatistics = () => {
    // 今日日期 YYYY-MM-DD 格式
    const today = dayjs().format('YYYY-MM-DD')
    
    // 计算今日新增客户数量
    const todayNewCount = customers.filter(customer => {
      return customer.register_date && dayjs(customer.register_date).format('YYYY-MM-DD') === today
    }).length
    
    // 电表号码为空的客户数量
    const emptyMeterNumberCount = customers.filter(customer => {
      return !customer.meter_number || customer.meter_number.trim() === '';
    }).length
    
    // 补充资料已填的客户数量
    const supplementaryDataCount = customers.filter(customer => {
      return customer.station_management && (
        typeof customer.station_management === 'string' ? 
          customer.station_management.length > 0 : 
          customer.station_management.length > 0
      )
    }).length
    
    return {
      total: customers.length,
      emptyMeterNumberCount,
      supplementaryDataCount,
      todayNewCount
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  useEffect(() => {
    // 当搜索文本变化时，应用过滤条件
    applyFilters()
  }, [customers, searchText])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      // 获取所有客户
      const data = await customerApi.getAll()
      
      // 获取当前踏勘员在user_roles表中的名字
      let surveyorName = '';
      if (user?.id) {
        try {
          const { data: userData, error } = await supabase
            .from('user_roles')
            .select('name, phone')
            .eq('user_id', user.id)
            .eq('role', 'surveyor')
            .single();
          
          if (userData && userData.name) {
            surveyorName = userData.name;
            console.log('当前踏勘员姓名:', surveyorName);
          }
        } catch (err) {
          console.error('获取踏勘员姓名失败:', err);
        }
      }
      
      // 过滤出当前踏勘员的客户
      const filteredData = data.filter(customer => {
        // 通过踏勘员邮箱或姓名匹配
        return (user?.email && customer.surveyor === user.email) || 
               (surveyorName && customer.surveyor === surveyorName);
      })
      
      setCustomers(filteredData)
      setFilteredCustomers(filteredData)
    } catch (error) {
      console.error('获取客户数据失败:', error)
      message.error('获取客户数据失败')
    } finally {
      setLoading(false)
    }
  }

  // 应用所有筛选条件
  const applyFilters = () => {
    let filtered = [...customers]
    
    // 应用搜索过滤
    if (searchText.trim()) {
      filtered = applySearchFilter(filtered, searchText)
    }
    
    setFilteredCustomers(filtered)
  }

  // 模糊搜索逻辑
  const applySearchFilter = (data: Customer[], value: string) => {
    if (!value.trim()) return data
    
    const searchValue = value.toLowerCase()
    
    return data.filter(customer => {
      return customer.customer_name?.toLowerCase().includes(searchValue) ||
        customer.phone?.toLowerCase().includes(searchValue) ||
        customer.address?.toLowerCase().includes(searchValue) ||
        customer.id_card?.toLowerCase().includes(searchValue) ||
        customer.meter_number?.toLowerCase().includes(searchValue) ||
        customer.designer?.toLowerCase().includes(searchValue) ||
        (customer.remarks && customer.remarks.toLowerCase().includes(searchValue)) ||
        customer.salesman?.toLowerCase().includes(searchValue)
    })
  }

  // 导出数据到Excel
  const handleExport = () => {
    // 构建导出数据
    const exportData = filteredCustomers.map(customer => ({
      '登记日期': customer.register_date ? dayjs(customer.register_date).format('YYYY-MM-DD') : '',
      '客户姓名': customer.customer_name,
      '客户电话': customer.phone,
      '客户地址': customer.address,
      '身份证号': customer.id_card,
      '业务员': customer.salesman,
      '业务员电话': customer.salesman_phone,
      '电表号码': customer.meter_number,
      '设计师': customer.designer,
      '图纸变更': customer.drawing_change === true ? '是' : '否',
      '补充资料': Array.isArray(customer.station_management) 
        ? customer.station_management.join(', ')
        : customer.station_management,
      '备注': customer.remarks
    }))
    
    // 创建工作簿
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '踏勘客户列表')
    
    // 导出文件
    XLSX.writeFile(wb, '踏勘客户列表_' + dayjs().format('YYYY-MM-DD') + '.xlsx')
    
    message.success('导出成功')
  }

  // 前往新增客户页面
  const goToAddCustomer = () => {
    navigate('/customers/new');
  }

  // 打开编辑模态框
  const openEditModal = (customer: Customer) => {
    setCurrentCustomer(customer)
    form.setFieldsValue({
      meter_number: customer.meter_number || '',
      station_management: customer.station_management || [],
      remarks: customer.remarks || ''
    })
    setEditModalVisible(true)
  }

  // 保存客户信息
  const handleSaveCustomer = async () => {
    try {
      if (!currentCustomer) return
      
      const values = await form.validateFields()
      
      // 使用类型断言解决类型检查问题
      const updateData = {
        meter_number: values.meter_number || '',
        station_management: values.station_management || [],
        remarks: values.remarks || ''
      } as any;
      
      // 更新客户信息
      await customerApi.update(currentCustomer.id as string, updateData)
      
      // 更新本地数据并重新应用过滤
      fetchCustomers()
      
      message.success('客户信息保存成功')
      setEditModalVisible(false)
    } catch (error) {
      console.error('保存客户信息失败:', error)
      message.error('保存客户信息失败')
    }
  }

  // 处理单元格内编辑
  const handleCellSave = async (record: Customer, dataIndex: string, value: any) => {
    try {
      setLoading(true);
      
      // 防止重复更新
      // 使用类型断言安全地访问任意属性
      const recordAny = record as any;
      if (recordAny[dataIndex] === value) {
        setLoading(false);
        return;
      }
      
      // 准备更新数据
      const updateData: any = {
        [dataIndex]: value
      };
      
      // 特殊处理 - 如果修改的是业务员，同步更新业务员电话
      if (dataIndex === 'salesman') {
        updateData.salesman_phone = ''; // 可以从其他地方获取，这里简化处理
      }
      
      console.log('更新客户:', record.id, updateData);
      
      // 调用API更新客户信息
      await customerApi.update(record.id || '', updateData);
      
      // 更新本地状态
      const newCustomers = [...customers];
      const index = newCustomers.findIndex(item => item.id === record.id);
      if (index > -1) {
        const item = newCustomers[index];
        newCustomers.splice(index, 1, { ...item, ...updateData });
        setCustomers(newCustomers);
      }
      
      message.success('更新成功');
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败，请检查网络或重试');
    } finally {
      setLoading(false);
    }
  };

  const stats = getStatistics()

  const columns = [
    {
      title: '登记日期',
      dataIndex: 'register_date',
      key: 'register_date',
      width: 120,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
      sorter: (a: Customer, b: Customer) => {
        if (!a.register_date && !b.register_date) return 0;
        if (!a.register_date) return 1;
        if (!b.register_date) return -1;
        return dayjs(a.register_date).unix() - dayjs(b.register_date).unix();
      },
    },
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 120,
      fixed: 'left' as const,
      render: (text: string, record: Customer) => (
        <EditableCell 
          value={text} 
          record={record} 
          dataIndex="customer_name" 
          title="客户姓名" 
          required={true}
          onSave={handleCellSave}
        />
      ),
      sorter: (a: Customer, b: Customer) => a.customer_name.localeCompare(b.customer_name),
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
          required={false}
          onSave={handleCellSave}
        />
      ),
    },
    {
      title: '客户地址',
      dataIndex: 'address',
      key: 'address',
      width: 180,
      ellipsis: true,
      render: (text: string, record: Customer) => (
        <EditableCell 
          value={text} 
          record={record} 
          dataIndex="address" 
          title="客户地址" 
          required={false}
          onSave={handleCellSave}
        />
      ),
    },
    {
      title: '身份证号',
      dataIndex: 'id_card',
      key: 'id_card',
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
    },
    {
      title: '业务员',
      dataIndex: 'salesman',
      key: 'salesman',
      width: 120,
      render: (text: string, record: Customer) => (
        <EditableCell 
          value={text} 
          record={record} 
          dataIndex="salesman" 
          title="业务员" 
          required={false}
          onSave={handleCellSave}
        />
      ),
    },
    {
      title: '业务员电话',
      dataIndex: 'salesman_phone',
      key: 'salesman_phone',
      width: 120,
      render: (text: string, record: Customer) => (
        <EditableCell 
          value={text} 
          record={record} 
          dataIndex="salesman_phone" 
          title="业务员电话" 
          required={false}
          onSave={handleCellSave}
        />
      ),
    },
    {
      title: '补充资料',
      dataIndex: 'station_management',
      key: 'station_management',
      width: 150,
      render: (value: string[] | string, record: Customer) => {
        const items = Array.isArray(value) ? value : (value ? value.split(',') : []);
        return items.length > 0 ? (
          <span>
            {items.map((item, index) => (
              <Tag key={index} color="blue">{item}</Tag>
            ))}
          </span>
        ) : (
          <Button 
            size="small" 
            type="dashed" 
            onClick={() => openEditModal(record)}
          >
            添加补充资料
          </Button>
        );
      },
    },
    {
      title: '电表号码',
      dataIndex: 'meter_number',
      key: 'meter_number',
      width: 150,
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
      render: (text: string, record: Customer) => (
        <EditableCell 
          value={text} 
          record={record} 
          dataIndex="designer" 
          title="设计师" 
          required={false}
          onSave={handleCellSave}
        />
      ),
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 200,
      ellipsis: true,
      render: (text: string, record: Customer) => (
        <EditableCell 
          value={text} 
          record={record} 
          dataIndex="remarks" 
          title="备注" 
          required={false}
          onSave={handleCellSave}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 120,
      render: (_, record: Customer) => (
        <Space size="small">
          <Button 
            type="primary" 
            size="small" 
            icon={<EditOutlined />} 
            onClick={() => navigate(`/customers/${record.id}`)}
          >
            查看
          </Button>
        </Space>
      ),
    }
  ]

  // 搜索功能
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value)
  }

  return (
    <div className="surveyor-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={2}>踏勘工作台</Title>
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchCustomers}
          >
            刷新
          </Button>
        </Space>
      </div>
      
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div><UserOutlined /> 总客户数</div>} 
              value={stats.total} 
              valueStyle={{ color: '#1890ff' }}
            />
            {stats.total > 0 && (
              <Progress percent={100} showInfo={false} status="active" strokeColor="#1890ff" style={{ marginTop: 8 }} />
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div><PlusOutlined /> 今日新增</div>} 
              value={stats.todayNewCount} 
              valueStyle={{ color: '#52c41a' }}
              suffix={<Text type="secondary" style={{ fontSize: '14px' }}>{stats.total ? `(${Math.round(stats.todayNewCount / stats.total * 100)}%)` : ''}</Text>}
            />
            {stats.total > 0 && (
              <Progress 
                percent={Math.round(stats.todayNewCount / stats.total * 100)} 
                strokeColor="#52c41a" 
                style={{ marginTop: 8 }} 
              />
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div><CheckCircleOutlined /> 补充资料</div>} 
              value={stats.supplementaryDataCount} 
              valueStyle={{ color: '#52c41a' }}
              suffix={<Text type="secondary" style={{ fontSize: '14px' }}>{stats.total ? `(${Math.round(stats.supplementaryDataCount / stats.total * 100)}%)` : ''}</Text>}
            />
            {stats.total > 0 && (
              <Progress 
                percent={Math.round(stats.supplementaryDataCount / stats.total * 100)} 
                strokeColor="#52c41a" 
                style={{ marginTop: 8 }} 
              />
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div><WarningOutlined /> 电表号码</div>} 
              value={stats.emptyMeterNumberCount} 
              valueStyle={{ color: '#fa8c16' }}
              suffix={<Text type="secondary" style={{ fontSize: '14px' }}>{stats.total ? `(${Math.round(stats.emptyMeterNumberCount / stats.total * 100)}%)` : ''}</Text>}
            />
            {stats.total > 0 && (
              <Progress 
                percent={Math.round(stats.emptyMeterNumberCount / stats.total * 100)} 
                strokeColor="#fa8c16" 
                style={{ marginTop: 8 }} 
              />
            )}
          </Card>
        </Col>
      </Row>
      
      <Card style={{ overflow: 'auto' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Input
              placeholder="搜索客户姓名、电话、地址等"
              prefix={<SearchOutlined />}
              style={{ width: 300 }}
              value={searchText}
              onChange={handleSearch}
              allowClear
            />
          </Space>
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={goToAddCustomer}
            >
              新增客户
            </Button>
            <Button 
              type="default" 
              icon={<ExportOutlined />} 
              onClick={handleExport}
            >
              导出Excel
            </Button>
          </Space>
        </div>
        
        <Table
          rowKey="id"
          dataSource={filteredCustomers}
          columns={columns}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            pageSize: 10,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          scroll={{ x: 1500 }}
          loading={loading}
          size="middle"
        />
      </Card>
      
      {/* 编辑模态框 */}
      <Modal
        title="编辑客户信息"
        visible={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setEditModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleSaveCustomer}>
            保存
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            label="电表号码"
            name="meter_number"
          >
            <Input placeholder="请输入电表号码" />
          </Form.Item>
          
          <Form.Item
            label="补充资料"
            name="station_management"
          >
            <Group
              options={[
                { label: '房产证', value: '房产证' },
                { label: '授权书', value: '授权书' },
                { label: '银行卡', value: '银行卡' },
                { label: '航拍', value: '航拍' },
                { label: '结构照', value: '结构照' },
                { label: '门头照', value: '门头照' },
                { label: '合同', value: '合同' },
              ]}
            />
          </Form.Item>
          
          <Form.Item
            label="备注"
            name="remarks"
          >
            <TextArea rows={4} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>
      
      {/* 使用常规CSS或styled-components替代jsx样式 */}
      <style>{`
        .surveyor-dashboard .ant-card {
          margin-bottom: 16px;
        }
        .surveyor-dashboard .ant-card:hover {
          box-shadow: 0 1px 2px -2px rgba(0,0,0,0.16), 0 3px 6px 0 rgba(0,0,0,0.12), 0 5px 12px 4px rgba(0,0,0,0.09);
        }
      `}</style>
    </div>
  )
}

export default SurveyorDashboard 