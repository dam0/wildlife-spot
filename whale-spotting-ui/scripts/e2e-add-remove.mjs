/**
 * KAN-2 functional test: add and remove a sighting as a logged-in user,
 * verifying both UI state AND backend persistence via SQL before/after.
 *
 * Usage: node scripts/e2e-add-remove.mjs
 * Env:   E2E_USER (default: e2e_add_remove_<suffix>)
 */
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const USER = process.env.E2E_USER ?? `e2e_add_${Date.now().toString(36).slice(-4)}`
const CLI = '../.tools/spacetimedb-cli'

function sql(query) {
  return execSync(`${CLI} sql whale-spotting ${JSON.stringify(query)} -s maincloud`, {
    encoding: 'utf8',
  })
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  // ---- Login ----
  await page.goto(BASE)
  await page.getByLabel('Username').fill(USER)
  await page.getByRole('button', { name: /login & start spotting/i }).click()
  await page.getByText(`Logged in as: ${USER}`).waitFor({ timeout: 20000 })
  check('login succeeds', true)

  // ---- Baseline counts ----
  const beforeDb = (sql('SELECT COUNT(*) AS c FROM sighting').match(/(\d+)\s*$/) || [])[1]
  console.log(`      DB sightings before: ${beforeDb}`)

  // ---- ADD a sighting: headless runs deny geolocation, so the map stays
  // ---- at world zoom where the water-detector can't work. Use the dev
  // ---- hook to fly to open ocean (Indian Ocean) at street-checkable zoom.
  await page.waitForFunction(() => window.__leafletMap !== undefined)
  await page.evaluate(() => {
    window.__leafletMap.setView([-30, 80], 12)
  })
  await page.waitForTimeout(1500) // tiles + geolocation fallback settle

  const map = page.locator('#map')
  const box = await map.boundingBox()
  const candidates = [
    [0.5, 0.5],
    [0.45, 0.55],
    [0.55, 0.45],
    [0.4, 0.5],
  ]
  let placed = false
  for (const [fx, fy] of candidates) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
    placed = await page
      .getByText(/pin added/i)
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    if (placed) break
    console.log(`      click (${fx},${fy}) rejected as land — trying next`)
  }
  if (!placed) throw new Error('No map click produced a pin')

  // Placing the pin doesn't auto-open the form — click the marker, as a user would.
  await page.locator('.custom-user-marker').first().click()
  await page.locator('.user-location-form').waitFor({ timeout: 5000 })
  await page.getByRole('button', { name: /^report$/i }).click()

  await page.getByText(/sighting reported successfully/i).waitFor({ timeout: 10000 })
  check('UI confirms report success', true)

  const markerAfterAdd = await page
    .locator('.sighting-marker')
    .first()
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  check('pin renders on map', markerAfterAdd)

  const listCount1 = await page.locator('.sighting-item').count()
  check('sidebar lists the sighting', listCount1 >= 1, `${listCount1} row(s)`)

  // Backend persistence (authoritative)
  await new Promise((r) => setTimeout(r, 1500))
  const afterAddDb = (sql('SELECT COUNT(*) AS c FROM sighting').match(/(\d+)\s*$/) || [])[1]
  check(
    'sighting persisted to Maincloud',
    Number(afterAddDb) > Number(beforeDb),
    `${beforeDb} -> ${afterAddDb}`,
  )
  // SpacetimeDB SQL has no ORDER BY/LIMIT — take max id in JS instead.
  const allIds = [...sql('SELECT id FROM sighting').matchAll(/\b(\d+)\b/g)].map((m) =>
    Number(m[1]),
  )
  const newId = allIds.length ? String(Math.max(...allIds)) : null

  // ---- REMOVE it: open MY OWN row's popup (non-owners get no delete
  // ---- button — that's server-side ownership surfacing in the UI).
  const myRow = page.locator('.sighting-item', { hasText: USER }).first()
  await myRow.click()
  await page.locator('.leaflet-popup-content-wrapper').waitFor({ timeout: 10000 })

  const delBtn = page.locator('#delete-sighting-' + newId)
  check('delete button present in own-sighting popup', (await delBtn.count()) > 0)

  page.once('dialog', (d) => d.accept())
  await delBtn.click()
  await page
    .getByText(/sighting deleted successfully/i)
    .waitFor({ timeout: 10000 })
    .then(() => check('UI confirms delete', true))
    .catch(() => check('UI confirms delete', false))

  const markersGone = (await page.locator('.sighting-marker').count()) === 0
  check('marker removed from map', markersGone)

  const myRowsGone = (await page.locator('.sighting-item', { hasText: USER }).count()) === 0
  check('row removed from sidebar', myRowsGone)

  await new Promise((r) => setTimeout(r, 1500))
  const afterDelDb = (sql('SELECT COUNT(*) AS c FROM sighting').match(/(\d+)\s*$/) || [])[1]
  check('row deleted from Maincloud', Number(afterDelDb) === Number(beforeDb), `${afterAddDb} -> ${afterDelDb}`)

  check('no page JS errors', errors.length === 0, errors.slice(0, 2).join(' | '))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
