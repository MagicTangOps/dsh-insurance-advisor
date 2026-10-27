#!/usr/bin/env node
/**
 * Cut a release: bump, regenerate the market index, test, commit, tag, push,
 * and purge the jsDelivr cache that serves the index.
 *
 * Usage:
 *   node scripts/release.mjs patch|minor|major [--dry-run]
 *   node scripts/release.mjs 0.2.0            [--dry-run]
 *
 * Deliberately stops before `npm publish`: publishing needs a 2FA one-time
 * password, which cannot be automated from here, and an unattended publish is
 * exactly the accident this script should not be able to cause. It prints the
 * command instead.
 *
 * --dry-run runs every check and prints the plan without touching git, npm,
 * the index file, or the network.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry-run')
const args = process.argv.slice(2).filter((a) => a !== '--dry-run')
const target = args[0]

if (target === undefined) {
  console.error('usage: node scripts/release.mjs patch|minor|major|<version> [--dry-run]')
  process.exit(2)
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const git = (argv) => execFileSync('git', argv, { cwd: root, encoding: 'utf8' }).trim()
const run = (argv) => execFileSync(argv[0], argv.slice(1), { cwd: root, stdio: 'inherit' })

const nextVersion = (() => {
  if (!['patch', 'minor', 'major'].includes(target)) {
    if (!/^\d+\.\d+\.\d+$/.test(target)) throw new Error(`not a release bump or exact version: ${target}`)
    return target
  }
  const [major, minor, patch] = pkg.version.split('.').map(Number)
  if (target === 'major') return `${major + 1}.0.0`
  if (target === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
})()

const tag = `v${nextVersion}`
const log = (line) => console.log(dryRun ? `[dry-run] ${line}` : line)

// --- guards -----------------------------------------------------------------

const dirty = git(['status', '--porcelain'])
if (dirty !== '') throw new Error(`working tree is not clean:\n${dirty}`)

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
if (branch !== 'main') throw new Error(`on ${branch}, releases come from main`)

if (!dryRun) git(['fetch', 'origin'])
const behind = git(['rev-list', '--count', 'HEAD..origin/main'])
if (behind !== '0') throw new Error(`local main is ${behind} commit(s) behind origin/main — pull first`)

if (git(['tag', '--list', tag]) !== '') throw new Error(`tag ${tag} already exists`)

console.log(`${dryRun ? 'plan' : 'release'}: ${pkg.name} ${pkg.version} -> ${nextVersion}\n`)

// --- steps ------------------------------------------------------------------

log(`1. npm version ${nextVersion} --no-git-tag-version`)
if (!dryRun) run(['npm', 'version', nextVersion, '--no-git-tag-version', '--allow-same-version'])

log('2. node scripts/make-index.mjs')
if (!dryRun) run(['node', 'scripts/make-index.mjs'])

log('3. npm test')
if (!dryRun) run(['npm', 'test'])

log(`4. git commit + tag ${tag}`)
if (!dryRun) {
  run(['git', 'add', 'package.json', 'index.json'])
  run(['git', 'commit', '-m', `release: ${tag}`])
  run(['git', 'tag', '-a', tag, '-m', tag])
}

log('5. git push origin main --follow-tags')
if (!dryRun) run(['git', 'push', 'origin', 'main', '--follow-tags'])

console.log(`
${dryRun ? 'Would be' : ''} done up to the push. Two steps left, both needing you:

  npm publish                     # asks for the 2FA one-time password

  # after the publish succeeds, flush the CDN copy of the index:
  node scripts/purge-cdn.mjs
`)