/**
 * 保险产品适当性匹配 —— 面向模型的合规判定工具。
 *
 * 依据《保险产品适当性管理自律规范》（中保协，2026-07-01 施行）：
 * 产品分级（P1–P5）↔ 销售人员能力等级（四级）↔ 客户风险等级（R1–R5）
 * 三位一体匹配，组合销售按「从高不从低」确定授权。
 *
 * 判定逻辑全部在 `rules.js` 的纯函数中，本文件只做工具接线与输出渲染。
 *
 * @module @local/dsh-insurance-suitability
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  authorizedClasses,
  evaluateSuitability,
  requiredLevelFor,
} from './rules.js'

/** Loader 诊断使用的插件名。 */
export const name = 'insurance-suitability'

/** 本插件依赖的工具注册与系统提示服务。 */
export const inject = ['tools', 'systemPrompt']

const TEXT_OUTPUT = {
  schema: { type: 'string' },
  render: (_args, value) => [{ type: 'text', text: value }],
}

const PROMPT_TEXT =
  '涉及保险产品销售授权、产品分级（P1–P5）、客户风险等级匹配时，'
  + '必须调用 insurance_check_suitability 取得确定性判定；'
  + '不得自行推断授权是否充足。判定不通过时不得出具方案。'

/**
 * 把判定结果渲染成可读文本。
 * @param verdict - `evaluateSuitability` 的返回值。
 * @returns 面向模型的文本。
 */
function renderVerdict(verdict) {
  const lines = []
  lines.push(verdict.allowed ? '判定结论：✅ 通过' : '判定结论：❌ 不通过')
  lines.push('')
  lines.push(`组合决定分级：${verdict.authorization.governingClass}`)
  const required = verdict.authorization.requiredLevel
  lines.push(`所需能力等级：${required === 'none' ? '不作要求' : `${required} 级`}`)
  lines.push(`风险等级匹配：${verdict.riskMatch.required ? (verdict.riskMatch.allowed ? '通过' : '不通过') : '无需匹配'}`)

  if (verdict.blockers.length > 0) {
    lines.push('')
    lines.push('阻碍项：')
    for (const blocker of verdict.blockers) lines.push(`- ${blocker}`)
  }

  lines.push('')
  lines.push('判定依据：')
  for (const item of verdict.rationale) lines.push(`- [${item.code}] ${item.text}`)

  return lines.join('\n')
}

/**
 * 注册适当性相关工具与共享提示。
 * @param ctx - Cordis 上下文。
 */
export function apply(ctx) {
  ctx.systemPrompt.section({
    name: 'tool:insurance-suitability',
    // 顺序落在内置工具指引之后、MCP 服务器之前（见 system-prompt SECTION_ORDERS）。
    order: 2500,
    text: PROMPT_TEXT,
  })

  ctx.tools.register(defineTool({
    name: 'insurance_check_suitability',
    description:
      '判定一笔保险销售或方案是否符合产品适当性管理要求。'
      + '校验销售人员能力等级对产品分级（P1–P5）的销售授权、组合销售的'
      + '「从高不从低」原则，以及 P4/P5 利益浮动产品的客户风险等级匹配。'
      + '返回确定性结论与逐条依据；不通过时列出全部阻碍项。',
    parameters: {
      agent_level: {
        type: 'string',
        required: true,
        enum: ['none', '4', '3', '2', '1'],
        description:
          '销售人员能力等级：none=不作要求、4/3/2/1 为四级至一级（1 级最高）。',
      },
      product_classes: {
        type: 'array',
        required: true,
        items: { type: 'string', enum: ['P1', 'P2', 'P3', 'P4', 'P5'] },
        description: '本次销售的产品分级；组合销售时列出全部产品。',
      },
      customer_level: {
        type: 'string',
        required: true,
        enum: ['R1', 'R2', 'R3', 'R4', 'R5'],
        description: '客户风险承受能力等级。',
      },
      product_risks: {
        type: 'object',
        additionalProperties: true,
        description:
          'P4/P5 产品的风险等级，键为产品分级、值为 R1–R5，'
          + '形如 {"P5":"R4"}；组合中含 P4/P5 时必须提供，否则判定不通过。',
      },
    },
    output: TEXT_OUTPUT,
    execute: (args) => {
      const rawLevel = String(args.agent_level)
      const agentLevel = rawLevel === 'none' ? 'none' : Number(rawLevel)
      return renderVerdict(evaluateSuitability({
        agentLevel,
        productClasses: args.product_classes,
        customerLevel: args.customer_level,
        productRisks: args.product_risks,
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'insurance_authorized_products',
    description:
      '查询某销售人员能力等级可销售的产品分级范围，以及某产品分级所需的'
      + '最低能力等级。用于回答「我能卖什么」「这个产品需要什么资质」。',
    parameters: {
      agent_level: {
        type: 'string',
        description: '销售人员能力等级：none、4、3、2、1。省略则不查询该部分。',
        enum: ['none', '4', '3', '2', '1'],
      },
      product_class: {
        type: 'string',
        description: '产品分级 P1–P5。省略则不查询该部分。',
        enum: ['P1', 'P2', 'P3', 'P4', 'P5'],
      },
    },
    output: TEXT_OUTPUT,
    execute: (args) => {
      const lines = []
      if (args.agent_level !== undefined) {
        const raw = String(args.agent_level)
        const level = raw === 'none' ? 'none' : Number(raw)
        const label = level === 'none' ? '不作能力等级要求' : `能力等级 ${raw} 级`
        lines.push(`${label} 可销售产品分级：${authorizedClasses(level).join('、')}`)
      }
      if (args.product_class !== undefined) {
        const needed = requiredLevelFor(args.product_class)
        lines.push(
          `${args.product_class} 级产品所需最低资质：`
          + (needed === 'none' ? '不作能力等级要求' : `能力等级 ${needed} 级及以上`),
        )
      }
      if (lines.length === 0) return '请至少提供 agent_level 或 product_class 之一。'
      return lines.join('\n')
    },
  }))
}