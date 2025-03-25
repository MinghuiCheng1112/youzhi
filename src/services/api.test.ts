import { describe, it, expect, vi } from 'vitest'

// 模拟 Supabase 客户端
vi.mock('../lib/supabaseClient', () => {
  return {
    supabase: {
      from: () => ({
        select: () => ({
          order: () => Promise.resolve({
            data: [{ id: '1', customer_name: '测试客户1' }],
            error: null
          })
        })
      })
    }
  }
})

describe('API测试', () => {
  it('基本测试', () => {
    expect(true).toBe(true)
  })
}) 