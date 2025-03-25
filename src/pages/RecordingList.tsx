import { useState, useEffect } from 'react'
import { Table, Space, Typography, Button, message, Card, Input, Select, DatePicker } from 'antd'
import { SearchOutlined, ReloadOutlined, FilterOutlined } from '@ant-design/icons'
import { customerApi, recordApi } from '../services/api'
import dayjs from 'dayjs'
import { supabase } from '../services/supabase'

const { Title } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

// 字段名称映射表
const fieldNameMapping: Record<string, string> = {
  'customer_name': '客户姓名',
  'phone': '电话号码',
  'address': '地址',
  'module_count': '组件数量',
  'module_power': '组件功率',
  'system_capacity': '系统容量',
  'inverter_count': '逆变器数量',
  'inverter_power': '逆变器功率',
  'roof_type': '屋顶类型',
  'register_date': '注册日期',
  'salesman': '业务员',
  'construction_team': '施工队',
  'construction_team_phone': '施工队电话',
  'surveyor': '踏勘员',
  'surveyor_phone': '踏勘员电话',
  'dispatch_date': '派工日期',
  'square_steel_outbound_date': '方钢出库日期',
  'square_steel_inbound_date': '方钢回库日期',
  'square_steel_status': '方钢状态',
  'component_outbound_date': '组件出库日期',
  'component_inbound_date': '组件回库日期',
  'component_status': '组件状态',
  'construction_date': '施工日期',
  'construction_acceptance_date': '施工验收日期',
  'construction_status': '施工状态',
  'meter_installation_date': '电表安装日期',
  'grid_connection_date': '并网日期',
  'urge_order': '催单状态',
  'remark': '备注',
  'updated_at': '更新时间',
  'construction_acceptance': '施工验收',
  'deleted_at': '删除时间',
  'created_at': '创建时间',
  // 以下是一些可能的数据库字段名称对应的中文名称
  'id': '编号',
  'email': '邮箱',
  'name': '姓名',
  'role': '角色',
  'password': '密码',
  'status': '状态',
  'township': '乡镇',
  'square_steel_type': '方钢类型',
  'square_steel_specs': '方钢规格',
  'panel_type': '面板类型'
}

const RecordingList = () => {
  const [records, setRecords] = useState<any[]>([])
  const [filteredRecords, setFilteredRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [fieldFilter, setFieldFilter] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [userNames, setUserNames] = useState<Record<string, string>>({})
  
  // 获取修改记录和用户信息
  useEffect(() => {
    fetchRecords()
    fetchUserNames()
  }, [])
  
  // 搜索和过滤功能
  useEffect(() => {
    let filtered = [...records]
    
    // 文本搜索
    if (searchText.trim()) {
      const searchValue = searchText.toLowerCase()
      filtered = filtered.filter(record => 
        record.customer_name?.toLowerCase().includes(searchValue) ||
        record.modified_by?.toLowerCase().includes(searchValue) ||
        record.field_name?.toLowerCase().includes(searchValue) ||
        record.old_value?.toLowerCase().includes(searchValue) ||
        record.new_value?.toLowerCase().includes(searchValue) ||
        (userNames[record.modified_by]?.toLowerCase().includes(searchValue)) ||
        (fieldNameMapping[record.field_name]?.toLowerCase().includes(searchValue))
      )
    }
    
    // 字段过滤
    if (fieldFilter) {
      filtered = filtered.filter(record => record.field_name === fieldFilter)
    }
    
    // 日期范围过滤
    if (dateRange && dateRange[0] && dateRange[1]) {
      const startDate = dateRange[0].startOf('day')
      const endDate = dateRange[1].endOf('day')
      
      filtered = filtered.filter(record => {
        const recordDate = dayjs(record.modified_at)
        return recordDate.isAfter(startDate) && recordDate.isBefore(endDate)
      })
    }
    
    setFilteredRecords(filtered)
  }, [searchText, fieldFilter, dateRange, records, userNames])
  
  // 获取修改记录
  const fetchRecords = async () => {
    try {
      setLoading(true)
      const data = await recordApi.getAll()
      
      // 处理返回的数据结构，确保客户姓名正确显示
      const formattedData = data.map(record => ({
        ...record,
        customer_name: record.customers?.customer_name || record.customer_name || '-',
        // 标准化字段名称，移除可能的前缀
        field_name: record.field_name ? record.field_name.replace(/^customers\./, '') : record.field_name
      }))
      
      console.log('修改记录数据:', formattedData)
      
      setRecords(formattedData)
      setFilteredRecords(formattedData)
    } catch (error) {
      message.error('获取修改记录失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }
  
  // 获取用户名称映射
  const fetchUserNames = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('email, name')
      
      if (error) throw error
      
      const nameMap: Record<string, string> = {}
      if (data) {
        data.forEach(user => {
          if (user.email && user.name) {
            nameMap[user.email] = user.name
          }
        })
      }
      
      setUserNames(nameMap)
    } catch (error) {
      console.error('获取用户名称失败', error)
    }
  }
  
  // 重置过滤器
  const resetFilters = () => {
    setSearchText('')
    setFieldFilter(null)
    setDateRange(null)
    setFilteredRecords(records)
  }
  
  // 获取所有字段名称（用于过滤）
  const getFieldNames = () => {
    const fields = new Set<string>()
    records.forEach(record => {
      if (record.field_name) {
        fields.add(record.field_name)
      }
    })
    return Array.from(fields).sort()
  }
  
  // 表格列定义
  const columns = [
    {
      title: '修改时间',
      dataIndex: 'modified_at',
      key: 'modified_at',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a: any, b: any) => new Date(a.modified_at).getTime() - new Date(b.modified_at).getTime(),
      defaultSortOrder: 'descend' as 'descend',
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      key: 'customer_name',
      sorter: (a: any, b: any) => (a.customer_name || '').localeCompare(b.customer_name || ''),
      render: (text: string) => text || '-',
    },
    {
      title: '修改字段',
      dataIndex: 'field_name',
      key: 'field_name',
      sorter: (a: any, b: any) => a.field_name.localeCompare(b.field_name),
      render: (fieldName: string) => {
        // 尝试查找映射，如果没有则显示原字段名
        const chineseName = fieldNameMapping[fieldName] || fieldName;
        console.log(`字段映射: ${fieldName} -> ${chineseName}`);
        return chineseName;
      },
    },
    {
      title: '原值',
      dataIndex: 'old_value',
      key: 'old_value',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '新值',
      dataIndex: 'new_value',
      key: 'new_value',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '修改人',
      dataIndex: 'modified_by',
      key: 'modified_by',
      sorter: (a: any, b: any) => (a.modified_by || '').localeCompare(b.modified_by || ''),
      render: (email: string) => {
        // 如果是UUID格式，显示为系统自动
        if (email && (email.includes('-') && email.length > 30)) {
          console.log(`检测到UUID: ${email}`);
          return '系统自动';
        }
        
        // 如果在用户名映射中找到，则显示用户名
        if (userNames[email]) {
          console.log(`找到用户名映射: ${email} -> ${userNames[email]}`);
          return userNames[email];
        }
        
        // 否则显示原始值
        console.log(`未找到用户名映射: ${email}`);
        return email || '-';
      },
    },
  ]
  
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={2}>修改记录</Title>
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchRecords}
          >
            刷新
          </Button>
          <Button 
            icon={<FilterOutlined />} 
            onClick={resetFilters}
          >
            重置过滤器
          </Button>
        </Space>
      </div>
      
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
          <Input
            placeholder="搜索客户、修改人等"
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            allowClear
          />
          
          <Select
            placeholder="按字段过滤"
            style={{ width: 200 }}
            value={fieldFilter}
            onChange={value => setFieldFilter(value)}
            allowClear
          >
            {getFieldNames().map(field => (
              <Option key={field} value={field}>{fieldNameMapping[field] || field}</Option>
            ))}
          </Select>
          
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            value={dateRange}
            onChange={dates => setDateRange(dates)}
            style={{ width: 300 }}
          />
        </div>
        
        <Table
          columns={columns}
          dataSource={filteredRecords}
          rowKey="id"
          loading={loading}
          pagination={{ 
            pageSize: 10, 
            showSizeChanger: true, 
            showTotal: (total) => `共 ${total} 条记录` 
          }}
        />
      </Card>
    </div>
  )
}

export default RecordingList 