/**
 * KAN-2 end-to-end verification: drives two real browsers against the dev
 * server and Maincloud, proving:
 *   1. login/registration works from the UI
 *   2. a reported sighting appears for the reporter
 *   3. it propagates LIVE to the second logged-in user (no reload)
 *   4. duplicate usernames are rejected with the friendly error
 *
 * Usage: node scripts/e2e-two-users.mjs
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const SUFFIX = Date.now().toString(36).slice(-4)
const USER_A = `e2e_a_${SUFFIX}`
const USER_B = `e2e_b_${SUFFIX}`

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function login(page, username) {
  await page.goto(BASE)
  await page.getByLabel('Username').fill(username)
  await page.getByRole('button', { name: /login & start spotting/i }).click()
  // Logged-in header is the success signal.
  await page.getByText(`Logged in as: ${username}`).waitFor({ timeout: 20000 })
}

async function reportSighting(page) {
  // Click somewhere in the ocean SW of Africa (open water at world zoom).
  const map = page.locator('#map')
  const box = await map.boundingBox()
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.62)
  // The pin form popup appears after water validation.
  await page.locator('.user-location-form').waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: /^report$/i }).click()
}

const browser = await chromium.launch()

try {
  // ---- User A: fresh registration --------------------------------------
  const ctxA = await browser.newContext()
  const a = await ctxA.newPage()
  await login(a, USER_A)
  check('A registers + logs in', true)

  // ---- Duplicate name rejection ----------------------------------------
  const ctxDup = await browser.newContext()
  const dup = await ctxDup.newPage()
  await login(dup, USER_A).catch(() => {})
  const dupError = await dup
    .getByText(/already taken/i)
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  check('duplicate username rejected', dupError, 'friendly error shown')
  await ctxDup.close()

  // ---- User B: logs in BEFORE A reports ---------------------------------
  const ctxB = await browser.newContext()
  const b = await ctxB.newPage()
  await login(b, USER_B)
  check('B registers + logs in', true)

  // ---- A reports; must appear on BOTH maps without reload ---------------
  await reportSighting(a)
  const markerOnA = await a
    .locator('.sighting-marker')
    .first()
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  check('reported pin appears for reporter (A)', markerOnA)

  const markerOnB = await b
    .locator('.sighting-marker')
    .first()
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  check('pin propagates live to B (no reload)', markerOnB)

  const listOnB = await b
    .getByText(new RegExp(USER_A))
    .first()
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false)
  check('sidebar shows reporter username for B', listOnB)
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
