import { useState, useEffect } from 'react'
import { Card, Typography, Table, Button, Input, Space, message, Spin, Empty, Statistic, Row, Col, Progress, Tag, InputNumber, Form, Tabs, Divider } from 'antd'
import { 
  ReloadOutlined, 
  SearchOutlined, 
  ShoppingCartOutlined, 
  TeamOutlined, 
  MoneyCollectOutlined, 
  ShoppingOutlined,
  InboxOutlined,
  CalculatorOutlined,
  EditOutlined,
  DollarOutlined,
  ToolOutlined
} from '@ant-design/icons'
import { customerApi } from '../../services/api'
import { Customer } from '../../types'
import dayjs from 'dayjs'

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

// 定义商品信息类型
interface Material {
  id: string;
  name: string;
  perHousehold: number;
  price: number;
  editable?: boolean;
}

// 采购计算结果类型
interface CalculationResult {
  id: string;
  name: string;
  perHousehold: number;
  quantity: number;
  price: number;
  totalPrice: number;
}

// 预定义的商品信息
const DEFAULT_MATERIALS: Material[] = [
  { id: '1', name: '方矩管100*100', perHousehold: 10, price: 180.11 },
  { id: '2', name: '方矩管40*60', perHousehold: 40, price: 85.62 },
  { id: '3', name: '方矩管50*100', perHousehold: 10, price: 133.54 },
  { id: '4', name: '方矩管40*40', perHousehold: 6, price: 68.17 },
  { id: '5', name: '角钢', perHousehold: 6, price: 46.84 },
  { id: '6', name: '柱底钢板', perHousehold: 25, price: 9.95 },
  { id: '7', name: '加劲板4.0', perHousehold: 40, price: 0.82 },
  { id: '8', name: '膨胀螺栓M12*80', perHousehold: 100, price: 1.53 },
  { id: '9', name: '80防水压块', perHousehold: 200, price: 1.43 },
  { id: '10', name: '纵向小水槽', perHousehold: 45, price: 7.81 },
  { id: '11', name: '纵向中水槽', perHousehold: 13, price: 31.54 },
  { id: '12', name: '主水槽', perHousehold: 8, price: 57.05 },
  { id: '13', name: '横向小水槽', perHousehold: 12, price: 31.84 },
  { id: '14', name: '包边水槽', perHousehold: 15, price: 21.64 },
  { id: '15', name: '屋脊水槽', perHousehold: 4, price: 35.82 },
];

const ProcurementDashboard = () => {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('1')
  
  // 采购计算相关状态
  const [materials, setMaterials] = useState<Material[]>(DEFAULT_MATERIALS)
  const [households, setHouseholds] = useState<number>(1)
  const [calculationResults, setCalculationResults] = useState<CalculationResult[]>([])
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const [tonnage, setTonnage] = useState<number>(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'perHousehold' | 'price' | null>(null)
  const [form] = Form.useForm()

  // 计算用料和价格
  useEffect(() => {
    calculateMaterials()
  }, [households, materials])

  // 计算材料数量和价格
  const calculateMaterials = () => {
    // 计算每种材料的数量和价格
    const results = materials.map(material => {
      const quantity = households > 0 ? Math.ceil(material.perHousehold * households) : 0
      const totalPrice = quantity * material.price
      return {
        id: material.id,
        name: material.name,
        perHousehold: material.perHousehold,
        quantity,
        price: material.price,
        totalPrice
      }
    })

    // 计算总价格和吨数
    const total = results.reduce((sum, item) => sum + item.totalPrice, 0)
    const tons = total / 5055

    setCalculationResults(results)
    setTotalAmount(total)
    setTonnage(tons)
  }

  // 更新每户用料数量
  const updateMaterialUsage = (id: string, field: 'perHousehold' | 'price', value: number) => {
    const updatedMaterials = materials.map(material => 
      material.id === id ? { ...material, [field]: value } : material
    )
    setMaterials(updatedMaterials)
  }

  // 开始编辑
  const startEditing = (id: string, field: 'perHousehold' | 'price') => {
    setEditingId(id)
    setEditingField(field)
    const material = materials.find(m => m.id === id)
    if (material) {
      form.setFieldsValue({ [field]: material[field] })
    }
  }

  // 保存编辑
  const saveEdit = async (id: string) => {
    try {
      if (!editingField) return
      const values = await form.validateFields()
      updateMaterialUsage(id, editingField, values[editingField])
      setEditingId(null)
      setEditingField(null)
    } catch (error) {
      console.error('验证失败:', error)
    }
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null)
    setEditingField(null)
  }

  // 商品信息表格列定义
  const materialsColumns = [
    {
      title: '序号',
      dataIndex: 'id',
      key: 'id',
      width: 70,
      align: 'center' as const,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '商品名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '每户用料',
      dataIndex: 'perHousehold',
      key: 'perHousehold',
      width: 150,
      align: 'center' as const,
      render: (text: number, record: Material) => {
        const isEditing = record.id === editingId && editingField === 'perHousehold'
        return isEditing ? (
          <Form form={form} component={false}>
            <Form.Item
              name="perHousehold"
              style={{ margin: 0 }}
              rules={[{ required: true, message: '请输入数量' }]}
            >
              <InputNumber 
                min={0} 
                precision={0} 
                style={{ width: '100%' }} 
                autoFocus
                onPressEnter={() => saveEdit(record.id)}
                onBlur={() => saveEdit(record.id)}
              />
            </Form.Item>
          </Form>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tag color="green">{text}</Tag>
            <Button 
              type="link" 
              icon={<EditOutlined />} 
              onClick={() => startEditing(record.id, 'perHousehold')} 
              size="small"
              style={{ marginLeft: 8 }}
            />
          </div>
        )
      },
    },
    {
      title: '单价 (元)',
      dataIndex: 'price',
      key: 'price',
      width: 150,
      align: 'center' as const,
      render: (text: number, record: Material) => {
        const isEditing = record.id === editingId && editingField === 'price'
        return isEditing ? (
          <Form form={form} component={false}>
            <Form.Item
              name="price"
              style={{ margin: 0 }}
              rules={[{ required: true, message: '请输入单价' }]}
            >
              <InputNumber 
                min={0} 
                precision={2} 
                style={{ width: '100%' }} 
                autoFocus
                onPressEnter={() => saveEdit(record.id)}
                onBlur={() => saveEdit(record.id)}
              />
            </Form.Item>
          </Form>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="danger">¥ {text.toFixed(2)}</Text>
            <Button 
              type="link" 
              icon={<EditOutlined />} 
              onClick={() => startEditing(record.id, 'price')} 
              size="small"
              style={{ marginLeft: 8 }}
            />
          </div>
        )
      },
    }
  ]

  // 计算结果表格列定义
  const calculationColumns = [
    {
      title: '商品名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '每户用料',
      dataIndex: 'perHousehold',
      key: 'perHousehold',
      width: 100,
      align: 'center' as const,
      render: (text: number) => <Tag color="green">{text}</Tag>
    },
    {
      title: '总用料',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'center' as const,
      render: (text: number) => <Tag color="purple">{text}</Tag>
    },
    {
      title: '单价 (元)',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      align: 'right' as const,
      render: (text: number) => <Text type="secondary">¥ {text.toFixed(2)}</Text>,
    },
    {
      title: '总价 (元)',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 130,
      align: 'right' as const,
      render: (text: number) => <Text type="danger" strong>¥ {text.toFixed(2)}</Text>,
    }
  ]

  return (
    <div className="procurement-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={2} style={{ margin: 0 }}>
          <ShoppingCartOutlined style={{ marginRight: 12 }} />
          采购工作台
        </Title>
      </div>

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        type="card"
        size="large"
        className="custom-tabs"
      >
        <TabPane 
          tab={<span><ToolOutlined /> 商品信息管理</span>} 
          key="1"
        >
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <InboxOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                <span>商品信息/每户用料/单价</span>
              </div>
            }
            style={{ 
              boxShadow: '0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09)',
              borderRadius: '8px',
              marginBottom: 16
            }}
            extra={
              <Text type="secondary">点击单价或用料后的编辑按钮可修改数值</Text>
            }
          >
            <Table
              columns={materialsColumns}
              dataSource={materials}
              rowKey="id"
              pagination={false}
              size="middle"
              scroll={{ y: 500 }}
              className="custom-table"
              rowClassName={() => 'material-row'}
            />
          </Card>
        </TabPane>

        <TabPane 
          tab={<span><CalculatorOutlined /> 用料计算</span>} 
          key="2"
        >
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <CalculatorOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                <span>用料计算工具</span>
              </div>
            }
            style={{ 
              boxShadow: '0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09)',
              borderRadius: '8px',
              marginBottom: 16
            }}
          >
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Card bordered={false} className="calculator-card">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text strong style={{ fontSize: '16px' }}>输入户数:</Text>
                    <InputNumber 
                      value={households} 
                      onChange={(value) => setHouseholds(value || 0)} 
                      min={0} 
                      step={0.1} 
                      style={{ width: '100%' }}
                      precision={1}
                      size="large"
                      addonBefore={<TeamOutlined />}
                    />
                  </div>
                </Card>
              </Col>
              
              <Col xs={24} sm={12} md={8} lg={6}>
                <Card 
                  bordered={false} 
                  className="result-card"
                  style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}
                >
                  <Statistic
                    title={<div style={{ fontSize: '16px', fontWeight: 'bold' }}><DollarOutlined /> 总价格 (元)</div>}
                    value={totalAmount}
                    precision={2}
                    valueStyle={{ color: '#cf1322', fontSize: '24px' }}
                    prefix="¥"
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12} md={8} lg={6}>
                <Card 
                  bordered={false} 
                  className="result-card"
                  style={{ background: '#e6f7ff', borderColor: '#91d5ff' }}
                >
                  <Statistic
                    title={<div style={{ fontSize: '16px', fontWeight: 'bold' }}><InboxOutlined /> 吨数</div>}
                    value={tonnage}
                    precision={2}
                    valueStyle={{ color: '#3f8600', fontSize: '24px' }}
                    suffix="吨"
                  />
                </Card>
              </Col>
            </Row>

            <Divider style={{ margin: '24px 0' }} />

            <Table
              columns={calculationColumns}
              dataSource={calculationResults}
              rowKey="id"
              pagination={false}
              size="middle"
              scroll={{ y: 500 }}
              className="custom-table"
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row className="summary-row">
                    <Table.Summary.Cell index={0} colSpan={4}>
                      <Text strong style={{ fontSize: '16px' }}>总计</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ fontSize: '16px', color: '#cf1322' }}>¥ {totalAmount.toFixed(2)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                  <Table.Summary.Row className="summary-row">
                    <Table.Summary.Cell index={0} colSpan={4}>
                      <Text strong style={{ fontSize: '16px' }}>吨数 (总价/5055)</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ fontSize: '16px', color: '#3f8600' }}>{tonnage.toFixed(2)} 吨</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Card>
        </TabPane>
      </Tabs>

      <style>
        {`
         .procurement-dashboard .ant-card {
           transition: all 0.3s;
           margin-bottom: 16px;
         }
         .procurement-dashboard .calculator-card,
         .procurement-dashboard .result-card {
           height: 120px;
           display: flex;
           flex-direction: column;
           justify-content: center;
         }
         .procurement-dashboard .ant-card:hover {
           transform: translateY(-3px);
           box-shadow: 0 2px 10px rgba(0,0,0,0.12);
         }
         .ant-table-thead > tr > th {
           background: #f0f5ff;
           font-weight: 600;
         }
         .ant-tabs-tab.ant-tabs-tab-active {
           font-weight: 600;
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
         .custom-table .ant-table-cell {
           padding: 12px 16px;
         }
         .material-row:hover {
           background-color: #f0f5ff;
         }
         .summary-row {
           background-color: #f6ffed;
         }
         .summary-row td {
           padding: 16px !important;
         }
        `}
      </style>
    </div>
  )
}

export default ProcurementDashboard