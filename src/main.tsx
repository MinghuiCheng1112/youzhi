import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import ensureDatabaseStructure from './utils/checkDatabase'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

// 设置dayjs为中文
dayjs.locale('zh-cn')

const queryClient = new QueryClient()

// 初始化数据库检查
ensureDatabaseStructure()
  .then(() => console.log('数据库结构检查完成'))
  .catch(error => console.error('数据库结构检查失败:', error))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)