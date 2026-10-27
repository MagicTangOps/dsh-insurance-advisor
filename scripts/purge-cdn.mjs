#!/usr/bin/env node
/**
 * Flush the jsDelivr cache for the files this market source serves.
 *
 * `@main` on jsDelivr is cached for up to 12 hours, so a release stays invisible
 * to anyone who already added the index URL until the cache expires. The purge
 * endpoint invalidates it immediately.
 *
 * Usage: node scripts/purge-cdn.mjs [--dry-run]
 * Exit status: 0 when every file was flushed, 1 when one was refused.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry-run')

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const repository = pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '')
const slug = repository.replace('https://github.com/', '')
const base = `https://cdn.jsdelivr.net/gh/${slug}@main`

// The index itself and everything it points a client at.
const index = JSON.parse(readFileSync(join(root, 'index.json'), 'utf8'))
const iconPath = new URL(index.plugins[0].icon).pathname.split('@main/')[1] ?? 'assets/icon-180.png'

const files = ['index.json', iconPath, 'icon.svg', 'package.json']

let failed = 0
for (const file of files) {
  const url = `https://purge.jsdelivr.net/gh/${slug}@main/${file}`
  if (dryRun) {
    console.log(`[dry-run] GET ${url}`)
    continue
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    console.log(res.ok ? `✓ ${file} (${res.status})` : `✗ ${file} (${res.status})`)
    if (!res.ok) failed += 1
  } catch (error) {
    console.log(`✗ ${file} — ${error.name === 'TimeoutError' ? 'timed out' : error.message}`)
    failed += 1
  }
}

console.log(failed === 0
  ? dryRun ? `\nwould flush ${files.length} file(s) under ${base}` : `\nflushed ${files.length} file(s) under ${base}`
  : `\n${failed} file(s) not flushed`)
process.exit(failed === 0 ? 0 : 1)