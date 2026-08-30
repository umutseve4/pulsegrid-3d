# PulseGrid 3D

**A living data reliability laboratory.** PulseGrid turns a deterministic pipeline incident into an explorable 3D city: failure, quarantine, replay, and verified recovery are visible in the scene and preserved as semantic evidence.

## Experience

- Cinematic WebGL data city built with Three.js
- Five-state deterministic incident lifecycle
- Keyboard-operable district focus and incident controls
- Accessible telemetry table and live status announcements
- OS-level and in-product reduced-motion controls
- Static fallback when WebGL is unavailable
- No account, cookies, backend, runtime API, or external CDN

## Local development

```bash
npm install
npm run dev
```

Quality gates:

```bash
npm run check
npm run build
```

The build gate verifies the GitHub Pages base path and enforces compressed budgets of **1,500,000 bytes total** and **300,000 JavaScript bytes**.

## Interaction map

| Control | Result |
|---|---|
| Inject an incident | Jumps from nominal operation to schema-drift failure |
| Scenario action | Advances quarantine → replay → recovery → reset |
| District buttons | Focuses the selected city district |
| Reduce motion | Stops camera drift, particles, and continuous pulsing |
| Canvas + Left/Right | Moves district focus |
| Canvas + Space | Toggles motion preference |

## Architecture

`simulation.ts` owns the pure state machine and evidence values. `city.ts` owns rendering only. `main.ts` coordinates DOM state, input, accessibility, and graceful fallback. This separation keeps the reliability story testable without WebGL.

## Deployment

The production build uses Vite base path `/pulsegrid-3d/` and deploys to GitHub Pages after CI succeeds on `main`.

Target URL: <https://umutseve4.github.io/pulsegrid-3d/>

## License

MIT
