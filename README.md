# Nightjar

**A bird-collision risk map and lighting advisory for Singapore.**

Built by team Green Sapiens for [NextStep Hacks 2026](https://nextstephacks.com) — theme *Earth Forward*.

> ⚠️ **Status: in development.** The scoring model works against real data; the interface is still being built. Everything here was created during the hackathon window (21 Aug – 13 Sep 2026); the repository was empty before it.

---

## The problem

Singapore is the **most light-polluted country on Earth** — 100% of its population lives under skies too bright for the human eye to dark-adapt.[^1] It also sits on the **East Asian–Australasian Flyway**, one of the world's most species-rich and threatened bird migration routes.[^2]

Every October and November, migrating birds are drawn off course by artificial light and killed against glass. Peer-reviewed research on Singapore found that collision risk for **migratory** species tracks building density and **blue-rich nocturnal light**, while risk for **resident** species tracks proximity to woodland.[^3]

Nobody has turned that finding into something a building manager or Town Council can act on. That's what this is.

## What it does

Enter a location → get a collision risk score → get a specific recommendation, and who is responsible for acting on it.

Three layers, each independently useful:

| Layer | Source | Purpose |
|---|---|---|
| **Base map** | NParks boundaries, VIIRS nighttime lights, OneMap | A working risk map with zero user input |
| **Lamp photos** | Community contributions | Ground truth on light *colour* where no inventory exists |
| **Collision reports** | Community contributions | Evidence that sharpens the map over time |

```
risk = √(habitat × density) × light
```

**habitat** is bird presence — highest in and beside green space, scaled by the size of that green space, decaying outward. **density** is what there is to collide with, near zero inside a reserve. **light** modulates: blue-rich lighting raises risk, warm lighting barely does, and it never zeroes the result because an unlit facade still kills by daylight reflection.

Both habitat and density are *required* — either at zero means no collisions. We deliberately do **not** hard-code the well-known result that forest-edge buildings are worst. It emerges on its own, because the edge is the only place where birds and buildings overlap. That the model reproduces the published finding without being told is the point.

## Why colour, not brightness

The research points at blue-rich light specifically, not overall brightness. That matters for two reasons.

**First**, it makes the measurement tractable — colour temperature is visible in an ordinary photograph, so a phone camera is sufficient. No photometer required.

**Second**, it exposes a gap in the standard data. The VIIRS Day/Night Band, the sensor behind essentially every light-pollution map, records roughly 500–900 nm. It is **blind below 500 nm** — precisely where white LEDs emit most strongly, and precisely the band that predicts migrant collisions.

Singapore's street lighting is not the problem: LTA uses 3000K warm white on minor residential roads and 4000K on arterial roads, and avoids 5000K+ entirely.[^4] By international standards that is responsible policy. The uncontrolled blue light is everything the government does not own — shop signage, illuminated facades, carpark decks, condo floodlights, sports and construction lighting — and **none of it is inventoried anywhere.**

## Tech

React · Vite · Leaflet · deployed as a static site. No backend, no database, no accounts. All geodata is committed to this repository as static files so the application has no runtime dependency that can fail.

Contributed photos and collision reports are stored **in the browser only** and never leave the device.

## Data sources

| Dataset | Source | Licence |
|---|---|---|
| Parks, reserves, park connectors | [data.gov.sg](https://data.gov.sg) (NParks) | Singapore Open Data Licence |
| Building footprints | [OpenStreetMap](https://www.openstreetmap.org) via Overpass | ODbL |
| Land-use zoning (superseded) | [data.gov.sg](https://data.gov.sg) (URA Master Plan 2025) | Singapore Open Data Licence |
| Nighttime lights | VIIRS Day/Night Band | Public domain (NOAA/NASA) |
| Lamp classifications | Our own field survey | This repository |

## Limitations

We state these plainly because they matter for how the output should be read.

- **We did not discover the collision drivers.** A peer-reviewed study did.[^3] This project operationalises published findings; it does not extend them.
- **The risk score is a weighted heuristic**, not a validated model. Weights are our own judgement, informed by that study but not derived from it. Treat the output as a guide for prioritising attention, not as a prediction.
- **We hold no collision data of our own.** The reporting feature demonstrates the concept. Substantive local records sit with the [Nature Society (Singapore) Bird Group](https://nss.org.sg/bird-group/), whose long-running survey work is why this problem is documented in Singapore at all.
- **Coverage of lamp classifications is sparse**, seeded from a single field survey.

## Team

Green Sapiens — four undergraduates.

## Acknowledgements

The Nature Society (Singapore) Bird Group, for the survey work that made this a documented problem rather than an invisible one. NParks, for the bird-safe glass treatments already deployed at Sungei Buloh, HortPark and the Singapore Botanic Gardens.

---

[^1]: Falchi et al., *The new world atlas of artificial night sky brightness*, Science Advances (2016). https://www.science.org/doi/10.1126/sciadv.1600377
[^2]: Shi et al., *Prospects for monitoring bird migration along the East Asian-Australasian Flyway using weather radar*, Remote Sensing in Ecology and Conservation (2023). https://doi.org/10.1002/rse2.307
[^3]: *Disentangling the biotic and abiotic drivers of bird–building collisions in a tropical Asian city with ecological niche modeling*, Conservation Biology 38, e14255 (2024). https://doi.org/10.1111/cobi.14255
[^4]: Ministry of Transport, written reply on the colour temperature of Singapore's street lighting. https://www.mot.gov.sg/news-resources/newsroom/written-reply-to-parliamentary-question-on-colour-temperature-of-singapore-s-street-lighting-and-feasibility-of-warmer-white-lighting-for-street-lamps-on-minor-roads/
