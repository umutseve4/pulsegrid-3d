<p align="center">
  <img src="https://github.com/user-attachments/assets/40c81fca-641f-4221-bcbf-7a74c01f66ff" alt="PulseGrid 3D — the data city during an incident, districts lit by pipeline health" width="900">
</p>

<h1 align="center">PulseGrid 3D</h1>

<p align="center">
  A data pipeline failing, quarantining, replaying and recovering —<br>
  rendered as a city you can fly through and operate from the keyboard.
</p>

<p align="center">
  <a href="https://umutseve4.github.io/pulsegrid-3d/"><img src="https://img.shields.io/badge/live-demo-FF4D4F?style=flat-square" alt="Live demo"></a>
  <img src="https://img.shields.io/badge/backend%20calls-0-FF4D4F?style=flat-square" alt="Zero backend calls">
  <img src="https://img.shields.io/badge/JS%20budget-300%20KB-FF4D4F?style=flat-square" alt="300 KB JavaScript budget">
</p>

<p align="center"><b><a href="https://umutseve4.github.io/pulsegrid-3d/">▶ Open the city</a></b></p>

---

## What happens in 30 seconds

The city runs nominal: districts glow steadily, data flows between them. You press **Inject an incident** and a schema drift breaks a pipeline — the affected district goes red and the telemetry table below the canvas updates with real values, not decoration. From there you walk the incident forward one step at a time: **quarantine** isolates the bad partition, **replay** re-runs it, **recovery** verifies the result, **reset** returns to nominal.

Five states, deterministic. The same sequence produces the same evidence every time, so the scene is a reproducible demonstration rather than an animation.

| Control | Result |
|---|---|
| Inject an incident | Nominal operation → schema-drift failure |
| Scenario action | Advances quarantine → replay → recovery → reset |
| District buttons | Focuses the selected district |
| Reduce motion | Stops camera drift, particles, continuous pulsing |
| Canvas + `←` `→` | Moves district focus |
| Canvas + `Space` | Toggles motion preference |

Every control is reachable from the keyboard, and state changes are announced live to screen readers.

## Try it

Open **[umutseve4.github.io/pulsegrid-3d](https://umutseve4.github.io/pulsegrid-3d/)**. No account, no cookies, no backend, no runtime API call, no external CDN.

To run it locally:

```bash
npm ci --ignore-scripts
npm run dev
```

## Measured constraints

| Gate | Limit |
|---|---|
| Total compressed payload | 1,500,000 bytes |
| JavaScript compressed | 300,000 bytes |
| Incident lifecycle states | 5, deterministic |
| Runtime network calls | 0 |

The build fails if a budget is exceeded — these are enforced numbers, not aspirations.

## How it is built

**The reliability story is testable without a GPU.** `simulation.ts` owns the pure state machine and the evidence values. `city.ts` owns rendering only. `main.ts` coordinates DOM state, input, accessibility, and fallback. Because the state machine has no WebGL dependency, the incident logic is verified in plain Node.

**The browser gate is real.** `node scripts/browser-acceptance.mjs` builds the app, previews it in headless Chrome, then verifies semantic evidence, 360 px overflow behaviour, keyboard interaction, reduced motion, the deterministic lifecycle, and the accessible fallback that appears when WebGL is missing.

```bash
npm run check
npm run build
node scripts/browser-acceptance.mjs
```

**Deployments are traceable.** Every Pages artifact ships `deployment.json` at the site root. Its `commit_sha` is the exact revision packaged by the workflow, and `workflow_run_id` links the artifact back to its GitHub Actions run — so you can always tell which commit produced the site you are looking at.

Stack: TypeScript, Three.js, Vite. Pages base path `/pulsegrid-3d/`, deployed after CI passes on `main`.

## Limits

- The incident is a **simulation**, not a live feed. It demonstrates the shape of a reliability workflow; it is not connected to a running pipeline.
- WebGL is required for the 3D view; without it the accessible static fallback is served instead.
- Tuned for desktop viewports. It stays usable down to 360 px, but the city reads best on a wide screen.

## Related

[`pulsegrid`](https://github.com/umutseve4/pulsegrid) is the engine side of the same idea — observable streaming pipelines, data contracts, quarantine and replay implemented in Python rather than visualised.

---

MIT — see [LICENSE](LICENSE).
