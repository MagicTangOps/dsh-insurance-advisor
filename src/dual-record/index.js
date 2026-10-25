/**
 * 双录（销售行为可回溯）清单与覆盖校验 —— 面向模型的工具。
 *
 * @module @local/dsh-insurance-dual-record
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { renderChecklist, validateCoverage } from './checklist.js'

/** Loader 诊断使用的插件名。 */
export const name = 'insurance-dual-record'

/** 本插件依赖的服务。 */
export const inject = ['tools', 'systemPrompt']

const TEXT_OUTPUT = {
  schema: { type: 'string' },
  render: (_args, value) => [{ type: 'text', text: value }],
}

const PROMPT_TEXT =
  '准备或检查保险销售双录时，用 insurance_dual_record_checklist 生成'
  + '按产品类型与客户群体定制的清单，用 insurance_dual_record_validate '
  + '校验必备环节是否覆盖。五个必备环节缺一不可。'

/** 把工具参数收拢成清单选项。 */
function toOptions(args) {
  return {
    floating: args.floating === true,
    health: args.health === true,
    deathBenefit: args.death_benefit === true,
    investmentLinked: args.investment_linked === true,
    groups: args.groups ?? [],
  }
}

/**
 * 注册双录工具。
 * @param ctx - Cordis 上下文。
 */
export function apply(ctx) {
  ctx.systemPrompt.section({ name: 'tool:insurance-dual-record', order: 2520, text: PROMPT_TEXT })

  ctx.tools.register(defineTool({
    name: 'insurance_dual_record_checklist',
    description:
      '生成双录（销售行为可回溯）录制清单。五个必备环节为：身份证明、'
      + '资料展示、产品说明、如实告知、以外利益。'
      + '按产品类型（分红/万能/投连、健康险、以死亡为给付）'
      + '与客户群体（老年人、残障人士、语言受限）自动展开附加项。',
    parameters: {
      floating: {
        type: 'boolean',
        description: '是否分红型/万能型/投资连结型等利益浮动产品。',
      },
      health: { type: 'boolean', description: '是否健康保险。' },
      death_benefit: { type: 'boolean', description: '是否以死亡为给付条件。' },
      investment_linked: { type: 'boolean', description: '是否投资连结型保险。' },
      groups: {
        type: 'array',
        items: { type: 'string', enum: ['elderly', 'disabled', 'language-limited'] },
        description: '客户群体标签：elderly=60周岁及以上、disabled=残障、language-limited=语言能力受限。',
      },
      jurisdiction: {
        type: 'string',
        description: '展业地（省市）。各地双录细则不同，提示核对当地监管要求。',
      },
    },
    output: TEXT_OUTPUT,
    execute: (args) => {
      const text = renderChecklist(toOptions(args))
      const notice = args.jurisdiction
        ? `\n\n⚠️ 展业地：${args.jurisdiction}。各地双录细则存在差异`
          + '（如山西、新疆、东莞、福建），录制前请核对当地金融监管局最新通知。'
        : '\n\n⚠️ 各地双录细则存在差异，录制前请确认展业地监管要求。'
      return text + notice
    },
  }))

  ctx.tools.register(defineTool({
    name: 'insurance_dual_record_validate',
    description:
      '校验双录已完成的环节是否覆盖五个必备环节。'
      + '传入已完成环节代码，返回缺失项。'
      + '注意：本工具只校验环节覆盖，不评估话术质量。',
    parameters: {
      completed_codes: {
        type: 'array',
        required: true,
        items: { type: 'string' },
        description:
          '已完成的环节代码：identity、materials、product、disclosure、no-extra-benefit。',
      },
      floating: { type: 'boolean', description: '是否利益浮动产品。' },
      health: { type: 'boolean', description: '是否健康保险。' },
      death_benefit: { type: 'boolean', description: '是否以死亡为给付条件。' },
      investment_linked: { type: 'boolean', description: '是否投资连结型。' },
      groups: {
        type: 'array',
        items: { type: 'string', enum: ['elderly', 'disabled', 'language-limited'] },
        description: '客户群体标签。',
      },
    },
    output: TEXT_OUTPUT,
    execute: (args) => {
      const result = validateCoverage(args.completed_codes, toOptions(args))
      const lines = [result.valid ? '校验结论：✅ 必备环节齐全' : '校验结论：❌ 存在缺失']
      if (result.missing.length > 0) {
        lines.push('')
        lines.push('缺失环节：')
        for (const item of result.missing) lines.push(`- ${item.code}（${item.title}）`)
      }
      if (result.unknown.length > 0) {
        lines.push('')
        lines.push(`未识别的代码：${result.unknown.join('、')}`)
      }
      lines.push('')
      lines.push(result.note)
      return lines.join('\n')
    },
  }))
}