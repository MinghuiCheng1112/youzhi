import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

export const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const navigate = useNavigate();
  const { user } = useAuth(); // 获取认证状态

  useEffect(() => {
    const handleVerification = async () => {
      // 获取所有URL参数用于调试
      const allParams: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        allParams[key] = value;
      });
      
      console.log('验证邮件页面 - URL参数:', allParams);
      setDebugInfo(allParams);
      
      // 尝试从URL获取token参数
      const token = searchParams.get('token') || searchParams.get('token_hash');
      const type = searchParams.get('type') || 'email';
      
      if (!token) {
        const errorMsg = '验证链接无效，缺少token参数';
        console.error(errorMsg, '所有参数:', allParams);
        setError(errorMsg);
        setVerifying(false);
        return;
      }

      try {
        console.log('开始验证邮箱，token:', token, 'type:', type);
        
        // 处理邮箱验证
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type as any,
        });

        console.log('验证结果:', { data: verifyData, error: verifyError });
        
        if (verifyError) {
          console.error('验证失败:', verifyError);
          throw verifyError;
        }
        
        console.log('验证成功');
        setSuccess(true);
        
        // 更新会话
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('获取会话失败:', sessionError);
        } else if (sessionData.session) {
          console.log('已获取新会话', sessionData);
        }
        
        // 设置验证成功，3秒后跳转
        setTimeout(() => navigate('/login'), 3000);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : '验证失败';
        console.error('验证过程中出错:', errorMessage);
        setError(errorMessage);
      } finally {
        setVerifying(false);
      }
    };

    handleVerification();
  }, [searchParams, navigate]);

  // 如果用户已登录并验证成功，直接重定向到主页
  useEffect(() => {
    if (user && success) {
      console.log('用户已登录且验证成功，即将重定向到主页');
      navigate('/');
    }
  }, [user, success, navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column'
    }}>
      {verifying ? (
        <div>
          <h2>验证中</h2>
          <p>正在验证您的邮箱，请稍候...</p>
        </div>
      ) : error ? (
        <div>
          <h2>验证失败</h2>
          <p style={{ color: 'red' }}>{error}</p>
          <p style={{ color: 'gray', fontSize: '12px' }}>调试信息: {JSON.stringify(debugInfo)}</p>
          <button onClick={() => navigate('/login')}>返回登录</button>
        </div>
      ) : (
        <div>
          <h2>验证成功</h2>
          <p>您的邮箱已验证成功！</p>
          <p>正在跳转到登录页面...</p>
        </div>
      )}
    </div>
  );
}; 