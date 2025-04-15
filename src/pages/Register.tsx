import { useState } from 'react'
import { Form, Input, Button, message, Card, Alert } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const Register = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const onFinish = async (values: { 
    email: string; 
    name: string; 
    phone: string; 
    password: string; 
    confirmPassword: string;
  }) => {
    try {
      // 清除之前的错误
      setError(null)
      
      // 设置加载状态
      setLoading(true)
      
      // 确保两次密码输入一致
      if (values.password !== values.confirmPassword) {
        setError('两次输入的密码不一致')
        return
      }
      
      // 使用Supabase注册新用户
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`,
          data: {
            name: values.name,
            phone: values.phone
          }
        }
      })
      
      if (signUpError) {
        setError(`注册失败: ${signUpError.message}`)
      } else if (data && data.user) {
        // 将用户信息保存到user_roles表中，设置为未分配角色状态
        const { error: roleError } = await supabase.from('user_roles').insert([
          {
            user_id: data.user.id,
            email: values.email,
            name: values.name,
            phone: values.phone,
            role: 'pending', // 默认设置为待分配角色状态
            created_at: new Date().toISOString()
          }
        ])
        
        if (roleError) {
          console.error('保存用户信息失败:', roleError)
          // 提供更详细的错误信息给用户
          if (roleError.message.includes('violates check constraint') && 
              roleError.message.includes('user_roles_role_check')) {
            setError('注册失败: 数据库不接受"pending"角色值，请联系管理员更新数据库约束')
            // 不再尝试使用其他角色重新保存
            return
          } else {
            setError(`注册失败: 无法保存用户信息 (${roleError.message})`)
            return
          }
        }
        
        message.success('注册成功！请查收邮箱中的验证链接以完成注册')
        navigate('/login')
      } else {
        setError('注册失败，请稍后重试')
      }
    } catch (error: any) {
      setError(`注册过程中发生错误: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={{ width: '100%', maxWidth: '400px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>用户注册</h2>
      
      {error && (
        <Alert
          message="注册错误"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}
      
      <Form
        name="register"
        className="register-form"
        initialValues={{ remember: true }}
        onFinish={onFinish}
      >
        <Form.Item
          name="email"
          rules={[
            { required: true, message: '请输入邮箱!' },
            { type: 'email', message: '请输入有效的邮箱地址!' }
          ]}
        >
          <Input 
            prefix={<MailOutlined />} 
            placeholder="邮箱" 
            size="large" 
          />
        </Form.Item>
        
        <Form.Item
          name="name"
          rules={[{ required: true, message: '请输入员工名称!' }]}
        >
          <Input 
            prefix={<UserOutlined />} 
            placeholder="员工名称" 
            size="large" 
          />
        </Form.Item>
        
        <Form.Item
          name="phone"
          rules={[
            { required: true, message: '请输入手机号码!' },
            { 
              pattern: /^1[3-9]\d{9}$/, 
              message: '请输入有效的手机号码!' 
            }
          ]}
        >
          <Input 
            prefix={<PhoneOutlined />} 
            placeholder="手机号码" 
            size="large" 
          />
        </Form.Item>
        
        <Form.Item
          name="password"
          rules={[
            { required: true, message: '请输入密码!' },
            { min: 6, message: '密码长度至少为6位!' }
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="密码"
            size="large"
          />
        </Form.Item>
        
        <Form.Item
          name="confirmPassword"
          rules={[
            { required: true, message: '请确认密码!' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不匹配!'));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="确认密码"
            size="large"
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            className="register-form-button"
            loading={loading}
            size="large"
            style={{ width: '100%' }}
          >
            注册
          </Button>
        </Form.Item>
        
        <div style={{ textAlign: 'center', marginTop: '10px', color: '#888' }}>
          <small>已有账号？<Link to="/login">返回登录</Link></small>
        </div>
      </Form>
    </Card>
  )
}

export default Register 