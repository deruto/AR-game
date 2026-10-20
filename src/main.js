import 'aframe';
import './style.css';

const statusEl = document.querySelector('#status');
const compatibilityEl = document.querySelector('#compatibility');
const startButton = document.querySelector('#start-ar');
const scoreEl = document.querySelector('#score');
const hintEl = document.querySelector('#hint');
const scene = document.querySelector('a-scene');
const camera = document.querySelector('#camera');
const gameObject = document.querySelector('#game-object');
const reticle = document.querySelector('#reticle');
const fallbackWorld = document.querySelector('#fallback-world');
const introCard = document.querySelector('#intro-card');
const fallbackGame = document.querySelector('#fallback-game');
const fallbackMessage = document.querySelector('#fallback-message');
const fallbackRetry = document.querySelector('#fallback-retry');
const fallbackVr = document.querySelector('#fallback-vr');

let score = 0;
let collected = false;
let fallbackActive = false;
const setStatus = (message) => { if (statusEl) statusEl.textContent = message; };
const webxrAvailable = () => window.isSecureContext && 'xr' in navigator;

function showFallback(message) {
  fallbackActive = true;
  document.body.classList.add('fallback-active');
  document.body.classList.remove('ar-active');
  fallbackGame.hidden = false;
  introCard.hidden = true;
  fallbackWorld.setAttribute('visible', true);
  gameObject.object3D.visible = true;
  gameObject.object3D.position.set(0, 1.6, -2.5);
  gameObject.object3D.scale.set(1, 1, 1);
  gameObject.dataset.collected = 'false';
  camera.setAttribute('look-controls', 'enabled', true);
  camera.setAttribute('raycaster', 'objects', '.collectible-mesh');
  fallbackMessage.textContent = message;
  hintEl.textContent = '3D adventure mode — drag to look around.';
  startButton.disabled = false;
  startButton.textContent = 'Start AR';
  updateVrButton();
}

function hideFallback() {
  fallbackActive = false;
  document.body.classList.remove('fallback-active');
  fallbackGame.hidden = true;
  fallbackWorld.setAttribute('visible', false);
  introCard.hidden = false;
  camera.setAttribute('look-controls', 'enabled', false);
}

async function updateVrButton() {
  if (!fallbackVr) return;
  try {
    const supported = webxrAvailable() && await navigator.xr.isSessionSupported('immersive-vr');
    fallbackVr.hidden = !supported;
  } catch {
    fallbackVr.hidden = true;
  }
}

if (!window.isSecureContext) {
  compatibilityEl.textContent = '3D mode works here. Use HTTPS (or localhost during development) to enable AR.';
} else if (!('xr' in navigator)) {
  compatibilityEl.textContent = 'This browser does not expose WebXR AR. The 3D adventure still works.';
} else {
  compatibilityEl.textContent = 'The 3D adventure works without AR. Device support will be checked when you press Start AR.';
}

fallbackRetry.addEventListener('click', () => {
  hideFallback();
  startButton.click();
});

fallbackVr.addEventListener('click', async () => {
  try {
    if (typeof scene.enterVR === 'function') await scene.enterVR();
    else throw new Error('A-Frame VR entry point is not available');
  } catch (error) {
    console.warn('Unable to enter headset VR:', error);
    fallbackMessage.textContent = 'Headset VR could not start on this device. The 3D scene remains playable on screen.';
  }
});

startButton.addEventListener('click', async () => {
  if (!webxrAvailable()) {
    showFallback('WebXR AR is unavailable in this browser or page context. Explore this 3D scene instead.');
    return;
  }
  startButton.disabled = true;
  startButton.textContent = 'Checking device…';
  try {
    const supported = await navigator.xr.isSessionSupported('immersive-ar');
    if (!supported) {
      showFallback('This device/browser does not support immersive AR. Explore the 3D orb chamber instead.');
      return;
    }
    setStatus('Starting AR… approve any browser prompts.');
    if (typeof scene.enterAR === 'function') await scene.enterAR();
    else {
      const arButton = document.querySelector('.a-enter-ar');
      if (!arButton) throw new Error('A-Frame AR entry point was not found');
      arButton.click();
    }
  } catch (error) {
    console.error('Unable to start immersive AR:', error);
    showFallback('AR could not start. The A-Frame 3D scene is ready to play without AR permissions.');
  }
});

AFRAME.registerComponent('ar-placement', {
  init() {
    this.hitTestSource = null;
    this.referenceSpace = null;
    this.hasSurface = false;
    this.placed = false;
    this.currentPosition = new THREE.Vector3();
    this.xrManager = null;
    this.onSessionStart = null;
    this.onSessionEnd = null;
    this.el.sceneEl.addEventListener('renderstart', () => this.attachXRListeners(), { once: true });
    if (this.el.sceneEl.renderer) this.attachXRListeners();
  },
  attachXRListeners() {
    if (this.xrManager || !this.el.sceneEl.renderer?.xr) return;
    this.xrManager = this.el.sceneEl.renderer.xr;
    this.onSessionStart = async () => {
      const session = this.xrManager.getSession();
      if (!session) return;
      hideFallback();
      document.body.classList.add('ar-active');
      fallbackWorld.setAttribute('visible', false);
      camera.setAttribute('look-controls', 'enabled', false);
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
        setStatus('Move your phone slowly to scan. When the reticle appears, tap to place the orb.');
      } catch (error) {
        console.error('Hit-test setup failed:', error);
        fallbackMessage.textContent = 'Surface detection failed. Exit AR to return to the 3D adventure mode.';
      }
    };
    this.onSessionEnd = () => {
      document.body.classList.remove('ar-active');
      this.hitTestSource?.cancel?.();
      this.hitTestSource = null;
      this.referenceSpace = null;
      this.hasSurface = false;
      this.placed = false;
      reticle.object3D.visible = false;
      gameObject.object3D.visible = true;
      gameObject.object3D.position.set(0, 1.6, -2.5);
      camera.setAttribute('look-controls', 'enabled', false);
      startButton.disabled = false;
      startButton.textContent = 'Start AR';
      if (!fallbackActive) {
        setStatus('AR session ended. You can use the 3D preview or start AR again.');
        hintEl.textContent = '3D preview: tap the sphere to test collection.';
      }
    };
    this.xrManager.addEventListener('sessionstart', this.onSessionStart);
    this.xrManager.addEventListener('sessionend', this.onSessionEnd);
  },
  tick() {
    if (!this.el.sceneEl.is('ar-mode') || !this.hitTestSource || !this.referenceSpace) return;
    const frame = this.el.sceneEl.frame;
    if (!frame) return;
    const results = frame.getHitTestResults(this.hitTestSource);
    if (results.length) {
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
  },
  remove() {
    if (this.xrManager && this.onSessionStart) this.xrManager.removeEventListener('sessionstart', this.onSessionStart);
    if (this.xrManager && this.onSessionEnd) this.xrManager.removeEventListener('sessionend', this.onSessionEnd);
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
    if (fallbackActive) {
      setStatus('Orb collected! Keep exploring and tap it again.');
      hintEl.textContent = 'Collected! Tap the orb again for another point.';
    } else {
      setStatus('Orb collected! The prototype will make it available again.');
    }
    this.el.setAttribute('animation__collect', { property: 'scale', to: '0.001 0.001 0.001', dur: 220, easing: 'easeInQuad' });
    window.setTimeout(() => {
      this.el.removeAttribute('animation__collect');
      this.el.object3D.scale.set(1, 1, 1);
      this.el.dataset.collected = 'false';
      this.el.object3D.visible = true;
      collected = false;
    }, 300);
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Service worker registration failed:', error));
  });
}