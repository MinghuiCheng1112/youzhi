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
  ToolOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import { customerApi } from '../../services/api'
import { Customer } from '../../types'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

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
  specs: string;
  perHousehold: number;
  price: number;
  editable?: boolean;
}

// 采购计算结果类型
interface CalculationResult {
  id: string;
  name: string;
  specs: string;
  perHousehold: number;
  quantity: number;
  price: number;
  totalPrice: number;
}

// 预定义的商品信息
const DEFAULT_MATERIALS: Material[] = [
  { id: '1', name: '南飞锌镁铝方矩管ZM275', specs: '100*100*2.0', perHousehold: 10, price: 180.11 },
  { id: '2', name: '南飞锌镁铝方矩管ZM275', specs: '40*60*2.0', perHousehold: 40, price: 85.62 },
  { id: '3', name: '南飞锌镁铝方矩管ZM275', specs: '50*100*2.0', perHousehold: 10, price: 133.54 },
  { id: '4', name: '南飞锌镁铝方矩管ZM275', specs: '40*40*2.0', perHousehold: 6, price: 68.17 },
  { id: '5', name: '南飞锌镁铝角钢光伏支架ZM275', specs: '40*40*2.5', perHousehold: 6, price: 46.84 },
  { id: '6', name: '南飞柱底钢板Q235B', specs: '200*200*6', perHousehold: 25, price: 9.95 },
  { id: '7', name: '南飞柱底加劲板Q235B', specs: '45*100*4.0', perHousehold: 40, price: 0.82 },
  { id: '8', name: '南飞不锈钢膨胀螺栓SUS304', specs: 'M12*80', perHousehold: 100, price: 1.53 },
  { id: '9', name: '南飞U型80防水压块组合', specs: 'U型螺栓:M8*50*105mm\n配套螺母\n上压块带刺片:80*52*2.5mm\n下垫板:70*28*2.5mm', perHousehold: 200, price: 1.43 },
  { id: '10', name: '南飞阳光房四级纵向小水槽', specs: '2360mm', perHousehold: 45, price: 7.81 },
  { id: '11', name: '南飞阳光房四级纵向中水槽', specs: '4000mm', perHousehold: 13, price: 31.54 },
  { id: '12', name: '南飞阳光房四级主水槽', specs: '4000mm', perHousehold: 8, price: 57.05 },
  { id: '13', name: '南飞阳光房阳光房四级横向小水槽', specs: '适用60*40檩条', perHousehold: 12, price: 31.84 },
  { id: '14', name: '南飞阳光房四级包边水槽', specs: '适用60*40檩条', perHousehold: 15, price: 21.64 },
  { id: '15', name: '南飞阳光房四级屋脊水槽', specs: '适用60*40檩条', perHousehold: 4, price: 35.82 },
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
        specs: material.specs,
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
      title: '货位名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '规格型号',
      dataIndex: 'specs',
      key: 'specs',
      width: 200,
      render: (text: string) => (
        <Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
          {text}
        </Text>
      )
    },
    {
      title: '每户用料',
      dataIndex: 'perHousehold',
      key: 'perHousehold',
      width: 120,
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
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      width: 120,
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
            <Text type="danger">{text.toFixed(2)}</Text>
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
      title: '货位名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '规格型号',
      dataIndex: 'specs',
      key: 'specs',
      width: 200,
      render: (text: string) => (
        <Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
          {text}
        </Text>
      )
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
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      align: 'right' as const,
      render: (text: number) => <Text type="secondary">{text.toFixed(2)}</Text>,
    },
    {
      title: '总价',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 120,
      align: 'right' as const,
      render: (text: number) => <Text type="danger" strong>{text.toFixed(2)}</Text>,
    }
  ]

  // 添加导出Excel功能
  const exportToExcel = () => {
    try {
      // 如果没有计算结果，则创建空的数据集
      if (calculationResults.length === 0) {
        message.info('暂无计算结果数据');
        return;
      }

      // 准备导出数据
      const exportData = calculationResults.map(item => ({
        '货位名称': item.name,
        '规格型号': item.specs.replace(/\n/g, ' '), // 将换行替换为空格
        '每户用料': item.perHousehold,
        '总用料': item.quantity,
        '单价': item.price,
        '总价': item.totalPrice
      }));

      // 添加总计行
      exportData.push({
        '货位名称': '总计',
        '规格型号': '',
        '每户用料': null,
        '总用料': null,
        '单价': null,
        '总价': totalAmount
      });

      // 添加吨数行
      exportData.push({
        '货位名称': '吨数 (总价/5055)',
        '规格型号': '',
        '每户用料': null,
        '总用料': null,
        '单价': null,
        '总价': tonnage
      });

      // 格式化数据的显示方式
      const workbookOptions = { bookType: 'xlsx', bookSST: false, type: 'binary' };
      
      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // 设置列宽
      const colWidths = [
        { wch: 25 }, // 货位名称
        { wch: 30 }, // 规格型号
        { wch: 10 }, // 每户用料
        { wch: 10 }, // 总用料
        { wch: 10 }, // 单价
        { wch: 15 }  // 总价
      ];
      worksheet['!cols'] = colWidths;

      // 创建工作簿
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '用料计算');

      // 生成Excel文件并下载
      const excelFileName = `采购计算表_${dayjs().format('YYYY-MM-DD')}.xlsx`;
      XLSX.writeFile(workbook, excelFileName);

      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

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
          tab={<span><ToolOutlined /> 采购材料表</span>} 
          key="1"
        >
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <InboxOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                <span>采购材料表</span>
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
            extra={
              <Button 
                type="primary" 
                icon={<DownloadOutlined />} 
                onClick={exportToExcel}
              >
                导出Excel
              </Button>
            }
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
         /* 修复滚动条样式 */
         .ant-table-body {
           overflow-y: auto !important;
           overflow-x: hidden !important;
           max-height: 500px !important;
         }
         .ant-table-body::-webkit-scrollbar {
           width: 8px;
           background-color: #f1f1f1;
         }
         .ant-table-body::-webkit-scrollbar-thumb {
           background-color: #bfbfbf;
           border-radius: 4px;
         }
         .ant-table-body::-webkit-scrollbar-track {
           background-color: #f1f1f1;
         }
         .ant-table-body::-webkit-scrollbar-button {
           display: block;
           height: 8px;
           background-color: #bfbfbf;
         }
         .ant-table-body::-webkit-scrollbar-button:start:decrement,
         .ant-table-body::-webkit-scrollbar-button:end:increment {
           display: block;
           height: 8px;
           background-color: #f1f1f1;
           background-repeat: no-repeat;
           background-position: center center;
         }
         .ant-table-body::-webkit-scrollbar-button:start:decrement {
           background-image: linear-gradient(to top, #bfbfbf 50%, transparent 50%);
           border-top-left-radius: 2px;
           border-top-right-radius: 2px;
         }
         .ant-table-body::-webkit-scrollbar-button:end:increment {
           background-image: linear-gradient(to bottom, #bfbfbf 50%, transparent 50%);
           border-bottom-left-radius: 2px;
           border-bottom-right-radius: 2px;
         }
        `}
      </style>
    </div>
  )
}

export default ProcurementDashboard