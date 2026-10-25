/**
 * 保险客户与保单台账 —— 面向模型的工具。
 *
 * 底层用 `ctx.storageDomain` 的 `insurance_crm` 域持久化。
 * 犹豫期、续期等日期推算复用 `dates.js` 的纯函数。
 *
 * @module @local/dsh-insurance-crm
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { insuranceCrmDomainSpec } from './domain.js'
import { computeGracePeriodEnd, daysUntil, isWithinGracePeriod } from './dates.js'

/** Loader 诊断使用的插件名。 */
export const name = 'insurance-crm'

/** 本插件依赖的服务。 */
export const inject = ['tools', 'systemPrompt', 'storageDomain']

const TEXT_OUTPUT = {
  schema: { type: 'string' },
  render: (_args, value) => [{ type: 'text', text: value }],
}

const PROMPT_TEXT =
  '客户信息与保单台账通过 insurance_crm_* 工具维护；'
  + '记录保单时提供 receipt_date（回执签收日）与 channel（渠道），'
  + '系统会推算犹豫期止日。犹豫期起算以回执签收日为准。'

/** 生成短 id。 */
function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/** 当前 ISO 时间戳。 */
function now() {
  return new Date().toISOString()
}

/**
 * 注册保险台账工具。
 * @param ctx - Cordis 上下文。
 */
export function apply(ctx) {
  let domain
  // 服务在 apply 返回后异步就绪，因此用 promise 门闩而非在 .then 里注册 effect
  //（.then 回调执行时 ctx 可能已 inactive，ctx.effect 会抛 INACTIVE_EFFECT）。
  const ready = ctx.storageDomain.open(insuranceCrmDomainSpec).then((opened) => {
    domain = opened
    return opened
  })
  ctx.effect(() => () => ready.then((opened) => opened.close()), 'insurance-crm.domainClose')

  ctx.systemPrompt.section({ name: 'tool:insurance-crm', order: 2510, text: PROMPT_TEXT })

  const clients = () => domain.table('clients')
  const policies = () => domain.table('policies')

  ctx.tools.register(defineTool({
    name: 'insurance_upsert_client',
    description:
      '新增或更新保险客户档案。用于记录客户基本信息、家庭角色、收入负债、'
      + '风险承受能力等级（R1–R5）与健康告知要点。'
      + '省略 client_id 时新建；提供则更新已有档案。',
    parameters: {
      client_id: { type: 'string', description: '已有客户 id；省略则新建。' },
      name: { type: 'string', required: true, description: '客户姓名。' },
      birth_date: { type: 'string', description: '出生日期 YYYY-MM-DD。' },
      occupation: { type: 'string', description: '职业。' },
      family_role: {
        type: 'string',
        description: '家庭角色，如：经济支柱 / 配偶 / 子女 / 父母。',
      },
      annual_income: { type: 'number', description: '年收入（元）。' },
      total_debt: { type: 'number', description: '负债合计（元）。' },
      risk_level: {
        type: 'string',
        enum: ['R1', 'R2', 'R3', 'R4', 'R5'],
        description: '风险承受能力等级，用于适当性匹配。',
      },
      existing_coverage: { type: 'string', description: '已有保障（社保/团险/已有商保）。' },
      health_notes: { type: 'string', description: '健康告知要点。' },
      notes: { type: 'string', description: '备注。' },
    },
    output: TEXT_OUTPUT,
    execute: async (args) => {
      await ready
      const id = args.client_id ?? newId('cli')
      const existing = clients().get(id)
      const record = {
        name: args.name,
        ...(args.birth_date !== undefined ? { birthDate: args.birth_date } : {}),
        ...(args.occupation !== undefined ? { occupation: args.occupation } : {}),
        ...(args.family_role !== undefined ? { familyRole: args.family_role } : {}),
        ...(args.annual_income !== undefined ? { annualIncome: args.annual_income } : {}),
        ...(args.total_debt !== undefined ? { totalDebt: args.total_debt } : {}),
        ...(args.risk_level !== undefined ? { riskLevel: args.risk_level } : {}),
        ...(args.existing_coverage !== undefined ? { existingCoverage: args.existing_coverage } : {}),
        ...(args.health_notes !== undefined ? { healthNotes: args.health_notes } : {}),
        ...(args.notes !== undefined ? { notes: args.notes } : {}),
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
      }
      await clients().put(id, record)
      return `${existing ? '已更新' : '已新建'}客户档案：${id}\n姓名：${record.name}`
        + (record.riskLevel ? `\n风险等级：${record.riskLevel}` : '')
        + (record.familyRole ? `\n家庭角色：${record.familyRole}` : '')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'insurance_list_clients',
    description: '列出全部已登记的保险客户档案，含风险等级与家庭角色。',
    parameters: {
      keyword: { type: 'string', description: '按姓名模糊筛选。' },
    },
    output: TEXT_OUTPUT,
    execute: async (args) => {
      await ready
      const all = [...clients().entries()]
      const filtered = args.keyword
        ? all.filter(([, record]) => record.name.includes(args.keyword))
        : all
      if (filtered.length === 0) return '暂无客户档案。'
      return filtered.map(([id, record]) => {
        const parts = [`${id}  ${record.name}`]
        if (record.familyRole) parts.push(record.familyRole)
        if (record.riskLevel) parts.push(record.riskLevel)
        if (record.annualIncome) parts.push(`年收入 ${record.annualIncome}`)
        return parts.join(' | ')
      }).join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'insurance_add_policy',
    description:
      '为某客户登记保单。提供 receipt_date（回执签收日）与 channel 时，'
      + '自动推算犹豫期止日。回执签收日是犹豫期的法定起算日。',
    parameters: {
      client_id: { type: 'string', required: true, description: '客户 id。' },
      insurer: { type: 'string', required: true, description: '保险公司。' },
      product_name: { type: 'string', required: true, description: '产品名称。' },
      product_class: {
        type: 'string',
        required: true,
        enum: ['P1', 'P2', 'P3', 'P4', 'P5'],
        description: '产品分级，依适当性管理规范。',
      },
      channel: {
        type: 'string',
        required: true,
        enum: ['individual', 'bancassurance', 'internet', 'telemarketing'],
        description: '销售渠道；银保渠道犹豫期为 15 日，其余一般 10 日。',
      },
      category: { type: 'string', description: '险种，如 重疾险 / 医疗险 / 定期寿险。' },
      coverage: { type: 'number', description: '保额（元）。' },
      annual_premium: { type: 'number', description: '年交保费（元）。' },
      issued_date: { type: 'string', description: '承保日 YYYY-MM-DD。' },
      receipt_date: { type: 'string', description: '回执签收日 YYYY-MM-DD（犹豫期起算日）。' },
      grace_period_days: { type: 'number', description: '覆盖犹豫期天数；省略按渠道默认。' },
      payment_years: { type: 'number', description: '缴费期间（年）。' },
      renewal_month_day: { type: 'string', description: '续期缴费日 MM-DD。' },
      notes: { type: 'string', description: '备注。' },
    },
    output: TEXT_OUTPUT,
    execute: async (args) => {
      await ready
      if (!clients().get(args.client_id)) {
        return `未找到客户 ${args.client_id}。请先用 insurance_upsert_client 建档。`
      }
      const id = newId('pol')
      const gracePeriodEnd = args.receipt_date !== undefined
        ? computeGracePeriodEnd(args.receipt_date, args.channel, args.grace_period_days)
        : undefined

      const record = {
        clientId: args.client_id,
        insurer: args.insurer,
        productName: args.product_name,
        productClass: args.product_class,
        channel: args.channel,
        ...(args.category !== undefined ? { category: args.category } : {}),
        ...(args.coverage !== undefined ? { coverage: args.coverage } : {}),
        ...(args.annual_premium !== undefined ? { annualPremium: args.annual_premium } : {}),
        ...(args.issued_date !== undefined ? { issuedDate: args.issued_date } : {}),
        ...(args.receipt_date !== undefined ? { receiptDate: args.receipt_date } : {}),
        ...(gracePeriodEnd !== undefined ? { gracePeriodEnd } : {}),
        ...(args.payment_years !== undefined ? { paymentYears: args.payment_years } : {}),
        ...(args.renewal_month_day !== undefined ? { renewalMonthDay: args.renewal_month_day } : {}),
        status: gracePeriodEnd && isWithinGracePeriod(gracePeriodEnd) ? 'pending' : 'active',
        ...(args.notes !== undefined ? { notes: args.notes } : {}),
        createdAt: now(),
        updatedAt: now(),
      }
      await policies().put(id, record)

      const lines = [`已登记保单：${id}`, `${record.insurer} ${record.productName}（${record.productClass}）`]
      if (gracePeriodEnd) {
        const remain = daysUntil(gracePeriodEnd)
        lines.push(`回执签收日：${record.receiptDate}`)
        lines.push(`犹豫期止日：${gracePeriodEnd}（剩余 ${remain} 天）`)
        lines.push('提示：一年期以上人身险新单须在犹豫期内 100% 回访。')
      } else {
        lines.push('未提供回执签收日，无法推算犹豫期。请在客户签收后补充 receipt_date。')
      }
      return lines.join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'insurance_list_policies',
    description: '列出保单台账，可按客户或状态筛选；标注仍在犹豫期内的保单。',
    parameters: {
      client_id: { type: 'string', description: '按客户筛选。' },
      status: {
        type: 'string',
        enum: ['pending', 'active', 'lapsed', 'surrendered', 'claimed'],
        description: '按状态筛选。',
      },
    },
    output: TEXT_OUTPUT,
    execute: async (args) => {
      await ready
      let all = [...policies().entries()]
      if (args.client_id) all = all.filter(([, record]) => record.clientId === args.client_id)
      if (args.status) all = all.filter(([, record]) => record.status === args.status)
      if (all.length === 0) return '暂无符合条件的保单。'
      return all.map(([id, record]) => {
        const inGrace = record.gracePeriodEnd && isWithinGracePeriod(record.gracePeriodEnd)
        return `${id} | ${record.insurer} ${record.productName} | ${record.productClass}`
          + ` | ${record.status ?? '未标注'}`
          + (record.gracePeriodEnd ? ` | 犹豫期止 ${record.gracePeriodEnd}` : '')
          + (inGrace ? ' ⚠️ 仍在犹豫期' : '')
      }).join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'insurance_service_due',
    description:
      '列出需要服务的保单：仍在犹豫期内的（须完成新单回访）、'
      + '以及在未来指定天数内到期的续期缴费。',
    parameters: {
      within_days: { type: 'number', description: '续期提醒窗口天数，默认 30。' },
      today: { type: 'string', description: '参考日期 YYYY-MM-DD；省略取今天。' },
    },
    output: TEXT_OUTPUT,
    execute: async (args) => {
      await ready
      const withinDays = args.within_days ?? 30
      const today = args.today
      const graces = []
      const renewals = []

      for (const [id, record] of policies().entries()) {
        if (record.gracePeriodEnd && isWithinGracePeriod(record.gracePeriodEnd, today)) {
          graces.push(
            `${id} | ${record.productName} | 犹豫期止 ${record.gracePeriodEnd}`
            + `（剩余 ${daysUntil(record.gracePeriodEnd, today)} 天）→ 须完成新单回访`,
          )
        }
        if (!record.renewalMonthDay) continue
        const [month, day] = record.renewalMonthDay.split('-').map(Number)
        const base = today ?? new Date().toISOString().slice(0, 10)
        const year = Number(base.slice(0, 4))
        let due = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        if (daysUntil(due, base) < 0) {
          due = `${year + 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        }
        const remain = daysUntil(due, base)
        if (remain <= withinDays) {
          renewals.push(`${id} | ${record.productName} | 续期缴费 ${due}（剩余 ${remain} 天）`)
        }
      }

      const lines = []
      if (graces.length > 0) {
        lines.push(`【犹豫期内，须完成新单回访】${graces.length} 笔`)
        lines.push(...graces)
      }
      if (renewals.length > 0) {
        if (lines.length > 0) lines.push('')
        lines.push(`【${withinDays} 天内续期缴费】${renewals.length} 笔`)
        lines.push(...renewals)
      }
      if (lines.length === 0) return `未来 ${withinDays} 天内无待办服务事项。`
      return lines.join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'insurance_record_touchpoint',
    description: '记录一次客户沟通（面谈、电话、微信等），含要点与后续动作。',
    parameters: {
      client_id: { type: 'string', required: true, description: '客户 id。' },
      channel_type: { type: 'string', required: true, description: '沟通方式。' },
      summary: { type: 'string', required: true, description: '沟通要点。' },
      next_action: { type: 'string', description: '后续动作。' },
      occurred_at: { type: 'string', description: '发生时间 ISO-8601；省略取当前时间。' },
    },
    output: TEXT_OUTPUT,
    execute: async (args) => {
      await ready
      if (!clients().get(args.client_id)) {
        return `未找到客户 ${args.client_id}。`
      }
      const id = newId('tp')
      await domain.table('touchpoints').put(id, {
        clientId: args.client_id,
        channelType: args.channel_type,
        summary: args.summary,
        ...(args.next_action !== undefined ? { nextAction: args.next_action } : {}),
        occurredAt: args.occurred_at ?? now(),
        createdAt: now(),
      })
      return `已记录沟通：${id}`
    },
  }))
}