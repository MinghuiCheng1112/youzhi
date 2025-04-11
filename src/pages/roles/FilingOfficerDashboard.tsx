import { useState, useEffect, useRef, useCallback } from 'react'
import { Table, Card, Input, Button, Typography, Space, message, Row, Col, Statistic, Tag, Tooltip, Progress, Empty } from 'antd'
import { SearchOutlined, ExportOutlined, ReloadOutlined, UserOutlined, FileTextOutlined, DollarOutlined, AreaChartOutlined, PieChartOutlined } from '@ant-design/icons'
import { customerApi } from '../../services/api'
import { Customer } from '../../types'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import { debounce } from 'lodash'
import { calculateAllFields } from '../../utils/calculationUtils'
// 如果遇到类型声明问题，请运行: npm i --save-dev @types/lodash

// 扩展Customer类型，确保filing_capacity属性可用
interface ExtendedCustomer extends Customer {
  filing_capacity: number;
}

const { Title, Text } = Typography

// 定义卡片样式
const CARD_STYLE: React.CSSProperties = {
  height: '140px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.09)',
  borderRadius: '8px',
  transition: 'all 0.3s',
  padding: '0 16px'
}

const FilingOfficerDashboard = () => {
  const [customers, setCustomers] = useState<ExtendedCustomer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<ExtendedCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    filedCount: 0,
    pendingCount: 0,
    todayFiledCount: 0,
    thisWeekFiledCount: 0,
    totalCapacity: 0,
    totalInvestment: 0,
    totalLandArea: 0
  })

  // 数据加载状态跟踪
  const dataLoadedRef = useRef(false)

  // 获取所有客户数据 - 添加缓存机制
  useEffect(() => {
    if (!dataLoadedRef.current) {
      fetchCustomers()
    }
  }, [])

  // 计算统计数据
  useEffect(() => {
    if (customers.length > 0) {
      const filedCount = customers.filter(c => c.filing_date && dayjs(c.filing_date).isValid()).length
      const pendingCount = customers.filter(c => !c.filing_date || !dayjs(c.filing_date).isValid()).length
      
      // 计算今日备案数量
      const today = dayjs().startOf('day')
      const todayFiledCount = customers.filter(c => 
        c.filing_date && dayjs(c.filing_date).isValid() && dayjs(c.filing_date).isAfter(today)
      ).length
      
      // 计算本周备案数量
      const startOfWeek = dayjs().startOf('week')
      const thisWeekFiledCount = customers.filter(c => 
        c.filing_date && dayjs(c.filing_date).isValid() && dayjs(c.filing_date).isAfter(startOfWeek)
      ).length
      
      // 计算总备案容量
      const totalFilingCapacity = parseFloat(customers.reduce((sum, c) => {
        // 如果有filing_capacity字段，使用该字段值
        // 否则如果有module_count，计算备案容量
        // 否则使用capacity字段值（兼容旧数据）
        const filingCapacity = c.filing_capacity ? c.filing_capacity : 
          (c.module_count ? parseFloat(((c.module_count + 5) * 0.71).toFixed(2)) : (c.capacity || 0));
        return sum + filingCapacity;
      }, 0).toFixed(2))
      
      // 计算总投资金额
      const totalInvestment = customers.reduce((sum, c) => sum + (c.investment_amount || 0), 0)
      
      // 计算总用地面积
      const totalLandArea = parseFloat(customers.reduce((sum, c) => sum + (c.land_area || 0), 0).toFixed(2))
      
      setStats({
        total: customers.length,
        filedCount,
        pendingCount,
        todayFiledCount,
        thisWeekFiledCount,
        totalCapacity: totalFilingCapacity, // 使用备案容量
        totalInvestment,
        totalLandArea
      })
    }
  }, [customers])

  // 计算统计数据 - 基于筛选后的客户
  useEffect(() => {
    if (filteredCustomers.length === 0) {
      // 当筛选结果为空时，不改变统计数据，仍显示总体统计
      // 此处不更新统计数据，而是等待filteredCustomers变化时再更新
      return;
    }
    
    const filedCount = filteredCustomers.filter(c => c.filing_date && dayjs(c.filing_date).isValid()).length
    const pendingCount = filteredCustomers.filter(c => !c.filing_date || !dayjs(c.filing_date).isValid()).length
    
    // 计算今日备案数量
    const today = dayjs().startOf('day')
    const todayFiledCount = filteredCustomers.filter(c => 
      c.filing_date && dayjs(c.filing_date).isValid() && dayjs(c.filing_date).isAfter(today)
    ).length
    
    // 计算本周备案数量
    const startOfWeek = dayjs().startOf('week')
    const thisWeekFiledCount = filteredCustomers.filter(c => 
      c.filing_date && dayjs(c.filing_date).isValid() && dayjs(c.filing_date).isAfter(startOfWeek)
    ).length
    
    // 计算总备案容量
    const totalFilingCapacity = parseFloat(filteredCustomers.reduce((sum, c) => {
      // 如果有filing_capacity字段，使用该字段值
      // 否则如果有module_count，计算备案容量
      // 否则使用capacity字段值（兼容旧数据）
      const filingCapacity = c.filing_capacity ? c.filing_capacity : 
        (c.module_count ? parseFloat(((c.module_count + 5) * 0.71).toFixed(2)) : (c.capacity || 0));
      return sum + filingCapacity;
    }, 0).toFixed(2))
    
    // 计算总投资金额
    const totalInvestment = filteredCustomers.reduce((sum, c) => sum + (c.investment_amount || 0), 0)
    
    setStats({
      total: filteredCustomers.length,
      filedCount,
      pendingCount,
      todayFiledCount,
      thisWeekFiledCount,
      totalCapacity: totalFilingCapacity, // 使用备案容量
      totalInvestment,
      totalLandArea: filteredCustomers.reduce((sum, c) => sum + (c.land_area || 0), 0)
    })
  }, [filteredCustomers])

  // 根据搜索关键词筛选客户
  useEffect(() => {
    if (searchText.trim()) {
      setFilteredCustomers(applySearchFilter(customers, searchText))
    } else {
      setFilteredCustomers(customers)
    }
  }, [customers, searchText])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      // 获取所有客户数据，不过滤
      const data = await customerApi.getAll()
      
      // 确保所有数据字段都正确计算
      const processedData = data.map(customer => {
        // 如果客户有module_count字段，重新计算相关值
        if (customer.module_count) {
          const calculatedFields = calculateAllFields(customer.module_count)
          return {
            ...customer,
            ...calculatedFields
          }
        }
        return customer
      }) as ExtendedCustomer[] // 类型转换为ExtendedCustomer[]
      
      // 确保不过滤任何客户数据
      setCustomers(processedData)
      setFilteredCustomers(processedData)
      // 标记数据已加载
      dataLoadedRef.current = true
    } catch (error) {
      message.error('获取客户数据失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // 应用搜索过滤 - 支持多个关键字
  const applySearchFilter = (data: ExtendedCustomer[], value: string) => {
    // 如果搜索为空，返回所有数据
    if (!value.trim()) return data;
    
    // 支持逗号或空格分隔的多个关键字
    const keywords = value.toLowerCase().split(/[\s,，]+/).filter(k => k.trim() !== '');
    
    // 如果没有关键字，返回所有数据
    if (keywords.length === 0) return data;
    
    return data.filter(customer => {
      const customerName = (customer.customer_name || '').toLowerCase();
      const phone = (customer.phone || '').toLowerCase();
      const address = (customer.address || '').toLowerCase();
      const idCard = (customer.id_card || '').toLowerCase();
      const salesman = (customer.salesman || '').toLowerCase();
      const constructionTeam = (customer.construction_team || '').toLowerCase();
      
      // 每个关键词都要求精准匹配各个字段
      // 例如，输入"张三"会匹配姓名为"张三"而不是"张三丰"的客户
      return keywords.some(keyword => 
        customerName === keyword || 
        phone === keyword || 
        address === keyword || 
        idCard === keyword || 
        salesman === keyword || 
        constructionTeam === keyword
      );
    });
  }

  // 搜索功能 - 使用防抖优化性能
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchText(value)
    }, 300),
    [customers]
  )

  // 搜索处理函数
  const handleSearch = (value: string) => {
    setSearchText(value)
    debouncedSearch(value)
  }

  // 导出客户数据
  const handleExport = () => {
    try {
      // 准备要导出的数据
      const exportData = filteredCustomers.map(customer => ({
        '登记日期': customer.register_date ? dayjs(customer.register_date).format('YYYY-MM-DD') : '',
        '客户姓名': customer.customer_name,
        '客户电话': customer.phone,
        '地址': customer.address,
        '身份证号': customer.id_card,
        '备案容量': customer.filing_capacity,
        '投资金额': customer.investment_amount,
        '用地面积': customer.land_area,
        '备案日期': customer.filing_date ? 
          (dayjs(customer.filing_date).isValid() ? 
            dayjs(customer.filing_date).format('YYYY-MM-DD') : 
            customer.filing_date) : 
          ''
      }))

      // 创建工作簿和工作表
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)

      // 将工作表添加到工作簿
      XLSX.utils.book_append_sheet(wb, ws, '客户数据')

      // 保存文件
      XLSX.writeFile(wb, `备案客户数据_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败')
      console.error(error)
    }
  }

  // 表格列定义
  const columns = [
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      sorter: (a: ExtendedCustomer, b: ExtendedCustomer) => a.customer_name.localeCompare(b.customer_name),
      render: (text: string) => (
        <span style={{ fontWeight: 'bold' }}>{text}</span>
      ),
      fixed: 'left' as const,
      width: 100
    },
    {
      title: '备案容量',
      dataIndex: 'filing_capacity',
      key: 'filing_capacity',
      render: (text: number, record: ExtendedCustomer) => {
        // 如果有module_count但没有filing_capacity，重新计算
        const filingCapacity = record.module_count && !text ? 
          parseFloat(((record.module_count + 5) * 0.71).toFixed(2)) : 
          text;
        
        return filingCapacity ? <Tag color="blue">{filingCapacity} KW</Tag> : '-';
      },
      sorter: (a: ExtendedCustomer, b: ExtendedCustomer) => (a.filing_capacity || 0) - (b.filing_capacity || 0),
      width: 110
    },
    {
      title: '客户地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text}</span>
        </Tooltip>
      ),
      sorter: (a: ExtendedCustomer, b: ExtendedCustomer) => (a.address || '').localeCompare(b.address || ''),
      width: 180
    },
    {
      title: '身份证号',
      dataIndex: 'id_card',
      key: 'id_card',
      ellipsis: true,
      render: (text: string) => <span>{text}</span>,
      sorter: (a: ExtendedCustomer, b: ExtendedCustomer) => (a.id_card || '').localeCompare(b.id_card || ''),
      width: 160
    },
    {
      title: '客户电话',
      dataIndex: 'phone',
      key: 'phone',
      render: (text: string) => <a href={`tel:${text}`}>{text}</a>,
      sorter: (a: ExtendedCustomer, b: ExtendedCustomer) => (a.phone || '').localeCompare(b.phone || ''),
      width: 120
    },
    {
      title: '投资金额',
      dataIndex: 'investment_amount',
      key: 'investment_amount',
      render: (text: number, record: ExtendedCustomer) => {
        // 如果有module_count但没有investment_amount，重新计算
        const amount = record.module_count && !text ? 
          parseFloat((record.module_count * 0.71 * 0.25).toFixed(2)) : 
          text;
        
        return amount ? <span style={{ color: '#389e0d' }}>¥ {amount}</span> : '-';
      },
      sorter: (a: ExtendedCustomer, b: ExtendedCustomer) => (a.investment_amount || 0) - (b.investment_amount || 0),
      width: 100
    },
    {
      title: '用地面积',
      dataIndex: 'land_area',
      key: 'land_area',
      render: (text: number, record: ExtendedCustomer) => {
        // 如果有module_count但没有land_area，重新计算
        const area = record.module_count && !text ? 
          parseFloat((record.module_count * 3.106).toFixed(2)) : 
          text;
        
        return area ? <span>{area} m²</span> : '-';
      },
      sorter: (a: ExtendedCustomer, b: ExtendedCustomer) => (a.land_area || 0) - (b.land_area || 0),
      width: 100
    },
    {
      title: '备案日期',
      dataIndex: 'filing_date',
      key: 'filing_date',
      render: (text: string) => {
        // 检查日期是否为有效日期
        if (text) {
          try {
            const date = dayjs(text);
            if (date.isValid()) {
              return <Tag color="green">{date.format('YYYY-MM-DD')}</Tag>;
            } else {
              // 显示原始值而不是"日期无效"
              return <Tag color="red">{text}</Tag>;
            }
          } catch (error) {
            console.error('备案日期格式错误:', text, error);
            // 显示原始值而不是"日期无效"
            return <Tag color="red">{text}</Tag>;
          }
        } else {
          return <Tag color="orange">未备案</Tag>;
        }
      },
      sorter: (a: ExtendedCustomer, b: ExtendedCustomer) => {
        if (!a.filing_date && !b.filing_date) return 0;
        if (!a.filing_date) return -1;
        if (!b.filing_date) return 1;
        
        // 确保日期格式正确
        try {
          const aDate = dayjs(a.filing_date);
          const bDate = dayjs(b.filing_date);
          
          if (!aDate.isValid()) return -1;
          if (!bDate.isValid()) return 1;
          
          return aDate.valueOf() - bDate.valueOf();
        } catch (error) {
          console.error('排序日期比较错误:', error);
          return 0;
        }
      },
      width: 110
    }
  ]

  return (
    <div className="filing-dashboard">
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div><UserOutlined /> 客户总数</div>} 
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
              title={<div><FileTextOutlined /> 已备案客户</div>} 
              value={stats.filedCount} 
              valueStyle={{ color: '#52c41a' }}
              suffix={<Text type="secondary" style={{ fontSize: '14px' }}>{stats.total ? `(${Math.round(stats.filedCount / stats.total * 100)}%)` : ''}</Text>}
            />
            {stats.total > 0 && (
              <Progress percent={Math.round(stats.filedCount / stats.total * 100)} strokeColor="#52c41a" style={{ marginTop: 8 }} />
            )}
          </Card>
        </Col>
        <Col span={5}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div><PieChartOutlined /> 总备案容量</div>} 
              value={stats.totalCapacity.toFixed(2)} 
              valueStyle={{ color: '#fa8c16' }}
              suffix="KW"
            />
            <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>
              {stats.filedCount > 0 ? `平均每户: ${(stats.totalCapacity / stats.total).toFixed(2)} KW` : '暂无数据'}
            </div>
          </Card>
        </Col>
        <Col span={5}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div><AreaChartOutlined /> 总用地面积</div>} 
              value={stats.totalLandArea ? stats.totalLandArea.toFixed(2) : '0.00'} 
              valueStyle={{ color: '#722ed1' }}
              suffix="m²"
            />
            <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>
              {stats.total > 0 ? `平均每户: ${(stats.totalLandArea / stats.total).toFixed(2)} m²` : '暂无数据'}
            </div>
          </Card>
        </Col>
        <Col span={5}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title={<div><DollarOutlined /> 总投资金额</div>} 
              value={stats.totalInvestment} 
              valueStyle={{ color: '#13c2c2' }}
              formatter={(value) => `¥ ${typeof value === 'number' ? value.toFixed(2) : Number(value).toFixed(2)}`}
            />
            <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>
              {stats.total > 0 ? `平均每户: ¥${Math.round(stats.totalInvestment / stats.total).toLocaleString()}` : '暂无数据'}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 搜索栏 - 按要求将标题放在搜索框前边 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 16 }}>
        <Space size="middle">
          <Title level={2} style={{ margin: 0 }}>备案工作台</Title>
          <Input
            placeholder="搜索客户姓名、电话、地址等"
            prefix={<SearchOutlined />}
            style={{ width: 300 }}
            value={searchText}
            onChange={e => handleSearch(e.target.value)}
            allowClear
          />
        </Space>
        
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchCustomers}
            loading={loading}
          >
            刷新
          </Button>
          
          <Button 
            type="primary" 
            icon={<ExportOutlined />} 
            onClick={handleExport}
            disabled={filteredCustomers.length === 0}
          >
            导出
          </Button>
          
          <Text>
            {filteredCustomers.length > 0 ? `显示 ${filteredCustomers.length} 条记录，共 ${customers.length} 条` : '显示 0 条记录，共 0 条'}
          </Text>
        </Space>
      </div>

      <Card 
        style={{ 
          boxShadow: '0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09)',
          borderRadius: '8px'
        }}
      >
        <Table
          columns={columns}
          dataSource={filteredCustomers}
          rowKey="id"
          loading={loading}
          pagination={false}
          rowClassName={(record) => record.filing_date ? 'filed-row' : ''}
          size="middle"
          scroll={{ x: 'max-content', y: 600 }}
          locale={{
            emptyText: <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          }}
        />
      </Card>

      <style>
        {`
         .filing-dashboard .ant-card {
           transition: all 0.3s;
         }
         .filing-dashboard .ant-card:hover {
           transform: translateY(-5px);
           box-shadow: 0 2px 10px rgba(0,0,0,0.12);
         }
         .filed-row {
           background-color: #f6ffed;
         }
         .ant-tabs-tab.ant-tabs-tab-active {
           font-weight: bold;
         }
         .ant-table-thead > tr > th {
           background: #fafafa;
           font-weight: 600;
           text-align: center;
           vertical-align: middle;
         }
         .ant-table-tbody > tr > td {
           padding: 12px 8px;
           vertical-align: middle;
         }
         .ant-table-tbody > tr:hover > td {
           background-color: #e6f7ff;
         }
         .ant-table {
           line-height: 1.5;
         }
         /* 显示所有客户信息，不设置高度限制 */
         .customer-detail-modal .ant-modal-body {
           max-height: none;
           overflow-y: auto;
         }
        `}
      </style>
    </div>
  )
}

export default FilingOfficerDashboard