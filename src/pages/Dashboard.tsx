import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Spin, Typography, DatePicker, ConfigProvider } from 'antd'
import { TeamOutlined, FileTextOutlined, ToolOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { customerApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import zhCN from 'antd/locale/zh_CN'

const { Title } = Typography

const Dashboard = () => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalCustomers: 0,
    pendingFiling: 0,
    pendingConstruction: 0,
    completed: 0
  })
  const { userRole } = useAuth()

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const customers = await customerApi.getAll()
        
        // 计算统计数据
        const totalCustomers = customers.length
        const pendingFiling = customers.filter(c => !c.filing_date).length
        const pendingConstruction = customers.filter(c => (c.square_steel_outbound_date || c.component_outbound_date) && !c.construction_status).length
        const completed = customers.filter(c => c.power_purchase_contract).length
        
        setStats({
          totalCustomers,
          pendingFiling,
          pendingConstruction,
          completed
        })
      } catch (error) {
        console.error('获取统计数据失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  // 根据用户角色显示不同的欢迎信息
  const getWelcomeMessage = () => {
    switch (userRole) {
      case 'admin':
        return '欢迎使用管理工作台'
      case 'filing_officer':
        return '欢迎使用备案工作台'
      case 'salesman':
        return '欢迎使用业务工作台'
      case 'warehouse':
        return '欢迎使用仓库工作台'
      case 'construction_team':
        return '欢迎使用施工工作台'
      case 'grid_connector':
        return '欢迎使用并网工作台'
      default:
        return '欢迎使用客户工作台'
    }
  }

  return (
    <ConfigProvider
      locale={zhCN}
    >
      <div>
        <Title level={2}>{getWelcomeMessage()}</Title>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic 
                  title="客户总数" 
                  value={stats.totalCustomers} 
                  prefix={<TeamOutlined />} 
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic 
                  title="待备案" 
                  value={stats.pendingFiling} 
                  prefix={<FileTextOutlined />} 
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic 
                  title="待施工" 
                  value={stats.pendingConstruction} 
                  prefix={<ToolOutlined />} 
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic 
                  title="已完成" 
                  value={stats.completed} 
                  prefix={<CheckCircleOutlined />} 
                />
              </Card>
            </Col>
          </Row>
        )}
      </div>
    </ConfigProvider>
  )
}

export default Dashboard