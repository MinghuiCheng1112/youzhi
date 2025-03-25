/**
 * 计算工具函数
 * 根据组件数量自动计算容量、投资金额、用地面积、逆变器型号、铜线、铝线和配电箱等相关字段
 */

/**
 * 根据组件数量计算容量（KW）
 * 容量 = 组件数量 * 0.71KW
 */
export const calculateCapacity = (moduleCount: number): number => {
  return parseFloat((moduleCount * 0.71).toFixed(2))
}

/**
 * 根据组件数量计算投资金额
 * 投资金额 = 组件数量 * 0.71 * 0.25
 */
export const calculateInvestmentAmount = (moduleCount: number): number => {
  return parseFloat((moduleCount * 0.71 * 0.25).toFixed(2))
}

/**
 * 根据组件数量计算用地面积（m²）
 * 用地面积 = 组件数量 * 3.106m²
 */
export const calculateLandArea = (moduleCount: number): number => {
  return parseFloat((moduleCount * 3.106).toFixed(2))
}

/**
 * 根据组件数量确定逆变器型号
 */
export const determineInverter = (moduleCount: number): string => {
  if (moduleCount >= 10 && moduleCount <= 13) return 'SN8.0PT-C'
  if (moduleCount >= 14 && moduleCount <= 16) return 'SN10PT-C'
  if (moduleCount >= 17 && moduleCount <= 20) return 'SN12PT-C'
  if (moduleCount >= 21 && moduleCount <= 24) return 'SN15PT-C'
  if (moduleCount >= 25 && moduleCount <= 27) return 'SN17PT-C'
  if (moduleCount >= 28 && moduleCount <= 32) return 'SN20PT-B'
  if (moduleCount >= 33 && moduleCount <= 37) return 'SN23PT-B'
  if (moduleCount >= 38 && moduleCount <= 41) return 'SN25PT-B'
  if (moduleCount >= 42 && moduleCount <= 48) return 'SN30PT-C'
  if (moduleCount >= 49 && moduleCount <= 53) return 'SN33PT-C'
  if (moduleCount >= 54 && moduleCount <= 59) return 'SN36PT-C'
  if (moduleCount >= 60 && moduleCount <= 67) return 'SN40PT-C'
  if (moduleCount >= 68 && moduleCount <= 83) return 'SN50PT-B'
  if (moduleCount >= 84 && moduleCount <= 97) return 'SN60PT'
  if (moduleCount < 10) return '组件数量过少，无法确定逆变器型号'
  return '组件数量过多，请手动选择逆变器型号'
}

/**
 * 根据逆变器型号确定配电箱规格
 */
export const determineDistributionBox = (inverter: string): string => {
  if (inverter.includes('组件数量')) return ''
  
  if (inverter <= 'SN30PT-C') return '30kWp'
  if (inverter > 'SN30PT-C' && inverter <= 'SN50PT-B') return '50kWp'
  if (inverter > 'SN50PT-B') return '80kWp'
  
  return ''
}

/**
 * 根据逆变器型号确定铜线规格
 */
export const determineCopperWire = (inverter: string): string => {
  if (inverter.includes('组件数量')) return ''
  
  if (inverter <= 'SN20PT-B') return '3*10mm²'
  if (inverter > 'SN20PT-B' && inverter <= 'SN30PT-C') return '3*16mm²'
  if (inverter > 'SN30PT-C' && inverter <= 'SN50PT-B') return '3*25mm²'
  if (inverter > 'SN50PT-B' && inverter <= 'SN60PT') return '3*35mm²'
  
  return ''
}

/**
 * 根据逆变器型号确定铝线规格
 */
export const determineAluminumWire = (inverter: string): string => {
  if (inverter.includes('组件数量')) return ''
  
  if (inverter <= 'SN20PT-B') return '3*16mm²'
  if (inverter > 'SN20PT-B' && inverter <= 'SN30PT-C') return '3*25mm²'
  if (inverter > 'SN30PT-C' && inverter <= 'SN50PT-B') return '3*35mm²'
  if (inverter > 'SN50PT-B' && inverter <= 'SN60PT') return '3*50mm²'
  if (inverter > 'SN60PT') return '3*70mm²'
  
  return ''
}

/**
 * 计算所有相关字段
 */
export const calculateAllFields = (moduleCount: number) => {
  const capacity = calculateCapacity(moduleCount)
  const investmentAmount = calculateInvestmentAmount(moduleCount)
  const landArea = calculateLandArea(moduleCount)
  const inverter = determineInverter(moduleCount)
  const distributionBox = determineDistributionBox(inverter)
  const copperWire = determineCopperWire(inverter)
  const aluminumWire = determineAluminumWire(inverter)
  
  return {
    capacity,
    investment_amount: investmentAmount,
    land_area: landArea,
    inverter,
    distribution_box: distributionBox,
    copper_wire: copperWire,
    aluminum_wire: aluminumWire
  }
}