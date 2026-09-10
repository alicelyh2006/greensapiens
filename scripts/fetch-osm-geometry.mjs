/**
 * Offline data prep — re-fetch Singapore's buildings WITH footprint geometry.
 *
 * The existing data-raw/osm-buildings.json was fetched with `out center tags`,
 * so every building is a point. That is enough to place a building in a cell
 * but not to know how big it is, and the collision literature is consistent
 * that GLASS AREA is the strongest predictor of bird-window collisions — a 10%
 * increase in glass tracks ~19% more collisions. Footprint perimeter times
 * facade height is the only way to approximate that from open data.
 *
 *   node scripts/fetch-osm-geometry.mjs
 *
 * Source: OpenStreetMap via Overpass API, ODbL.
 */
import { writeFileSync } from 'node:fs'

const QUERY = `
[out:json][timeout:1800];
area["ISO3166-1"="SG"][admin_level=2]->.sg;
(way["building"](area.sg););
out geom;
`
const ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
]

for (const url of ENDPOINTS) {
  console.log(`requesting geometry from ${url} …`)
  const t0 = Date.now()
  try {
    // Overpass wants the query form-encoded as `data=`, not as a raw body.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: QUERY }),
    })
    if (!res.ok) { console.log(`  HTTP ${res.status}, trying next`); continue }
    const text = await res.text()
    const mb = (text.length / 1048576).toFixed(0)
    console.log(`  ${mb} MB in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    const json = JSON.parse(text)
    const withGeom = json.elements.filter((e) => e.geometry?.length).length
    console.log(`  ${json.elements.length.toLocaleString()} elements, ${withGeom.toLocaleString()} with geometry`)
    if (withGeom < 100000) { console.log('  too few, trying next endpoint'); continue }
    writeFileSync('./data-raw/osm-buildings-geom.json', text)
    console.log('  wrote data-raw/osm-buildings-geom.json')
    process.exit(0)
  } catch (e) {
    console.log(`  failed: ${e.message}`)
  }
}
console.log('all endpoints failed')
process.exit(1)
