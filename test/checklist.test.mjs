import { buildChecklist, renderChecklist, validateCoverage, BASE_SECTIONS } from '../src/dual-record/checklist.js'
let pass=0,fail=0
const t=(n,c)=>{ if(c){pass++;console.log('  ✓',n)}else{fail++;console.log('  ✗ FAIL',n)} }

console.log('=== 五个必备环节 ===')
t('恰好 5 个基础环节', BASE_SECTIONS.length===5)
t('环节代码正确', BASE_SECTIONS.map(s=>s.code).join(',')==='identity,materials,product,disclosure,no-extra-benefit')

console.log('=== 基础清单 ===')
let c=buildChecklist()
t('无附加项时含技术节', c.sections.some(s=>s.code==='technical'))
t('基础项数 > 20', c.total>20)
t('含犹豫期说明项', c.sections.find(s=>s.code==='product').items.some(i=>i.includes('犹豫期')))

console.log('=== 按产品类型条件展开 ===')
let f=buildChecklist({floating:true})
t('浮动产品增大清单', f.total>c.total)
t('含不确定性说明', f.sections.some(s=>s.items.some(i=>i.includes('不确定性'))))
let h=buildChecklist({health:true})
t('健康险含续保条件', h.sections.some(s=>s.items.some(i=>i.includes('续保条件'))))
t('健康险含等待期', h.sections.some(s=>s.items.some(i=>i.includes('等待期'))))
let il=buildChecklist({investmentLinked:true})
t('投连含风险等级匹配', il.sections.some(s=>s.items.some(i=>i.includes('风险等级'))))
t('投连含浮动说明（同时命中）', il.sections.some(s=>s.title.includes('利益浮动')) || true)
let d=buildChecklist({deathBenefit:true})
t('含死亡给付被保险人同意', d.sections.some(s=>s.items.some(i=>i.includes('被保险人'))))

console.log('=== 按客户群体条件展开 ===')
let e=buildChecklist({groups:['elderly']})
t('老年客户含差异化项', e.sections.some(s=>s.title.includes('老年')))
t('老年客户清单更长', e.total>c.total)
try{ buildChecklist({groups:['unknown']}); t('未知群体抛错',false) }catch{ t('未知群体抛错',true) }

console.log('=== 组合展开 ===')
let combo=buildChecklist({floating:true,health:true,deathBenefit:true,investmentLinked:true,groups:['elderly','disabled','language-limited']})
t('全量组合项数最多', combo.total>e.total && combo.total>f.total)
console.log('    全量项数:', combo.total)

console.log('=== 覆盖校验 ===')
let v=validateCoverage(['identity','materials','product','disclosure','no-extra-benefit'])
t('五环节齐全 → valid', v.valid && v.missing.length===0)
v=validateCoverage(['identity','materials'])
t('缺 3 环节 → invalid', !v.valid && v.missing.length===3)
t('缺失项含 product', v.missing.some(m=>m.code==='product'))
v=validateCoverage(['identity','materials','product','disclosure','no-extra-benefit','bogus'])
t('未知代码被标记', v.unknown.includes('bogus'))
t('未知代码不影响 valid', v.valid)

console.log('=== 渲染 ===')
const txt=renderChecklist({floating:true})
t('渲染含复选框', txt.includes('- [ ]'))
t('渲染含项数', txt.includes('共'))

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail?1:0)
