# Bird Collisions & Light in Singapore — Reference

Facts, figures and sources behind Nightjar. Everything with a confidence rating — check anything marked Low before putting it in the pitch.

Compiled 2 Sep 2026. Replaces `SG_SOLAR_REFERENCE.md`.

---

## 1. The headline facts

| Fact | Value | Confidence | Source |
|---|---|---|---|
| Singapore's population under skies too bright to dark-adapt | **100%** — highest of any country | High | World Atlas of Artificial Night Sky Brightness, *Science Advances*, 2016 |
| Next highest | Kuwait 98%, Qatar 97%, UAE 93% | High | Same |
| Residents who can see the Milky Way from home | **Zero** | High | Same |
| Flyway | East Asian–Australasian, described as among the most species-rich and threatened in the world | High | Remote Sensing in Ecology & Conservation, 2023 |
| Collision peak season | **October–November** (southbound migration) | High | Conservation Biology, 2024 |
| Bird deaths from man-made structures | At a record high in Singapore | Medium | National reporting |

---

## 2. What actually causes collisions

**Two factors, not one.** Light draws birds in; **glass** is what kills them. Birds cannot perceive glass — they see reflected sky and vegetation and fly into it. And the two often act at different times: light disorients at night, but many strikes happen at dawn or in daylight when a bird pulled into the city overnight moves through unfamiliar reflective terrain.

**The drivers split by taxa** — this is the core finding the whole product rests on:

| Group | Collision risk driven by |
|---|---|
| **Migratory** species | High building density **+ nocturnal blue-rich light** |
| **Non-migratory** residents | Proximity to **woodland cover** |

> *Disentangling the biotic and abiotic drivers of bird–building collisions in a tropical Asian city with ecological niche modeling*, **Conservation Biology 38, e14255 (2024)**. Built on **7 years of community-science observations** plus public building and remote-sensing data.

A separate study — [bird-building collisions and building characteristics](https://repository.nie.edu.sg/entities/publication/fe3732d8-5c48-43d6-b72c-f428670833e8), NIE — recorded **80 birds across 36 species**, most frequent in the Central Region during fall migration. Pittas, pigeons/doves and kingfishers were most susceptible.

**Buildings on forest edges have the highest collision rates.** This is why the product targets edges rather than the whole island.

---

## 3. The blue-light spectrum

It is **not brightness** that predicts migrant collisions — it's blue content.

| Lamp | Appearance | Approx. CCT | Blue content | Bird risk |
|---|---|---|---|---|
| High-pressure sodium | Deep orange | ~2000K | Minimal | **Low** |
| Warm white LED | Yellowish | 2700–3000K | Low | **Low** |
| Neutral LED | Plain white | ~4000K | Moderate | **Medium** |
| Cool white LED | Blue-white glare | 5000–6500K | High | **High** |

Confidence: High on the ordering, Medium on exact CCT boundaries.

**Implementation note:** blue content correlates with colour temperature, and colour is visible in an ordinary photo as the ratio between colour channels. Reading average pixel colour on a canvas is enough to bucket a lamp into the four rows above. Absolute photometry is unnecessary.

---

## 4. The satellite blind spot — our strongest technical point

**VIIRS DNB — the sensor behind essentially every light-pollution map — records roughly 500–900 nm. It is blind below ~500 nm.**

That is exactly where white LEDs emit most strongly, and exactly the band that predicts migrant collisions.

Worse: when a city replaces sodium lamps with 4000K LEDs, **VIIRS registers a *fall* in emissions while the actual night sky grows brighter** for scotopic observers kilometres around. Blue radiance below 500 nm never reaches the sensor.

> **Every light-pollution map of Singapore is blind to the wavelengths that kill birds — and reads a switch to LED as an improvement.**

Confidence: **High.** Verified across multiple independent sources.

**Resolved:** Singapore has converted to LED — and the literature's worked example is *specifically* a sodium → 4000K transition, which matches LTA's arterial road spec exactly. So the claim is narrow and defensible: even a well-managed LED conversion is partly invisible to satellite monitoring.

---

## 4a. LTA's street lighting is NOT the villain

⚠️ **Do not claim Singapore's street lighting is blue-rich. It isn't, and judges can check.**

Per a [written parliamentary reply from MOT](https://www.mot.gov.sg/news-resources/newsroom/written-reply-to-parliamentary-question-on-colour-temperature-of-singapore-s-street-lighting-and-feasibility-of-warmer-white-lighting-for-street-lamps-on-minor-roads/) — the only authoritative source on this; treat LED-vendor blogs as unreliable:

| Road type | Colour temperature |
|---|---|
| Minor roads, low-rise residential estates | **3000K** warm white |
| Main arterial roads | **4000K** neutral white |
| Anywhere | **5000K+ avoided entirely** |

By international standards that is responsible policy. Many cities deployed 5000–6500K and are now retrofitting.

### So where IS the blue light?

Everywhere LTA doesn't control — and none of it is inventoried anywhere:

| Source | Owner | Regulated? |
|---|---|---|
| Shop signage, illuminated facades | Private / URA guidelines | Partially |
| Multi-storey carpark lighting | HDB / Town Council / private | No standard |
| Condo common-area floodlights | MCST | No |
| Sports facilities, stadium floodlights | Various | No |
| Construction site lighting | Contractors | No |
| Landed-home security floodlights | Private | **No** |
| Port and industrial lighting | Private | No |

**This aligns with the research.** The Conservation Biology study found migrant collisions concentrated in **high building density** areas, worst in the **Central Region** — commercial and office territory where facade and signage lighting dominates. Forest-edge buildings are typically condos, institutional buildings and carparks. All privately lit.

### The pitch framing

Not adversarial. Use this:

> **Singapore already solved this for street lighting. The gap is everything the government doesn't own — and nobody has mapped it.**

This is exactly why the photo layer earns its place: LTA knows its own spec, but **no inventory exists of private and commercial lighting anywhere in Singapore.**

---

## 5. Who owns which lights

Singapore has **no single agency responsible for light pollution**. Responsibility is split — which is a problem in reality and a feature for our advisory output.

| Light type | Agency |
|---|---|
| Illuminated signage, facades | URA |
| Street lighting | LTA |
| HDB estate lighting | HDB / Town Councils |
| Park lighting | NParks |
| Condo common areas | MCST |

NParks published a [light management technical note](https://www.nparks.gov.sg/docs/default-source/resources/2024/technical-note-light-management-may2024.pdf) in 2024 for night works — documented evidence that at least one agency takes this seriously.

---

## 6. Existing mitigation in Singapore

- **Bird-safe glass treatments** (decals, films) already deployed at **Sungei Buloh Wetland Reserve, HortPark and the Singapore Botanic Gardens** — precedent we can point at.
- **NTU students** campaigned for bird-safe retrofits on a glass building linked to **120+ collisions**.
- **Nature Society (Singapore) Bird Group** ran a five-year study of migratory bird collisions — the most likely source of real local data, and an obvious first email.

---

## 7. Data sources

| Source | Use | Access |
|---|---|---|
| **data.gov.sg — NParks boundaries** | Parks, reserves, park connectors | Free, GeoJSON |
| **OneMap SG** | Address search, building footprints | Free, government |
| **VIIRS nighttime lights** | Baseline light layer | Free |
| **data.gov.sg — NEA weather** | Optional context | Free API |

**Download and commit these as static files.** A live API failing mid-demo is not a risk worth taking.

---

## 8. What we must not overclaim

- We did **not** discover that blue light drives migrant collisions. A published study did. Cite it.
- Our risk score is a **weighted heuristic** built from that study's findings, not a validated model.
- We have **no collision data of our own**. The reporting feature demonstrates the concept.
- Whether migration through Singapore is **pulsed or continuous** is unknown to us — which is precisely why we build a *map*, not a *forecast*.

---

## 9. Source links

- World Atlas of Artificial Night Sky Brightness: https://www.science.org/doi/10.1126/sciadv.1600377
- Conservation Biology 2024, collision drivers: https://conbio.onlinelibrary.wiley.com/doi/10.1111/cobi.14255
- NIE study, building characteristics: https://repository.nie.edu.sg/entities/publication/fe3732d8-5c48-43d6-b72c-f428670833e8
- EAAF radar monitoring prospects: https://zslpublications.onlinelibrary.wiley.com/doi/10.1002/rse2.307
- NParks light management technical note: https://www.nparks.gov.sg/docs/default-source/resources/2024/technical-note-light-management-may2024.pdf
- Nature Society (Singapore) Bird Group: https://nss.org.sg/bird-group/
- data.gov.sg: https://data.gov.sg
- OneMap SG: https://www.onemap.gov.sg
