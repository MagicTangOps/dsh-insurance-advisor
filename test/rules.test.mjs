import * as R from '../src/suitability/rules.js'
let pass=0, fail=0
const t=(name,cond)=>{ if(cond){pass++;console.log('  ✓',name)} else {fail++;console.log('  ✗ FAIL',name)} }

console.log('=== 授权矩阵（自律规范对照）===')
t('none → P1 only', JSON.stringify(R.authorizedClasses('none'))==='["P1"]')
t('4级 → P1,P2',    JSON.stringify(R.authorizedClasses(4))==='["P1","P2"]')
t('3级 → P1..P3',    JSON.stringify(R.authorizedClasses(3))==='["P1","P2","P3"]')
t('2级 → P1..P4',    JSON.stringify(R.authorizedClasses(2))==='["P1","P2","P3","P4"]')
t('1级 → P1..P5',    JSON.stringify(R.authorizedClasses(1))==='["P1","P2","P3","P4","P5"]')

console.log('=== requiredLevelFor ===')
t('P1 → none', R.requiredLevelFor('P1')==='none')
t('P2 → 4',    R.requiredLevelFor('P2')===4)
t('P3 → 3',    R.requiredLevelFor('P3')===3)
t('P4 → 2',    R.requiredLevelFor('P4')===2)
t('P5 → 1',    R.requiredLevelFor('P5')===1)

console.log('=== 组合"从高不从低" ===')
let c=R.checkCombination(3,['P1','P2'])
t('3级卖 P1+P2 → allowed, governing P2', c.allowed && c.governingClass==='P2')
c=R.checkCombination(3,['P1','P2','P4'])
t('3级卖含P4组合 → 拒绝, governing P4', !c.allowed && c.governingClass==='P4')
c=R.checkCombination(2,['P1','P2','P4'])
t('2级卖含P4组合 → 通过', c.allowed)

console.log('=== 风险匹配 ===')
let r=R.checkRiskMatch('R3','P5','R4')
t('客户R3 vs 产品R4(P5) → 错配拒绝', !r.allowed && r.required)
r=R.checkRiskMatch('R4','P5','R4')
t('客户R4 vs 产品R4(P5) → 通过', r.allowed)
r=R.checkRiskMatch('R1','P4')
t('P4缺风险等级 → 拒绝', !r.allowed)
r=R.checkRiskMatch('R1','P2')
t('P2无需风险匹配 → 通过', r.allowed && !r.required)

console.log('=== 完整判定 ===')
let v=R.evaluateSuitability({agentLevel:4,productClasses:['P1','P2'],customerLevel:'R2'})
t('4级+P1P2+R2 → 全部通过', v.allowed && v.blockers.length===0)
v=R.evaluateSuitability({agentLevel:4,productClasses:['P1','P5'],customerLevel:'R5',productRisks:{P5:'R5'}})
t('4级卖P5 → 授权不足', !v.allowed && v.blockers.some(b=>b.includes('授权不足')))
v=R.evaluateSuitability({agentLevel:1,productClasses:['P5'],customerLevel:'R1',productRisks:{P5:'R5'}})
t('1级卖P5但风险错配 → 拒绝', !v.allowed && v.blockers.some(b=>b.includes('风险错配')))
v=R.evaluateSuitability({agentLevel:1,productClasses:['P5'],customerLevel:'R5',productRisks:{P5:'R5'}})
t('1级+P5+R5 → 通过', v.allowed)
v=R.evaluateSuitability({agentLevel:4,productClasses:['P5'],customerLevel:'R1'})
t('多重问题 → 一次列出全部阻碍项', v.blockers.length>=2)

console.log('=== 失败即拒绝（不静默降级）===')
try { R.checkAuthorization(3,'P9'); t('未知分级抛错',false) } catch { t('未知分级抛错',true) }
try { R.checkRiskMatch('R9','P2'); t('未知风险等级抛错',false) } catch { t('未知风险等级抛错',true) }
try { R.checkCombination(3,[]); t('空组合抛错',false) } catch { t('空组合抛错',true) }

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail?1:0)
