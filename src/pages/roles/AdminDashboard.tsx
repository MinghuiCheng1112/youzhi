import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Typography, Button, Space, Table, Tag, DatePicker, Select, Progress } from 'antd'
import { 
  TeamOutlined, 
  UserOutlined, 
  HomeOutlined, 
  BarChartOutlined, 
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  AreaChartOutlined,
  PieChartOutlined,
  TableOutlined
} from '@ant-design/icons'
import { customerApi } from '../../services/api'
import { Customer } from '../../types'
import dayjs from 'dayjs'
// @ts-ignore
import { Line, Pie } from '@ant-design/charts'

const { Title } = Typography
const { RangePicker } = DatePicker
const { Option } = Select

// 定义卡片样式常量
const CARD_STYLE = {
  height: '180px',
  margin: '0 0 16px 0',
  display: 'flex' as const,
  flexDirection: 'column' as const,
  justifyContent: 'center' as const
}

const CHART_CARD_STYLE = {
  height: '400px',
  margin: '0 0 16px 0',
}

const TABLE_CARD_STYLE = {
  margin: '0 0 16px 0',
}

const AdminDashboard = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs()
  ])
  const [statsView, setStatsView] = useState<'day' | 'month' | 'year'>('month')
  const [stats, setStats] = useState({
    totalCustomers: 0,
    completedCustomers: 0,
    pendingCustomers: 0,
    totalModules: 0,
    totalCapacity: 0,
    salesmanCount: 0,
    constructionTeamCount: 0,
    averageCompletionDays: 0
  })

  // 获取客户数据
  useEffect(() => {
    fetchCustomers()
  }, [])

  // 计算统计数据
  useEffect(() => {
    if (customers.length > 0) {
      // 基本统计
      // 检查客户数据，在控制台输出
      console.log('所有客户数据:', customers);
      
      // 根据实际情况过滤已完工的客户
      const completedCustomers = customers.filter(c => {
        // 更全面的检查，考虑到各种可能的已完工状态
        return Boolean(c.construction_status); 
      });
      
      // 输出已完工客户信息
      console.log('已完工客户:', completedCustomers);
      console.log('已完工客户数量:', completedCustomers.length);
      
      const completedCount = completedCustomers.length;
      const pendingCount = customers.length - completedCount;
      const totalModules = customers.reduce((sum, c) => sum + (c.module_count || 0), 0);
      
      // 计算已完工客户的总容量
      let totalCapacityValue = 0;
      completedCustomers.forEach(c => {
        // 详细检查容量值及其类型
        console.log(`客户 ${c.customer_name} 的容量值类型:`, typeof c.capacity);
        console.log(`客户 ${c.customer_name} 的原始容量值:`, c.capacity);
        
        // 尝试多种方式来解析容量值
        let capacityValue = 0;
        if (c.capacity !== undefined && c.capacity !== null) {
          if (typeof c.capacity === 'number') {
            capacityValue = c.capacity;
          } else if (typeof c.capacity === 'string') {
            // 尝试移除字符串中的非数字字符（可能有单位等）
            const capacityStr = String(c.capacity); // 确保是字符串
            const numericValue = capacityStr.replace(/[^0-9.]/g, '');
            if (numericValue && !isNaN(parseFloat(numericValue))) {
              capacityValue = parseFloat(numericValue);
            }
          } else {
            // 尝试强制转换
            const numValue = Number(c.capacity);
            if (!isNaN(numValue)) {
              capacityValue = numValue;
            }
          }
        }
        
        // 如果没有容量值，尝试从组件数量估算容量（每块组件约0.5kW）
        if (capacityValue <= 0 && c.module_count && c.module_count > 0) {
          capacityValue = c.module_count * 0.5; // 按每块组件0.5kW估算
          console.log(`客户 ${c.customer_name} 没有容量值，根据组件数量${c.module_count}估算容量为: ${capacityValue}`);
        }
        
        if (capacityValue > 0) {
          totalCapacityValue += capacityValue;
          console.log(`客户 ${c.customer_name} 的有效容量值: ${capacityValue}`);
        } else {
          console.log(`客户 ${c.customer_name} 没有有效的容量值`);
        }
      });
      
      // 格式化并输出总容量
      const totalCapacity = parseFloat(totalCapacityValue.toFixed(2));
      console.log('已完工总容量:', totalCapacity);
      
      
      // 获取唯一业务员和施工队数量
      const salesmen = new Set(customers.map(c => c.salesman).filter(Boolean))
      const teams = new Set(customers.map(c => c.construction_team).filter(Boolean))
      
      // 计算平均完工天数（从派工到完工）
      let totalDays = 0
      let completedWithDates = 0
      
      customers.forEach(customer => {
        if (customer.construction_status && customer.dispatch_date) {
          const dispatchDate = dayjs(customer.dispatch_date)
          const constructionDate = dayjs(customer.construction_status)
          const days = constructionDate.diff(dispatchDate, 'day')
          
          if (days >= 0) {
            totalDays += days
            completedWithDates++
          }
        }
      })
      
      const avgDays = completedWithDates > 0 ? Math.round(totalDays / completedWithDates) : 0
      
      setStats({
        totalCustomers: customers.length,
        completedCustomers: completedCount,
        pendingCustomers: pendingCount,
        totalModules: totalModules,
        totalCapacity: totalCapacity,
        salesmanCount: salesmen.size,
        constructionTeamCount: teams.size,
        averageCompletionDays: avgDays
      })
    }
  }, [customers])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      // 获取所有客户
      const data = await customerApi.getAll()
      
      // 过滤出未删除的客户
      const activeCustomers = data.filter(customer => customer.status !== 'deleted')
      
      setCustomers(activeCustomers)
    } catch (error) {
      console.error('获取客户数据失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 按业务员分组的客户数量
  const getSalesmanData = () => {
    const salesmanMap = new Map<string, number>()
    
    customers.forEach(customer => {
      // 使用有效的业务员名称，如果为空则使用"未分配"
      const salesmanName = customer.salesman || "未分配业务员"
      const count = salesmanMap.get(salesmanName) || 0
      salesmanMap.set(salesmanName, count + 1)
    })
    
    return Array.from(salesmanMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10) // 只取前10名
  }

  // 按施工队分组的客户数量
  const getConstructionTeamData = () => {
    const teamMap = new Map<string, number>()
    
    customers.forEach(customer => {
      // 使用有效的施工队名称，如果为空则使用"未分配"
      const teamName = customer.construction_team || "未分配施工队"
      const count = teamMap.get(teamName) || 0
      teamMap.set(teamName, count + 1)
    })
    
    return Array.from(teamMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10) // 只取前10名
  }

  // 获取每月/每日/每年新增客户数据
  const getTimeSeriesData = () => {
    const timeFormat = statsView === 'day' ? 'YYYY-MM-DD' : 
                      statsView === 'month' ? 'YYYY-MM' : 'YYYY'
    
    const timeMap = new Map<string, number>()
    
    // 初始化时间序列，确保没有数据的时间点也显示
    let current = dateRange[0].clone()
    while (current.isBefore(dateRange[1]) || current.isSame(dateRange[1], statsView)) {
      timeMap.set(current.format(timeFormat), 0)
      if (statsView === 'day') {
        current = current.add(1, 'day')
      } else if (statsView === 'month') {
        current = current.add(1, 'month')
      } else {
        current = current.add(1, 'year')
      }
    }
    
    // 统计实际数据
    customers.forEach(customer => {
      if (customer.register_date) {
        const date = dayjs(customer.register_date)
        if (date.isAfter(dateRange[0]) && date.isBefore(dateRange[1])) {
          const key = date.format(timeFormat)
          const count = timeMap.get(key) || 0
          timeMap.set(key, count + 1)
        }
      }
    })
    
    return Array.from(timeMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  // 最近注册的客户
  const getRecentCustomers = () => {
    return [...customers]
      .sort((a, b) => new Date(b.register_date || '').getTime() - new Date(a.register_date || '').getTime())
      .slice(0, 5)
  }

  // 表格列定义
  const columns = [
    {
      title: '登记日期',
      dataIndex: 'register_date',
      key: 'register_date',
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
    },
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: '客户地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
    },
    {
      title: '业务员',
      dataIndex: 'salesman',
      key: 'salesman',
    },
    {
      title: '组件数量',
      dataIndex: 'module_count',
      key: 'module_count',
    },
    {
      title: '容量(kW)',
      dataIndex: 'capacity',
      key: 'capacity',
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: Customer) => {
        if (record.construction_status) {
          return <Tag color="green" icon={<CheckCircleOutlined />}>已完工</Tag>
        }
        if (record.dispatch_date) {
          return <Tag color="blue" icon={<ClockCircleOutlined />}>已派工</Tag>
        }
        if (record.square_steel_outbound_date || record.component_outbound_date) {
          return <Tag color="orange" icon={<ClockCircleOutlined />}>已出库</Tag>
        }
        return <Tag icon={<ClockCircleOutlined />}>已登记</Tag>
      },
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={2}>管理工作台</Title>
        <Space>
          <Button 
            type="primary"
            icon={<ReloadOutlined />} 
            onClick={fetchCustomers}
          >
            刷新数据
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title="客户总数" 
              value={stats.totalCustomers} 
              prefix={<TeamOutlined />}
              suffix="户" 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title="已完工" 
              value={stats.completedCustomers} 
              prefix={<CheckCircleOutlined />}
              suffix="户" 
              valueStyle={{ color: '#3f8600' }}
            />
            <div style={{ marginTop: 8 }}>
              <Progress 
                percent={stats.totalCustomers ? Math.round(stats.completedCustomers / stats.totalCustomers * 100) : 0} 
                size="small" 
                status="success" 
              />
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title="已完工装机容量" 
              value={stats.totalCapacity.toFixed(2)} 
              prefix={<BarChartOutlined />}
              suffix="kW" 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title="平均完工天数" 
              value={stats.averageCompletionDays} 
              prefix={<ClockCircleOutlined />}
              suffix="天" 
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title="组件总数" 
              value={stats.totalModules} 
              prefix={<HomeOutlined />}
              suffix="块" 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title="业务员数量" 
              value={stats.salesmanCount} 
              prefix={<UserOutlined />}
              suffix="人" 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title="施工队数量" 
              value={stats.constructionTeamCount} 
              prefix={<TeamOutlined />}
              suffix="队" 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable style={CARD_STYLE}>
            <Statistic 
              title="待完工客户" 
              value={stats.pendingCustomers} 
              prefix={<ClockCircleOutlined />}
              suffix="户" 
              valueStyle={{ color: '#cf1322' }}
            />
            <div style={{ marginTop: 8 }}>
              <Progress 
                percent={stats.totalCustomers ? Math.round(stats.pendingCustomers / stats.totalCustomers * 100) : 0} 
                size="small" 
                status="exception" 
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card 
            title={<span><AreaChartOutlined /> 客户增长趋势</span>} 
            bordered={false}
            className="chart-card"
            style={CHART_CARD_STYLE}
            extra={
            <Space>
              <RangePicker 
                value={dateRange}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange([dates[0], dates[1]])
                  }
                }}
              />
              <Select 
                value={statsView} 
                onChange={setStatsView}
                style={{ width: 100 }}
              >
                <Option value="day">按日</Option>
                <Option value="month">按月</Option>
                <Option value="year">按年</Option>
              </Select>
            </Space>
          }>
            <div style={{ height: '320px' }}>
              <Line 
                data={getTimeSeriesData()} 
                xField="date" 
                yField="count"
                point={{
                  size: 5,
                  shape: 'diamond',
                }}
                label={{
                  style: {
                    fill: '#aaa',
                  },
                }}
                smooth={true}
                animation={{
                  appear: {
                    animation: 'wave-in',
                    duration: 1000,
                  },
                }}
              />
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card 
            title={<span><PieChartOutlined /> 业务员客户分布</span>}
            bordered={false}
            className="chart-card"
            style={CHART_CARD_STYLE}
          >
            <div style={{ height: '320px' }}>
              <Pie 
                data={getSalesmanData()} 
                angleField="value" 
                colorField="name"
                radius={0.8}
                label={{
                  content: ({name, percent}: {name: string, percent: number}) => `${name}: ${(percent * 100).toFixed(0)}%`,
                }}
                interactions={[
                  {
                    type: 'element-active',
                  },
                ]}
                tooltip={{
                  formatter: (datum: { name: string; value: number }) => {
                    return { name: datum.name || '未知', value: `${datum.value} 户` };
                  },
                }}
                legend={{
                  layout: 'horizontal',
                  position: 'bottom',
                }}
              />
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            title={<span><PieChartOutlined /> 施工队客户分布</span>}
            bordered={false}
            className="chart-card"
            style={CHART_CARD_STYLE}
          >
            <div style={{ height: '320px' }}>
              <Pie 
                data={getConstructionTeamData()} 
                angleField="value" 
                colorField="name"
                radius={0.8}
                label={{
                  content: ({name, percent}: {name: string, percent: number}) => `${name}: ${(percent * 100).toFixed(0)}%`,
                }}
                interactions={[
                  {
                    type: 'element-active',
                  },
                ]}
                tooltip={{
                  formatter: (datum: { name: string; value: number }) => {
                    return { name: datum.name || '未知', value: `${datum.value} 户` };
                  },
                }}
                legend={{
                  layout: 'horizontal',
                  position: 'bottom',
                }}
              />
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <Card 
            title={<span><TableOutlined /> 最近注册的客户</span>}
            bordered={false}
            className="chart-card"
            style={TABLE_CARD_STYLE}
          >
            <Table 
              columns={columns} 
              dataSource={getRecentCustomers()}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default AdminDashboard 