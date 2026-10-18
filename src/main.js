import 'aframe';
import './style.css';

const statusEl = document.querySelector('#status');
const compatibilityEl = document.querySelector('#compatibility');
const startButton = document.querySelector('#start-ar');
const scoreEl = document.querySelector('#score');
const hintEl = document.querySelector('#hint');
const scene = document.querySelector('a-scene');
const gameObject = document.querySelector('#game-object');
const reticle = document.querySelector('#reticle');

let score = 0;
let collected = false;

function setStatus(message) { statusEl.textContent = message; }
function secureWebXRAvailable() { return window.isSecureContext && 'xr' in navigator; }

if (!window.isSecureContext) {
  compatibilityEl.textContent = 'Use HTTPS when deployed (localhost is fine for development) to enable camera and AR features.';
} else if (!('xr' in navigator)) {
  compatibilityEl.textContent = 'This browser does not expose WebXR. You can preview the 3D scene, but immersive AR may not be available.';
} else {
  compatibilityEl.textContent = 'Your device will be checked when you start AR.';
}

startButton.addEventListener('click', async () => {
  if (!secureWebXRAvailable()) {
    setStatus('AR needs HTTPS and a browser with WebXR support. Try a compatible Android phone using Chrome.');
    return;
  }
  startButton.disabled = true;
  startButton.textContent = 'Checking device…';
  try {
    const supported = await navigator.xr.isSessionSupported('immersive-ar');
    if (!supported) {
      setStatus('Immersive AR is not supported here. Try a compatible Android device and browser. The 3D preview remains available.');
      startButton.disabled = false;
      startButton.textContent = 'Try AR again';
      return;
    }
    setStatus('Starting AR… approve any browser camera or motion prompts.');
    if (typeof scene.enterAR === 'function') await scene.enterAR();
    else {
      const arButton = document.querySelector('.a-enter-ar');
      if (arButton) arButton.click();
      else throw new Error('A-Frame AR entry point was not found');
    }
  } catch (error) {
    console.error('Unable to start immersive AR:', error);
    setStatus('Could not start AR. Check permissions, HTTPS, and device support, then try again.');
    startButton.disabled = false;
    startButton.textContent = 'Try AR again';
  }
});

AFRAME.registerComponent('ar-placement', {
  init() {
    this.hitTestSource = null;
    this.referenceSpace = null;
    this.hasSurface = false;
    this.placed = false;
    this.currentPosition = new THREE.Vector3();
    const xrManager = this.el.sceneEl.renderer.xr;

    xrManager.addEventListener('sessionstart', async () => {
      const session = xrManager.getSession();
      if (!session) return;
      document.body.classList.add('ar-active');
      try {
        const viewerSpace = await session.requestReferenceSpace('viewer');
        this.referenceSpace = await session.requestReferenceSpace('local');
        this.hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
        this.hasSurface = false;
        this.placed = false;
        gameObject.object3D.visible = false;
        reticle.object3D.visible = false;
        session.addEventListener('select', () => {
          if (!this.hasSurface || this.placed) return;
          gameObject.object3D.position.copy(this.currentPosition);
          gameObject.object3D.scale.set(1, 1, 1);
          gameObject.object3D.visible = true;
          gameObject.dataset.collected = 'false';
          this.placed = true;
          setStatus('Orb placed! Tap the orb to collect it.');
          hintEl.textContent = 'Tap the glowing orb to collect it.';
        });
        setStatus('Move your phone slowly to scan the area. When the reticle appears, tap to place the orb.');
      } catch (error) {
        console.error('Hit-test setup failed:', error);
        setStatus('AR started, but this device could not initialize surface detection. Try a well-lit area or another supported device.');
      }
    });

    xrManager.addEventListener('sessionend', () => {
      document.body.classList.remove('ar-active');
      this.hitTestSource?.cancel?.();
      this.hitTestSource = null;
      this.referenceSpace = null;
      this.hasSurface = false;
      this.placed = false;
      reticle.object3D.visible = false;
      gameObject.object3D.visible = false;
      setStatus('AR session ended. Press Start AR to try again.');
      hintEl.textContent = 'Prototype: one replaceable 3D sphere';
      startButton.disabled = false;
      startButton.textContent = 'Start AR';
    });
  },
  tick() {
    if (!this.el.sceneEl.is('ar-mode') || !this.hitTestSource || !this.referenceSpace) return;
    const frame = this.el.sceneEl.frame;
    if (!frame) return;
    const results = frame.getHitTestResults(this.hitTestSource);
    if (results.length > 0) {
      const pose = results[0].getPose(this.referenceSpace);
      if (!pose) return;
      this.currentPosition.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
      reticle.object3D.position.copy(this.currentPosition);
      reticle.object3D.visible = !this.placed;
      this.hasSurface = true;
    } else {
      reticle.object3D.visible = false;
      this.hasSurface = false;
    }
  }
});

AFRAME.registerComponent('collectible', {
  init() { this.el.addEventListener('click', () => this.collect()); },
  collect() {
    if (!this.el.object3D.visible || this.el.dataset.collected === 'true' || collected) return;
    collected = true;
    this.el.dataset.collected = 'true';
    score += 1;
    scoreEl.textContent = String(score);
    setStatus('Orb collected! A new orb is ready to appear.');
    hintEl.textContent = 'Tap the orb to collect it.';
    this.el.setAttribute('animation__collect', {
      property: 'scale', to: '0.001 0.001 0.001', dur: 220, easing: 'easeInQuad'
    });
    window.setTimeout(() => {
      this.el.removeAttribute('animation__collect');
      this.el.object3D.scale.set(1, 1, 1);
      this.el.dataset.collected = 'false';
      this.el.object3D.visible = true;
      collected = false;
      setStatus('Another orb appeared. Tap it to collect again.');
    }, 300);
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Service worker registration failed:', error));
  });
}
