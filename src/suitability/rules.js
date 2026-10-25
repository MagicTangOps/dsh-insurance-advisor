/**
 * 适当性匹配规则引擎 —— 纯函数核心。
 *
 * 依据《保险产品适当性管理自律规范》（中保协，2026-07-01 施行）。
 *
 * 本模块刻意不依赖任何 harness 服务：规则是确定性的、可单独测试的。
 * 所有判定返回结构化结果与依据，便于审计。
 *
 * @module @local/dsh-insurance-suitability/rules
 */

/** 人身险产品分级，复杂程度由低到高。 */

/** 浮动收益产品的风险等级，由低到高。 */

/**
 * 销售人员能力等级。
 * `none` 表示不作能力等级要求；数字越小能力越高（1 级最高）。
 */

/** 客户风险承受能力等级，与产品风险等级同标度。 */

/** 产品分级由低到高的有序列表。 */
export const PRODUCT_CLASSES = ['P1', 'P2', 'P3', 'P4', 'P5']

/** 风险等级由低到高的有序列表。 */
export const RISK_LEVELS = ['R1', 'R2', 'R3', 'R4', 'R5']

/** 需要划分并匹配风险等级的产品分级（利益浮动产品）。 */
export const RISK_GRADED_CLASSES = ['P4', 'P5']

/**
 * 能力等级 → 授权销售的最高产品分级。
 *
 * 依据自律规范「销售人员分级与保险产品分类分级对应」：
 * - 不作要求：P1
 * - 四级：P1、P2
 * - 三级：P1、P2、P3
 * - 二级：P1、P2、P3、P4
 * - 一级：全部
 */
export const AUTHORIZATION = {
  none: 'P1',
  4: 'P2',
  3: 'P3',
  2: 'P4',
  1: 'P5',
}

/** 一条判定依据，用于审计与向用户解释。 */

/** 单产品授权判定结果。 */

/** 组合销售判定结果。 */

/** 风险等级匹配结果。 */

/** 一次完整适当性判定的汇总。 */

/**
 * 产品分级在有序表中的下标；未知分级抛错而非静默降级。
 * 合规判定不能猜：宁可失败也不给出错误的"通过"。
 * @param value - 待查产品分级。
 * @returns 由低到高的下标。
 */
function classIndex(value) {
  const index = PRODUCT_CLASSES.indexOf(value)
  if (index < 0) throw new Error(`未知产品分级：${String(value)}`)
  return index
}

/**
 * 风险等级在有序表中的下标。
 * @param value - 待查风险等级。
 * @returns 由低到高的下标。
 */
function riskIndex(value) {
  const index = RISK_LEVELS.indexOf(value)
  if (index < 0) throw new Error(`未知风险等级：${String(value)}`)
  return index
}

/**
 * 校验能力等级取值合法。
 * @param level - 待校验等级。
 * @returns 规范化后的等级。
 */
export function normalizeAgentLevel(level) {
  if (level === 'none') return 'none'
  if (level === 1 || level === 2 || level === 3 || level === 4) return level
  throw new Error(`未知能力等级：${String(level)}`)
}

/**
 * 求某产品分级所需的最低能力等级。
 * @param productClass - 产品分级。
 * @returns 满足该分级的最低（数值最大）能力等级。
 */
export function requiredLevelFor(productClass) {
  // P1 不作能力等级要求（自律规范：授权销售 P1 类产品的，可不作能力等级要求）。
  if (productClass === 'P1') return 'none'
  classIndex(productClass)
  // 遍历由低能力到高能力，找到第一个覆盖该分级的等级。
  for (const level of [4, 3, 2, 1]) {
    if (classIndex(AUTHORIZATION[String(level)]) >= classIndex(productClass)) return level
  }
  return 1
}

/**
 * 判断代理人能力等级是否覆盖某产品分级。
 * @param agentLevel - 代理人能力等级。
 * @param productClass - 产品分级。
 * @returns 授权判定结果。
 */
export function checkAuthorization(agentLevel, productClass) {
  const level = normalizeAgentLevel(agentLevel)
  const maxClass = AUTHORIZATION[String(level)]
  const allowed = classIndex(maxClass) >= classIndex(productClass)
  const needed = requiredLevelFor(productClass)
  const levelLabel = level === 'none' ? '不作能力等级要求' : `能力等级 ${String(level)} 级`
  const neededLabel = needed === 'none' ? '不作能力等级要求' : `能力等级 ${String(needed)} 级`

  return {
    allowed,
    requiredLevel: needed,
    rationale: [
      {
        code: 'agent-level',
        text: `代理人当前为${levelLabel}，最多可销售至 ${maxClass} 级产品。`,
      },
      {
        code: 'product-class',
        text: `本次产品为 ${productClass} 级，需${neededLabel}及以上资质。`,
      },
      allowed
        ? { code: 'authorization-pass', text: '授权校验通过。' }
        : {
            code: 'authorization-fail',
            text: `授权不足：${productClass} 级产品超出当前销售授权范围，不得销售。`,
          },
    ],
  }
}

/**
 * 组合销售判定 —— 依据「从高不从低」原则。
 *
 * 组合销售两种及以上产品的，按组合中最高分级确定所需销售授权。
 * @param agentLevel - 代理人能力等级。
 * @param productClasses - 组合内全部产品分级；不可为空。
 * @returns 组合判定结果。
 */
export function checkCombination(
  agentLevel,
  productClasses,
) {
  if (productClasses.length === 0) {
    throw new Error('组合销售判定至少需要一个产品分级')
  }
  const governingClass = productClasses.reduce(
    (highest, current) => (classIndex(current) > classIndex(highest) ? current : highest),
    productClasses[0],
  )
  const verdict = checkAuthorization(agentLevel, governingClass)
  const mixed = new Set(productClasses).size > 1

  return {
    allowed: verdict.allowed,
    governingClass,
    requiredLevel: verdict.requiredLevel,
    rationale: [
      {
        code: 'combination-rule',
        text: mixed
          ? `组合销售 ${productClasses.join('、')}，按「从高不从低」原则以 ${governingClass} 级为准。`
          : `单一产品 ${governingClass} 级。`,
      },
      ...verdict.rationale,
    ],
  }
}

/**
 * 风险等级匹配 —— 仅 P4/P5 产品需要。
 *
 * 客户风险承受能力等级须不低于产品风险等级。
 * @param customerLevel - 客户风险承受能力等级。
 * @param productClass - 产品分级。
 * @param productRisk - 产品（或投资账户）风险等级；P4/P5 必填。
 * @returns 匹配判定结果。
 */
export function checkRiskMatch(
  customerLevel,
  productClass,
  productRisk,
) {
  const required = RISK_GRADED_CLASSES.includes(productClass)
  riskIndex(customerLevel)

  if (!required) {
    return {
      allowed: true,
      required: false,
      rationale: [{
        code: 'risk-not-required',
        text: `${productClass} 级产品无需风险等级匹配。`,
      }],
    }
  }

  if (productRisk === undefined) {
    return {
      allowed: false,
      required: true,
      rationale: [{
        code: 'risk-missing',
        text: `${productClass} 级为利益浮动产品，必须提供产品风险等级（R1–R5）才能完成匹配。`,
      }],
    }
  }

  const allowed = riskIndex(customerLevel) >= riskIndex(productRisk)
  return {
    allowed,
    required,
    rationale: [
      { code: 'risk-compare', text: `客户风险承受能力 ${customerLevel}，产品风险等级 ${productRisk}。` },
      allowed
        ? { code: 'risk-pass', text: '风险等级匹配通过。' }
        : {
            code: 'risk-fail',
            text: `风险错配：产品风险等级 ${productRisk} 高于客户承受能力 ${customerLevel}，不得销售。`,
          },
    ],
  }
}

/** 一次完整判定的输入。 */

/**
 * 执行完整适当性判定：授权 + 组合规则 + 风险匹配。
 *
 * 任一项不通过则整体不通过，并列出全部阻碍项 —— 一次给出所有问题，
 * 而不是逐个暴露，便于代理人一次性修正。
 * @param input - 判定输入。
 * @returns 汇总判定结果。
 */
export function evaluateSuitability(input) {
  const authorization = checkCombination(input.agentLevel, input.productClasses)

  const riskVerdicts = input.productClasses
    .filter(productClass => RISK_GRADED_CLASSES.includes(productClass))
    .map(productClass => checkRiskMatch(
      input.customerLevel,
      productClass,
      input.productRisks?.[productClass],
    ))

  const riskMatch = {
    allowed: riskVerdicts.every(verdict => verdict.allowed),
    required: riskVerdicts.some(verdict => verdict.required),
    rationale: riskVerdicts.flatMap(verdict => verdict.rationale),
  }

  const blockers = []
  if (!authorization.allowed) {
    blockers.push(
      `销售授权不足：组合最高分级为 ${authorization.governingClass}，`
      + `需能力等级 ${String(authorization.requiredLevel)} 级及以上。`,
    )
  }
  if (!riskMatch.allowed) {
    for (const verdict of riskVerdicts) {
      if (verdict.allowed) continue
      for (const item of verdict.rationale) {
        if (item.code === 'risk-fail' || item.code === 'risk-missing') blockers.push(item.text)
      }
    }
  }

  return {
    allowed: blockers.length === 0,
    authorization,
    riskMatch,
    blockers,
    rationale: [...authorization.rationale, ...riskMatch.rationale],
  }
}

/**
 * 列出某能力等级可销售的产品分级 —— 用于向代理人解释"我能卖什么"。
 * @param agentLevel - 代理人能力等级。
 * @returns 授权范围内的产品分级。
 */
export function authorizedClasses(agentLevel) {
  const level = normalizeAgentLevel(agentLevel)
  const maxClass = AUTHORIZATION[String(level)]
  return PRODUCT_CLASSES.filter(productClass => classIndex(productClass) <= classIndex(maxClass))
}