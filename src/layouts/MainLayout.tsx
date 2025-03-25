import { useState, useEffect } from 'react'
import { Layout, Menu, Button, Dropdown, Avatar, theme, Typography } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  DeleteOutlined,
  UserOutlined,
  LogoutOutlined,
  InboxOutlined,
  ToolOutlined,
  AppstoreOutlined,
  SendOutlined,
  ShoppingOutlined,
} from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const { user, signOut, userRole } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
      if (window.innerWidth <= 768) {
        setCollapsed(true)
      }
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // 根据用户角色显示不同的菜单项
  const getMenuItems = (role: string | null) => {
    // 角色特定菜单
    switch (role) {
      case 'admin':
        return [
          {
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: '系统仪表盘',
          },
          {
            key: '/role-dashboard',
            icon: <AppstoreOutlined />,
            label: '角色工作台',
          },
          {
            key: '/customers',
            icon: <TeamOutlined />,
            label: '客户工作台',
          },
          {
            key: '/admin',
            icon: <UserOutlined />,
            label: '管理工作台',
          },
          {
            key: '/filing',
            icon: <FileTextOutlined />,
            label: '备案工作台',
          },
          {
            key: '/sales',
            icon: <TeamOutlined />,
            label: '业务工作台',
          },
          {
            key: '/surveyor',
            icon: <TeamOutlined />,
            label: '踏勘工作台',
          },
          {
            key: '/warehouse',
            icon: <InboxOutlined />,
            label: '仓库工作台',
          },
          {
            key: '/dispatch',
            icon: <SendOutlined />,
            label: '派工工作台',
          },
          {
            key: '/construction',
            icon: <ToolOutlined />,
            label: '施工工作台',
          },
          {
            key: '/grid-connection',
            icon: <AppstoreOutlined />,
            label: '并网工作台',
          },
          {
            key: '/procurement',
            icon: <ShoppingOutlined />,
            label: '采购工作台',
          },
          {
            key: '/records',
            icon: <FileTextOutlined />,
            label: '修改记录',
          },
          {
            key: '/deleted',
            icon: <DeleteOutlined />,
            label: '删除记录',
          },
        ]
      
      case 'filing_officer':
        return [
          {
            key: '/filing',
            icon: <FileTextOutlined />,
            label: '备案工作台',
          }
        ]
      
      case 'salesman':
        return [
          {
            key: '/sales',
            icon: <TeamOutlined />,
            label: '业务工作台',
          }
        ]
      
      case 'surveyor':
        return [
          {
            key: '/surveyor',
            icon: <TeamOutlined />,
            label: '踏勘工作台',
          }
        ]
      
      case 'warehouse':
        return [
          {
            key: '/warehouse',
            icon: <InboxOutlined />,
            label: '仓库工作台',
          }
        ]
      
      case 'dispatch':
        return [
          {
            key: '/dispatch',
            icon: <SendOutlined />,
            label: '派工工作台',
          }
        ]
      
      case 'construction_team':
        return [
          {
            key: '/construction',
            icon: <ToolOutlined />,
            label: '施工工作台',
          }
        ]
      
      case 'grid_connector':
        return [
          {
            key: '/grid-connection',
            icon: <AppstoreOutlined />,
            label: '并网工作台',
          }
        ]
      
      case 'procurement':
        return [
          {
            key: '/procurement',
            icon: <ShoppingOutlined />,
            label: '采购工作台',
          }
        ]
      
      default:
        // 对于未知角色，不显示任何菜单项
        return []; 
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        collapsedWidth={isMobile ? 0 : 80}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
        }}
      >
        <div className="logo" style={{ margin: '16px', background: 'rgba(255, 255, 255, 0.2)', height: '32px' }} />
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={[location.pathname]}
          selectedKeys={[location.pathname]}
          items={getMenuItems(userRole)}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? (isMobile ? 0 : 80) : 200, transition: 'all 0.2s' }}>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '16px', width: 64, height: 64 }}
          />
          <div style={{ float: 'right', marginRight: '24px' }}>
            <Dropdown
              menu={{
                items: [
                  {
                    key: '1',
                    icon: <UserOutlined />,
                    label: (
                      <div>
                        <Text strong>{user?.email}</Text>
                        <br />
                        <Text type="secondary">{userRole ? `角色: ${userRole}` : ''}</Text>
                      </div>
                    ),
                  },
                  {
                    key: '2',
                    icon: <LogoutOutlined />,
                    label: '退出登录',
                    onClick: handleSignOut,
                  },
                ],
              }}
              placement="bottomRight"
            >
              <Avatar icon={<UserOutlined />} style={{ cursor: 'pointer' }} />
            </Dropdown>
          </div>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout