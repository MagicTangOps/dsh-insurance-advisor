// 包根入口：只是三个插件的汇总导出，供需要直接 import 的调用方使用。
// 真正的挂载由 cordis.patch.yml 通过子路径完成（dsh-insurance-advisor/crm 等）。
export * as suitability from './suitability/index.js'
export * as crm from './crm/index.js'
export * as dualRecord from './dual-record/index.js'