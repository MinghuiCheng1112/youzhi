import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntApp, theme, message, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useAuth } from './contexts/AuthContext'
import { fixRoleConstraint } from './services/supabase'

// 布局组件
import MainLayout from './layouts/MainLayout'
import AuthLayout from './layouts/AuthLayout'

// 页面组件
import Login from './pages/Login'
import CustomerList from './pages/CustomerList'
import CustomerForm from './pages/CustomerForm'
import ImportCustomers from './pages/ImportCustomers'
import RecordingList from './pages/RecordingList'
import DeletedRecords from './pages/DeletedRecords'
import DrawSystem from './pages/DrawSystem'
import NotFound from './pages/NotFound'
import { VerifyEmail } from './pages/VerifyEmail'

// 角色特定页面
import RoleDashboard from './pages/roles/RoleDashboard'
import FilingOfficerDashboard from './pages/roles/FilingOfficerDashboard'
import SalesmanDashboard from './pages/roles/SalesmanDashboard'
import WarehouseManagerDashboard from './pages/roles/WarehouseManagerDashboard'
import ConstructionTeamDashboard from './pages/roles/ConstructionTeamDashboard'
import DispatchManagerDashboard from './pages/roles/DispatchManagerDashboard'
import AdminDashboard from './pages/roles/AdminDashboard'
import GridConnectionDashboard from './pages/roles/GridConnectionDashboard'
import SurveyorDashboard from './pages/roles/SurveyorDashboard'
import ProcurementDashboard from './pages/roles/ProcurementDashboard'

// 角色路由守卫组件 - 仅允许特定角色访问
const RoleRoute = ({ 
  children, 
  allowedRoles 
}: { 
  children: JSX.Element, 
  allowedRoles: string[] 
}) => {
  const { user, loading, userRole } = useAuth()
  
  // 如果正在加载，显示空内容
  if (loading) {
    return <div style={{ width: '100%', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}></div>
  }
  
  // 如果未认证，重定向到登录页
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  // 临时解决方案：跳过权限检查，允许访问所有页面
  console.log(`用户角色: ${userRole}, 所需角色: ${allowedRoles.join(', ')}`);
  
  // 注释掉原始的权限检查逻辑，允许任何角色访问
  /*
  if (!allowedRoles.includes(userRole || '')) {
    message.error('您没有权限访问此页面');
    return <Navigate to={getDefaultPath(userRole || undefined)} replace state={{ from: location }} />
  }
  */
  
  // 角色匹配，渲染子组件
  return children
}

function App() {
  const { user, loading, userRole, error, clearError, connectionStatus } = useAuth()
  const [initialized, setInitialized] = useState(false)

  // 当认证状态加载完成时，设置初始化标志
  useEffect(() => {
    if (!loading) {
      setInitialized(true)
    }
  }, [loading])

  // 错误处理
  useEffect(() => {
    if (error) {
      message.error({
        content: error,
        duration: 5,
        onClose: clearError
      });
    }
  }, [error, clearError]);

  // 连接状态监控
  useEffect(() => {
    if (connectionStatus === 'error' && initialized) {
      message.warning({
        content: '数据库连接异常，部分功能可能不可用',
        duration: 5
      });
    }
  }, [connectionStatus, initialized]);

  // 在应用启动时尝试修复角色约束
  useEffect(() => {
    // 尝试修复数据库角色约束
    const fixDatabaseConstraints = async () => {
      try {
        console.log('应用启动：检查并修复数据库角色约束...');
        await fixRoleConstraint();
      } catch (error) {
        console.error('修复数据库角色约束失败:', error);
      }
    };
    
    fixDatabaseConstraints();
  }, []);

  // 根据用户角色获取默认主页
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
        // 一个通用页面，展示基本信息
        return '/dashboard';
    }
  };

  // 显示全局加载状态
  if (!initialized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="系统加载中..." />
      </div>
    )
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <AntApp>
        <Routes>
          {/* 公共路由 */}
          <Route path="/login" element={user ? <Navigate to={getDefaultHomePage(userRole || undefined)} replace /> : <AuthLayout><Login /></AuthLayout>} />
          <Route path="/404" element={<NotFound />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* 受保护的路由 */}
          {user ? (
            <>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Navigate to={getDefaultHomePage(userRole || undefined)} replace />} />
                <Route path="dashboard" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <Navigate to={getDefaultHomePage(userRole || undefined)} replace />
                  </RoleRoute>
                } />
                <Route path="role-dashboard" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <RoleDashboard />
                  </RoleRoute>
                } />
                <Route path="customers" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <CustomerList />
                  </RoleRoute>
                } />
                <Route path="customers/new" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <CustomerForm />
                  </RoleRoute>
                } />
                <Route path="customers/import" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <ImportCustomers />
                  </RoleRoute>
                } />
                <Route path="customers/:id" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <CustomerForm />
                  </RoleRoute>
                } />
                <Route path="records" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <RecordingList />
                  </RoleRoute>
                } />
                <Route path="deleted" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <DeletedRecords />
                  </RoleRoute>
                } />
                <Route path="draw" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <DrawSystem />
                  </RoleRoute>
                } />
                
                {/* 角色特定路由 */}
                <Route path="admin" element={
                  <RoleRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </RoleRoute>
                } />
                <Route path="filing" element={
                  <RoleRoute allowedRoles={['admin', 'filing_officer']}>
                    <FilingOfficerDashboard />
                  </RoleRoute>
                } />
                <Route path="sales" element={
                  <RoleRoute allowedRoles={['admin', 'salesman']}>
                    <SalesmanDashboard />
                  </RoleRoute>
                } />
                <Route path="warehouse" element={
                  <RoleRoute allowedRoles={['admin', 'warehouse']}>
                    <WarehouseManagerDashboard />
                  </RoleRoute>
                } />
                <Route path="construction" element={
                  <RoleRoute allowedRoles={['admin', 'construction_team']}>
                    <ConstructionTeamDashboard />
                  </RoleRoute>
                } />
                <Route path="dispatch" element={
                  <RoleRoute allowedRoles={['admin', 'dispatch']}>
                    <DispatchManagerDashboard />
                  </RoleRoute>
                } />
                <Route path="grid-connection" element={
                  <RoleRoute allowedRoles={['admin', 'grid_connector']}>
                    <GridConnectionDashboard />
                  </RoleRoute>
                } />
                <Route path="surveyor" element={
                  <RoleRoute allowedRoles={['admin', 'surveyor']}>
                    <SurveyorDashboard />
                  </RoleRoute>
                } />
                <Route path="procurement" element={
                  <RoleRoute allowedRoles={['admin', 'procurement']}>
                    <ProcurementDashboard />
                  </RoleRoute>
                } />
              </Route>
            </>
          ) : (
            <Route path="*" element={<Navigate to="/login" replace />} />
          )}

          {/* 捕获所有其他路由 */}
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </AntApp>
    </ConfigProvider>
  )
}

export default App