import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PendingRole = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      padding: '20px'
    }}>
      <Result
        status="info"
        title="您的账号尚未分配角色"
        subTitle="您的账号注册成功，但需要管理员分配角色后才能使用系统。请联系系统管理员为您分配适当的角色权限。"
        extra={[
          <Button type="primary" key="logout" onClick={handleLogout}>
            退出登录
          </Button>,
        ]}
      />
    </div>
  );
};

export default PendingRole; 