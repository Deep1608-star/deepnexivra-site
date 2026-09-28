const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
document.querySelectorAll('.operation-card').forEach((card) => {
  const focus = card.dataset.focus || 'FLOW';
  card.addEventListener('pointerenter', () => { if (coreFocus) coreFocus.textContent = focus; });
  card.addEventListener('pointerleave', () => { if (coreFocus) coreFocus.textContent = 'FLOW'; });
  card.addEventListener('focusin', () => { if (coreFocus) coreFocus.textContent = focus; });
  card.addEventListener('focusout', () => { if (coreFocus) coreFocus.textContent = 'FLOW'; });
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
          emissiveIntensity: 0.65
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
        emissiveIntensity: 0.7
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

    const clock = new THREE.Clock();
    const draw = () => {
      const t = clock.getElapsedTime();
      system.rotation.y += (pointerX - system.rotation.y) * 0.035;
      system.rotation.x += (-pointerY - system.rotation.x) * 0.035;

      if (!reducedMotion) {
        if (core) {
          core.rotation.y = t * 0.18;
          core.rotation.x = Math.sin(t * 0.4) * 0.08;
        }
        if (ringA) ringA.rotation.z += 0.0018;
        if (ringB) ringB.rotation.z -= 0.00135;
        if (ringC) ringC.rotation.y += 0.0011;
        nodes.forEach((node, index) => {
          const pulse = 1 + Math.sin(t * 1.25 + index * 0.8) * 0.07;
          node.scale.setScalar(pulse);
        });
        pointCloud.rotation.y = t * 0.012;
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
