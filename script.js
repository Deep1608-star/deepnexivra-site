const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const storyStyles = document.createElement('link');
storyStyles.rel = 'stylesheet';
storyStyles.href = '/story.css';
document.head.appendChild(storyStyles);

const storyStates = [
  { name: 'FRICTION', description: 'See the noise, delays, rework and disconnected decisions.' },
  { name: 'DIAGNOSE', description: 'Map the real workflow, constraints, handoffs and failure points.' },
  { name: 'SIMPLIFY', description: 'Remove unnecessary motion before adding more process or technology.' },
  { name: 'SYSTEMIZE', description: 'Create ownership, standards, cadence, controls and repeatable flow.' },
  { name: 'EXECUTE', description: 'Turn the designed process into operating behavior with the team.' },
  { name: 'FLOW', description: 'Make performance visible, measurable and continuously improvable.' }
];

function setupHeroStory() {
  const hero = document.querySelector('.hero');
  const heroCopy = hero?.querySelector('.hero-copy');
  const coreStage = hero?.querySelector('.core-stage');
  if (!hero || !heroCopy || !coreStage || reducedMotion) return;

  hero.classList.add('story-enabled');
  const sticky = document.createElement('div');
  sticky.className = 'hero-sticky';
  hero.insertBefore(sticky, hero.firstChild);
  sticky.append(heroCopy, coreStage);

  const rail = document.createElement('div');
  rail.className = 'story-rail';
  storyStates.forEach((state, index) => {
    const item = document.createElement('div');
    item.className = 'story-step';
    item.dataset.storyIndex = String(index);
    item.innerHTML = `<span>${state.name}</span>`;
    rail.appendChild(item);
  });
  sticky.appendChild(rail);

  const copy = document.createElement('div');
  copy.className = 'story-state-copy';
  copy.innerHTML = `<strong>${storyStates[0].name}</strong><span>${storyStates[0].description}</span>`;
  sticky.appendChild(copy);

  const hint = document.createElement('div');
  hint.className = 'story-scroll-hint';
  hint.textContent = 'Scroll through the operating journey';
  sticky.appendChild(hint);

  hero.dataset.storyIndex = '0';
  coreStage.dataset.story = 'FRICTION';
}

setupHeroStory();

if (!reducedMotion && 'IntersectionObserver' in window) {
  const revealTargets = document.querySelectorAll('.section-kicker, .section-heading, .thesis-grid, .before-after, .method-step, .operation-card, .boundary-stage, .engagement-card, .proof-grid');
  revealTargets.forEach((el) => el.classList.add('reveal'));

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  revealTargets.forEach((el) => revealObserver.observe(el));
}

const coreFocus = document.getElementById('core-focus');
const coreSubcopy = document.querySelector('.hud-center small');
let operationHover = false;
document.querySelectorAll('.operation-card').forEach((card) => {
  const focus = card.dataset.focus || 'FLOW';
  card.addEventListener('pointerenter', () => {
    operationHover = true;
    if (coreFocus) coreFocus.textContent = focus;
  });
  card.addEventListener('pointerleave', () => { operationHover = false; });
  card.addEventListener('focusin', () => {
    operationHover = true;
    if (coreFocus) coreFocus.textContent = focus;
  });
  card.addEventListener('focusout', () => { operationHover = false; });
});

function decodeBase64Asset(text) {
  const clean = text.replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function initExecutionCore() {
  const canvas = document.getElementById('execution-core');
  const stage = document.querySelector('.core-stage');
  const fallback = document.querySelector('.core-fallback');
  const hero = stage?.closest('.hero');
  if (!canvas || !stage) return;

  try {
    const [THREE, loaderModule] = await Promise.all([
      import('https://esm.sh/three@0.180.0'),
      import('https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js')
    ]);
    const { GLTFLoader } = loaderModule;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 7.3);

    const system = new THREE.Group();
    scene.add(system);

    scene.add(new THREE.AmbientLight(0xb9c9e2, 1.15));
    const key = new THREE.PointLight(0xc8dcff, 38, 18, 1.7);
    key.position.set(3.2, 4.2, 5.2);
    scene.add(key);
    const rim = new THREE.PointLight(0x567ed0, 28, 15, 1.7);
    rim.position.set(-4.5, -2.5, 2.5);
    scene.add(rim);

    let core;
    let ringA;
    let ringB;
    let ringC;
    let nodes = [];
    let loadedModel = false;

    const tryLoadModel = async () => {
      const response = await fetch('/models/execution-core.b64', { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Execution Core asset returned ${response.status}`);
      const payload = decodeBase64Asset(await response.text());
      const loader = new GLTFLoader();
      const gltf = await new Promise((resolve, reject) => loader.parse(payload, '', resolve, reject));
      const model = gltf.scene;
      model.name = 'DeepNexivra_ExecutionCore';
      model.scale.setScalar(1.02);
      system.add(model);

      core = model.getObjectByName('Core_FLOW');
      ringA = model.getObjectByName('Ring_Strategy');
      ringB = model.getObjectByName('Ring_Systems');
      ringC = model.getObjectByName('Ring_Execution');
      nodes = ['Strategy', 'Revenue', 'Product', 'Projects', 'People', 'Delivery']
        .map((name) => model.getObjectByName(`Node_${name}`))
        .filter(Boolean);

      model.traverse((object) => {
        if (!object.isMesh) return;
        object.frustumCulled = true;
        if (object.material) {
          object.material.envMapIntensity = 0.8;
          object.material.transparent = true;
          object.material.needsUpdate = true;
        }
      });

      loadedModel = Boolean(core && ringA && ringB && ringC && nodes.length);
      stage.dataset.core = loadedModel ? 'asset' : 'asset-partial';
      return loadedModel;
    };

    const buildProceduralFallback = () => {
      stage.dataset.core = 'procedural';
      core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.68, 4),
        new THREE.MeshPhysicalMaterial({
          color: 0x9eb5dc,
          metalness: 0.74,
          roughness: 0.2,
          clearcoat: 1,
          clearcoatRoughness: 0.16,
          emissive: 0x172640,
          emissiveIntensity: 0.65,
          transparent: true
        })
      );
      system.add(core);

      const inner = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.82, 2),
        new THREE.MeshBasicMaterial({ color: 0xaac6ff, wireframe: true, transparent: true, opacity: 0.11 })
      );
      inner.name = 'Core_Wireframe';
      system.add(inner);

      const ringMaterial = new THREE.MeshStandardMaterial({
        color: 0x829bc7,
        metalness: 0.88,
        roughness: 0.25,
        transparent: true,
        opacity: 0.54
      });

      const makeRing = (radius, tube, rotation) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 180), ringMaterial.clone());
        ring.rotation.set(...rotation);
        system.add(ring);
        return ring;
      };

      ringA = makeRing(1.38, 0.018, [1.12, 0.15, 0.2]);
      ringB = makeRing(1.75, 0.014, [0.28, 1.14, -0.25]);
      ringC = makeRing(2.08, 0.011, [1.48, 0.42, 0.72]);

      const nodeMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xd4e2fb,
        metalness: 0.58,
        roughness: 0.22,
        emissive: 0x243e70,
        emissiveIntensity: 0.7,
        transparent: true
      });

      const nodePositions = [
        new THREE.Vector3(0, 2.06, 0.15),
        new THREE.Vector3(1.76, 1.0, 0.34),
        new THREE.Vector3(1.68, -1.08, -0.28),
        new THREE.Vector3(0, -2.06, 0.2),
        new THREE.Vector3(-1.72, -1.0, -0.35),
        new THREE.Vector3(-1.76, 1.0, 0.3)
      ];

      nodes = [];
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x6f8fc6, transparent: true, opacity: 0.17 });
      nodePositions.forEach((position, index) => {
        const node = new THREE.Mesh(new THREE.SphereGeometry(index % 2 ? 0.095 : 0.115, 20, 20), nodeMaterial.clone());
        node.position.copy(position);
        nodes.push(node);
        system.add(node);

        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          position.clone().multiplyScalar(0.94)
        ]);
        system.add(new THREE.Line(lineGeometry, lineMaterial));
      });
    };

    try {
      const ok = await tryLoadModel();
      if (!ok) throw new Error('Execution Core asset is missing named components');
    } catch (assetError) {
      console.warn('Execution Core GLB unavailable; using procedural renderer.', assetError);
      system.clear();
      buildProceduralFallback();
    }

    const nodeBasePositions = nodes.map((node) => node.position.clone());
    const ringMaterials = [ringA, ringB, ringC].map((ring) => ring?.material).filter(Boolean);

    const points = [];
    for (let i = 0; i < 64; i += 1) {
      const radius = 2.7 + Math.random() * 1.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      points.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
    }
    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const pointCloud = new THREE.Points(
      pointGeometry,
      new THREE.PointsMaterial({ color: 0x7895c8, size: 0.018, transparent: true, opacity: 0.30 })
    );
    system.add(pointCloud);

    const resize = () => {
      const { width, height } = stage.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);

    let pointerX = 0;
    let pointerY = 0;
    stage.addEventListener('pointermove', (event) => {
      const rect = stage.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.42;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.32;
    }, { passive: true });
    stage.addEventListener('pointerleave', () => {
      pointerX = 0;
      pointerY = 0;
    });

    let visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      }, { threshold: 0.01 }).observe(stage);
    }

    let storyIndex = 0;
    let storyProgress = 0;
    const updateStory = () => {
      if (!hero || reducedMotion || !hero.classList.contains('story-enabled')) return;
      const rect = hero.getBoundingClientRect();
      const total = Math.max(1, hero.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / total));
      storyProgress = progress;
      const nextIndex = Math.min(storyStates.length - 1, Math.floor(progress * storyStates.length));
      if (nextIndex === storyIndex && hero.dataset.storyIndex === String(nextIndex)) return;
      storyIndex = nextIndex;
      hero.dataset.storyIndex = String(storyIndex);
      const state = storyStates[storyIndex];
      stage.dataset.story = state.name;
      if (!operationHover && coreFocus) coreFocus.textContent = state.name;
      if (coreSubcopy) coreSubcopy.textContent = `${state.name === 'FRICTION' ? 'FIND' : state.name === 'FLOW' ? 'RUN' : state.name} → BETTER EXECUTION`;
      const copy = hero.querySelector('.story-state-copy');
      if (copy) copy.innerHTML = `<strong>${state.name}</strong><span>${state.description}</span>`;
      hero.querySelectorAll('.story-step').forEach((step, index) => {
        step.classList.toggle('active', index === storyIndex);
        step.classList.toggle('complete', index < storyIndex);
      });
    };
    window.addEventListener('scroll', updateStory, { passive: true });
    window.addEventListener('resize', updateStory, { passive: true });
    updateStory();

    const stateParams = [
      { spread: 1.10, systemScale: 0.96, ringOpacity: [0.28, 0.22, 0.18], coreScale: 0.94, cloud: 0.48, speed: 1.8, jitter: 0.12 },
      { spread: 1.06, systemScale: 0.99, ringOpacity: [0.86, 0.28, 0.22], coreScale: 0.98, cloud: 0.38, speed: 1.25, jitter: 0.04 },
      { spread: 0.91, systemScale: 1.00, ringOpacity: [0.62, 0.42, 0.28], coreScale: 1.00, cloud: 0.28, speed: 0.92, jitter: 0.01 },
      { spread: 0.97, systemScale: 1.02, ringOpacity: [0.54, 0.92, 0.54], coreScale: 1.03, cloud: 0.24, speed: 0.82, jitter: 0.00 },
      { spread: 1.00, systemScale: 1.04, ringOpacity: [0.58, 0.72, 0.96], coreScale: 1.06, cloud: 0.22, speed: 1.18, jitter: 0.00 },
      { spread: 1.00, systemScale: 1.07, ringOpacity: [0.86, 0.86, 0.86], coreScale: 1.10, cloud: 0.18, speed: 0.72, jitter: 0.00 }
    ];

    const clock = new THREE.Clock();
    const draw = () => {
      const t = clock.getElapsedTime();
      const params = stateParams[storyIndex] || stateParams[stateParams.length - 1];
      system.rotation.y += (pointerX - system.rotation.y) * 0.035;
      system.rotation.x += (-pointerY - system.rotation.x) * 0.035;
      system.scale.lerp(new THREE.Vector3(params.systemScale, params.systemScale, params.systemScale), 0.045);

      if (!reducedMotion) {
        if (core) {
          core.rotation.y = t * 0.18 * params.speed;
          core.rotation.x = Math.sin(t * 0.4) * 0.08;
          const cScale = params.coreScale + Math.sin(t * 1.1) * (storyIndex === 5 ? 0.018 : 0.009);
          core.scale.lerp(new THREE.Vector3(cScale, cScale, cScale), 0.06);
          if (core.material?.emissiveIntensity !== undefined) {
            core.material.emissiveIntensity += (((storyIndex === 5 ? 1.25 : 0.72) - core.material.emissiveIntensity) * 0.04);
          }
        }
        if (ringA) ringA.rotation.z += 0.0018 * params.speed;
        if (ringB) ringB.rotation.z -= 0.00135 * params.speed;
        if (ringC) ringC.rotation.y += 0.0011 * params.speed;
        ringMaterials.forEach((material, index) => {
          if (!material) return;
          material.opacity += ((params.ringOpacity[index] - material.opacity) * 0.05);
        });
        nodes.forEach((node, index) => {
          const base = nodeBasePositions[index];
          if (base) {
            const jitter = params.jitter;
            const target = base.clone().multiplyScalar(params.spread);
            if (jitter) {
              target.x += Math.sin(t * 2.1 + index * 1.7) * jitter;
              target.y += Math.cos(t * 1.7 + index * 1.3) * jitter;
              target.z += Math.sin(t * 1.4 + index) * jitter * 0.7;
            }
            node.position.lerp(target, 0.055);
          }
          const pulse = 1 + Math.sin(t * 1.25 + index * 0.8) * (storyIndex === 0 ? 0.12 : storyIndex === 5 ? 0.035 : 0.065);
          node.scale.setScalar(pulse);
          if (node.material?.emissiveIntensity !== undefined) {
            const targetGlow = storyIndex === 5 ? 1.1 : storyIndex === 0 ? 0.48 : 0.72;
            node.material.emissiveIntensity += ((targetGlow - node.material.emissiveIntensity) * 0.04);
          }
        });
        pointCloud.rotation.y = t * 0.012 * params.speed;
        pointCloud.material.opacity += ((params.cloud - pointCloud.material.opacity) * 0.04);
      }

      renderer.render(scene, camera);
    };

    if (reducedMotion) {
      draw();
    } else {
      const frame = () => {
        requestAnimationFrame(frame);
        if (visible && !document.hidden) draw();
      };
      frame();
    }

    if (fallback) fallback.style.display = 'none';
    if (loadedModel) stage.classList.add('core-asset-loaded');
  } catch (error) {
    console.warn('Execution Core WebGL fallback activated.', error);
    canvas.style.display = 'none';
    if (fallback) fallback.style.display = 'block';
  }
}

initExecutionCore();
