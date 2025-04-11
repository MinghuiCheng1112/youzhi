import { useState, useEffect } from 'react'
import { Form, Input, Button, message, Card, DatePicker, InputNumber, Select, Checkbox, Typography, Row, Col, Divider, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'
import { customerApi, constructionTeamApi, surveyorApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import dayjs from 'dayjs'
import { calculateAllFields } from '../utils/calculationUtils'
import { supabase } from '../services/supabase'

const { Title } = Typography
const { TextArea } = Input
const { Option } = Select

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

const NewCustomerForm = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [calculatingFields, setCalculatingFields] = useState(false)
  const navigate = useNavigate()
  const { user, userRole } = useAuth()
  const [constructionTeams, setConstructionTeams] = useState<{name: string, phone: string}[]>([])
  const [surveyors, setSurveyors] = useState<{name: string, phone: string}[]>([])

  // 获取施工队和踏勘员列表
  useEffect(() => {
    const fetchTeamsAndSurveyors = async () => {
      try {
        // 获取施工队列表
        const teamList = await constructionTeamApi.getFromUserRoles();
        console.log('新建表单获取到的施工队列表:', teamList);
        setConstructionTeams(teamList);
        
        // 踏勘员数据现在通过独立的fetchSurveyors函数获取
      } catch (error) {
        console.error('获取施工队列表失败:', error);
        message.error('获取施工队列表失败');
      }
    };
    
    // 获取施工队数据
    fetchTeamsAndSurveyors();
    
    // 获取踏勘员数据
    fetchSurveyors();
  }, []);

  // 获取踏勘员列表
  const fetchSurveyors = async () => {
    try {
      console.log('开始获取踏勘员数据...');
      
      // 使用getAll方法获取所有来源的踏勘员数据
      const surveyorList = await surveyorApi.getAll();
      console.log('获取到的踏勘员数据:', surveyorList);
      
      if (surveyorList && surveyorList.length > 0) {
        setSurveyors(surveyorList);
      } else {
        console.log('无法获取踏勘员数据，使用空列表');
        setSurveyors([]);
      }
    } catch (error) {
      console.error('获取踏勘员列表失败:', error);
      message.error('获取踏勘员列表失败');
      setSurveyors([]);
    }
  };

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
    
    setCalculatingFields(true)
    try {
      // 仅用于实时UI预览，让后端触发器负责数据库中的最终计算
      const fields = calculateAllFields(value)
      form.setFieldsValue(fields)
      console.log('根据组件数量自动计算的字段(仅UI预览):', fields)
    } finally {
      setCalculatingFields(false)
    }
  }

  // 提交表单
  const onFinish = async (values: any) => {
    setLoading(true);
    
    try {
      // 处理日期
      let formattedValues: any = {
        ...values,
        register_date: values.register_date ? values.register_date : null
      };
      
      // 修正模块数量的处理，确保传递数字而非空字符串
      const moduleCount = values.module_count ? Number(values.module_count) : null;
      formattedValues.module_count = moduleCount;
      
      // 不再手动计算相关字段，让数据库触发器处理这些计算
      
      // 如果是踏勘员创建客户，自动关联当前踏勘员信息
      if (userRole === 'surveyor' && user?.email) {
        try {
          // 查询踏勘员信息
          const { data } = await supabase
            .from('user_roles')
            .select('name, phone')
            .eq('user_id', user.id)
            .eq('role', 'surveyor')
            .single();
          
          if (data && data.name) {
            // 使用姓名作为显示名
            formattedValues.surveyor = data.name;
            
            // 设置踏勘员电话
            if (data.phone && !formattedValues.surveyor_phone) {
              formattedValues.surveyor_phone = data.phone;
            }
            
            // 保存踏勘员邮箱，用于关联
            formattedValues.surveyor_email = user.email;
          } else {
            // 如果没有找到姓名，从邮箱提取用户名部分
            const username = user.email.split('@')[0];
            formattedValues.surveyor = username;
            formattedValues.surveyor_email = user.email;
          }
        } catch (err) {
          console.error('获取踏勘员姓名失败，使用邮箱作为替代:', err);
          formattedValues.surveyor = user.email;
          formattedValues.surveyor_email = user.email;
        }
      }
      
      // 如果是业务员创建客户，自动关联当前业务员信息
      if (userRole === 'salesman' && user?.email) {
        try {
          // 保存业务员邮箱，用于关联
          formattedValues.salesman_email = user.email;
          
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
            
            // 设置业务员电话
            if (data.phone && !formattedValues.salesman_phone) {
              formattedValues.salesman_phone = data.phone;
            }
          } else {
            // 如果没有找到业务员真实姓名，标记为"未知业务员"
            formattedValues.salesman = "未知业务员";
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
      
      // 设置图纸变更默认值
      if (!formattedValues.drawing_change) {
        formattedValues.drawing_change = '未出图';
      }
      
      console.log('提交的客户数据:', formattedValues);
      
      // 等待客户创建完成
      try {
        await customerApi.create(formattedValues);
        // 创建成功后显示消息
        message.success('客户添加成功');
        
        // 根据用户角色跳转到不同页面
        if (userRole === 'surveyor') {
          navigate('/surveyor');
        } else if (userRole === 'salesman') {
          navigate('/sales');
        } else if (userRole === 'construction_team') {
          navigate('/construction');
        } else {
          navigate('/customers');
        }
      } catch (createError: any) {
        console.error('客户创建失败:', createError);
        if (createError.code === '23505') {
          message.error('该客户已存在（姓名与电话重复）');
        } else {
          message.error(`客户创建失败: ${createError.message || '未知错误'}`);
        }
      }
    } catch (error: any) {
      console.error('保存客户失败:', error);
      if (error.code === '23505') {
        message.error('该客户已存在（姓名与电话重复）');
      } else {
        message.error(`保存失败: ${error.message || '未知错误'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title={<Title level={3}>新增客户</Title>} style={{ marginBottom: 20 }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          register_date: dayjs(),
          drawing_change: '未出图',
          company: '祐之', // 默认选择祐之
          status: '待处理',    // 默认状态
          technical_review_status: 'pending',
          construction_acceptance_status: 'pending'
        }}
      >
        <Divider orientation="left">基本信息</Divider>
        <Row gutter={24}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item 
              name="register_date" 
              label="登记日期"
              rules={[{ required: true, message: '请选择登记日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item 
              name="customer_name" 
              label="客户姓名"
              rules={[{ required: true, message: '请输入客户姓名' }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item 
              name="phone" 
              label="客户电话"
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={24}>
          <Col xs={24} sm={12} md={12}>
            <Form.Item 
              name="address" 
              label="地址"
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={12}>
            <Form.Item 
              name="id_card" 
              label="身份证号"
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">业务员信息</Divider>
        <Row gutter={24}>
          <Col xs={24} sm={12} md={12}>
            <Form.Item 
              name="salesman" 
              label="业务员"
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={12}>
            <Form.Item 
              name="salesman_phone" 
              label="业务员电话"
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">踏勘员信息</Divider>
        <Row gutter={24}>
          <Col xs={24} sm={12} md={12}>
            <Form.Item 
              name="surveyor" 
              label="踏勘员"
            >
              <Select 
                placeholder="请选择踏勘员" 
                allowClear
                showSearch
                optionFilterProp="label"
                onChange={(value, option: any) => {
                  console.log('新建表单选择踏勘员:', value, option);
                  // 如果选择了踏勘员，自动填充电话
                  if (value && option && option.phone) {
                    form.setFieldsValue({ surveyor_phone: option.phone });
                  } else if (!value) {
                    // 如果清空了踏勘员，也清空电话（设置为null而不是空字符串）
                    form.setFieldsValue({ surveyor_phone: null });
                    console.log('清空踏勘员，将电话设置为null');
                  }
                }}
              >
                {surveyors.map(surveyor => (
                  <Option key={surveyor.name} value={surveyor.name} phone={surveyor.phone}>
                    {surveyor.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={12}>
            <Form.Item 
              name="surveyor_phone" 
              label="踏勘员电话"
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">施工队信息</Divider>
        <Row gutter={24}>
          <Col xs={24} sm={12} md={12}>
            <Form.Item 
              name="construction_team" 
              label="施工队"
            >
              <Select 
                placeholder="请选择施工队" 
                allowClear
                showSearch
                optionFilterProp="label"
                onChange={(value, option: any) => {
                  console.log('新建表单选择施工队:', value, option);
                  // 如果选择了施工队，自动填充电话
                  if (value && option && option.phone) {
                    form.setFieldsValue({ construction_team_phone: option.phone });
                  } else if (!value) {
                    // 如果清空了施工队，也清空电话（设置为null而不是空字符串）
                    form.setFieldsValue({ construction_team_phone: null });
                    console.log('清空施工队，将电话设置为null');
                  }
                }}
              >
                {constructionTeams.map(team => (
                  <Option key={team.name} value={team.name} phone={team.phone}>
                    {team.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={12}>
            <Form.Item 
              name="construction_team_phone" 
              label="施工队电话"
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">电站信息</Divider>
        <Row gutter={24}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item 
              name="module_count" 
              label="组件数量"
            >
              <InputNumber 
                style={{ width: '100%' }} 
                min={0} 
                onChange={handleModuleCountChange} 
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item 
              name="capacity" 
              label="容量(KW)"
            >
              <InputNumber 
                style={{ width: '100%' }} 
                min={0} 
                disabled={calculatingFields}
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
                min={0} 
                disabled={calculatingFields}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={24}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item 
              name="land_area" 
              label="用地面积(m²)"
            >
              <InputNumber 
                style={{ width: '100%' }} 
                min={0} 
                disabled={calculatingFields}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item 
              name="meter_number" 
              label="电表号码"
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item 
              name="filing_date" 
              label="备案日期"
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">设计相关</Divider>
        <Row gutter={24}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item 
              name="designer" 
              label="设计师"
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item 
              name="designer_phone" 
              label="设计师电话"
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item 
              name="drawing_change" 
              label="图纸变更"
              initialValue="未出图"
            >
              <Input placeholder="未出图" />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">物料信息</Divider>
        <Row gutter={24}>
          <Col xs={24} sm={12} md={6}>
            <Form.Item 
              name="inverter" 
              label="逆变器"
            >
              <Input disabled={calculatingFields} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item 
              name="copper_wire" 
              label="铜线"
            >
              <Input disabled={calculatingFields} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item 
              name="aluminum_wire" 
              label="铝线"
            >
              <Input disabled={calculatingFields} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item 
              name="distribution_box" 
              label="配电箱"
            >
              <Input disabled={calculatingFields} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">其他信息</Divider>
        <Row gutter={24}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item 
              name="station_management" 
              label="补充资料"
            >
              <Checkbox.Group options={stationManagementOptions} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item 
              name="company" 
              label="公司"
              initialValue="昊尘"
            >
              <Select>
                <Option value="昊尘">昊尘</Option>
                <Option value="祐之">祐之</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item 
              name="status" 
              label="状态"
              initialValue="待处理"
            >
              <Select>
                <Option value="待处理">待处理</Option>
                <Option value="处理中">处理中</Option>
                <Option value="已完成">已完成</Option>
                <Option value="已取消">已取消</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={24}>
          <Col span={24}>
            <Form.Item 
              name="remarks" 
              label="备注"
            >
              <TextArea rows={4} />
            </Form.Item>
          </Col>
        </Row>

        <Row>
          <Col span={24} style={{ textAlign: 'center' }}>
            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                style={{ marginRight: 10 }}
              >
                保存
              </Button>
              <Button 
                onClick={() => navigate(-1)}
              >
                返回
              </Button>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  )
}

export default NewCustomerForm 
