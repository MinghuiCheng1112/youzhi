import { useState, useEffect } from 'react'
import { Table, Card, Input, Button, Typography, Space, message } from 'antd'
import { SearchOutlined, ExportOutlined, ReloadOutlined } from '@ant-design/icons'
import { customerApi } from '../../services/api'
import { Customer } from '../../types'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'

const { Title } = Typography

const RecordingOfficerDashboard = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')

  // 获取所有客户数据
  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const data = await customerApi.getAll()
      setCustomers(data)
      setFilteredCustomers(data)
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
        customer.id_card?.toLowerCase().includes(searchValue)
      )
    })

    setFilteredCustomers(filtered)
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
        '容量(KW)': customer.capacity,
        '投资金额': customer.investment_amount,
        '用地面积(m²)': customer.land_area
      }))

      // 创建工作簿和工作表
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)

      // 将工作表添加到工作簿
      XLSX.utils.book_append_sheet(wb, ws, '客户数据')

      // 保存文件
      XLSX.writeFile(wb, `备案员客户数据_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败')
      console.error(error)
    }
  }

  // 表格列定义
  const columns = [
    {
      title: '姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      sorter: (a: Customer, b: Customer) => a.customer_name.localeCompare(b.customer_name),
    },
    {
      title: '容量(KW)',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (text: number) => text ? `${text} KW` : '-',
      sorter: (a: Customer, b: Customer) => (a.capacity || 0) - (b.capacity || 0),
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      sorter: (a: Customer, b: Customer) => (a.address || '').localeCompare(b.address || ''),
    },
    {
      title: '身份证号',
      dataIndex: 'id_card',
      key: 'id_card',
      ellipsis: true,
      sorter: (a: Customer, b: Customer) => (a.id_card || '').localeCompare(b.id_card || ''),
    },
    {
      title: '客户电话',
      dataIndex: 'phone',
      key: 'phone',
      sorter: (a: Customer, b: Customer) => (a.phone || '').localeCompare(b.phone || ''),
    },
    {
      title: '投资金额',
      dataIndex: 'investment_amount',
      key: 'investment_amount',
      render: (text: number) => text ? `¥ ${text}` : '-',
      sorter: (a: Customer, b: Customer) => (a.investment_amount || 0) - (b.investment_amount || 0),
    },
    {
      title: '用地面积(m²)',
      dataIndex: 'land_area',
      key: 'land_area',
      render: (text: number) => text ? `${text} m²` : '-',
      sorter: (a: Customer, b: Customer) => (a.land_area || 0) - (b.land_area || 0),
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={2}>备案员账号工作台</Title>
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
          >
            导出
          </Button>
        </Space>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索客户姓名、电话、地址等"
            prefix={<SearchOutlined />}
            style={{ width: 300 }}
            value={searchText}
            onChange={e => handleSearch(e.target.value)}
            allowClear
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredCustomers}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  )
}

export default RecordingOfficerDashboard