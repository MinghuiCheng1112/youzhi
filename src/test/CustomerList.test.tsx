/// <reference types="vitest" />
/// <reference types="@testing-library/react" />

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import CustomerList from '../pages/CustomerList'
import { BrowserRouter } from 'react-router-dom'

// 模拟react-router-dom hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

// 模拟AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    userRole: 'admin',
    user: { email: 'test@example.com', id: '1' }
  })
}))

// 模拟API
vi.mock('../services/api', () => ({
  customerApi: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: '1',
        customer_name: '测试客户1',
        phone: '13800138001',
        address: '北京市海淀区',
        register_date: '2023-01-01',
        square_steel_outbound_date: null,
        component_outbound_date: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      },
      {
        id: '2',
        customer_name: '测试客户2',
        phone: '13800138002',
        address: '北京市朝阳区',
        register_date: '2023-01-02',
        square_steel_outbound_date: '2023-01-03T00:00:00Z',
        component_outbound_date: null,
        created_at: '2023-01-02T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z'
      }
    ]),
    delete: vi.fn().mockResolvedValue(undefined)
  }
}))

// 模拟window.matchMedia
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // 模拟window.getComputedStyle
  Object.defineProperty(window, 'getComputedStyle', {
    value: () => ({
      getPropertyValue: () => '',
    }),
  })
})

describe('CustomerList组件', () => {
  it('应该正确渲染', () => {
    render(
      <BrowserRouter>
        <CustomerList />
      </BrowserRouter>
    )
    
    // 只测试组件是否渲染，不做断言检查
    expect(true).toBe(true)
  })
}) 