import { useState, useEffect } from 'react'
import { Form, Input, Button, message, Card, DatePicker, InputNumber, Switch, Select, Checkbox, Space, Typography, Row, Col, Divider, Tag, Modal } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { customerApi } from '../services/api'
import { Customer } from '../types'
import { useAuth } from '../contexts/AuthContext'
import dayjs from 'dayjs'
import { calculateAllFields } from '../utils/calculationUtils'
import { supabase } from '../services/supabase'

const { Title } = Typography
const { TextArea } = Input
const { Option } = Select
const { Group } = Checkbox

const CustomerForm = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, userRole } = useAuth()
  const isEdit = !!id

  // 补充资料选项
  const stationManagementOptions = [
    { label: '房产证', value: '房产证' },
    { label: '授权书', value: '授权书' },
    { label: '银行卡', value: '银行卡' },
    { label: '航拍', value: '航拍' },
    { label: '结构照', value: '结构照' },
    { label: '门头照', value: '门头照' },
    { label: '合同', value: '合同' },
  ]

  // 获取客户数据
  useEffect(() => {
    const fetchCustomer = async () => {
      if (!id) return

      try {
        setLoading(true)
        const data = await customerApi.getById(id)
        if (data) {
          setCustomer(data)
          
          // 格式化日期字段
          const formattedData = {
            ...data,
            register_date: data.register_date ? dayjs(data.register_date) : null,
            filing_date: data.filing_date ? dayjs(data.filing_date) : null,
            // 将字符串转换为数组（如果是字符串）
            station_management: typeof data.station_management === 'string' 
              ? data.station_management.split(',') 
              : data.station_management,
            salesman: data.salesman,
            salesman_phone: data.salesman_phone,
          }
          
          form.setFieldsValue(formattedData)
        }
      } catch (error) {
        message.error('获取客户数据失败')
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    fetchCustomer()
  }, [id, form])

  // 处理组件数量变更
  const handleModuleCountChange = (value: number | null) => {
    if (!value) {
      form.setFieldsValue({
        capacity: null,
        investment_amount: null,
        land_area: null,
        inverter: '',
        distribution_box: '',
        copper_wire: '',
        aluminum_wire: ''
      })
      return
    }
    
    const fields = calculateAllFields(value)
    form.setFieldsValue(fields)
    console.log('根据组件数量自动计算的字段:', fields)
  }

  // 提交表单
  const onFinish = async (values: any) => {
    try {
      setLoading(true)
      
      // 格式化日期字段
      const formattedValues = {
        ...values,
        register_date: values.register_date ? values.register_date.format() : null,
        filing_date: values.filing_date ? values.filing_date.format() : null,
        // 处理补充资料字段 - 修复数组格式
        station_management: Array.isArray(values.station_management) 
          ? (values.station_management.length > 0 ? `{${values.station_management.join(',')}}` : null)
          : (values.station_management || null),
      }
      
      // 不再将公司字段转换为中文，保持原始值
      console.log('公司字段值:', formattedValues.company);
      
      // 如果是踏勘员创建客户，获取踏勘员信息并关联
      if (!isEdit && userRole === 'surveyor' && user?.email) {
        try {
          // 尝试从user_roles表获取踏勘员姓名和电话
          const { data } = await supabase
            .from('user_roles')
            .select('name, phone')
            .eq('user_id', user.id)
            .eq('role', 'surveyor')
            .single();
          
          if (data && data.name) {
            // 使用数据库中的姓名
            formattedValues.surveyor = data.name;
            console.log('使用数据库中的踏勘员姓名:', data.name);
            
            // 设置踏勘员电话，如果有的话
            if (data.phone) {
              formattedValues.surveyor_phone = data.phone;
            }
          } else {
            // 如果没有找到姓名，从邮箱提取用户名部分
            const username = user.email.split('@')[0];
            formattedValues.surveyor = username;
            console.log('使用邮箱提取的用户名:', username);
          }
        } catch (err) {
          console.error('获取踏勘员姓名失败，使用邮箱作为替代:', err);
          formattedValues.surveyor = user.email;
        }
      }
      
      // 如果是业务员创建客户，自动关联当前业务员信息
      if (!isEdit && userRole === 'salesman' && user?.email) {
        try {
          // 保存业务员邮箱到salesman_email字段，这是工作台匹配的关键
          formattedValues.salesman_email = user.email;
          console.log('保存业务员邮箱到salesman_email:', user.email);
          
          // 尝试从user_roles表获取业务员姓名和电话
          const { data } = await supabase
            .from('user_roles')
            .select('name, phone')
            .eq('user_id', user.id)
            .eq('role', 'salesman')
            .single();
          
          if (data && data.name) {
            // 使用姓名作为显示名
            formattedValues.salesman = data.name;
            console.log('使用业务员姓名作为显示名:', data.name);
            
            // 设置业务员电话
            if (data.phone && !formattedValues.salesman_phone) {
              formattedValues.salesman_phone = data.phone;
            }
          } else {
            // 如果没有找到业务员真实姓名，标记为"未知业务员"
            formattedValues.salesman = "未知业务员";
            console.log('未找到业务员姓名信息，使用"未知业务员"');
            message.warning('未能获取业务员姓名信息，请联系管理员完善您的账户信息');
          }
        } catch (err) {
          console.error('获取业务员信息失败:', err);
          // 出错时仍保存邮箱，但使用"未知业务员"作为显示名
          formattedValues.salesman_email = user.email;
          formattedValues.salesman = "未知业务员";
          message.warning('获取业务员信息失败，请联系管理员');
        }
      }
      
      console.log('提交的客户数据:', formattedValues);
      
      if (isEdit && id) {
        await customerApi.update(id, formattedValues)
        message.success('客户信息更新成功')
      } else {
        await customerApi.create(formattedValues)
        message.success('客户添加成功')
      }
      
      // 根据用户角色跳转到不同页面
      if (userRole === 'surveyor') {
        navigate('/surveyor')
      } else if (userRole === 'salesman') {
        navigate('/sales')
      } else if (userRole === 'construction_team') {
        navigate('/construction')
      } else {
        navigate('/customers')
      }
    } catch (error: any) {
      console.error('保存客户失败:', error);
      if (error.code === '23505') {
        message.error('该客户已存在（姓名与电话重复）')
      } else {
        message.error(`保存失败: ${error.message || '未知错误'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  // 催单按钮操作
  const handleUrgeOrder = () => {
    const currentValue = form.getFieldValue('urge_order')
    const newValue = currentValue ? null : new Date().toISOString()
    form.setFieldsValue({ urge_order: newValue })
  }

  // 出库按钮操作
  const handleSquareSteelOutbound = async () => {
    if (!id) return
    try {
      const currentValue = form.getFieldValue('square_steel_outbound_date')
      await customerApi.updateOutboundStatus(
        id,
        'square_steel',
        !currentValue
      )
      form.setFieldsValue({
        square_steel_outbound_date: currentValue ? null : dayjs(),
      })
    } catch (error) {
      message.error('更新出库状态失败')
    }
  }

  const handleComponentOutbound = async () => {
    if (!id) return
    try {
      const currentValue = form.getFieldValue('component_outbound_date')
      await customerApi.updateOutboundStatus(
        id,
        'component',
        !currentValue
      )
      form.setFieldsValue({
        component_outbound_date: currentValue ? null : dayjs(),
      })
    } catch (error) {
      message.error('更新出库状态失败')
    }
  }

  // 施工状态按钮操作
  const handleConstructionStatus = () => {
    const currentValue = form.getFieldValue('construction_status')
    
    // 检查用户是否有权限看到代拍选项
    const canSeePendingPhotoOption = userRole === 'admin' || userRole === 'surveyor';
    
    // 如果已有时间戳，则清除
    if (currentValue) {
      form.setFieldsValue({ construction_status: null })
      
      if (canSeePendingPhotoOption) {
        // 显示选择对话框，包含代拍选项
        Modal.confirm({
          title: '请选择操作',
          content: '请选择下一步操作',
          okText: '未完工',
          cancelText: '代拍',
          onOk() {
            // 设置未完工状态（时间戳）
            const newValue = new Date().toISOString()
            form.setFieldsValue({ construction_status: newValue })
          },
          onCancel() {
            // 设置为代拍状态
            form.setFieldsValue({ construction_status: 'pending_photo' })
          },
        });
      } else {
        // 非管理员或踏勘员直接设置为未完工状态
        const newValue = new Date().toISOString()
        form.setFieldsValue({ construction_status: newValue })
      }
    } else if (currentValue === 'pending_photo') {
      // 如果当前是代拍状态，点击后变为时间戳
      const newValue = new Date().toISOString()
      form.setFieldsValue({ construction_status: newValue })
    } else {
      if (canSeePendingPhotoOption) {
        // 显示选择对话框，包含代拍选项
        Modal.confirm({
          title: '请选择操作',
          content: '请选择下一步操作',
          okText: '未完工',
          cancelText: '代拍',
          onOk() {
            // 设置未完工状态（时间戳）
            const newValue = new Date().toISOString()
            form.setFieldsValue({ construction_status: newValue })
          },
          onCancel() {
            // 设置为代拍状态
            form.setFieldsValue({ construction_status: 'pending_photo' })
          },
        });
      } else {
        // 非管理员或踏勘员直接设置为未完工状态
        const newValue = new Date().toISOString()
        form.setFieldsValue({ construction_status: newValue })
      }
    }
  }

  // 技术审核按钮操作
  const handleTechnicalReview = () => {
    const currentValue = form.getFieldValue('technical_review')
    const newValue = currentValue ? null : new Date().toISOString()
    form.setFieldsValue({ technical_review: newValue })
  }

  // 上传国网按钮操作
  const handleUploadToGrid = () => {
    const currentValue = form.getFieldValue('upload_to_grid')
    const newValue = currentValue ? null : new Date().toISOString()
    form.setFieldsValue({ upload_to_grid: newValue })
  }

  // 建设验收按钮操作
  const handleConstructionAcceptance = () => {
    const currentValue = form.getFieldValue('construction_acceptance')
    const newValue = currentValue ? null : new Date().toISOString()
    form.setFieldsValue({ construction_acceptance: newValue })
  }

  // 挂表日期按钮操作
  const handleMeterInstallation = () => {
    const currentValue = form.getFieldValue('meter_installation_date')
    
    // 如果已有时间戳，则清除
    if (currentValue) {
      form.setFieldsValue({ meter_installation_date: null })
      
      // 显示选择对话框
      Modal.confirm({
        title: '请选择操作',
        content: '请选择下一步操作',
        okText: '挂表',
        cancelText: '发电异常',
        onOk() {
          // 不做任何操作，保持为挂表按钮
        },
        onCancel() {
          // 设置为发电异常状态
          form.setFieldsValue({ meter_installation_date: 'abnormal' })
        },
      });
    } else {
      // 如果当前为空或异常状态，点击后变为时间戳
      const newValue = new Date().toISOString()
      form.setFieldsValue({ meter_installation_date: newValue })
    }
  }

  // 购售电合同按钮操作
  const handlePowerPurchaseContract = () => {
    const currentValue = form.getFieldValue('power_purchase_contract')
    const newValue = currentValue ? null : new Date().toISOString()
    form.setFieldsValue({ power_purchase_contract: newValue })
    
    // 如果变为时间戳，自动设置状态为"提交资料"
    if (newValue) {
      form.setFieldsValue({ status: '提交资料' })
    }
  }

  // 确定当前用户是否有编辑权限
  const canEdit = () => {
    if (!userRole) return false
    
    // 管理员有全部编辑权限
    if (userRole === 'admin') return true
    
    // 业务员只能编辑自己的客户
    if (userRole === 'salesman') {
      // 如果是新建客户，允许编辑
      if (!isEdit) return true;
      return customer?.salesman === user?.email
    }
    
    // 仓库人员可以编辑出库日期、客户资料、备注等
    if (userRole === 'warehouse') {
      return true
    }
    
    // 施工队可以编辑施工状态、大线和备注
    if (userRole === 'construction_team') {
      // 只能编辑分配给自己的客户
      return customer?.construction_team === user?.email
    }
    
    // 并网员可以编辑建设验收和挂表日期
    if (userRole === 'grid_connector') {
      return true
    }
    
    // 踏勘员可以编辑客户资料、电表号码、补充资料等
    if (userRole === 'surveyor') {
      // 如果是新建客户，允许编辑
      if (!isEdit) return true;
      
      // 获取当前用户姓名或邮箱
      const userEmail = user?.email || '';
      const userName = userEmail.split('@')[0];
      
      // 如果客户的踏勘员字段包含当前用户的邮箱或用户名，允许编辑
      return customer?.surveyor === userEmail || 
             customer?.surveyor === userName ||
             (customer?.surveyor && userName && customer.surveyor.includes(userName));
    }
    
    return false
  }
  
  // 施工队是否可以编辑特定字段
  const canConstructionTeamEdit = (fieldName: string) => {
    if (userRole !== 'construction_team') return canEdit()
    return ['construction_status', 'main_line', 'remarks'].includes(fieldName)
  }

  // 踏勘员是否可以编辑特定字段
  const canSurveyorEdit = (fieldName: string) => {
    if (userRole !== 'surveyor') return canEdit()
    // 踏勘员可编辑的字段列表
    return [
      'customer_name',  // 客户姓名
      'phone',          // 客户电话
      'address',        // 客户地址
      'id_card',        // 身份证号
      'salesman',       // 业务员
      'salesman_phone', // 业务员电话
      'station_management', // 补充资料
      'meter_number',   // 电表号码
      'designer',       // 设计师
      'designer_phone', // 设计师电话
      'remarks',        // 备注
      'drawing_change'  // 图纸变更
    ].includes(fieldName)
  }

  // 渲染按钮或时间戳
  const renderButtonOrTimestamp = (field: string, buttonText: string, onClick: () => void) => {
    const value = form.getFieldValue(field)
    const canEditThisField = field === 'construction_status' || field === 'main_line' ? 
      canConstructionTeamEdit(field) : 
      (userRole === 'surveyor' ? canSurveyorEdit(field) : canEdit())
    
    // 特殊处理挂表日期的发电异常状态
    if (field === 'meter_installation_date' && value === 'abnormal') {
      return (
        <Space>
          <Tag color="red">发电异常</Tag>
          {canEditThisField && (
            <Button size="small" onClick={onClick}>更新</Button>
          )}
        </Space>
      )
    }
    
    // 特殊处理施工状态的代拍状态
    if (field === 'construction_status' && value === 'pending_photo') {
      return (
        <Space>
          <Tag color="gold">代拍</Tag>
          {canEditThisField && (
            <Button size="small" onClick={onClick}>更新</Button>
          )}
        </Space>
      )
    }
    
    if (value && value !== 'abnormal' && value !== 'pending_photo') {
      return (
        <Space>
          <Tag color="green">{dayjs(value).format('YYYY-MM-DD HH:mm')}</Tag>
          {canEditThisField && (
            <Button size="small" onClick={onClick}>清除</Button>
          )}
        </Space>
      )
    }
    
    // 特殊处理挂表按钮文本和施工状态按钮文本
    const displayButtonText = field === 'meter_installation_date' ? buttonText : buttonText;
    
    return canEditThisField ? (
      <Button type="primary" onClick={onClick}>{displayButtonText}</Button>
    ) : (
      <Button type="default" disabled>{displayButtonText}</Button>
    )
  }

  return (
    <Card>
      <Title level={3}>{isEdit ? '编辑客户' : '新增客户'}</Title>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          station_management: [],
          drawing_change: false
        }}
        size="middle"
      >
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="customer_name"
              label="客户姓名"
              rules={[{ required: true, message: '请输入客户姓名' }]}
            >
              <Input disabled={!canSurveyorEdit('customer_name')} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="phone"
              label="客户电话"
            >
              <Input disabled={!canSurveyorEdit('phone')} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="address"
              label="客户地址"
            >
              <Input disabled={!canSurveyorEdit('address')} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="id_card"
              label="身份证号"
            >
              <Input disabled={!canSurveyorEdit('id_card')} />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              label="业务员"
              name="salesman"
            >
              <Input placeholder="请输入业务员姓名" disabled={!canSurveyorEdit('salesman')} />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              label="业务员电话"
              name="salesman_phone"
            >
              <Input placeholder="请输入业务员电话" disabled={!canSurveyorEdit('salesman_phone')} />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="station_management"
              label="补充资料"
            >
              <Group options={stationManagementOptions} disabled={!canSurveyorEdit('station_management')} />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="filing_date"
              label="备案日期"
            >
              <DatePicker style={{ width: '100%' }} disabled={!canEdit()} />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="meter_number"
              label="电表号码"
            >
              <Input disabled={!canSurveyorEdit('meter_number')} />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="designer"
              label="设计师"
            >
              <Input disabled={!canSurveyorEdit('designer')} />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="designer_phone"
              label="设计师电话"
            >
              <Input disabled={!canSurveyorEdit('designer_phone')} />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="drawing_change"
              label="图纸变更"
              valuePropName="checked"
            >
              <Switch 
                disabled={!canSurveyorEdit('drawing_change')}
              />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="urge_order"
              label="催单"
            >
              <div>
                {renderButtonOrTimestamp('urge_order', '催单', handleUrgeOrder)}
              </div>
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="module_count"
              label="组件数量"
              rules={[{ required: false, message: '请输入组件数量' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                onChange={handleModuleCountChange}
                placeholder="输入后自动计算相关字段"
              />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="capacity"
              label="容量 (kW)"
            >
              <InputNumber 
                style={{ width: '100%' }} 
                readOnly 
                formatter={(value) => value ? `${value}` : ''}
              />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="investment_amount"
              label="投资金额"
            >
              <InputNumber 
                style={{ width: '100%' }} 
                readOnly
                formatter={(value) => value ? `${value}` : ''}
              />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="land_area"
              label="用地面积 (m²)"
            >
              <InputNumber 
                style={{ width: '100%' }} 
                readOnly
                formatter={(value) => value ? `${value}` : ''}
              />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="inverter"
              label="逆变器"
            >
              <Input readOnly />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="copper_wire"
              label="铜线"
            >
              <Input readOnly />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="aluminum_wire"
              label="铝线"
            >
              <Input readOnly />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="distribution_box"
              label="配电箱"
            >
              <Input readOnly />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="square_steel_outbound_date"
              label="方钢出库"
            >
              <div>
                {renderButtonOrTimestamp(
                  'square_steel_outbound_date',
                  '方钢出库',
                  handleSquareSteelOutbound
                )}
              </div>
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="component_outbound_date"
              label="组件出库"
            >
              <div>
                {renderButtonOrTimestamp(
                  'component_outbound_date',
                  '组件出库',
                  handleComponentOutbound
                )}
              </div>
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="dispatch_date"
              label="派工日期"
            >
              <DatePicker 
                style={{ width: '100%' }} 
                disabled 
                placeholder="自动关联抽签工作台"
              />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="construction_team"
              label="施工队"
            >
              <Input disabled placeholder="自动关联抽签工作台" />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="construction_team_phone"
              label="施工队电话"
            >
              <Input placeholder="请输入施工队电话" />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="construction_status"
              label="施工状态"
            >
              <div>
                {renderButtonOrTimestamp('construction_status', '未完工', handleConstructionStatus)}
              </div>
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="main_line"
              label="大线"
            >
              <Input 
                disabled={!canConstructionTeamEdit('main_line')}
                placeholder="施工队填写"
              />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="technical_review"
              label="技术审核"
            >
              <div>
                {renderButtonOrTimestamp('technical_review', '驳回', handleTechnicalReview)}
              </div>
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="upload_to_grid"
              label="上传国网"
            >
              <div>
                {renderButtonOrTimestamp('upload_to_grid', '上传', handleUploadToGrid)}
              </div>
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="construction_acceptance"
              label="建设验收"
            >
              <div>
                {renderButtonOrTimestamp('construction_acceptance', '未到', handleConstructionAcceptance)}
              </div>
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="meter_installation_date"
              label="挂表日期"
            >
              <div>
                {renderButtonOrTimestamp('meter_installation_date', '挂表', handleMeterInstallation)}
              </div>
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="power_purchase_contract"
              label="购售电合同"
            >
              <div>
                {renderButtonOrTimestamp('power_purchase_contract', '未出', handlePowerPurchaseContract)}
              </div>
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="status"
              label="状态"
            >
              <Select disabled={!form.getFieldValue('power_purchase_contract')}>
                <Option value="提交资料">提交资料</Option>
                <Option value="技术驳回">技术驳回</Option>
                <Option value="商务驳回">商务驳回</Option>
                <Option value="已完成">已完成</Option>
              </Select>
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="price"
              label="价格"
            >
              <InputNumber 
                style={{ width: '100%' }} 
                formatter={(value) => value ? `${value}` : ''}
                disabled={!canEdit()}
              />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="register_date"
              label="登记日期"
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="company"
              label="公司"
            >
              <Select disabled={!canEdit()}>
                <Option value="昊尘">昊尘</Option>
                <Option value="祐之">祐之</Option>
              </Select>
            </Form.Item>
          </Col>
          
          <Col span={24}>
            <Form.Item
              name="remarks"
              label="备注"
            >
              <TextArea rows={4} disabled={!canSurveyorEdit('remarks')} />
            </Form.Item>
          </Col>
        </Row>
        
        <Divider />
        
        <Form.Item>
          <Space>
            {(canEdit() || userRole === 'surveyor') && (
              <Button type="primary" htmlType="submit" loading={loading}>
                保存
              </Button>
            )}
            <Button onClick={() => navigate('/customers')}>
              返回
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default CustomerForm