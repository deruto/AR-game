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
const introCard = document.querySelector('#intro-card');
const fallbackGame = document.querySelector('#fallback-game');
const fallbackMessage = document.querySelector('#fallback-message');
const fallbackOrb = document.querySelector('#fallback-orb');
const fallbackRetry = document.querySelector('#fallback-retry');
const fallbackInstruction = document.querySelector('#fallback-instruction');

let score = 0;
let collected = false;
let fallbackActive = false;
const setStatus = (message) => { if (statusEl) statusEl.textContent = message; };
const webxrAvailable = () => window.isSecureContext && 'xr' in navigator;

function showFallback(message) {
  fallbackActive = true;
  document.body.classList.add('fallback-active');
  fallbackGame.hidden = false;
  introCard.hidden = true;
  fallbackMessage.textContent = message;
  fallbackInstruction.textContent = 'Tap the glowing orb to collect it';
  startButton.disabled = false;
  startButton.textContent = 'Start AR';
  hintEl.textContent = 'Preview mode is active — no AR required.';
}

function hideFallback() {
  fallbackActive = false;
  document.body.classList.remove('fallback-active');
  fallbackGame.hidden = true;
  introCard.hidden = false;
}

if (!window.isSecureContext) {
  compatibilityEl.textContent = 'Preview mode works here. Use HTTPS (or localhost during development) to enable AR.';
} else if (!('xr' in navigator)) {
  compatibilityEl.textContent = 'This browser does not expose WebXR AR. You can still play the preview.';
} else {
  compatibilityEl.textContent = 'Preview works without AR. Device support will be checked when you press Start AR.';
}

fallbackOrb.addEventListener('click', () => {
  score += 1;
  scoreEl.textContent = String(score);
  fallbackOrb.classList.remove('collected');
  void fallbackOrb.offsetWidth;
  fallbackOrb.classList.add('collected');
  fallbackInstruction.textContent = 'Collected! Tap again for another orb.';
  setStatus('Orb collected in preview mode.');
});

fallbackRetry.addEventListener('click', () => {
  hideFallback();
  startButton.click();
});

startButton.addEventListener('click', async () => {
  if (!webxrAvailable()) {
    showFallback('WebXR AR is unavailable in this browser or page context. The preview game works without it.');
    return;
  }
  startButton.disabled = true;
  startButton.textContent = 'Checking device…';
  try {
    const supported = await navigator.xr.isSessionSupported('immersive-ar');
    if (!supported) {
      showFallback('This device/browser does not support immersive AR. Play the preview below instead.');
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
    showFallback('AR could not start. You can keep playing here without camera or AR permissions.');
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
        showFallback('AR opened, but surface detection failed. Exit AR if needed and use this preview instead.');
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
      gameObject.object3D.position.set(0, 1.1, -2.2);
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
    setStatus('Orb collected! The prototype will make it available again.');
    this.el.setAttribute('animation__collect', { property: 'scale', to: '0.001 0.001 0.001', dur: 220, easing: 'easeInQuad' });
    window.setTimeout(() => {
      this.el.removeAttribute('animation__collect');
      this.el.object3D.scale.set(1, 1, 1);
      this.el.dataset.collected = 'false';
      this.el.object3D.visible = true;
      collected = false;
      setStatus('Tap the sphere to collect it again.');
    }, 300);
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Service worker registration failed:', error));
  });
}