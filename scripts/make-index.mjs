#!/usr/bin/env node
/**
 * Regenerate `index.json` — this repository served as a DSH plugin market index
 * (format 1), so the plugin is browsable in Plugins → Discover without waiting
 * for a third-party catalog.
 *
 * Why a script instead of `@deepseek-ai/dsh-plugin-market-generator`: that one
 * enumerates Git tags over the network and only understands npm or git
 * sources at build time. This package is published from Git alone, and the
 * only facts that change per release are the version, the commit, and the
 * commit time — all of which are already local.
 *
 * Usage: node scripts/make-index.mjs [--check]
 *   --check  exit 1 when index.json is stale, without writing
 *
 * The commit the run pins is `GITHUB_SHA` when set (a tag push), else HEAD.
 * The index file itself is not part of the tagged tree, so writing it after
 * the tag commit does not make the entry point at itself.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const sha = (process.env.GITHUB_SHA ?? '').trim()
  || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()

if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`not a 40-hex commit: ${sha}`)
const timestamp = Number(execFileSync('git', ['log', '-1', '--format=%ct', sha], { cwd: root, encoding: 'utf8' }).trim())
if (!Number.isInteger(timestamp)) throw new Error(`no commit time for ${sha}`)

const repository = pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '')
const engine = pkg.engines?.dsh

const index = {
  format: 1,
  title: { en: 'MagicTangOps Insurance', zh: 'MagicTangOps 保险插件' },
  description: {
    en: 'Plugins for individual insurance agents published by MagicTangOps.',
    zh: 'MagicTangOps 发布的个险代理人展业插件。',
  },
  metadata: {
    categories: { insurance: { title: { en: 'Insurance', zh: '保险' } } },
    labels: {},
    sortKeys: {},
  },
  plugins: [{
    name: pkg.name,
    title: { en: 'Insurance Advisor', zh: '保险顾问' },
    description: {
      en: 'Sales workflow for individual insurance agents: P1-P5 product class matched against the client risk rating, a policy ledger that counts grace periods from the receipt date, and five-section dual-recording checks. 10 tools and 5 skills.',
      zh: '个险代理人的展业工作流：P1-P5 产品分级与客户风险等级匹配、按回执签收日推算犹豫期的保单台账、双录五环节校验，含 10 个工具与 5 个技能。',
    },
    icon: `${repository.replace('github.com', 'raw.githubusercontent.com')}/main/assets/icon-180.png`,
    author: repository.split('/')[3],
    homepage: `${repository}#readme`,
    repository: { url: repository },
    metadata: {
      category: 'insurance',
      keywords: ['insurance', 'agent-preset', 'compliance', 'suitability'],
      labels: [],
    },
    versions: [{
      version: pkg.version,
      publishTimestamp: timestamp,
      source: { type: 'git', url: repository, commit: sha },
      ...engine === undefined ? { engines: {} } : { engines: { dsh: engine } },
    }],
  }],
}

const text = `${JSON.stringify(index, null, 2)}\n`
const target = join(root, 'index.json')
const current = (() => { try { return readFileSync(target, 'utf8') } catch { return null } })()

if (current === text) {
  console.log(`index.json is current (${pkg.name}@${pkg.version} @ ${sha.slice(0, 10)})`)
  process.exit(0)
}
if (checkOnly) {
  console.error(`index.json is stale for ${pkg.name}@${pkg.version} @ ${sha.slice(0, 10)} — run: node scripts/make-index.mjs`)
  process.exit(1)
}
writeFileSync(target, text)
console.log(`wrote index.json (${pkg.name}@${pkg.version} @ ${sha.slice(0, 10)})`)