import { useState, useEffect } from 'react'
import { Form, Input, Button, message, Card, Alert } from 'antd'
import { UserOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Login = () => {
  const [loading, setLoading] = useState(false)
  const { signIn, error, clearError, connectionStatus, userRole } = useAuth()
  const navigate = useNavigate()
  
  // 监听连接状态变化
  useEffect(() => {
    if (connectionStatus === 'error') {
      message.error('无法连接到服务器，请检查网络连接')
    }
  }, [connectionStatus])

  // 根据用户角色获取默认页面路径
  const getDefaultHomePage = (role?: string) => {
    switch(role) {
      case 'admin':
        return '/admin';
      case 'salesman':
        return '/sales';
      case 'filing_officer':
        return '/filing';
      case 'warehouse':
        return '/warehouse';
      case 'construction_team':
        return '/construction';
      case 'grid_connector':
        return '/grid-connection';
      case 'surveyor':
        return '/surveyor';
      case 'dispatch':
        return '/dispatch';
      case 'procurement':
        return '/procurement';
      default:
        return '/dashboard';
    }
  };

  const onFinish = async (values: { emailOrPhone: string; password: string }) => {
    try {
      // 清除之前的错误
      clearError()
      
      // 设置加载状态
      setLoading(true)
      
      // 登录状态由AuthContext内部管理
      const { error, data } = await signIn(values.emailOrPhone, values.password)
      
      if (error) {
        message.error('登录失败: ' + error.message)
      } else {
        message.success('登录成功')
        
        // 获取用户角色
        const role = data?.user?.user_metadata?.role || userRole
        console.log('用户角色:', role)
        
        // 根据角色跳转到对应页面
        const homePath = getDefaultHomePage(role)
        console.log('跳转到:', homePath)
        navigate(homePath, { replace: true })
      }
    } catch (error: any) {
      message.error('登录过程中发生错误: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={{ width: '100%', maxWidth: '400px' }}>
      {error && (
        <Alert
          message="登录错误"
          description={error}
          type="error"
          closable
          onClose={clearError}
          style={{ marginBottom: 16 }}
        />
      )}
      
      {connectionStatus === 'error' && (
        <Alert
          message="连接错误"
          description="无法连接到服务器，请检查网络连接"
          type="error"
          style={{ marginBottom: 16 }}
        />
      )}
      
      <Form
        name="login"
        className="login-form"
        initialValues={{ remember: true }}
        onFinish={onFinish}
      >
        <Form.Item
          name="emailOrPhone"
          rules={[
            { required: true, message: '请输入邮箱或手机号码!' },
            { 
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                
                // 验证邮箱或手机号格式
                const isEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
                const isPhone = /^1[3-9]\d{9}$/.test(value);
                
                if (isEmail || isPhone) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('请输入有效的邮箱或手机号码!'));
              }
            }
          ]}
        >
          <Input 
            prefix={<UserOutlined />} 
            placeholder="邮箱或手机号码" 
            size="large" 
          />
        </Form.Item>
        
        <Form.Item
          name="password"
          rules={[{ required: true, message: '请输入密码!' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            type="password"
            placeholder="密码"
            size="large"
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            className="login-form-button"
            loading={loading}
            size="large"
            style={{ width: '100%' }}
          >
            登录
          </Button>
        </Form.Item>
        
        <div style={{ textAlign: 'center', marginTop: '10px', color: '#888' }}>
          <small>您可以使用邮箱或手机号码登录系统</small>
        </div>
      </Form>
    </Card>
  )
}

export default Login