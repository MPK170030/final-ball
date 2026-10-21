/**
 * Reads docs/design-system/tokens.json and writes apps/web/src/app/tokens.css.
 *
 * Run: pnpm generate:tokens
 *
 * The output is committed so CI needs no extra build step. Re-run whenever
 * tokens.json changes.
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// ── Types ────────────────────────────────────────────────────────────────────

type ThemeValue = { dark: string; light: string }

interface ColorToken {
  name: string
  value: string | ThemeValue // string = "{ref}", object = per-theme hex/rgba
  usage: string
}

interface RadiusToken {
  name: string
  value: string
}

interface TokensJson {
  color: { tokens: ColorToken[] }
  radius: { tokens: RadiusToken[] }
}

// ── Load ─────────────────────────────────────────────────────────────────────

const ROOT = process.cwd()

const tokens: TokensJson = JSON.parse(
  readFileSync(join(ROOT, 'docs/design-system/tokens.json'), 'utf8'),
)

const colorMap = new Map(tokens.color.tokens.map((t) => [t.name, t]))

// ── Resolution ───────────────────────────────────────────────────────────────

function resolve(value: string | ThemeValue, theme: 'dark' | 'light'): string {
  if (typeof value === 'object') return value[theme]
  // Reference: "{token-name}"
  const ref = value.slice(1, -1)
  const token = colorMap.get(ref)
  if (!token) throw new Error(`Unknown token reference: ${value}`)
  return resolve(token.value, theme)
}

// ── CSS generation ───────────────────────────────────────────────────────────

function colorBlock(selector: string, theme: 'dark' | 'light'): string {
  const vars = tokens.color.tokens
    .map((t) => `  --${t.name}: ${resolve(t.value, theme)};`)
    .join('\n')
  return `${selector} {\n${vars}\n}`
}

// Radius tokens are theme-independent; append to :root only.
const radiusVars = tokens.radius.tokens
  .map((t) => `  --${t.name}: ${t.value};`)
  .join('\n')

// --radius is shadcn's single radius variable; maps to radius-md.
const radiusMd = tokens.radius.tokens.find((t) => t.name === 'radius-md')
if (!radiusMd) throw new Error('radius-md token not found')
const radiusMdRem = (parseInt(radiusMd.value) / 16).toFixed(4).replace(/\.?0+$/, '') + 'rem'

const HEADER = `/* Generated from docs/design-system/tokens.json — do not edit by hand.
   Run: pnpm generate:tokens */`

const rootBlock = colorBlock(':root', 'light').replace(
  /^:root \{/,
  `:root {\n  /* Shadcn radius convention (radius-md) */\n  --radius: ${radiusMdRem};\n  /* Radius scale */\n${radiusVars}\n  /* Light colour tokens */`,
)

const darkBlock = colorBlock('.dark', 'dark').replace(
  /^\.dark \{/,
  '.dark {\n  /* Dark colour tokens (override :root) */',
)

const css = [HEADER, '', rootBlock, '', darkBlock, ''].join('\n')

// ── Write ─────────────────────────────────────────────────────────────────────

const OUT = join(ROOT, 'apps/web/src/app/tokens.css')
writeFileSync(OUT, css, 'utf8')
console.log(`✓ Written ${OUT.replace(ROOT, '').replaceAll('\\', '/')}`)
