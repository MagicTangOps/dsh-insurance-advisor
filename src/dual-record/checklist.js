/**
 * 双录（销售行为可回溯）清单规则 —— 纯函数。
 *
 * 五个基础环节依据国家金融监督管理总局福建监管局
 * 《关于深入推进人身保险销售行为可回溯管理的通知》（闽金规〔2024〕2 号）
 * 列明的录制内容；附加项按产品类型与客户群体条件化展开。
 *
 * 单独成模块以便脱离 harness 独立测试。
 *
 * @module @local/dsh-insurance-dual-record/checklist
 */

/** 五个必备环节，缺一不可。 */
export const BASE_SECTIONS = [
  {
    code: 'identity',
    title: '身份证明',
    items: [
      '销售人员出示有效身份证明',
      '销售人员告知本人所属机构名称',
      '投保人出示有效身份证明',
      '被保险人出示有效身份证明（与投保人非同一人时）',
    ],
  },
  {
    code: 'materials',
    title: '资料展示',
    items: [
      '出示投保提示书',
      '出示产品条款',
      '出示产品说明书（如有）',
      '出示免除保险人责任条款的书面说明',
    ],
  },
  {
    code: 'product',
    title: '产品说明',
    items: [
      '明确告知所购买的是保险产品',
      '告知承保保险机构名称',
      '说明保险责任',
      '说明责任免除',
      '说明投保范围',
      '说明保险期间',
      '说明交费方式、金额与期间',
      '说明保单利益',
      '说明犹豫期（起算时间、天数、期内权利）',
      '说明犹豫期后退保需扣除的费用及退保金计算方法',
    ],
  },
  {
    code: 'disclosure',
    title: '如实告知',
    items: [
      '询问投保人是否对投保单询问事项如实告知',
      '确认投保单内容为投保人本人真实意思表示',
      '告知不如实告知的后果',
    ],
  },
  {
    code: 'no-extra-benefit',
    title: '以外利益',
    items: [
      '由投保人确认销售人员未给予或承诺给予合同外利益',
    ],
  },
]

/** 按产品类型触发的附加项。 */
export const PRODUCT_ADDENDA = {
  /** 分红型、万能型、投资连结型：利益浮动。 */
  floating: {
    label: '利益浮动产品（分红型/万能型/投连型）',
    items: [
      '明确说明保单利益的不确定性',
      '按《一年期以上人身保险产品信息披露规则》进行保单利益演示',
      '说明最低保证利率之上的利益承诺无效',
    ],
  },
  /** 健康保险。 */
  health: {
    label: '健康保险',
    items: [
      '说明保险责任等待期的起算时间及对权益的影响',
      '说明免赔额或赔付比例的约定',
      '说明合同指定医疗机构',
      '说明续保条件',
      '说明医疗费用补偿原则',
    ],
  },
  /** 以死亡为给付条件的产品。 */
  deathBenefit: {
    label: '以死亡为给付条件的产品',
    items: [
      '取得被保险人（或其监护人）同意投保人为其订立保险合同并认可合同内容',
    ],
  },
  /** 投资连结型：需风险等级匹配留痕。 */
  investmentLinked: {
    label: '投资连结型',
    items: [
      '说明投资账户的风险等级（R1–R5）',
      '确认客户风险承受能力与产品风险等级匹配',
    ],
  },
}

/** 按客户群体触发的附加项。 */
export const GROUP_ADDENDA = {
  elderly: {
    label: '老年投保人（60 周岁及以上）',
    items: [
      '放慢语速、放大字号，重点条款反复确认',
      '确认投保人对犹豫期与退保损失的理解',
    ],
  },
  disabled: {
    label: '残障人士',
    items: [
      '提供无障碍告知方式（手语/盲文/大字版等）',
      '确认投保人已理解产品关键信息',
    ],
  },
  'language-limited': {
    label: '国家通用语言能力受限人士',
    items: [
      '提供翻译或双语材料',
      '确认投保人已理解产品关键信息',
    ],
  },
}

/** 录制技术要求。 */
export const TECHNICAL_ITEMS = [
  '视听资料真实、完整、连续，录制后未作任何剪辑',
  '视频中可显示录制时间',
]

/**
 * 按产品类型与客户群体生成定制化双录清单。
 * @param options - 产品与客户特征。
 * @param options.floating - 是否分红型/万能型/投连型。
 * @param options.health - 是否健康保险。
 * @param options.deathBenefit - 是否以死亡为给付条件。
 * @param options.investmentLinked - 是否投资连结型。
 * @param options.groups - 客户群体标签数组，如 ['elderly']。
 * @returns 分节的清单，含 total 项数。
 */
export function buildChecklist(options = {}) {
  const sections = BASE_SECTIONS.map(section => ({
    code: section.code,
    title: section.title,
    items: [...section.items],
  }))

  const addenda = []
  if (options.floating) addenda.push(PRODUCT_ADDENDA.floating)
  if (options.health) addenda.push(PRODUCT_ADDENDA.health)
  if (options.deathBenefit) addenda.push(PRODUCT_ADDENDA.deathBenefit)
  if (options.investmentLinked) addenda.push(PRODUCT_ADDENDA.investmentLinked)

  for (const group of options.groups ?? []) {
    const addendum = GROUP_ADDENDA[group]
    if (addendum === undefined) throw new Error(`未知客户群体标签：${group}`)
    addenda.push(addendum)
  }

  for (const addendum of addenda) {
    sections.push({ code: `addendum:${addendum.label}`, title: addendum.label, items: [...addendum.items] })
  }

  sections.push({
    code: 'technical',
    title: '录制技术要求',
    items: [...TECHNICAL_ITEMS],
  })

  return {
    sections,
    total: sections.reduce((sum, section) => sum + section.items.length, 0),
  }
}

/**
 * 渲染清单为可读文本。
 * @param options - 同 `buildChecklist`。
 * @returns 文本清单。
 */
export function renderChecklist(options = {}) {
  const { sections, total } = buildChecklist(options)
  const lines = [`双录清单（共 ${total} 项）`]
  for (const section of sections) {
    lines.push('')
    lines.push(`【${section.title}】`)
    for (const item of section.items) lines.push(`- [ ] ${item}`)
  }
  return lines.join('\n')
}

/**
 * 校验已完成录制的环节代码是否覆盖全部必备环节。
 *
 * 只校验**必备环节**是否被触及；附加项与具体话术质量需人工复核。
 * @param completedCodes - 已完成的环节代码数组。
 * @param options - 同 `buildChecklist`。
 * @returns 校验结果，含缺失项。
 */
export function validateCoverage(completedCodes, options = {}) {
  const { sections } = buildChecklist(options)
  const done = new Set(completedCodes)
  const missing = sections
    .filter(section => section.code.startsWith('addendum:') === false && section.code !== 'technical')
    .filter(section => !done.has(section.code))
    .map(section => ({ code: section.code, title: section.title }))

  const unknown = [...done].filter(
    code => !sections.some(section => section.code === code),
  )

  return {
    valid: missing.length === 0,
    missing,
    unknown,
    note: missing.length === 0
      ? '五个必备环节均已覆盖。附加项与话术质量仍需人工复核。'
      : `缺少 ${missing.length} 个必备环节，该笔双录存在合规瑕疵。`,
  }
}