/**
 * 保险客户与保单台账的领域模型与日期推算规则。
 *
 * 关键业务规则集中在这里，而非散落在工具里：
 * - 犹豫期起算日 = 回执签收日（电子签收按系统记录时间）
 * - 犹豫期时长：一般 10 日；银行保险渠道 15 日；部分公司延长至 20 天
 * - 新单回访须在犹豫期内完成
 * - 续期缴费提醒提前量
 *
 * @module @local/dsh-insurance-crm/domain
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { CHANNEL } from './dates.js'

export { CHANNEL, GRACE_PERIOD_DAYS, computeGracePeriodEnd, daysUntil, isWithinGracePeriod } from './dates.js'

/** 产品分级，与适当性管理规范一致。 */
export const PRODUCT_CLASS = ['P1', 'P2', 'P3', 'P4', 'P5']

/** 客户档案。 */
export const clientRecord = z.object({
  /** 客户姓名。 */
  name: z.string(),
  /** 出生日期 ISO-8601（date）。 */
  birthDate: z.string().optional(),
  /** 职业。 */
  occupation: z.string().optional(),
  /** 家庭角色：经济支柱 / 配偶 / 子女 / 父母。 */
  familyRole: z.string().optional(),
  /** 年收入（元）。 */
  annualIncome: z.number().optional(),
  /** 负债合计（元）。 */
  totalDebt: z.number().optional(),
  /** 风险承受能力等级 R1–R5。 */
  riskLevel: z.enum(['R1', 'R2', 'R3', 'R4', 'R5']).optional(),
  /** 已有保障备注（社保、团险、已有商保）。 */
  existingCoverage: z.string().optional(),
  /** 健康告知要点。 */
  healthNotes: z.string().optional(),
  /** 备注。 */
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/** 保单台账记录。 */
export const policyRecord = z.object({
  /** 归属客户 id。 */
  clientId: z.string(),
  /** 保险公司。 */
  insurer: z.string(),
  /** 产品名称。 */
  productName: z.string(),
  /** 产品分级 P1–P5。 */
  productClass: z.enum(PRODUCT_CLASS),
  /** 险种类型，如 重疾险 / 医疗险 / 定期寿险。 */
  category: z.string().optional(),
  /** 保额（元）。 */
  coverage: z.number().optional(),
  /** 年交保费（元）。 */
  annualPremium: z.number().optional(),
  /** 销售渠道。 */
  channel: z.enum(CHANNEL),
  /** 承保日 ISO-8601（date）。 */
  issuedDate: z.string().optional(),
  /** 回执签收日 ISO-8601（date）—— 犹豫期起算日。 */
  receiptDate: z.string().optional(),
  /** 犹豫期止日 ISO-8601（date），由回执日推算。 */
  gracePeriodEnd: z.string().optional(),
  /** 缴费期间（年）。 */
  paymentYears: z.number().optional(),
  /** 年缴保费到期日（月-日），用于续期提醒。 */
  renewalMonthDay: z.string().optional(),
  /** 保单状态。 */
  status: z.enum(['pending', 'active', 'lapsed', 'surrendered', 'claimed']).optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/** 沟通记录。 */
export const touchpointRecord = z.object({
  clientId: z.string(),
  /** 沟通方式：面谈 / 电话 / 微信 / 其他。 */
  channelType: z.string(),
  /** 沟通要点。 */
  summary: z.string(),
  /** 后续动作。 */
  nextAction: z.string().optional(),
  occurredAt: z.string(),
  createdAt: z.string(),
})

/** 客户与保单台账的域声明。 */
export const insuranceCrmDomainSpec = defineDomain({
  name: 'insurance_crm',
  version: 1,
  tables: {
    clients: domainTable(clientRecord),
    policies: domainTable(policyRecord),
    touchpoints: domainTable(touchpointRecord),
  },
})
