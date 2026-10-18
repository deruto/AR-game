# AR Sphere Hunt — A-Frame PWA starter

A starter for a mobile-first, Pokémon GO-inspired AR prototype. It uses A-Frame and WebXR, with a sphere as the first replaceable game object.

## Requirements

- Node.js 20+ recommended
- A modern browser
- For immersive AR: a compatible device/browser (typically Android + Chrome with ARCore/WebXR support)
- HTTPS for deployed testing; `localhost` is allowed for local development

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Desktop browsers can preview the 3D scene, but immersive AR must be tested on a compatible mobile device. To test on a phone, deploy to an HTTPS host or expose the dev server through a secure tunnel.

## Build

```bash
npm run build
npm run preview
```

## Current prototype

- PWA manifest and service worker shell cache
- A-Frame scene with a replaceable `#game-object`
- WebXR support check and AR entry UI
- WebXR hit-test reticle for surface placement
- Basic collection counter and tap handler

## Replace the sphere later

Keep the `id="game-object"` entity and replace its child spheres with a GLB/GLTF model, for example:

```html
<a-entity id="game-object" visible="false" position="0 0 0" collectible>
  <a-entity gltf-model="#your-model"></a-entity>
</a-entity>
```

Add a model asset to `<a-assets>` and point `gltf-model` to its asset selector. Keep game behavior in the `collectible` component rather than embedding it into the mesh.

## Important limitations / next work

This is an initial scaffold, not a production-ready game. WebXR immersive AR and hit-test are not available on every phone/browser. iOS support needs a separately tested fallback path. Collection input and AR entry behavior should be tested on the target devices and refined after the first real-device test. PWA installation does not itself enable AR.


## Phase 1 notes

The camera is supplied by the browser's immersive WebXR AR session; the app does not open a second `getUserMedia()` stream. The camera entity has a mouse/touch raycaster for entity taps, while WebXR `select` places the orb after the hit-test reticle finds a surface. Test on a supported Android device over HTTPS. If AR fails, capture the browser console error and device/browser model; WebXR feature support varies by device.
