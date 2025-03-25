import { ReactNode } from 'react'
import { Layout, Typography } from 'antd'

const { Content } = Layout
const { Title } = Typography

interface AuthLayoutProps {
  children: ReactNode
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '50px 20px' }}>
        <div style={{ maxWidth: '400px', width: '100%', marginBottom: '24px', textAlign: 'center' }}>
          <Title level={2}>公司客户工作台</Title>
        </div>
        {children}
      </Content>
    </Layout>
  )
}

export default AuthLayout