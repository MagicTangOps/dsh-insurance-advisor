import { computeGracePeriodEnd, daysUntil, isWithinGracePeriod } from '../src/crm/domain.js'
let pass=0,fail=0
const t=(n,c)=>{ if(c){pass++;console.log('  ✓',n)}else{fail++;console.log('  ✗ FAIL',n)} }

console.log('=== 犹豫期推算（起算日含当日）===')
t('个险 1/1 签收 → 1/10（10日）', computeGracePeriodEnd('2026-01-01','individual')==='2026-01-10')
t('银保 1/1 签收 → 1/15（15日）', computeGracePeriodEnd('2026-01-01','bancassurance')==='2026-01-15')
t('覆盖 20 天 → 1/20',            computeGracePeriodEnd('2026-01-01','individual',20)==='2026-01-20')
t('跨月：1/25 签收 → 2/3',        computeGracePeriodEnd('2026-01-25','individual')==='2026-02-03')
t('闰年：2/20/2028 → 2/29',       computeGracePeriodEnd('2028-02-20','individual')==='2028-02-29')
t('跨年：12/28 → 1/6',            computeGracePeriodEnd('2025-12-28','individual')==='2026-01-06')

console.log('=== daysUntil ===')
t('同一天 → 0',      daysUntil('2026-05-01','2026-05-01')===0)
t('未来 5 天 → 5',   daysUntil('2026-05-06','2026-05-01')===5)
t('过去 3 天 → -3',  daysUntil('2026-04-28','2026-05-01')===-3)

console.log('=== 犹豫期判定 ===')
t('止日当天仍在期内', isWithinGracePeriod('2026-05-10','2026-05-10')===true)
t('止日次日已过期',   isWithinGracePeriod('2026-05-10','2026-05-11')===false)

console.log('=== 失败即报错 ===')
try{ computeGracePeriodEnd('bad','individual'); t('无效日期抛错',false) }catch{ t('无效日期抛错',true) }

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail?1:0)
