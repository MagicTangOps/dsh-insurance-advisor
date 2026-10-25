/**
 * 保险台账的日期推算规则 —— 纯函数，无外部依赖。
 *
 * 单独成模块的原因：这些规则决定合规期限（犹豫期、回访窗口），
 * 必须能脱离 harness 与存储层独立测试。
 *
 * @module @local/dsh-insurance-crm/dates
 */

/** 销售渠道 —— 影响犹豫期时长。 */
export const CHANNEL = ['individual', 'bancassurance', 'internet', 'telemarketing']

/**
 * 犹豫期时长（天）。
 * 银保渠道依监管为 15 日；个险与电销一般 10 日。
 */
export const GRACE_PERIOD_DAYS = {
  individual: 10,
  bancassurance: 15,
  internet: 15,
  telemarketing: 10,
}

/**
 * 由回执签收日推算犹豫期止日。
 *
 * 犹豫期自投保人签收保单回执之日起算，**含起算当日**。
 * 例：1 月 1 日签收，10 日犹豫期 → 止日为 1 月 10 日。
 * @param receiptDate - 回执签收日，ISO-8601 date（YYYY-MM-DD）。
 * @param channel - 销售渠道，决定时长。
 * @param overrideDays - 覆盖天数（部分公司延长至 20 天）。
 * @returns 犹豫期止日，ISO-8601 date。
 */
export function computeGracePeriodEnd(receiptDate, channel, overrideDays) {
  const days = overrideDays ?? GRACE_PERIOD_DAYS[channel] ?? 10
  const start = new Date(`${receiptDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime())) throw new Error(`无效的回执签收日：${receiptDate}`)
  const end = new Date(start.getTime() + (days - 1) * 86_400_000)
  return end.toISOString().slice(0, 10)
}

/**
 * 计算某日期距参考日的天数（正数表示未来）。
 * @param date - 目标日期，ISO-8601 date。
 * @param today - 参考日；省略则取当前 UTC 日期。
 * @returns 相差天数。
 */
export function daysUntil(date, today) {
  const target = new Date(`${date}T00:00:00Z`).getTime()
  if (Number.isNaN(target)) throw new Error(`无效日期：${date}`)
  const base = today
    ? new Date(`${today}T00:00:00Z`).getTime()
    : new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime()
  return Math.round((target - base) / 86_400_000)
}

/**
 * 判断参考日是否仍在犹豫期内（含止日当天）。
 * @param gracePeriodEnd - 犹豫期止日。
 * @param today - 参考日；省略取当前日期。
 * @returns 是否在犹豫期内。
 */
export function isWithinGracePeriod(gracePeriodEnd, today) {
  return daysUntil(gracePeriodEnd, today) >= 0
}