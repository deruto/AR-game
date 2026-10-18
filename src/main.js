import 'aframe';
import './style.css';

const statusEl = document.querySelector('#status');
const compatibilityEl = document.querySelector('#compatibility');
const startButton = document.querySelector('#start-ar');
const scoreEl = document.querySelector('#score');
const hintEl = document.querySelector('#hint');
const scene = document.querySelector('a-scene');

let score = 0;

function setStatus(message) {
  statusEl.textContent = message;
}

function isSecureContextForAR() {
  return window.isSecureContext && 'xr' in navigator;
}

if (!window.isSecureContext) {
  compatibilityEl.textContent = 'Open this site over HTTPS (or localhost during development) to use camera/AR features.';
} else if (!('xr' in navigator)) {
  compatibilityEl.textContent = 'This browser does not expose WebXR. The basic 3D preview can still run, but immersive AR may not be available.';
} else {
  compatibilityEl.textContent = 'Device support will be checked when you start AR.';
}

startButton.addEventListener('click', async () => {
  if (!isSecureContextForAR()) {
    setStatus('AR needs a secure HTTPS page and a browser that supports WebXR. Try a compatible Android phone using Chrome.');
    return;
  }

  try {
    const supported = await navigator.xr.isSessionSupported('immersive-ar');
    if (!supported) {
      setStatus('Immersive AR is not supported in this browser/device. You can still use the 3D preview; try a compatible Android device and browser.');
      return;
    }

    setStatus('Starting AR… follow the browser prompt and allow camera access.');
    // A-Frame's AR mode UI handles requesting the session. Trigger its scene API
    // when available; otherwise instruct the user to use the AR button provided by A-Frame.
    if (typeof scene.enterAR === 'function') {
      await scene.enterAR();
    } else {
      const arButton = document.querySelector('.a-enter-ar');
      if (arButton) arButton.click();
      else setStatus('AR is supported, but this A-Frame build did not expose its AR entry button. Reload and try again.');
    }
  } catch (error) {
    console.error(error);
    setStatus('Could not start AR. Check browser permissions and confirm the page is served over HTTPS.');
  }
});

AFRAME.registerComponent('ar-placement', {
  init() {
    this.hitTestSource = null;
    this.viewerSpace = null;
    this.referenceSpace = null;
    this.hasSurface = false;
    this.placed = false;

    const reset = () => {
      this.hitTestSource = null;
      this.viewerSpace = null;
      this.referenceSpace = null;
      this.hasSurface = false;
    };

    this.el.sceneEl.renderer.xr.addEventListener('sessionend', reset);
    this.el.sceneEl.renderer.xr.addEventListener('sessionstart', async () => {
      const session = this.el.sceneEl.renderer.xr.getSession();
      if (!session) return;

      try {
        this.viewerSpace = await session.requestReferenceSpace('viewer');
        this.referenceSpace = await session.requestReferenceSpace('local');
        this.hitTestSource = await session.requestHitTestSource({ space: this.viewerSpace });

        session.addEventListener('select', () => {
          if (!this.hasSurface) return;
          const gameObject = document.querySelector('#game-object');
          if (!this.placed) {
            gameObject.object3D.position.copy(this.currentPosition);
            gameObject.object3D.visible = true;
            this.placed = true;
            setStatus('Orb placed! Tap the orb to collect it.');
            hintEl.textContent = 'Move around the orb to view it from different angles.';
          }
        });
        setStatus('Move your phone slowly until the reticle finds a surface, then tap to place the orb.');
      } catch (error) {
        console.error('Hit-test setup failed:', error);
        setStatus('AR started, but surface detection could not be initialized on this device.');
      }
    });

    this.currentPosition = new THREE.Vector3();
  },

  tick() {
    if (!this.el.sceneEl.is('ar-mode') || !this.hitTestSource || !this.referenceSpace) return;
    const frame = this.el.sceneEl.frame;
    if (!frame) return;

    const results = frame.getHitTestResults(this.hitTestSource);
    const reticle = document.querySelector('#reticle');

    if (results.length > 0) {
      const pose = results[0].getPose(this.referenceSpace);
      if (!pose) return;

      this.currentPosition.set(
        pose.transform.position.x,
        pose.transform.position.y,
        pose.transform.position.z
      );
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
  init() {
    this.el.addEventListener('click', () => this.collect());
    this.el.addEventListener('touchend', (event) => {
      // Prevent duplicate collection if a browser also synthesizes a click.
      if (event.cancelable) event.preventDefault();
      this.collect();
    }, { passive: false });
  },

  collect() {
    if (!this.el.object3D.visible || this.el.dataset.collected === 'true') return;
    this.el.dataset.collected = 'true';
    score += 1;
    scoreEl.textContent = String(score);
    setStatus('Nice! You collected the orb. This placeholder can later be replaced with any 3D model.');
    this.el.setAttribute('animation__collect', {
      property: 'scale',
      to: '0.001 0.001 0.001',
      dur: 220,
      easing: 'easeInQuad'
    });
    window.setTimeout(() => {
      this.el.object3D.visible = false;
      this.el.dataset.collected = 'false';
      this.el.removeAttribute('animation__collect');
      this.el.object3D.scale.set(1, 1, 1);
      // Prototype loop: make the next orb available at the same location.
      this.el.object3D.visible = true;
      setStatus('Another orb appeared. Tap it to collect again.');
    }, 280);
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
}
