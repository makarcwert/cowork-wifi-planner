/* ============================================================
   CoworkWiFi Planner — 3D-визуализация тепловой карты
   Three.js r160 через ES-модули (importmap)
   ============================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

(function (global) {
  'use strict';

  // ============================================================
  // СОСТОЯНИЕ
  // ============================================================
  let renderer = null;
  let scene = null;
  let camera = null;
  let controls = null;
  let host = null;
  let animId = null;
  let isOpen = false;

  let groupSurface = null;
  let groupWalls = null;
  let groupAPs = null;
  let groupFloor = null;

  let currentState = null;
  let currentHeatmap = null;
  let currentLayer = 'rssi';
  let heightScale = 6;

  // ============================================================
  // ЦВЕТА
  // ============================================================
  function colorForRssi(v) {
    if (v >= -55) return { r: 0.20, g: 0.85, b: 0.35 };
    if (v >= -65) return { r: 0.45, g: 0.80, b: 0.30 };
    if (v >= -75) return { r: 0.95, g: 0.80, b: 0.20 };
    if (v >= -85) return { r: 0.95, g: 0.55, b: 0.15 };
    if (v >= -95) return { r: 0.90, g: 0.25, b: 0.20 };
    return { r: 0.45, g: 0.10, b: 0.30 };
  }
  function colorForSnr(v) {
    if (v >= 40) return { r: 0.20, g: 0.85, b: 0.35 };
    if (v >= 25) return { r: 0.55, g: 0.80, b: 0.30 };
    if (v >= 15) return { r: 0.95, g: 0.80, b: 0.20 };
    if (v >= 10) return { r: 0.95, g: 0.55, b: 0.15 };
    return { r: 0.90, g: 0.25, b: 0.20 };
  }
  function colorForInterference(v) {
    if (v <= -95) return { r: 0.20, g: 0.85, b: 0.35 };
    if (v <= -85) return { r: 0.55, g: 0.80, b: 0.30 };
    if (v <= -75) return { r: 0.95, g: 0.80, b: 0.20 };
    if (v <= -65) return { r: 0.95, g: 0.55, b: 0.15 };
    return { r: 0.90, g: 0.25, b: 0.20 };
  }
  function colorFor(v, layer) {
    if (layer === 'snr') return colorForSnr(v);
    if (layer === 'interference') return colorForInterference(v);
    return colorForRssi(v);
  }

  function heightFor(v, layer) {
    if (layer === 'snr') return Math.max(0, Math.min(1, v / 50));
    if (layer === 'interference') return Math.max(0, Math.min(1, (v + 100) / 60));
    return Math.max(0, Math.min(1, (v + 100) / 70));
  }

  // ============================================================
  // ИНИЦИАЛИЗАЦИЯ
  // ============================================================
  function initScene() {
    host = document.getElementById('scene3dHost');
    if (!host) return false;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.Fog(0x0a0a0a, 40, 120);

    const aspect = host.clientWidth / host.clientHeight;
    camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    camera.position.set(20, 25, 35);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    host.innerHTML = '';
    host.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 5;
    controls.maxDistance = 150;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dir1.position.set(20, 40, 20);
    scene.add(dir1);

    const dir2 = new THREE.DirectionalLight(0x88aaff, 0.4);
    dir2.position.set(-30, 20, -20);
    scene.add(dir2);

    groupFloor   = new THREE.Group();
    groupSurface = new THREE.Group();
    groupWalls   = new THREE.Group();
    groupAPs     = new THREE.Group();
    scene.add(groupFloor, groupSurface, groupWalls, groupAPs);

    window.addEventListener('resize', onResize);
    bindUI();
    return true;
  }

  function onResize() {
    if (!renderer || !host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  // ============================================================
  // ГЕОМЕТРИЯ
  // ============================================================
  function clearGroup(g) {
    while (g.children.length) {
      const c = g.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material.dispose();
      }
    }
  }

  function buildFloor(project) {
    clearGroup(groupFloor);
    const W = project.width_m;
    const H = project.height_m;
    const cx = W / 2;
    const cz = H / 2;

    const floorGeo = new THREE.PlaneGeometry(W, H);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, roughness: 0.9, metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, cz);
    groupFloor.add(floor);

    const grid = new THREE.GridHelper(
      Math.max(W, H) * 2, Math.max(W, H) * 2,
      0x333333, 0x222222
    );
    grid.position.set(cx, 0.01, cz);
    groupFloor.add(grid);

    const points = [
      new THREE.Vector3(0, 0.02, 0),
      new THREE.Vector3(W, 0.02, 0),
      new THREE.Vector3(W, 0.02, H),
      new THREE.Vector3(0, 0.02, H),
      new THREE.Vector3(0, 0.02, 0),
    ];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x0e639c });
    groupFloor.add(new THREE.Line(lineGeo, lineMat));
  }

  function materialForWall(name) {
    const MAP = {
      brick:    { color: 0xb85c38, thickness: 0.20, opacity: 1.0 },
      concrete: { color: 0x7a7a7a, thickness: 0.25, opacity: 1.0 },
      drywall:  { color: 0xe8e8e8, thickness: 0.10, opacity: 1.0 },
      wood:     { color: 0xa0522d, thickness: 0.15, opacity: 1.0 },
      glass:    { color: 0x88ccee, thickness: 0.05, opacity: 0.35 },
      window:   { color: 0x88ccee, thickness: 0.05, opacity: 0.35 },
    };
    return MAP[name] || MAP.concrete;
  }

  function buildWalls(project, elements) {
    clearGroup(groupWalls);
    const wallH = 3.0;

    (elements || []).filter(el =>
      el.type === 'wall' || el.type === 'window'
    ).forEach(el => {
      const a = new THREE.Vector3(el.x1, 0, el.y1);
      const b = new THREE.Vector3(el.x2, 0, el.y2);
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      if (len < 0.05) return;

      const mat = materialForWall(el.material);
      const geo = new THREE.BoxGeometry(len, wallH, mat.thickness);
      const material = new THREE.MeshStandardMaterial({
        color: mat.color,
        roughness: 0.85,
        metalness: 0.05,
        transparent: mat.opacity < 1,
        opacity: mat.opacity,
      });
      const mesh = new THREE.Mesh(geo, material);

      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      mesh.position.set(mid.x, wallH / 2, mid.z);
      mesh.rotation.y = -Math.atan2(dir.z, dir.x);

      groupWalls.add(mesh);
    });
  }

  function makeLabel(text, color, bg) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    ctx.clearRect(0, 0, 256, 64);
    if (bg && bg !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 256, 64);
    }
    ctx.fillStyle = color;
    ctx.font = 'bold 32px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const mat = new THREE.SpriteMaterial({
      map: texture, transparent: true, depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2, 0.5, 1);
    return sprite;
  }

  function buildAPs(aps) {
    clearGroup(groupAPs);
    const H = 3.2;

    aps.forEach(ap => {
      const g = new THREE.Group();

      const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, H, 8);
      const poleMat = new THREE.MeshStandardMaterial({
        color: 0x2e5eaa, metalness: 0.6, roughness: 0.3,
      });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(ap.x, H / 2, ap.y);
      g.add(pole);

      const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
      const headMat = new THREE.MeshStandardMaterial({
        color: 0x0e639c,
        emissive: 0x0e639c,
        emissiveIntensity: 0.8,
      });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(ap.x, H, ap.y);
      g.add(head);

      const ringGeo = new THREE.RingGeometry(0.3, 0.4, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x0e639c, side: THREE.DoubleSide,
        transparent: true, opacity: 0.7,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(ap.x, 0.05, ap.y);
      ring.userData.pulse = true;
      g.add(ring);

      const label = makeLabel(ap.name, '#ffffff', '#0e639c');
      label.position.set(ap.x, H + 0.6, ap.y);
      g.add(label);

      const chLabel = makeLabel('ch ' + (ap.channel || '?'), '#aaccff', 'rgba(0,0,0,0)');
      chLabel.position.set(ap.x, H + 0.3, ap.y);
      chLabel.scale.set(1.5, 0.4, 1);
      g.add(chLabel);

      groupAPs.add(g);
    });
  }

  function buildSurface(project, heatmap, layer) {
    clearGroup(groupSurface);
    if (!heatmap || !heatmap.grid) return;

    const W = project.width_m;
    const H = project.height_m;
    const cols = heatmap.cols;
    const rows = heatmap.rows;
    const cw = W / cols;
    const ch = H / rows;

    const positions = [];
    const colors = [];
    const indices = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = heatmap.grid[r][c];
        const x = c * cw + cw / 2;
        const z = r * ch + ch / 2;
        const y = heightFor(v, layer) * heightScale;

        positions.push(x, y, z);
        const col = colorFor(v, layer);
        colors.push(col.r, col.g, col.b);
      }
    }

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = a + 1;
        const d = (r + 1) * cols + c;
        const e = d + 1;
        indices.push(a, d, b);
        indices.push(b, d, e);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.7,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
    });
    groupSurface.add(new THREE.Mesh(geo, mat));

    const wireGeo = new THREE.WireframeGeometry(geo);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.15,
    });
    groupSurface.add(new THREE.LineSegments(wireGeo, wireMat));
  }

  // ============================================================
  // СБОРКА
  // ============================================================
  function rebuild(nextState, heatmap, layer) {
    if (!scene) return;
    currentState = nextState;
    currentHeatmap = heatmap;
    currentLayer = layer || currentLayer;

    const { project, elements } = nextState;

    buildFloor(project);
    buildWalls(project, elements);
    buildAPs(nextState.aps || []);
    if (currentHeatmap) {
      buildSurface(project, currentHeatmap, currentLayer);
    }

    applyVisibility();

    if (controls) {
      controls.target.set(project.width_m / 2, 0, project.height_m / 2);
      controls.update();
    }
  }

  function applyVisibility() {
    const w = document.getElementById('chk3dWalls');
    const a = document.getElementById('chk3dAps');
    const s = document.getElementById('chk3dSurface');
    if (groupWalls)   groupWalls.visible   = w ? w.checked : true;
    if (groupAPs)     groupAPs.visible     = a ? a.checked : true;
    if (groupSurface) groupSurface.visible = s ? s.checked : true;
  }

  // ============================================================
  // АНИМАЦИЯ
  // ============================================================
  function animate() {
    if (!isOpen) return;
    animId = requestAnimationFrame(animate);
    if (controls) controls.update();

    const t = performance.now() * 0.002;
    if (groupAPs) {
      groupAPs.traverse(obj => {
        if (obj.userData && obj.userData.pulse) {
          const s = 1 + Math.sin(t) * 0.15;
          obj.scale.set(s, s, 1);
        }
      });
    }
    renderer.render(scene, camera);
  }

  // ============================================================
  // UI
  // ============================================================
  function bindUI() {
    document.querySelectorAll('input[name="layer3d"]').forEach(r => {
      r.addEventListener('change', () => {
        if (!r.checked) return;
        currentLayer = r.value;
        if (global.Editor3D.onLayerChange) {
          global.Editor3D.onLayerChange(currentLayer);
        }
      });
    });

    const cw = document.getElementById('chk3dWalls');
    const ca = document.getElementById('chk3dAps');
    const cs = document.getElementById('chk3dSurface');
    if (cw) cw.addEventListener('change', applyVisibility);
    if (ca) ca.addEventListener('change', applyVisibility);
    if (cs) cs.addEventListener('change', applyVisibility);

    const h = document.getElementById('height3d');
    if (h) h.addEventListener('input', function () {
      heightScale = parseFloat(this.value);
      if (currentHeatmap && currentState) {
        buildSurface(currentState.project, currentHeatmap, currentLayer);
        applyVisibility();
      }
    });

    const rst = document.getElementById('btn3dReset');
    if (rst) rst.addEventListener('click', () => {
      if (!currentState) return;
      const p = currentState.project;
      camera.position.set(p.width_m * 1.2, 25, p.height_m * 1.2);
      if (controls) {
        controls.target.set(p.width_m / 2, 0, p.height_m / 2);
        controls.update();
      }
    });

    const cls = document.getElementById('btn3dClose');
    if (cls) cls.addEventListener('click', close);
  }

  // ============================================================
  // ПУБЛИЧНОЕ API
  // ============================================================
  function open(payload) {
    if (!payload || !payload.project) {
      alert('Создайте проект');
      return;
    }

    const modalEl = document.getElementById('modal3D');

    // Страховка: если модалка внутри элемента с transform/filter —
    // position:fixed перестаёт работать. Переносим её в body.
    if (modalEl && modalEl.parentElement !== document.body) {
      document.body.appendChild(modalEl);
    }

    modalEl.classList.add('show');
    isOpen = true;

    // Ждём, пока модалка получит реальные размеры (не 0×0)
    let tries = 0;
    const waitHost = setInterval(() => {
      tries++;
      const h = document.getElementById('scene3dHost');
      if (!h) { clearInterval(waitHost); return; }
      if (tries > 60) {                       // максимум ~1.8 сек
        clearInterval(waitHost);
        console.warn('[editor3d] не удалось получить размеры host');
        return;
      }
      if (h.clientWidth < 10 || h.clientHeight < 10) return;  // ещё не отрисовано

      clearInterval(waitHost);
      console.log('[editor3d] host готов:', h.clientWidth, 'x', h.clientHeight);

      if (!scene) {
        if (!initScene()) return;
      }
      onResize();
      rebuild({
        project: payload.project,
        elements: payload.elements,
        aps: payload.aps,
        computeHeatmap: payload.computeHeatmap,
      }, payload.heatmap, payload.layer || 'rssi');

      if (animId) cancelAnimationFrame(animId);
      animate();
    }, 30);
  }

  function close() {
    isOpen = false;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    document.getElementById('modal3D').classList.remove('show');
  }

  // ============================================================
  // ЭКСПОРТ В WINDOW (для editor.js)
  // ============================================================
  global.Editor3D = {
    open,
    close,
    onLayerChange: null,
    getLayer: () => currentLayer,
  };

  console.log('[editor3d] Three.js r160 (ESM) подключён');

})(window);