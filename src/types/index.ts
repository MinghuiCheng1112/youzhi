// 更新出库状态类型定义
export type OutboundStatus = 'none' | 'outbound' | 'inbound' | 'returned';

// 客户信息类型定义
export interface Customer {
  id: string
  register_date: string // 登记日期
  customer_name: string // 客户姓名
  phone: string // 客户电话
  address: string // 地址
  id_card: string // 身份证号
  salesman: string // 业务员
  salesman_phone: string | null // 业务员电话
  surveyor: string | null // 踏勘员
  surveyor_phone: string | null // 踏勘员电话
  surveyor_email: string | null // 踏勘员邮箱(隐藏字段，用于关联)
  station_management: string[] | string // 电站建设管理
  filing_date: string | null // 备案日期
  meter_number: string // 电表号码
  designer: string // 设计师
  designer_phone: string | null // 设计师电话
  drawing_change: string | null // 图纸变更
  urge_order: string | null // 催单
  capacity: number // 容量
  investment_amount: number // 投资金额
  land_area: number // 用地面积
  module_count: number | null // 组件数量
  inverter: string // 逆变器
  copper_wire: string // 铜线
  aluminum_wire: string // 铝线
  distribution_box: string // 配电箱
  square_steel_outbound_date: string | null // 方钢出库日期
  component_outbound_date: string | null // 组件出库日期
  square_steel_inbound_date: string | null // 方钢回库日期
  component_inbound_date: string | null // 组件回库日期
  square_steel_status: OutboundStatus | null // 方钢状态
  component_status: OutboundStatus | null // 组件状态
  dispatch_date: string | null // 派工日期
  construction_team: string | null // 施工队
  construction_team_phone: string | null // 施工队电话
  construction_team_email: string | null // 施工队账号邮箱
  construction_status: string | null // 施工状态
  main_line: string | null // 大线
  large_cable: string | null // 大线
  technical_review: string | null // 技术审核
  technical_review_date: string | null // 技术审核日期
  technical_review_notes: string | null // 技术审核备注
  upload_to_grid: string | null // 上传国网
  construction_acceptance: string | null // 建设验收
  construction_acceptance_date: string | null // 建设验收日期
  construction_acceptance_notes: string | null // 建设验收备注
  meter_installation_date: string | null // 挂表日期
  power_purchase_contract: string | null // 购售电合同
  status: string | null // 状态
  price: number | null // 价格
  company: string | null // 公司
  remarks: string | null // 备注
  first_contact: string | null // 首次联系日期
  renewal_status: string | null // 续约状态
  created_at: string
  updated_at: string
  deleted_at: string | null
  timestamp?: string // 时间戳字段，用于补充资料中的日期选项
}

// 修改记录类型定义
export interface ModificationRecord {
  id: string
  customer_id: string
  field_name: string
  old_value: string
  new_value: string
  modified_by: string
  modified_at: string
}

// 用户角色类型定义
export type UserRole = 
  | 'admin' // 管理员
  | 'filing_officer' // 备案员
  | 'salesman' // 业务员
  | 'warehouse' // 仓库
  | 'construction_team' // 施工队
  | 'grid_connector' // 并网员
  | 'surveyor' // 踏勘员
  | 'dispatch' // 派工员

// 用户角色关系类型定义
export interface UserRoleRelation {
  id: string
  user_id: string
  parent_id: string | null
  role: UserRole
}

// 乡镇类型定义
export type Township = 
  | '舞泉镇'
  | '吴城镇'
  | '北舞渡镇'
  | '莲花镇'
  | '辛安镇'
  | '孟寨镇'
  | '太尉镇'
  | '侯集镇'
  | '九街镇'
  | '文峰乡'
  | '保和乡'
  | '马村乡'
  | '姜店乡'
  | '章化镇'

// 抽签记录类型定义
export interface DrawRecord {
  id: string
  customer_id: string
  township: Township
  random_code: string
  construction_team: string
  draw_date: string
  drawn_by: string
}

// 导入结果类型定义
export interface ImportResult {
  total: number
  success: number
  duplicate: number
  failed: number
  failedItems?: { row: number; reason: string }[]
}

export type UpdateCustomerInput = Partial<Omit<Customer, 'id' | 'created_at' | 'updated_at'>> & {
  drawing_change?: string | null;
};