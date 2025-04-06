import React, { useState } from 'react';
import { Button, Card, message, Typography, Space, Alert, Spin } from 'antd';
import { CheckCircleOutlined, CodeOutlined, DatabaseOutlined } from '@ant-design/icons';
import { supabase } from '../../services/supabaseClient';

const { Title, Paragraph, Text } = Typography;

const triggerScript = `
-- 确保派工日期与施工队关联的触发器脚本
-- 实现规则:
-- 1. 如果施工队为空，则派工日期必须为空
-- 2. 如果施工队从空变为有值，则派工日期设置为当前日期

-- 首先删除已存在的同名触发器（如果有）
DROP TRIGGER IF EXISTS ensure_dispatch_date_consistency ON customers;

-- 创建触发器函数
CREATE OR REPLACE FUNCTION ensure_dispatch_date_consistency()
RETURNS TRIGGER AS $$
BEGIN
    -- 如果施工队为空，则派工日期也必须为空
    IF (NEW.construction_team IS NULL OR NEW.construction_team = '') THEN
        NEW.dispatch_date := NULL;
    -- 如果施工队从空变为有值，则设置派工日期为当前日期
    ELSIF (
        (OLD.construction_team IS NULL OR OLD.construction_team = '') AND 
        (NEW.construction_team IS NOT NULL AND NEW.construction_team != '')
    ) THEN
        NEW.dispatch_date := CURRENT_DATE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器，在更新或插入记录前执行
CREATE TRIGGER ensure_dispatch_date_consistency
BEFORE INSERT OR UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION ensure_dispatch_date_consistency();

-- 添加一次性更新，修复现有数据
DO $$
BEGIN
    -- 1. 修复施工队为空但派工日期不为空的情况
    UPDATE customers
    SET dispatch_date = NULL
    WHERE (construction_team IS NULL OR construction_team = '')
    AND dispatch_date IS NOT NULL;
    
    -- 2. 修复施工队不为空但派工日期为空的情况
    UPDATE customers
    SET dispatch_date = CURRENT_DATE
    WHERE construction_team IS NOT NULL 
    AND construction_team != ''
    AND dispatch_date IS NULL;
    
    RAISE NOTICE '数据已修复: 所有记录的派工日期与施工队状态现已保持一致';
END $$;

-- 返回成功消息
SELECT '触发器已创建: 施工队与派工日期的数据一致性将自动维护' as message;
`;

const DatabaseTriggerSetup: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const executeScript = async () => {
    setLoading(true);
    setSuccess(false);
    setError(null);
    setResult(null);
    
    try {
      const { data, error } = await supabase.rpc('execute_sql', { sql_string: triggerScript });
      
      if (error) {
        console.error('执行SQL脚本失败:', error);
        setError(error.message);
        message.error('触发器创建失败');
      } else {
        console.log('SQL脚本执行结果:', data);
        setSuccess(true);
        setResult(data && Array.isArray(data) && data.length > 0 ? JSON.stringify(data[data.length - 1]) : '执行成功');
        message.success('触发器创建成功');
      }
    } catch (err: any) {
      console.error('执行过程中出错:', err);
      setError(err.message || '未知错误');
      message.error('执行过程中出错');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px' }}>
      <Card 
        title={
          <Space>
            <DatabaseOutlined />
            <span>施工队与派工日期关联触发器设置</span>
          </Space>
        }
        style={{ marginBottom: 20 }}
      >
        <Typography>
          <Title level={4}>功能说明</Title>
          <Paragraph>
            此功能将创建数据库触发器，确保施工队与派工日期之间的数据一致性，实现以下业务规则：
          </Paragraph>
          <ul>
            <li>当施工队字段为空时，派工日期会自动设置为空</li>
            <li>当施工队字段从空变为有值时，派工日期会自动设置为当前日期</li>
          </ul>
          
          <Title level={4}>执行步骤</Title>
          <Paragraph>
            点击下方"创建触发器"按钮，系统将执行SQL脚本，创建必要的数据库触发器，并修复现有数据。
          </Paragraph>
          
          <Alert
            message="注意事项"
            description="此操作需要管理员权限，并将直接修改数据库结构。执行前请确认您已理解其影响。"
            type="warning"
            showIcon
            style={{ marginBottom: 20 }}
          />
          
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button 
              type="primary" 
              icon={<CodeOutlined />} 
              onClick={executeScript}
              loading={loading}
              disabled={success}
              size="large"
              block
            >
              创建触发器
            </Button>
            
            {loading && <Spin tip="正在执行SQL脚本..." />}
            
            {error && (
              <Alert message="执行失败" description={error} type="error" showIcon />
            )}
            
            {success && (
              <Alert
                message="触发器创建成功"
                description={
                  <div>
                    <p>施工队与派工日期关联触发器已成功创建，并已修复现有数据。</p>
                    {result && <p>执行结果: {result}</p>}
                    <p>现在，系统将自动维护施工队与派工日期的数据一致性。</p>
                  </div>
                }
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
              />
            )}
          </Space>
        </Typography>
      </Card>
    </div>
  );
};

export default DatabaseTriggerSetup; 