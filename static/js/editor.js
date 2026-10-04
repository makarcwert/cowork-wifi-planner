/* ============================================================
   CoworkWiFi Planner — редактор зоны покрытия
   Часть 1: состояние, физика, рендер
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     КОНСТАНТЫ
     ============================================================ */

  const PX_PER_M = 40;          // пикселей на метр
  const SNAP_M = 0.5;           // шаг сетки в метрах
  const CABLE_LIMIT_M = 100;    // максимальная длина кабеля
  const CABLE_COEF = 1.1;       // коэффициент запаса кабеля
  const POE = { '2.4': 12.5, '5': 15.5, '6': 18.0 };

  const MATERIALS = {
    brick:    { name: 'Кирпич',      loss: 15, pattern: 'pat-brick',    width: 7 },
    concrete: { name: 'Бетон',       loss: 25, pattern: 'pat-concrete', width: 8 },
    drywall:  { name: 'Гипсокартон', loss: 4,  pattern: 'pat-drywall',  width: 3 },
    wood:     { name: 'Дерево',      loss: 6,  pattern: 'pat-wood',     width: 6 },
    glass:    { name: 'Стекло',      loss: 3,  pattern: 'pat-glass',    width: 5 }
  };

  const PALETTE = [
    { name: 'Сеть', items: [
      { key: 'ap', label: 'AP', icon: 'ap' },
      { key: 'switch', label: 'SW', icon: 'switch' },
      { key: 'router', label: 'Роутер', icon: 'router' },
      { key: 'wlc', label: 'WLC', icon: 'wlc' },
      { key: 'patch', label: 'Патч', icon: 'patch' }
    ]},
    { name: 'Стены', items: [
      { key: 'wall', material: 'brick',    label: 'Кирпич', icon: 'wall_brick' },
      { key: 'wall', material: 'wood',     label: 'Дерево', icon: 'wall_wood' },
      { key: 'wall', material: 'glass',    label: 'Стекло', icon: 'wall_glass' },
      { key: 'wall', material: 'drywall',  label: 'ГКЛ',    icon: 'wall_drywall' },
      { key: 'wall', material: 'concrete', label: 'Бетон',  icon: 'wall_concrete' }
    ]},
    { name: 'Мебель', items: [
      { key: 'table', label: 'Стол', icon: 'table' },
      { key: 'chair', label: 'Стул', icon: 'chair' },
      { key: 'sofa', label: 'Диван', icon: 'sofa' },
      { key: 'plant', label: 'Растение', icon: 'plant' }
    ]},
    { name: 'Техника', items: [
      { key: 'pc', label: 'ПК', icon: 'pc' },
      { key: 'laptop', label: 'Ноутбук', icon: 'laptop' },
      { key: 'printer', label: 'МФУ', icon: 'printer' },
      { key: 'scanner', label: 'Сканер', icon: 'scanner' },
      { key: 'camera', label: 'Камера', icon: 'camera' }
    ]},
    { name: 'IoT', items: [
      { key: 'light', label: 'Свет', icon: 'light', iot: true },
      { key: 'sensor', label: 'Датчик', icon: 'sensor', iot: true },
      { key: 'lock', label: 'Замок', icon: 'lock', iot: true },
      { key: 'doorphone', label: 'Домофон', icon: 'doorphone', iot: true },
      { key: 'ac', label: 'Кондиц.', icon: 'ac', iot: true }
    ]}
  ];

  const DEV_ICON = {
    pc: 'pc', laptop: 'laptop', printer: 'printer',
    scanner: 'scanner', camera: 'camera', router: 'router',
    patch: 'patch', wlc: 'wlc'
  };

  const IOT_ICON = {
    light: 'light', sensor: 'sensor', lock: 'lock',
    doorphone: 'doorphone', ac: 'ac'
  };

  const WIRELESS_TYPES = [
    'pc', 'laptop', 'printer', 'scanner', 'camera',
    'light', 'sensor', 'lock', 'doorphone', 'ac'
  ];

  const DEVICE_NAMES = {
    pc: 'PC-', laptop: 'LT-', printer: 'MFP-', scanner: 'SC-',
    camera: 'CAM-', router: 'RT-', patch: 'PP-', wlc: 'WLC-'
  };

  const IOT_NAMES = {
    light: 'LT-', sensor: 'TH-', lock: 'LK-', doorphone: 'DF-', ac: 'AC-'
  };

  const FURNITURE_TYPES = ['table', 'chair', 'sofa', 'plant'];

  /* ============================================================
     СОСТОЯНИЕ
     ============================================================ */

  const state = {
    // Серверный проект
    projectId: null,
    project: null,

    // Локальные коллекции (синхронизируются с БД)
    elements: [],
    aps: [],
    switches: [],
    devices: [],

    // UI
    selected: null,
    multiSelected: [],
    tool: 'select',
    wallMaterial: 'concrete',
    draft: null,
    roomPoints: [],
    drag: null,
    zoom: 1,
    snap: true,
    history: [],
    redoStack: [],
    clipboard: null,
    heatmap: null,
    heatmapMode: 'rssi',
    lastMousePos: null,

    // Счётчики для автоименования
    idSeq: 1,
    apCnt: 0,
    swCnt: 0,
    devCnt: 0,

    // Флаг: идёт ли сейчас загрузка с сервера (чтобы не сохранять в процессе)
    loading: false
  };

  const nextId = () => state.idSeq++;

  /* ============================================================
     ССЫЛКИ НА DOM-ЭЛЕМЕНТЫ
     ============================================================ */

  const svg             = document.getElementById('planSvg');
  const wrap            = document.getElementById('canvasWrap');
  const heatmapCanvas   = document.getElementById('heatmapCanvas');
  const selectionRectEl = document.getElementById('selectionRect');
  const snapIndicator   = document.getElementById('snapIndicator');
  const propsPanel      = document.getElementById('propsPanel');
  const canvasHint      = document.getElementById('canvasHint');
  const paletteGroups   = document.getElementById('paletteGroups');

  const L = {};
  [
    'layerGrid', 'layerCoverage', 'layerCables', 'layerRooms', 'layerWalls',
    'layerFurniture', 'layerText', 'layerDevices', 'layerIoT', 'layerSwitches',
    'layerAps', 'layerDraft', 'layerSelection'
  ].forEach(id => L[id] = document.getElementById(id));

  /* ============================================================
     ТЕМА
     ============================================================ */

  (function initTheme() {
    const saved = localStorage.getItem('cw_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.textContent = saved === 'dark' ? '☀' : '🌙';
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('cw_theme', next);
      btn.textContent = next === 'dark' ? '☀' : '🌙';
      // Перерисовать тепловую карту, если она активна
      if (state.heatmap) drawHeatmap();
    });
  })();

  /* ============================================================
     УТИЛИТЫ
     ============================================================ */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function snap(v) {
    if (!state.snap) return +v.toFixed(2);
    return Math.round(v / SNAP_M) * SNAP_M;
  }

  function m2px(mx, my) {
    return { x: mx * PX_PER_M, y: my * PX_PER_M };
  }

  /* С учётом preserveAspectRatio="xMidYMid meet" */
  function svgMetrics() {
    const r = svg.getBoundingClientRect();
    const vb = (svg.getAttribute('viewBox') || '0 0 100 100')
      .split(/[\s,]+/).map(Number);
    const vx = vb[0] || 0, vy = vb[1] || 0;
    const vw = vb[2] || 1, vh = vb[3] || 1;
    const scale = Math.min(r.width / vw, r.height / vh);
    const offsetX = (r.width  - vw * scale) / 2;
    const offsetY = (r.height - vh * scale) / 2;
    return { r, vx, vy, vw, vh, scale, offsetX, offsetY };
  }

  function eventToM(e) {
    const m = svgMetrics();
    const px = (e.clientX - m.r.left - m.offsetX) / m.scale + m.vx;
    const py = (e.clientY - m.r.top  - m.offsetY) / m.scale + m.vy;
    return { px, py, m: { x: px / PX_PER_M, y: py / PX_PER_M } };
  }

  function clientToM(sx, sy) {
    const m = svgMetrics();
    return {
      x: ((sx - m.offsetX) / m.scale + m.vx) / PX_PER_M,
      y: ((sy - m.offsetY) / m.scale + m.vy) / PX_PER_M
    };
  }

  function flashSnap(mx, my) {
    if (!state.snap || !snapIndicator) return;
    const p = m2px(snap(mx), snap(my));
    const size = SNAP_M * PX_PER_M;
    snapIndicator.style.left   = (p.x - size / 2) + 'px';
    snapIndicator.style.top    = (p.y - size / 2) + 'px';
    snapIndicator.style.width  = size + 'px';
    snapIndicator.style.height = size + 'px';
    snapIndicator.style.display = 'block';
    clearTimeout(snapIndicator._t);
    snapIndicator._t = setTimeout(() => {
      snapIndicator.style.display = 'none';
    }, 400);
  }

  /* ============================================================
     API-ОБЁРТКИ (расширяют api.js для удобства)
     ============================================================ */

  const API_PROJECTS = '/api/projects';

  const Api = {
    // ---- Проекты ----
    listProjects: () => API.get(API_PROJECTS + '/'),
    createProject: (data) => API.post(API_PROJECTS + '/', data),
    getProject: (id) => API.get(API_PROJECTS + '/' + id),
    updateProject: (id, data) => API.put(API_PROJECTS + '/' + id, data),
    deleteProject: (id) => API.del(API_PROJECTS + '/' + id),

    // ---- Элементы ----
    listElements: (pid) => API.get(API_PROJECTS + '/' + pid + '/elements'),
    createElement: (pid, data) => API.post(API_PROJECTS + '/' + pid + '/elements', data),
    updateElement: (eid, data) => API.put(API_PROJECTS + '/elements/' + eid, data),
    deleteElement: (eid) => API.del(API_PROJECTS + '/elements/' + eid),

    // ---- AP ----
    listAPs: (pid) => API.get(API_PROJECTS + '/' + pid + '/aps'),
    createAP: (pid, data) => API.post(API_PROJECTS + '/' + pid + '/aps', data),
    updateAP: (aid, data) => API.put(API_PROJECTS + '/aps/' + aid, data),
    deleteAP: (aid) => API.del(API_PROJECTS + '/aps/' + aid),

    // ---- Устройства ----
    listDevices: (pid) => API.get(API_PROJECTS + '/' + pid + '/devices'),
    createDevice: (pid, data) => API.post(API_PROJECTS + '/' + pid + '/devices', data),
    updateDevice: (did, data) => API.put(API_PROJECTS + '/devices/' + did, data),
    deleteDevice: (did) => API.del(API_PROJECTS + '/devices/' + did),

    // ---- Коммутаторы ----
    listSwitches: (pid) => API.get('/api/infra/' + pid + '/switches'),
    createSwitch: (pid, data) => API.post('/api/infra/' + pid + '/switches', data),
    updateSwitch: (sid, data) => API.put('/api/infra/switches/' + sid, data),
    deleteSwitch: (sid) => API.del('/api/infra/switches/' + sid),

    // ---- Каталог AP ----
    listApModels: () => API.get('/api/ap-models/')
  };

  /* ============================================================
     ПАЛИТРА (построение DOM)
     ============================================================ */

  function buildPalette() {
    if (!paletteGroups) return;
    paletteGroups.innerHTML = '';

    PALETTE.forEach(cat => {
      const sec = document.createElement('section');
      sec.className = 'palette-category open';

      const header = document.createElement('button');
      header.className = 'palette-cat-header';
      header.type = 'button';
      header.innerHTML = '<span class="chev">▾</span> ' + cat.name;
      sec.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'palette-grid';

      cat.items.forEach(it => {
        const el = document.createElement('div');
        el.className = 'palette-item' + (it.iot ? ' iot' : '');
        el.draggable = true;
        el.dataset.key = it.key;
        if (it.material) el.dataset.material = it.material;

        el.innerHTML =
          '<div>' + window.getEditorIcon(it.icon) + '</div>' +
          '<span>' + it.label + '</span>';

        // Клик — выбор инструмента (для стены) или размещение
        el.addEventListener('click', () => {
          if (it.key === 'wall') {
            state.tool = 'wall';
            state.wallMaterial = it.material;
            setActiveTool('wall');
            canvasHint.textContent =
              'Стена: ' + MATERIALS[it.material].name +
              '. Клик — начало, клик — конец';
          } else {
            const pos = state.lastMousePos || {
              x: state.project ? state.project.width_m / 2 : 5,
              y: state.project ? state.project.height_m / 2 : 5
            };
            placeObject(it.key, pos.x, pos.y);
          }
        });

        // Drag-n-drop
        el.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', JSON.stringify(it));
          e.dataTransfer.effectAllowed = 'copy';
        });

        grid.appendChild(el);
      });

      header.addEventListener('click', () => sec.classList.toggle('open'));
      sec.appendChild(grid);
      paletteGroups.appendChild(sec);
    });
  }

  // Поиск в палитре
  const paletteSearch = document.getElementById('paletteSearch');
  if (paletteSearch) {
    paletteSearch.addEventListener('input', function () {
      const q = this.value.toLowerCase();
      document.querySelectorAll('.palette-item').forEach(el => {
        const t = (el.querySelector('span') || {}).textContent || '';
        el.style.display = (!q || t.toLowerCase().includes(q)) ? '' : 'none';
      });
    });
  }

  /* ============================================================
     ФИЗИКА
     ============================================================ */

  function fspl(d, f) {
    if (d <= 0.1) d = 0.1;
    return 20 * Math.log10(d) + 20 * Math.log10(f) - 27.55;
  }

  function segInt(p1, p2, p3, p4) {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(d) < 1e-9) return false;
    const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
    return t > 0 && t < 1 && u > 0 && u < 1;
  }

  function wallLoss(ap, px, py) {
    let loss = 0;
    const p1 = { x: ap.x, y: ap.y };
    const p2 = { x: px, y: py };
    for (const el of state.elements) {
      if (el.type !== 'wall') continue;
      if (segInt(p1, p2,
        { x: el.x1, y: el.y1 },
        { x: el.x2, y: el.y2 })) {
        loss += (MATERIALS[el.material] || MATERIALS.concrete).loss;
      }
    }
    return loss;
  }

  function signalAt(ap, x, y) {
    const dz = (state.project.height_v || 3) - 1.2;
    const dx = ap.x - x, dy = ap.y - y;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return ap.power + ap.gain - fspl(d, ap.freq) - wallLoss(ap, x, y);
  }

  function coverageAt(x, y) {
    if (!state.aps.length) return -Infinity;
    let best = -Infinity;
    for (const ap of state.aps) {
      const s = signalAt(ap, x, y);
      if (s > best) best = s;
    }
    return best;
  }

  /* ============================================================
     СЕТКА ЧЕРТЕЖА
     ============================================================ */

  function drawGrid() {
    L.layerGrid.innerHTML = '';
    if (!state.project) return;

    const W = state.project.width_m * PX_PER_M;
    const H = state.project.height_m * PX_PER_M;

    // Рамка чертежа
    const border = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    border.setAttribute('x', 0);
    border.setAttribute('y', 0);
    border.setAttribute('width', W);
    border.setAttribute('height', H);
    border.setAttribute('fill', 'none');
    border.setAttribute('stroke', '#444');
    border.setAttribute('stroke-width', '1.5');
    L.layerGrid.appendChild(border);

    // Верхняя линейка
    for (let x = 0; x <= state.project.width_m; x++) {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', x * PX_PER_M);
      l.setAttribute('y1', 0);
      l.setAttribute('x2', x * PX_PER_M);
      l.setAttribute('y2', x % 5 === 0 ? -10 : -5);
      l.setAttribute('stroke', '#555');
      l.setAttribute('stroke-width', '1');
      L.layerGrid.appendChild(l);

      if (x % 5 === 0 && x > 0) {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', x * PX_PER_M);
        t.setAttribute('y', -14);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('class', 'svg-label');
        t.textContent = x + ' м';
        L.layerGrid.appendChild(t);
      }
    }

    // Левая линейка
    for (let y = 0; y <= state.project.height_m; y++) {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', 0);
      l.setAttribute('y1', y * PX_PER_M);
      l.setAttribute('x2', y % 5 === 0 ? -10 : -5);
      l.setAttribute('y2', y * PX_PER_M);
      l.setAttribute('stroke', '#555');
      l.setAttribute('stroke-width', '1');
      L.layerGrid.appendChild(l);

      if (y % 5 === 0 && y > 0) {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', -14);
        t.setAttribute('y', y * PX_PER_M + 3);
        t.setAttribute('text-anchor', 'end');
        t.setAttribute('class', 'svg-label');
        t.textContent = y + ' м';
        L.layerGrid.appendChild(t);
      }
    }
  }

  /* ============================================================
     ГЛАВНЫЙ РЕНДЕР
     ============================================================ */

  function render() {
    if (!state.project) {
      Object.values(L).forEach(l => { if (l) l.innerHTML = ''; });
      return;
    }
    drawGrid();
    renderWalls();
    renderShapes();
    renderFurniture();
    renderText();
    renderDevices();
    renderIoT();
    renderSwitches();
    renderAPs();
    renderCables();
    renderCoverage();
    renderMarkers();
    renderLegendIcons();
    if (state.heatmap) drawHeatmap();
  }

  /* ============================================================
     РЕНДЕР: СТЕНЫ (с пунктирной длиной и якорями)
     ============================================================ */

  function renderWalls() {
    L.layerWalls.innerHTML = '';

    for (const el of state.elements) {
      if (el.type !== 'wall') continue;

      const a = m2px(el.x1, el.y1);
      const b = m2px(el.x2, el.y2);
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;

      const mat = MATERIALS[el.material] || MATERIALS.concrete;

      // Основная линия стены
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', a.x);
      line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x);
      line.setAttribute('y2', b.y);
      line.setAttribute('stroke', 'url(#' + mat.pattern + ')');
      line.setAttribute('stroke-width', mat.width);
      line.setAttribute('stroke-linecap', 'square');
      line.dataset.kind = 'element';
      line.dataset.id = el.id;

      if (isSelected('element', el.id)) {
        line.setAttribute('stroke', '#2E5EAA');
        line.setAttribute('stroke-width', mat.width + 3);
      }

      line.style.cursor = 'move';

      line.addEventListener('click', e => {
        e.stopPropagation();
        if (state.tool !== 'select') return;
        if (e.shiftKey) toggleMulti('element', el.id);
        else {
          state.selected = { kind: 'element', id: el.id };
          state.multiSelected = [];
        }
        render();
        renderProps();
      });

      line.addEventListener('mousedown', e => {
        if (state.tool === 'select') startDrag(e, 'element', el.id);
      });

      L.layerWalls.appendChild(line);

      // Пунктирная линия длины (сдвинутая по нормали)
      const ux = dx / len, uy = dy / len;
      const nx = -uy, ny = ux;
      const off = 14;

      const dim = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      dim.setAttribute('x1', a.x + nx * off);
      dim.setAttribute('y1', a.y + ny * off);
      dim.setAttribute('x2', b.x + nx * off);
      dim.setAttribute('y2', b.y + ny * off);
      dim.setAttribute('stroke', '#666');
      dim.setAttribute('stroke-width', '0.8');
      dim.setAttribute('stroke-dasharray', '3 3');
      dim.setAttribute('pointer-events', 'none');
      L.layerWalls.appendChild(dim);

      // Засечки на концах
      [a, b].forEach(pt => {
        const tk = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tk.setAttribute('x1', pt.x + nx * (off - 4));
        tk.setAttribute('y1', pt.y + ny * (off - 4));
        tk.setAttribute('x2', pt.x + nx * (off + 4));
        tk.setAttribute('y2', pt.y + ny * (off + 4));
        tk.setAttribute('stroke', '#666');
        tk.setAttribute('stroke-width', '0.8');
        tk.setAttribute('pointer-events', 'none');
        L.layerWalls.appendChild(tk);
      });

      // Подпись длины
      const lenM = Math.hypot(el.x2 - el.x1, el.y2 - el.y1).toFixed(2);
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', (a.x + b.x) / 2 + nx * off);
      lbl.setAttribute('y', (a.y + b.y) / 2 + ny * off - 3);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('class', 'svg-dim-label');
      lbl.setAttribute('pointer-events', 'none');
      lbl.textContent = lenM + ' м';
      L.layerWalls.appendChild(lbl);
    }
  }

  /* Поиск ближайшего якоря (угол/центр стены) */
  function findAnchor(x, y, t) {
    t = t || 0.8;
    let best = null, bd = t;
    for (const el of state.elements) {
      if (el.type !== 'wall') continue;
      const pts = [
        { x: el.x1, y: el.y1 },
        { x: el.x2, y: el.y2 },
        { x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2 }
      ];
      for (const c of pts) {
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < bd) { bd = d; best = c; }
      }
    }
    return best;
  }

  /* ============================================================
     РЕНДЕР: ФИГУРЫ И КОМНАТЫ
     ============================================================ */

  function renderShapes() {
    L.layerRooms.innerHTML = '';

    for (const el of state.elements) {
      if (el.type === 'shape') {
        const p = m2px(el.x, el.y);
        const w = (el.width || 4) * PX_PER_M;
        const h = (el.height || 3) * PX_PER_M;
        let s;
        if (el.subtype === 'ellipse') {
          s = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
          s.setAttribute('cx', p.x + w / 2);
          s.setAttribute('cy', p.y + h / 2);
          s.setAttribute('rx', w / 2);
          s.setAttribute('ry', h / 2);
        } else if (el.subtype === 'triangle') {
          s = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          s.setAttribute('points',
            (p.x + w / 2) + ',' + p.y + ' ' +
            (p.x + w) + ',' + (p.y + h) + ' ' +
            p.x + ',' + (p.y + h));
        } else {
          s = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          s.setAttribute('x', p.x);
          s.setAttribute('y', p.y);
          s.setAttribute('width', w);
          s.setAttribute('height', h);
        }
        s.setAttribute('fill', 'rgba(46,94,170,.15)');
        s.setAttribute('stroke', isSelected('element', el.id) ? '#2E5EAA' : '#666');
        s.setAttribute('stroke-width', isSelected('element', el.id) ? 3 : 1.5);
        s.dataset.kind = 'element';
        s.dataset.id = el.id;
        s.style.cursor = 'move';
        s.addEventListener('mousedown', e => startDrag(e, 'element', el.id));
        s.addEventListener('click', e => {
          e.stopPropagation();
          if (state.tool === 'select') {
            state.selected = { kind: 'element', id: el.id };
            state.multiSelected = [];
            render(); renderProps();
          }
        });
        L.layerRooms.appendChild(s);
      }

      if (el.type === 'room') {
        try {
          const pts = JSON.parse(el.points_json || '[]');
          if (pts.length < 3) continue;
          const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          poly.setAttribute('points', pts.map(p => {
            const q = m2px(p.x, p.y);
            return q.x + ',' + q.y;
          }).join(' '));
          poly.setAttribute('fill', 'rgba(46,94,170,.05)');
          poly.setAttribute('stroke', '#2E5EAA');
          poly.setAttribute('stroke-width', '1.5');
          poly.dataset.kind = 'element';
          poly.dataset.id = el.id;
          poly.addEventListener('click', e => {
            e.stopPropagation();
            if (state.tool === 'select') {
              state.selected = { kind: 'element', id: el.id };
              state.multiSelected = [];
              render(); renderProps();
            }
          });
          L.layerRooms.appendChild(poly);
        } catch (err) { /* игнорируем битый JSON */ }
      }
    }
  }

  /* ============================================================
     РЕНДЕР: МЕБЕЛЬ
     ============================================================ */

  function renderFurniture() {
    L.layerFurniture.innerHTML = '';
    const ICON_MAP = {
      sofa: 'sofa', table: 'table', chair: 'chair', plant: 'plant'
    };

    for (const el of state.elements) {
      if (el.type !== 'furniture') continue;

      const p = m2px(el.x, el.y);
      const wPx = (el.width  || 1.5) * PX_PER_M;
      const hPx = (el.height || 1)   * PX_PER_M;
      const scaleF = wPx / 40;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform',
        'translate(' + (p.x - wPx / 2) + ',' + (p.y - hPx / 2) + ') scale(' + scaleF + ')');
      g.dataset.kind = 'element';
      g.dataset.id = el.id;
      g.style.cursor = 'move';

      const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      fo.setAttribute('width', 40);
      fo.setAttribute('height', 40);

      const div = document.createElement('div');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.style.width = '40px';
      div.style.height = '40px';
      div.style.color = isSelected('element', el.id) ? '#2E5EAA' : '#c8c8c8';
      div.innerHTML = window.getEditorIcon(ICON_MAP[el.subtype] || 'table');
      fo.appendChild(div);
      g.appendChild(fo);

      g.addEventListener('mousedown', e => startDrag(e, 'element', el.id));
      g.addEventListener('click', e => {
        e.stopPropagation();
        if (state.tool === 'select') {
          state.selected = { kind: 'element', id: el.id };
          state.multiSelected = [];
          render(); renderProps();
        }
      });

      L.layerFurniture.appendChild(g);
    }
  }

  /* ============================================================
     РЕНДЕР: ТЕКСТ
     ============================================================ */

  function renderText() {
    L.layerText.innerHTML = '';

    for (const el of state.elements) {
      if (el.type !== 'text') continue;

      const p = m2px(el.x, el.y);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', p.x);
      t.setAttribute('y', p.y);
      t.setAttribute('class', 'svg-label');
      t.dataset.kind = 'element';
      t.dataset.id = el.id;
      t.style.cursor = 'move';
      t.textContent = el.name || 'Текст';

      t.addEventListener('mousedown', e => startDrag(e, 'element', el.id));
      t.addEventListener('click', e => {
        e.stopPropagation();
        if (state.tool === 'select') {
          state.selected = { kind: 'element', id: el.id };
          state.multiSelected = [];
          render(); renderProps();
        }
      });

      L.layerText.appendChild(t);
    }
  }

  /* ============================================================
     РЕНДЕР: УСТРОЙСТВА (ПК, ноутбук, принтер, камера...)
     ============================================================ */

  function renderDevices() {
    L.layerDevices.innerHTML = '';

    for (const d of state.devices) {
      if (!DEV_ICON[d.type]) continue;

      const p = m2px(d.x, d.y);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(' + (p.x - 16) + ',' + (p.y - 16) + ')');
      g.dataset.kind = 'device';
      g.dataset.id = d.id;
      g.style.cursor = 'move';

      const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      fo.setAttribute('width', 32);
      fo.setAttribute('height', 32);

      const div = document.createElement('div');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.style.width = '32px';
      div.style.height = '32px';
      div.style.color = isSelected('device', d.id) ? '#2E5EAA' : '#b0b0b0';
      div.innerHTML = window.getEditorIcon(DEV_ICON[d.type]);
      fo.appendChild(div);
      g.appendChild(fo);

      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', 16);
      lbl.setAttribute('y', 44);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('class', 'svg-label');
      lbl.textContent = d.name;
      g.appendChild(lbl);

      g.addEventListener('mousedown', e => startDrag(e, 'device', d.id));
      g.addEventListener('click', e => {
        e.stopPropagation();
        if (state.tool === 'select') {
          state.selected = { kind: 'device', id: d.id };
          state.multiSelected = [];
          render(); renderProps();
        }
      });

      L.layerDevices.appendChild(g);
    }
  }

  /* ============================================================
     РЕНДЕР: IoT
     ============================================================ */

  function renderIoT() {
    L.layerIoT.innerHTML = '';

    for (const d of state.devices) {
      if (!IOT_ICON[d.type]) continue;

      const p = m2px(d.x, d.y);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(' + (p.x - 14) + ',' + (p.y - 14) + ')');
      g.dataset.kind = 'device';
      g.dataset.id = d.id;
      g.style.cursor = 'move';

      const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      fo.setAttribute('width', 28);
      fo.setAttribute('height', 28);

      const div = document.createElement('div');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.style.width = '28px';
      div.style.height = '28px';
      div.innerHTML = window.getEditorIcon(IOT_ICON[d.type]);
      fo.appendChild(div);
      g.appendChild(fo);

      g.addEventListener('mousedown', e => startDrag(e, 'device', d.id));
      g.addEventListener('click', e => {
        e.stopPropagation();
        if (state.tool === 'select') {
          state.selected = { kind: 'device', id: d.id };
          state.multiSelected = [];
          render(); renderProps();
        }
      });

      L.layerIoT.appendChild(g);
    }
  }

  /* ============================================================
     РЕНДЕР: КОММУТАТОРЫ
     ============================================================ */

  function renderSwitches() {
    L.layerSwitches.innerHTML = '';

    for (const sw of state.switches) {
      const p = m2px(sw.x, sw.y);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(' + (p.x - 20) + ',' + (p.y - 16) + ')');
      g.dataset.kind = 'switch';
      g.dataset.id = sw.id;
      g.style.cursor = 'move';

      const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      fo.setAttribute('width', 40);
      fo.setAttribute('height', 32);

      const div = document.createElement('div');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.style.width = '40px';
      div.style.height = '32px';
      div.innerHTML = window.getEditorIcon('switch');
      fo.appendChild(div);
      g.appendChild(fo);

      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', 20);
      lbl.setAttribute('y', 44);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('class', 'svg-label');
      lbl.textContent = sw.name;
      g.appendChild(lbl);

      g.addEventListener('mousedown', e => startDrag(e, 'switch', sw.id));
      g.addEventListener('click', e => {
        e.stopPropagation();
        if (state.tool === 'select') {
          state.selected = { kind: 'switch', id: sw.id };
          state.multiSelected = [];
          render(); renderProps();
        }
      });

      L.layerSwitches.appendChild(g);
    }
  }

  /* ============================================================
     РЕНДЕР: AP
     ============================================================ */

  function renderAPs() {
    L.layerAps.innerHTML = '';

    for (const ap of state.aps) {
      const p = m2px(ap.x, ap.y);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(' + (p.x - 20) + ',' + (p.y - 20) + ')');
      g.dataset.kind = 'ap';
      g.dataset.id = ap.id;
      g.style.cursor = 'move';

      const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      fo.setAttribute('width', 40);
      fo.setAttribute('height', 40);

      const div = document.createElement('div');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.style.width = '40px';
      div.style.height = '40px';
      div.style.color = '#2E5EAA';
      div.innerHTML = window.getEditorIcon('ap');
      fo.appendChild(div);
      g.appendChild(fo);

      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', 20);
      lbl.setAttribute('y', 52);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('class', 'svg-label');
      lbl.textContent = ap.name;
      g.appendChild(lbl);

      g.addEventListener('mousedown', e => startDrag(e, 'ap', ap.id));
      g.addEventListener('click', e => {
        e.stopPropagation();
        if (state.tool === 'select') {
          state.selected = { kind: 'ap', id: ap.id };
          state.multiSelected = [];
          render(); renderProps();
        }
      });

      L.layerAps.appendChild(g);
    }
  }

  /* ============================================================
     РЕНДЕР: КАБЕЛИ И БЕСПРОВОДНЫЕ СВЯЗИ
     ============================================================ */

  function drawCableLine(x1, y1, x2, y2, lenM, isMain, kind) {
    const a = m2px(x1, y1);
    const b = m2px(x2, y2);
    const over = lenM > CABLE_LIMIT_M;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    path.setAttribute('x1', a.x);
    path.setAttribute('y1', a.y);
    path.setAttribute('x2', b.x);
    path.setAttribute('y2', b.y);
    path.setAttribute('stroke', over ? '#f44336' : '#2E5EAA');
    path.setAttribute('stroke-width', isMain ? '1.2' : '0.8');
    path.setAttribute('stroke-dasharray', kind === 'uplink' ? '4 3' : '2 3');
    path.setAttribute('opacity', '0.75');
    L.layerCables.appendChild(path);

    if (isMain) {
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', (a.x + b.x) / 2);
      lbl.setAttribute('y', (a.y + b.y) / 2 - 3);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('class', 'svg-label');
      lbl.textContent = lenM.toFixed(1) + ' м';
      L.layerCables.appendChild(lbl);
    }
  }

  function renderCables() {
    L.layerCables.innerHTML = '';
    const chk = document.getElementById('chkLayerCables');
    if (chk && !chk.checked) return;

    // 1. AP → ближайший коммутатор
    if (state.switches.length) {
      for (const ap of state.aps) {
        let best = null, bd = Infinity;
        for (const sw of state.switches) {
          const d = Math.hypot(ap.x - sw.x, ap.y - sw.y) * CABLE_COEF;
          if (d < bd) { bd = d; best = sw; }
        }
        if (!best) continue;
        drawCableLine(best.x, best.y, ap.x, ap.y, bd, true, 'uplink');
      }
    }

    // 2. Беспроводные устройства → ближайшая AP (пунктир)
    for (const d of state.devices) {
      if (!WIRELESS_TYPES.includes(d.type)) continue;
      let bestAP = null, bdAP = Infinity;
      for (const ap of state.aps) {
        const dist = Math.hypot(d.x - ap.x, d.y - ap.y);
        if (dist < bdAP) { bdAP = dist; bestAP = ap; }
      }
      if (!bestAP) continue;
      const a = m2px(bestAP.x, bestAP.y);
      const b = m2px(d.x, d.y);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', a.x);
      line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x);
      line.setAttribute('y2', b.y);
      line.setAttribute('stroke', bdAP > 30 ? '#f44336' : '#4caf50');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '2 3');
      line.setAttribute('opacity', '0.6');
      L.layerCables.appendChild(line);
    }
  }

  /* ============================================================
     РЕНДЕР: ЗОНЫ ПОКРЫТИЯ (когда нет тепловой карты)
     ============================================================ */

  function renderCoverage() {
    L.layerCoverage.innerHTML = '';
    const chk = document.getElementById('chkLayerCoverage');
    if (chk && !chk.checked) return;
    if (state.heatmap) return;

    for (const ap of state.aps) {
      const p = m2px(ap.x, ap.y);
      let r_m = 5 + (ap.power - 10) * 0.8;
      if (ap.freq === 2400) r_m *= 1.4;
      if (ap.freq === 6000) r_m *= 0.8;
      const r_px = r_m * PX_PER_M;

      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', p.x);
      c.setAttribute('cy', p.y);
      c.setAttribute('r', r_px);
      c.setAttribute('fill', 'rgba(46,94,170,.08)');
      c.setAttribute('stroke', 'rgba(46,94,170,.5)');
      c.setAttribute('stroke-width', '1');
      c.setAttribute('stroke-dasharray', '4 4');
      c.setAttribute('pointer-events', 'none');
      L.layerCoverage.appendChild(c);
    }
  }

  /* ============================================================
     ВЫДЕЛЕНИЕ И МАРКЕРЫ RESIZE
     ============================================================ */

  function isSelected(kind, id) {
    if (state.selected && state.selected.kind === kind && state.selected.id === id) return true;
    return state.multiSelected.some(s => s.kind === kind && s.id === id);
  }

  function toggleMulti(kind, id) {
    const i = state.multiSelected.findIndex(s => s.kind === kind && s.id === id);
    if (i >= 0) state.multiSelected.splice(i, 1);
    else state.multiSelected.push({ kind, id });
    state.selected = null;
  }

  function getObj(kind, id) {
    if (kind === 'ap')      return state.aps.find(x => x.id === id);
    if (kind === 'device')  return state.devices.find(x => x.id === id);
    if (kind === 'switch')  return state.switches.find(x => x.id === id);
    if (kind === 'element') return state.elements.find(x => x.id === id);
  }

  function renderMarkers() {
    L.layerSelection.innerHTML = '';
    if (state.multiSelected.length > 1) return;
    if (!state.selected || state.selected.kind !== 'element') return;

    const el = state.elements.find(x => x.id === state.selected.id);
    if (!el || el.type === 'text') return;

    let x1, y1, x2, y2;
    if (el.type === 'wall') {
      const a = m2px(el.x1, el.y1);
      const b = m2px(el.x2, el.y2);
      x1 = Math.min(a.x, b.x); y1 = Math.min(a.y, b.y);
      x2 = Math.max(a.x, b.x); y2 = Math.max(a.y, b.y);
      if (x2 - x1 < 12) { x1 -= 6; x2 += 6; }
      if (y2 - y1 < 12) { y1 -= 6; y2 += 6; }
    } else if (el.type === 'shape') {
      const p = m2px(el.x, el.y);
      x1 = p.x;
      y1 = p.y;
      x2 = p.x + (el.width  || 4) * PX_PER_M;
      y2 = p.y + (el.height || 3) * PX_PER_M;
    } else if (el.type === 'furniture') {
      const p = m2px(el.x, el.y);
      const w = (el.width  || 1.5) * PX_PER_M;
      const h = (el.height || 1)   * PX_PER_M;
      x1 = p.x - w / 2;
      y1 = p.y - h / 2;
      x2 = p.x + w / 2;
      y2 = p.y + h / 2;
    } else {
      return;
    }

    if (el.type !== 'wall') {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', x1);
      r.setAttribute('y', y1);
      r.setAttribute('width', x2 - x1);
      r.setAttribute('height', y2 - y1);
      r.setAttribute('fill', 'none');
      r.setAttribute('stroke', '#2E5EAA');
      r.setAttribute('stroke-width', '1');
      r.setAttribute('stroke-dasharray', '3 3');
      r.setAttribute('pointer-events', 'none');
      L.layerSelection.appendChild(r);
    }

    let markers = [];
    if (el.type === 'wall') {
      const a = m2px(el.x1, el.y1);
      const b = m2px(el.x2, el.y2);
      markers = [
        { x: a.x, y: a.y, which: 'start' },
        { x: b.x, y: b.y, which: 'end' }
      ];
    } else {
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      markers = [
        { x: x1, y: y1, c: 'nwse-resize' },
        { x: cx, y: y1, c: 'ns-resize' },
        { x: x2, y: y1, c: 'nesw-resize' },
        { x: x2, y: cy, c: 'ew-resize' },
        { x: x2, y: y2, c: 'nwse-resize' },
        { x: cx, y: y2, c: 'ns-resize' },
        { x: x1, y: y2, c: 'nesw-resize' },
        { x: x1, y: cy, c: 'ew-resize' }
      ];
    }

    markers.forEach(cn => {
      const mk = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      mk.setAttribute('x', cn.x - 5);
      mk.setAttribute('y', cn.y - 5);
      mk.setAttribute('width', 10);
      mk.setAttribute('height', 10);
      mk.setAttribute('fill', '#fff');
      mk.setAttribute('stroke', '#2E5EAA');
      mk.setAttribute('stroke-width', '2');
      mk.style.cursor = cn.c || 'move';
      mk.style.pointerEvents = 'all';
      mk.addEventListener('mousedown', ev => {
        ev.stopPropagation(); ev.preventDefault();
        if (el.type === 'wall') {
          startWallResize(ev, el, cn.which);
        } else {
          startShapeResize(ev, el, cn.x, cn.y, x1, y1, x2, y2);
        }
      });
      L.layerSelection.appendChild(mk);
    });
  }

  /* ============================================================
     ЛЕГЕНДА (иконки оборудования)
     ============================================================ */

  function renderLegendIcons() {
    const grid = document.getElementById('legendGrid');
    if (!grid) return;
    const list = window.EditorLegendList || [];
    grid.innerHTML = list.map(([k, l]) =>
      '<div class="legend-item">' +
        '<span class="ic">' + window.getEditorIcon(k) + '</span>' +
        l +
      '</div>'
    ).join('');
  }

  /* ============================================================
     VIEWBOX / ZOOM
     ============================================================ */

  function applyViewBox(x, y, w, h) {
    svg.setAttribute('viewBox', x + ' ' + y + ' ' + w + ' ' + h);
    state._vb = { x, y, w, h };
  }

  /* ============================================================
     ЭКСПОРТ (внутренний API для второй части файла)
     ============================================================ */

  // Открываем наружу только то, что нужно второй части (в том же файле)
  // — через объект внутреннего API
  /* ============================================================
     ТЕПЛОВАЯ КАРТА
     ============================================================ */

  function calcHeatmap(mode) {
    if (!state.project) return alert('Создайте проект');
    if (!state.aps.length) return alert('Разместите хотя бы одну AP');
    state.heatmapMode = mode;
    state.heatmap = buildHeatmap();
    drawHeatmap();
    heatmapCanvas.style.display = 'block';
    canvasHint.textContent = 'Тепловая карта: ' + mode.toUpperCase();
  }

  function recalcHeatmap() {
    if (!state.heatmap) return;
    state.heatmap = buildHeatmap();
    drawHeatmap();
  }

  function buildHeatmap() {
    const step = 0.5;
    const cols = Math.ceil(state.project.width_m  / step);
    const rows = Math.ceil(state.project.height_m / step);
    const grid = [];

    let total = 0, sum = 0;
    let dead = 0, weak = 0, good = 0, exc = 0;
    let min = Infinity, max = -Infinity;
    const deadZones = [];

    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const x = c * step + step / 2;
        const y = r * step + step / 2;
        const dbm = coverageAt(x, y);
        row.push(dbm);
        total++;
        sum += dbm;
        if (dbm < min) min = dbm;
        if (dbm > max) max = dbm;
        if (dbm >= -65) exc++;
        else if (dbm >= -75) good++;
        else if (dbm >= -85) weak++;
        else {
          dead++;
          if (deadZones.length < 50) deadZones.push({ x, y, dbm });
        }
      }
      grid.push(row);
    }

    return {
      cols, rows, grid,
      stats: {
        total,
        avg: sum / total,
        min, max,
        deadPct: dead / total * 100,
        weakPct: weak / total * 100,
        goodPct: good / total * 100,
        excPct:  exc / total * 100,
        deadZones
      }
    };
  }

  function colorFor(v, mode) {
    if (mode === 'rssi') {
      if (v >= -65) return 'rgba(76,175,80,0.45)';
      if (v >= -75) return 'rgba(255,193,7,0.45)';
      if (v >= -85) return 'rgba(255,152,0,0.5)';
      return 'rgba(244,67,54,0.55)';
    }
    if (mode === 'snr') {
      const s = v + 95;
      if (s >= 40) return 'rgba(76,175,80,0.45)';
      if (s >= 25) return 'rgba(255,193,7,0.45)';
      return 'rgba(244,67,54,0.55)';
    }
    return 'rgba(0,0,0,0)';
  }

  function drawHeatmap() {
    if (!state.heatmap || !state.project) return;

    const W = state.project.width_m  * PX_PER_M;
    const H = state.project.height_m * PX_PER_M;
    heatmapCanvas.width  = W;
    heatmapCanvas.height = H;

    // Позиционируем canvas поверх области (0,0)-(W,H) в SVG-пикселях
    const m = svgMetrics();
    const wr = wrap.getBoundingClientRect();
    const screenX = (0 - m.vx) * m.scale + m.offsetX + (m.r.left - wr.left);
    const screenY = (0 - m.vy) * m.scale + m.offsetY + (m.r.top  - wr.top);
    const screenW = W * m.scale;
    const screenH = H * m.scale;

    heatmapCanvas.style.left   = screenX + 'px';
    heatmapCanvas.style.top    = screenY + 'px';
    heatmapCanvas.style.width  = screenW + 'px';
    heatmapCanvas.style.height = screenH + 'px';

    const ctx = heatmapCanvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const cw = W / state.heatmap.cols;
    const ch = H / state.heatmap.rows;

    for (let r = 0; r < state.heatmap.rows; r++) {
      for (let c = 0; c < state.heatmap.cols; c++) {
        const v = state.heatmap.grid[r][c];
        ctx.fillStyle = colorFor(v, state.heatmapMode);
        ctx.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
      }
    }
  }

  /* ============================================================
     DRAG&DROP: ПЕРЕТАСКИВАНИЕ ОБЪЕКТОВ
     ============================================================ */

  function startDrag(e, kind, id) {
    if (state.tool !== 'select') return;
    e.stopPropagation();
    e.preventDefault();

    const inMulti = state.multiSelected.some(s => s.kind === kind && s.id === id);
    const single  = state.selected &&
                    state.selected.kind === kind &&
                    state.selected.id === id;

    if (!inMulti && !single) {
      state.selected = { kind, id };
      state.multiSelected = [];
      render();
      renderProps();
    }

    const list = state.multiSelected.length
      ? state.multiSelected
      : [state.selected];

    const items = [];
    for (const s of list) {
      const o = getObj(s.kind, s.id);
      if (!o) continue;
      if (s.kind === 'element' && o.type === 'wall') {
        items.push({
          kind: s.kind, id: s.id, isWall: true,
          sx: o.x1, sy: o.y1, ex: o.x2, ey: o.y2
        });
      } else if (o.x != null && o.y != null) {
        items.push({ kind: s.kind, id: s.id, sx: o.x, sy: o.y });
      }
    }
    if (!items.length) return;

    const em = eventToM(e);
    state.drag = { items, sm: em.m };

    document.body.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e) {
    if (!state.drag) return;
    const em = eventToM(e);
    const dx = em.m.x - state.drag.sm.x;
    const dy = em.m.y - state.drag.sm.y;
    const first = state.drag.items[0];

    const sdx = snap(first.sx + dx) - first.sx;
    const sdy = snap(first.sy + dy) - first.sy;

    for (const it of state.drag.items) {
      const obj = getObj(it.kind, it.id);
      if (!obj) continue;

      if (it.isWall) {
        it.nx1 = first.sx + sdx + (it.sx - first.sx);
        it.ny1 = first.sy + sdy + (it.sy - first.sy);
        it.nx2 = first.sx + sdx + (it.ex - first.sx);
        it.ny2 = first.sy + sdy + (it.ey - first.sy);
        obj.x1 = it.nx1; obj.y1 = it.ny1;
        obj.x2 = it.nx2; obj.y2 = it.ny2;
      } else {
        it.nx = first.sx + sdx + (it.sx - first.sx);
        it.ny = first.sy + sdy + (it.sy - first.sy);
        obj.x = it.nx; obj.y = it.ny;
      }
    }

    render();
    flashSnap(snap(first.sx + dx), snap(first.sy + dy));
  }

  function onDragEnd() {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.body.style.cursor = '';

    if (!state.drag) return;
    const items = state.drag.items;
    state.drag = null;

    let moved = false;
    for (const it of items) {
      if (it.isWall && it.nx1 != null) { moved = true; break; }
      if (!it.isWall && it.nx != null) { moved = true; break; }
    }
    if (!moved) { render(); renderProps(); return; }

    pushHistory('перемещение');

    // Применяем изменения и синхронизируем с сервером
    const promises = [];

    for (const it of items) {
      const o = getObj(it.kind, it.id);
      if (!o) continue;

      if (it.isWall) {
        if (it.nx1 == null) continue;
        o.x1 = +it.nx1.toFixed(2); o.y1 = +it.ny1.toFixed(2);
        o.x2 = +it.nx2.toFixed(2); o.y2 = +it.ny2.toFixed(2);

        promises.push(Api.updateElement(o.id, {
          type: 'wall', material: o.material,
          x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2
        }).catch(err => console.error('update element:', err)));
      } else if (it.nx != null) {
        o.x = +it.nx.toFixed(2); o.y = +it.ny.toFixed(2);

        const payload = objectToApiPayload(it.kind, o);
        if (!payload) continue;

        if (it.kind === 'ap') {
          promises.push(Api.updateAP(o.id, payload).catch(err => console.error('update ap:', err)));
        } else if (it.kind === 'device') {
          promises.push(Api.updateDevice(o.id, payload).catch(err => console.error('update device:', err)));
        } else if (it.kind === 'switch') {
          promises.push(Api.updateSwitch(o.id, payload).catch(err => console.error('update switch:', err)));
        } else if (it.kind === 'element') {
          promises.push(Api.updateElement(o.id, payload).catch(err => console.error('update element:', err)));
        }
      }
    }

    if (state.heatmap) recalcHeatmap();
    render(); renderProps();

    Promise.all(promises).catch(() => {});
  }

  /* ============================================================
     RESIZE СТЕН
     ============================================================ */

  function startWallResize(e, el, which) {
    document.body.style.cursor = 'crosshair';

    function onMove(ev) {
      const em = eventToM(ev);
      const nx = snap(em.m.x), ny = snap(em.m.y);
      if (which === 'start') { el.x1 = nx; el.y1 = ny; }
      else { el.x2 = nx; el.y2 = ny; }
      renderWalls();
      renderMarkers();
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      pushHistory('resize стены');

      Api.updateElement(el.id, {
        type: 'wall', material: el.material,
        x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2
      }).catch(err => console.error('resize wall:', err));

      if (state.heatmap) recalcHeatmap();
      render();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /* ============================================================
     RESIZE ФИГУР / МЕБЕЛИ
     ============================================================ */

  function startShapeResize(e, el, mx, my, x1, y1, x2, y2) {
    const start = {
      w: el.width  || (el.type === 'furniture' ? 1.5 : 4),
      h: el.height || (el.type === 'furniture' ? 1   : 3),
      x: el.x,
      y: el.y,
      which: (mx === x1 ? 'w' : mx === x2 ? 'e' : '') +
             (my === y1 ? 'n' : my === y2 ? 's' : ''),
      mm: eventToM(e).m
    };

    function onMove(ev) {
      const em = eventToM(ev);
      const dx = em.m.x - start.mm.x;
      const dy = em.m.y - start.mm.y;
      let w = start.w, h = start.h, x = start.x, y = start.y;

      if (start.which.includes('e')) w += dx;
      if (start.which.includes('w')) { w -= dx; x += dx; }
      if (start.which.includes('s')) h += dy;
      if (start.which.includes('n')) { h -= dy; y += dy; }
      if (w < 0.5) w = 0.5;
      if (h < 0.5) h = 0.5;

      el.width  = +w.toFixed(2);
      el.height = +h.toFixed(2);
      el.x = +snap(x).toFixed(2);
      el.y = +snap(y).toFixed(2);
      render();
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      pushHistory('resize');

      if (el.type === 'furniture') {
        Api.updateElement(el.id, {
          type: 'furniture', subtype: el.subtype,
          x: el.x, y: el.y,
          width: el.width, height: el.height,
          rotation: el.rotation || 0
        }).catch(err => console.error('resize furniture:', err));
      } else {
        Api.updateElement(el.id, {
          type: el.type, subtype: el.subtype || 'rect',
          material: el.material || 'brick',
          x: el.x, y: el.y,
          width: el.width, height: el.height,
          points_json: el.points_json
        }).catch(err => console.error('resize shape:', err));
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /* ============================================================
     СОБЫТИЯ ХОЛСТА: MOUSEMOVE (курсор + черновик стены)
     ============================================================ */

  svg.addEventListener('mousemove', e => {
    if (!state.project) return;
    const em = eventToM(e);
    state.lastMousePos = { x: snap(em.m.x), y: snap(em.m.y) };

    const cp = document.getElementById('cursorPos');
    if (cp) {
      cp.textContent = 'X: ' + em.m.x.toFixed(1) + '  Y: ' + em.m.y.toFixed(1);
    }

    if (state.tool === 'wall' && state.draft) {
      const x = snap(em.m.x), y = snap(em.m.y);
      const a = m2px(state.draft.x1, state.draft.y1);
      const b = m2px(x, y);
      let line = L.layerDraft.querySelector('line');
      if (!line) {
        line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', a.x);
        line.setAttribute('y1', a.y);
        line.setAttribute('stroke', '#2E5EAA');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', '6 3');
        L.layerDraft.appendChild(line);
      }
      line.setAttribute('x2', b.x);
      line.setAttribute('y2', b.y);
    }
  });

  /* ============================================================
     СОБЫТИЯ ХОЛСТА: CLICK (создание объектов)
     ============================================================ */

  svg.addEventListener('click', e => {
    if (!state.project) return;
    if (e.target.closest && e.target.closest('[data-kind]')) return;

    const em = eventToM(e);
    const x = snap(em.m.x), y = snap(em.m.y);

    /* --- Стена --- */
    if (state.tool === 'wall') {
      const mat = state.wallMaterial;

      if (!state.draft) {
        const a = findAnchor(x, y);
        state.draft = { x1: a ? a.x : x, y1: a ? a.y : y };
        L.layerDraft.innerHTML = '';

        const p = m2px(state.draft.x1, state.draft.y1);
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', p.x);
        dot.setAttribute('cy', p.y);
        dot.setAttribute('r', 5);
        dot.setAttribute('fill', '#2E5EAA');
        dot.setAttribute('stroke', '#fff');
        dot.setAttribute('stroke-width', '2');
        L.layerDraft.appendChild(dot);

        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', p.x); l.setAttribute('y1', p.y);
        l.setAttribute('x2', p.x); l.setAttribute('y2', p.y);
        l.setAttribute('stroke', '#2E5EAA');
        l.setAttribute('stroke-width', '2');
        l.setAttribute('stroke-dasharray', '6 3');
        L.layerDraft.appendChild(l);
        return;
      }

      const a = findAnchor(x, y);
      const ex = a ? a.x : x;
      const ey = a ? a.y : y;

      if (Math.hypot(ex - state.draft.x1, ey - state.draft.y1) < 0.3) {
        state.draft = null;
        L.layerDraft.innerHTML = '';
        return;
      }

      const payload = {
        type: 'wall',
        material: mat,
        x1: +state.draft.x1.toFixed(2),
        y1: +state.draft.y1.toFixed(2),
        x2: +ex.toFixed(2),
        y2: +ey.toFixed(2)
      };

      state.draft = null;
      L.layerDraft.innerHTML = '';
      pushHistory('стена');

      Api.createElement(state.projectId, payload)
        .then(el => {
          if (el && el.id) state.elements.push(apiToLocalElement(el));
          if (state.heatmap) recalcHeatmap();
          render();
        })
        .catch(err => {
          console.error('create wall:', err);
          // Откат: создаём локально, чтобы не терять данные
          state.elements.push(Object.assign({ id: nextId() }, payload));
          render();
        });
      return;
    }

    /* --- Комната --- */
    if (state.tool === 'room') {
      state.roomPoints.push({ x, y });
      L.layerDraft.innerHTML = '';

      if (state.roomPoints.length > 1) {
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        poly.setAttribute('points', state.roomPoints.map(p => {
          const q = m2px(p.x, p.y);
          return q.x + ',' + q.y;
        }).join(' '));
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', '#2E5EAA');
        poly.setAttribute('stroke-width', '2');
        poly.setAttribute('stroke-dasharray', '6 3');
        L.layerDraft.appendChild(poly);
      }
      return;
    }

    /* --- Текст --- */
    if (state.tool === 'text') {
      const t = prompt('Введите текст:');
      if (!t) return;
      pushHistory('текст');

      Api.createElement(state.projectId, {
        type: 'text',
        name: t,
        x: +x.toFixed(2),
        y: +y.toFixed(2)
      }).then(el => {
        if (el && el.id) state.elements.push(apiToLocalElement(el));
        render();
      }).catch(err => {
        console.error('create text:', err);
        state.elements.push({ id: nextId(), type: 'text', name: t, x, y });
        render();
      });
      return;
    }

    /* --- Выделение --- */
    if (state.tool === 'select') {
      state.selected = null;
      state.multiSelected = [];
      render();
      renderProps();
    }
  });

  /* ============================================================
     СОБЫТИЯ ХОЛСТА: DBLCLICK (замыкание комнаты)
     ============================================================ */

  svg.addEventListener('dblclick', () => {
    if (state.tool !== 'room' || state.roomPoints.length < 3) return;
    pushHistory('комната');

    const payload = {
      type: 'room',
      points_json: JSON.stringify(state.roomPoints)
    };
    state.roomPoints = [];
    L.layerDraft.innerHTML = '';

    Api.createElement(state.projectId, payload)
      .then(el => {
        if (el && el.id) state.elements.push(apiToLocalElement(el));
        render();
      })
      .catch(err => {
        console.error('create room:', err);
        state.elements.push(Object.assign({ id: nextId() }, payload));
        render();
      });
  });

  /* ============================================================
     СОБЫТИЯ ХОЛСТА: Mousedown (рамка выделения)
     ============================================================ */

  svg.addEventListener('mousedown', e => {
    if (state.tool !== 'select' || !state.project) return;
    if (e.target.closest && e.target.closest('[data-kind]')) return;
    if (e.button !== 0) return;

    const r0 = svg.getBoundingClientRect();
    const sx = e.clientX - r0.left;
    const sy = e.clientY - r0.top;
    let moved = false;

    function onMove(ev) {
      const cx = ev.clientX - r0.left;
      const cy = ev.clientY - r0.top;
      if (Math.hypot(cx - sx, cy - sy) < 5) return;
      moved = true;
      const left = Math.min(sx, cx);
      const top  = Math.min(sy, cy);
      const w = Math.abs(cx - sx);
      const h = Math.abs(cy - sy);
      selectionRectEl.style.left   = left + 'px';
      selectionRectEl.style.top    = top + 'px';
      selectionRectEl.style.width  = w + 'px';
      selectionRectEl.style.height = h + 'px';
      selectionRectEl.style.display = 'block';
    }

    function onUp(ev) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      selectionRectEl.style.display = 'none';
      if (!moved) return;

      const cx = ev.clientX - r0.left;
      const cy = ev.clientY - r0.top;
      const p1 = clientToM(Math.min(sx, cx), Math.min(sy, cy));
      const p2 = clientToM(Math.max(sx, cx), Math.max(sy, cy));

      const picked = [];
      const check = (arr, kind) => arr.forEach(o => {
        if (o.x >= p1.x && o.x <= p2.x && o.y >= p1.y && o.y <= p2.y)
          picked.push({ kind, id: o.id });
      });
      check(state.aps, 'ap');
      check(state.devices, 'device');
      check(state.switches, 'switch');

      state.multiSelected = picked;
      state.selected = null;
      render();
      renderProps();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  /* ============================================================
     DRAG&DROP ИЗ ПАЛИТРЫ
     ============================================================ */

  wrap.addEventListener('dragover', e => {
    if (!state.project) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  wrap.addEventListener('drop', e => {
    e.preventDefault();
    if (!state.project) return;

    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;

    let payload;
    try { payload = JSON.parse(raw); } catch (err) { return; }

    const em = eventToM(e);
    const x = snap(em.m.x);
    const y = snap(em.m.y);

    if (payload.key === 'wall') {
      state.tool = 'wall';
      state.wallMaterial = payload.material;
      setActiveTool('wall');
      return;
    }
    placeObject(payload.key, x, y);
  });

  /* ============================================================
     РАЗМЕЩЕНИЕ ОБЪЕКТОВ (с синхронизацией)
     ============================================================ */

  function placeObject(kind, x, y) {
    if (!state.project) { alert('Создайте проект'); return; }
    x = +snap(x).toFixed(2);
    y = +snap(y).toFixed(2);
    pushHistory('создание ' + kind);

    /* --- Коммутатор --- */
    if (kind === 'switch') {
      const name = 'SW-' + String(++state.swCnt).padStart(2, '0');
      const payload = {
        name, model: 'PoE Switch',
        x, y, total_ports: 24, poe_ports: 24,
        total_power_budget_w: 370
      };
      Api.createSwitch(state.projectId, payload)
        .then(sw => {
          if (sw && sw.id) state.switches.push(apiToLocalSwitch(sw));
          render(); renderCables();
        })
        .catch(err => {
          console.error('create switch:', err);
          state.switches.push({
            id: nextId(), name, x, y,
            totalPorts: 24, poeBudget: 370
          });
          render();
        });
      return;
    }

    /* --- AP --- */
    if (kind === 'ap') {
      const name = 'AP-' + String(++state.apCnt).padStart(2, '0');
      const payload = {
        name, model: 'Generic AP',
        x, y, tx_power_dbm: 20, antenna_gain: 5,
        band: '2.4', channel: 6, ssid_type: 'corporate'
      };
      Api.createAP(state.projectId, payload)
        .then(ap => {
          if (ap && ap.id) state.aps.push(apiToLocalAP(ap));
          if (state.heatmap) recalcHeatmap();
          render();
        })
        .catch(err => {
          console.error('create ap:', err);
          state.aps.push({
            id: nextId(), name, x, y,
            power: 20, gain: 5, freq: 2400,
            band: '2.4', channel: 6
          });
          render();
        });
      return;
    }

    /* --- Техника (ПК, ноутбук, принтер, камера, роутер, патч, WLC) --- */
    if (['pc', 'laptop', 'printer', 'scanner', 'camera',
         'router', 'patch', 'wlc'].includes(kind)) {
      const name = (DEVICE_NAMES[kind] || 'DEV-') +
                   String(++state.devCnt).padStart(2, '0');
      const payload = {
        name, type: kind, x, y,
        band: '5', required_rssi: -65,
        required_speed: 10, ssid_type: 'corporate'
      };
      Api.createDevice(state.projectId, payload)
        .then(d => {
          if (d && d.id) state.devices.push(apiToLocalDevice(d));
          render(); renderCables();
        })
        .catch(err => {
          console.error('create device:', err);
          state.devices.push({ id: nextId(), name, type: kind, x, y });
          render();
        });
      return;
    }

    /* --- IoT --- */
    if (['light', 'sensor', 'lock', 'doorphone', 'ac'].includes(kind)) {
      const name = (IOT_NAMES[kind] || 'IoT-') +
                   String(++state.devCnt).padStart(2, '0');
      const payload = {
        name, type: kind, x, y,
        band: '2.4', required_rssi: -70,
        required_speed: 1, ssid_type: 'iot'
      };
      Api.createDevice(state.projectId, payload)
        .then(d => {
          if (d && d.id) state.devices.push(apiToLocalDevice(d));
          render(); renderCables();
        })
        .catch(err => {
          console.error('create iot:', err);
          state.devices.push({ id: nextId(), name, type: kind, x, y });
          render();
        });
      return;
    }

    /* --- Мебель --- */
    if (FURNITURE_TYPES.includes(kind)) {
      const payload = {
        type: 'furniture', subtype: kind,
        x, y, width: 1.5, height: 1, rotation: 0
      };
      Api.createElement(state.projectId, payload)
        .then(el => {
          if (el && el.id) state.elements.push(apiToLocalElement(el));
          render();
        })
        .catch(err => {
          console.error('create furniture:', err);
          state.elements.push(Object.assign({ id: nextId() }, payload));
          render();
        });
      return;
    }
  }

  /* ============================================================
     ИНСТРУМЕНТЫ
     ============================================================ */

  function setActiveTool(name) {
    state.tool = name;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === name);
    });
  }

  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
    b.addEventListener('click', () => {
      setActiveTool(b.dataset.tool);
      state.draft = null;
      state.roomPoints = [];
      L.layerDraft.innerHTML = '';
      canvasHint.textContent = {
        select: 'Выделение',
        wall:   'Стена: клик — начало, клик — конец',
        room:   'Комната: клик по углам, двойной клик — замкнуть',
        text:   'Текст: кликните на холст'
      }[b.dataset.tool] || '';
    });
  });

  /* ============================================================
     ИСТОРИЯ
     ============================================================ */

  function pushHistory(action) {
    state.history.push({
      action,
      snap: {
        elements: JSON.parse(JSON.stringify(state.elements)),
        aps:      JSON.parse(JSON.stringify(state.aps)),
        switches: JSON.parse(JSON.stringify(state.switches)),
        devices:  JSON.parse(JSON.stringify(state.devices))
      }
    });
    if (state.history.length > 50) state.history.shift();
    state.redoStack = [];
  }

  function applySnapshot(s) {
    state.elements = JSON.parse(JSON.stringify(s.elements));
    state.aps      = JSON.parse(JSON.stringify(s.aps));
    state.switches = JSON.parse(JSON.stringify(s.switches));
    state.devices  = JSON.parse(JSON.stringify(s.devices));
    state.selected = null;
    state.multiSelected = [];
    if (state.heatmap) recalcHeatmap();
    render();
    renderProps();
  }

  function undo() {
    if (!state.history.length) return;
    const h = state.history.pop();
    state.redoStack.push(h);
    applySnapshot(h.snap);
  }

  function redo() {
    if (!state.redoStack.length) return;
    const h = state.redoStack.pop();
    state.history.push(h);
    applySnapshot(h.snap);
  }

  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);

  /* ============================================================
     КЛАВИАТУРА
     ============================================================ */

  document.addEventListener('keydown', e => {
    const t = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(t)) return;

    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault(); undo();
    } else if (ctrl && (e.key.toLowerCase() === 'y' ||
               (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault(); redo();
    } else if (ctrl && e.key.toLowerCase() === 'c') {
      e.preventDefault(); copySel();
    } else if (ctrl && e.key.toLowerCase() === 'v') {
      e.preventDefault(); pasteClip();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault(); delSel();
    } else if (e.key === 'Escape') {
      state.draft = null;
      state.roomPoints = [];
      L.layerDraft.innerHTML = '';
      state.selected = null;
      state.multiSelected = [];
      render(); renderProps();
    }
  });

  /* ============================================================
     КОПИРОВАНИЕ / ВСТАВКА / УДАЛЕНИЕ
     ============================================================ */

  function copySel() {
    const list = state.multiSelected.length
      ? state.multiSelected
      : (state.selected ? [state.selected] : []);
    if (!list.length) return;

    state.clipboard = list.map(s => {
      const o = getObj(s.kind, s.id);
      if (!o) return null;
      const c = JSON.parse(JSON.stringify(o));
      delete c.id;
      delete c.project_id;
      return { kind: s.kind, payload: c };
    }).filter(Boolean);
  }

  function pasteClip() {
    if (!state.clipboard || !state.project) return;
    pushHistory('вставка');

    state.clipboard.forEach(it => {
      const p = JSON.parse(JSON.stringify(it.payload));
      if (p.x != null) p.x = snap(p.x + 1);
      if (p.y != null) p.y = snap(p.y + 1);
      if (p.x1 != null) { p.x1 = snap(p.x1 + 1); p.x2 = snap(p.x2 + 1); }
      if (p.y1 != null) { p.y1 = snap(p.y1 + 1); p.y2 = snap(p.y2 + 1); }

      if (it.kind === 'ap') {
        Api.createAP(state.projectId, p)
          .then(ap => { if (ap && ap.id) state.aps.push(apiToLocalAP(ap)); render(); })
          .catch(() => {});
      } else if (it.kind === 'switch') {
        Api.createSwitch(state.projectId, p)
          .then(sw => { if (sw && sw.id) state.switches.push(apiToLocalSwitch(sw)); render(); })
          .catch(() => {});
      } else if (it.kind === 'device') {
        Api.createDevice(state.projectId, p)
          .then(d => { if (d && d.id) state.devices.push(apiToLocalDevice(d)); render(); })
          .catch(() => {});
      } else if (it.kind === 'element') {
        Api.createElement(state.projectId, p)
          .then(el => { if (el && el.id) state.elements.push(apiToLocalElement(el)); render(); })
          .catch(() => {});
      }
    });
  }

  function delSel() {
    const list = state.multiSelected.length
      ? state.multiSelected
      : (state.selected ? [state.selected] : []);
    if (!list.length) return;
    if (!confirm('Удалить ' + list.length + ' объектов?')) return;

    pushHistory('удаление');

    list.forEach(s => {
      const o = getObj(s.kind, s.id);
      if (!o) return;

      if (s.kind === 'ap') {
        state.aps = state.aps.filter(x => x.id !== s.id);
        Api.deleteAP(s.id).catch(err => console.error('del ap:', err));
      } else if (s.kind === 'switch') {
        state.switches = state.switches.filter(x => x.id !== s.id);
        Api.deleteSwitch(s.id).catch(err => console.error('del switch:', err));
      } else if (s.kind === 'device') {
        state.devices = state.devices.filter(x => x.id !== s.id);
        Api.deleteDevice(s.id).catch(err => console.error('del device:', err));
      } else if (s.kind === 'element') {
        state.elements = state.elements.filter(x => x.id !== s.id);
        Api.deleteElement(s.id).catch(err => console.error('del element:', err));
      }
    });

    state.selected = null;
    state.multiSelected = [];
    if (state.heatmap) recalcHeatmap();
    render();
    renderProps();
  }

  /* ============================================================
     ZOOM И ПАНОРАМИРОВАНИЕ
     ============================================================ */

  function setZoom(z) {
    state.zoom = Math.max(0.25, Math.min(3, z));
    const cur = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
    const cx = cur[0] + cur[2] / 2;
    const cy = cur[1] + cur[3] / 2;
    const W = cur[2] * (state._prevZoom || 1) / state.zoom;
    const H = cur[3] * (state._prevZoom || 1) / state.zoom;
    state._prevZoom = state.zoom;
    applyViewBox(cx - W / 2, cy - H / 2, W, H);
    document.getElementById('zoomLabel').textContent =
      Math.round(state.zoom * 100) + '%';
    if (state.heatmap) drawHeatmap();
  }

  document.getElementById('zoomIn').addEventListener('click',
    () => setZoom(state.zoom + 0.15));
  document.getElementById('zoomOut').addEventListener('click',
    () => setZoom(state.zoom - 0.15));

  /* Колесо: обычное — панорама, Ctrl+колесо — зум */
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      zoomAtPoint(e, e.deltaY > 0 ? -0.12 : 0.12);
    } else {
      panBy(-e.deltaX, -e.deltaY);
    }
  }, { passive: false });

  /* Панорамирование перетаскиванием средней кнопкой / Alt+ЛКМ */
  let panState = null;

  svg.addEventListener('mousedown', e => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      panState = { x: e.clientX, y: e.clientY };
      document.body.style.cursor = 'grabbing';
      document.addEventListener('mousemove', onPanMove);
      document.addEventListener('mouseup', onPanEnd);
    }
  });

  function onPanMove(e) {
    if (!panState) return;
    panBy(e.clientX - panState.x, e.clientY - panState.y);
    panState = { x: e.clientX, y: e.clientY };
  }

  function onPanEnd() {
    panState = null;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', onPanMove);
    document.removeEventListener('mouseup', onPanEnd);
  }

  function panBy(dxPx, dyPx) {
    const m = svgMetrics();
    const dxWorld = dxPx / m.scale;
    const dyWorld = dyPx / m.scale;
    const cur = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
    applyViewBox(cur[0] + dxWorld, cur[1] + dyWorld, cur[2], cur[3]);
    if (state.heatmap) drawHeatmap();
  }

  function zoomAtPoint(e, delta) {
    const newZoom = Math.max(0.25, Math.min(3, state.zoom + delta));
    if (newZoom === state.zoom) return;

    const r = svg.getBoundingClientRect();
    const m = svgMetrics();
    const mx = (e.clientX - r.left - m.offsetX) / m.scale + m.vx;
    const my = (e.clientY - r.top  - m.offsetY) / m.scale + m.vy;

    const cur = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
    const factor = newZoom / state.zoom;
    const newW = cur[2] / factor;
    const newH = cur[3] / factor;
    const newX = mx - (mx - cur[0]) / factor;
    const newY = my - (my - cur[1]) / factor;

    state.zoom = newZoom;
    applyViewBox(newX, newY, newW, newH);
    document.getElementById('zoomLabel').textContent =
      Math.round(newZoom * 100) + '%';
    if (state.heatmap) drawHeatmap();
  }

  /* ============================================================
     СЛОИ (чекбоксы)
     ============================================================ */

  document.getElementById('chkLayerWalls').addEventListener('change', function () {
    L.layerWalls.style.display = this.checked ? '' : 'none';
  });
  document.getElementById('chkLayerFurniture').addEventListener('change', function () {
    L.layerFurniture.style.display = this.checked ? '' : 'none';
  });
  document.getElementById('chkLayerDevices').addEventListener('change', function () {
    L.layerDevices.style.display = this.checked ? '' : 'none';
    L.layerIoT.style.display     = this.checked ? '' : 'none';
  });
  document.getElementById('chkLayerCoverage').addEventListener('change', function () {
    L.layerCoverage.style.display = this.checked ? '' : 'none';
    heatmapCanvas.style.display =
      this.checked && state.heatmap ? 'block' : 'none';
  });
  document.getElementById('chkLayerCables').addEventListener('change', renderCables);

  document.getElementById('toggleSnap').addEventListener('click', function () {
    state.snap = !state.snap;
    this.textContent = state.snap ? 'Выкл. сетку' : 'Вкл. сетку';
    document.getElementById('snapStatus').textContent =
      state.snap ? 'Сетка: 0.5 м' : 'Сетка: выкл';
  });

  /* ============================================================
     КНОПКИ ТЕПЛОВЫХ КАРТ
     ============================================================ */

  document.getElementById('btnRssi').addEventListener('click', () => calcHeatmap('rssi'));
  document.getElementById('btnSnr').addEventListener('click',  () => calcHeatmap('snr'));

  /* ============================================================
     ПРАВАЯ ПАНЕЛЬ: СВОЙСТВА
     ============================================================ */

  function renderProps() {
    if (!propsPanel) return;

    if (state.multiSelected.length > 1) {
      propsPanel.innerHTML =
        '<div class="props-empty">' +
          '<div class="props-empty-icon">🎯</div>' +
          '<div>Выделено <b>' + state.multiSelected.length + '</b> объектов</div>' +
        '</div>';
      return;
    }

    if (!state.selected) {
      propsPanel.innerHTML =
        '<div class="props-empty">' +
          '<div class="props-empty-icon">🎨</div>' +
          '<div>Выберите объект на чертеже</div>' +
        '</div>';
      return;
    }

    if (state.selected.kind === 'ap')      return propsAP();
    if (state.selected.kind === 'device')  return propsDevice();
    if (state.selected.kind === 'element') return propsElement();
    if (state.selected.kind === 'switch')  return propsSwitch();
  }

  function propsAP() {
    const ap = state.aps.find(x => x.id === state.selected.id);
    if (!ap) return;

    propsPanel.innerHTML =
      '<div class="props-header">' +
        '<div class="icon">📡</div>' +
        '<div>' +
          '<div class="title">' + esc(ap.name) + '</div>' +
          '<div class="subtitle">Точка доступа</div>' +
        '</div>' +
      '</div>' +

      '<div class="props-section"><h4>Параметры</h4>' +
        '<div class="props-row"><label>Имя</label>' +
          '<input id="p_name" value="' + esc(ap.name) + '"></div>' +
        '<div class="props-row"><label>Модель</label>' +
          '<select id="p_model"><option value="">— загрузка —</option></select></div>' +
        '<div class="props-row"><label>Мощность, dBm</label>' +
          '<input id="p_tx" type="number" value="' + ap.power + '" min="5" max="30"></div>' +
        '<div class="props-row"><label>Усиление, dBi</label>' +
          '<input id="p_gain" type="number" value="' + ap.gain + '" min="0" max="15"></div>' +
        '<div class="props-row"><label>Частота</label>' +
          '<select id="p_freq">' +
            '<option value="2400"' + (ap.freq === 2400 ? ' selected' : '') + '>2.4 ГГц</option>' +
            '<option value="5000"' + (ap.freq === 5000 ? ' selected' : '') + '>5 ГГц</option>' +
            '<option value="6000"' + (ap.freq === 6000 ? ' selected' : '') + '>6 ГГц</option>' +
          '</select></div>' +
        '<div class="props-row"><label>Канал</label>' +
          '<input id="p_ch" type="number" value="' + ap.channel + '"></div>' +
      '</div>' +

      '<div class="props-section">' +
        '<button class="btn-block" id="delBtn">🗑 Удалить</button>' +
      '</div>';

    // Загрузка каталога моделей AP
    Api.listApModels().then(models => {
      const sel = document.getElementById('p_model');
      if (!sel) return;
      sel.innerHTML = '<option value="">— выбрать —</option>';
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.model;
        opt.textContent = m.vendor + ' ' + m.model;
        if (ap.model === m.model) opt.selected = true;
        opt.dataset.power = m.tx_power_dbm;
        opt.dataset.gain = m.antenna_gain;
        opt.dataset.band = m.band;
        sel.appendChild(opt);
      });

      sel.addEventListener('change', () => {
        const opt = sel.options[sel.selectedIndex];
        if (!opt || !opt.dataset.power) return;
        ap.model = opt.value;
        ap.power = parseFloat(opt.dataset.power) || ap.power;
        ap.gain  = parseFloat(opt.dataset.gain) || ap.gain;
        // Автоматически подставить band
        if (opt.dataset.band.includes('5')) ap.freq = 5000;
        else if (opt.dataset.band.includes('2.4')) ap.freq = 2400;
        saveAP();
        render();
        if (state.heatmap) recalcHeatmap();
        renderProps();
      });
    }).catch(() => {});

    ['p_name', 'p_tx', 'p_gain', 'p_freq', 'p_ch'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        ap.name   = document.getElementById('p_name').value;
        ap.power  = parseFloat(document.getElementById('p_tx').value) || 20;
        ap.gain   = parseFloat(document.getElementById('p_gain').value) || 5;
        ap.freq   = parseInt(document.getElementById('p_freq').value, 10);
        ap.channel = parseInt(document.getElementById('p_ch').value, 10) || 6;
        saveAP();
        render();
        if (state.heatmap) recalcHeatmap();
      });
    });

    document.getElementById('delBtn').addEventListener('click', () => {
      Api.deleteAP(ap.id).catch(() => {});
      state.aps = state.aps.filter(x => x.id !== ap.id);
      state.selected = null;
      if (state.heatmap) recalcHeatmap();
      render(); renderProps();
    });

    function saveAP() {
      Api.updateAP(ap.id, {
        name: ap.name,
        model: ap.model || 'Generic AP',
        x: ap.x, y: ap.y,
        tx_power_dbm: ap.power,
        antenna_gain: ap.gain,
        band: ap.freq === 2400 ? '2.4' : ap.freq === 6000 ? '6' : '5',
        channel: ap.channel,
        ssid_type: 'corporate'
      }).catch(err => console.error('save ap:', err));
    }
  }

  function propsSwitch() {
    const sw = state.switches.find(x => x.id === state.selected.id);
    if (!sw) return;

    propsPanel.innerHTML =
      '<div class="props-header">' +
        '<div class="icon">🔀</div>' +
        '<div>' +
          '<div class="title">' + esc(sw.name) + '</div>' +
          '<div class="subtitle">PoE-коммутатор</div>' +
        '</div>' +
      '</div>' +

      '<div class="props-section"><h4>Параметры</h4>' +
        '<div class="props-row"><label>Имя</label>' +
          '<input id="s_name" value="' + esc(sw.name) + '"></div>' +
        '<div class="props-row"><label>Портов</label>' +
          '<input id="s_ports" type="number" value="' + sw.totalPorts + '"></div>' +
        '<div class="props-row"><label>PoE, Вт</label>' +
          '<input id="s_poe" type="number" value="' + sw.poeBudget + '"></div>' +
      '</div>' +

      '<div class="props-section">' +
        '<button class="btn-block" id="delBtn">🗑 Удалить</button>' +
      '</div>';

    ['s_name', 's_ports', 's_poe'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        sw.name      = document.getElementById('s_name').value;
        sw.totalPorts = parseInt(document.getElementById('s_ports').value, 10) || 24;
        sw.poeBudget  = parseFloat(document.getElementById('s_poe').value) || 370;

        Api.updateSwitch(sw.id, {
          name: sw.name,
          model: sw.model || 'PoE Switch',
          x: sw.x, y: sw.y,
          total_ports: sw.totalPorts,
          poe_ports: sw.totalPorts,
          total_power_budget_w: sw.poeBudget
        }).catch(err => console.error('save switch:', err));

        render();
      });
    });

    document.getElementById('delBtn').addEventListener('click', () => {
      Api.deleteSwitch(sw.id).catch(() => {});
      state.switches = state.switches.filter(x => x.id !== sw.id);
      state.selected = null;
      render(); renderProps();
    });
  }

  function propsDevice() {
    const d = state.devices.find(x => x.id === state.selected.id);
    if (!d) return;

    let linkInfo = '';
    if (WIRELESS_TYPES.includes(d.type) && state.aps.length) {
      let best = null, bd = Infinity;
      for (const ap of state.aps) {
        const dist = Math.hypot(d.x - ap.x, d.y - ap.y);
        if (dist < bd) { bd = dist; best = ap; }
      }
      if (best) {
        const rssi = -30 - 20 * Math.log10(Math.max(bd, 0.5));
        linkInfo =
          '<div class="props-section"><h4>Подключение</h4>' +
            '<div class="props-row"><label>AP</label><span>' + esc(best.name) + '</span></div>' +
            '<div class="props-row"><label>Расстояние</label><span>' + bd.toFixed(1) + ' м</span></div>' +
            '<div class="props-row"><label>~RSSI</label><span>' + rssi.toFixed(0) + ' dBm</span></div>' +
          '</div>';
      }
    }

    propsPanel.innerHTML =
      '<div class="props-header">' +
        '<div class="icon">💻</div>' +
        '<div>' +
          '<div class="title">' + esc(d.name) + '</div>' +
          '<div class="subtitle">' + d.type + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="props-section">' +
        '<div class="props-row"><label>Имя</label>' +
          '<input id="d_name" value="' + esc(d.name) + '"></div>' +
      '</div>' +

      linkInfo +

      '<div class="props-section">' +
        '<button class="btn-block" id="delBtn">🗑 Удалить</button>' +
      '</div>';

    document.getElementById('d_name').addEventListener('change', () => {
      d.name = document.getElementById('d_name').value;
      Api.updateDevice(d.id, {
        name: d.name, type: d.type, x: d.x, y: d.y,
        band: d.band || '5',
        required_rssi: d.required_rssi || -65,
        required_speed: d.required_speed || 10,
        ssid_type: d.ssid_type || 'corporate'
      }).catch(err => console.error('save device:', err));
      render();
    });

    document.getElementById('delBtn').addEventListener('click', () => {
      Api.deleteDevice(d.id).catch(() => {});
      state.devices = state.devices.filter(x => x.id !== d.id);
      state.selected = null;
      render(); renderProps();
    });
  }

  function propsElement() {
    const el = state.elements.find(x => x.id === state.selected.id);
    if (!el) return;

    /* --- Стена --- */
    if (el.type === 'wall') {
      const mat = el.material || 'concrete';
      const lenM = Math.hypot(el.x2 - el.x1, el.y2 - el.y1).toFixed(2);

      propsPanel.innerHTML =
        '<div class="props-header">' +
          '<div class="icon">🧱</div>' +
          '<div>' +
            '<div class="title">Стена</div>' +
            '<div class="subtitle">' + MATERIALS[mat].name + ' · ' + lenM + ' м</div>' +
          '</div>' +
        '</div>' +

        '<div class="props-section"><h4>Материал</h4>' +
          '<div class="props-row"><select id="e_mat">' +
            Object.keys(MATERIALS).map(k =>
              '<option value="' + k + '"' + (mat === k ? ' selected' : '') + '>' +
              MATERIALS[k].name + ' (' + MATERIALS[k].loss + ' дБ)</option>'
            ).join('') +
          '</select></div>' +
        '</div>' +

        '<div class="props-section"><h4>Координаты, м</h4>' +
          '<div class="props-row"><label>X1</label>' +
            '<input id="w_x1" type="number" step="0.5" value="' + el.x1 + '"></div>' +
          '<div class="props-row"><label>Y1</label>' +
            '<input id="w_y1" type="number" step="0.5" value="' + el.y1 + '"></div>' +
          '<div class="props-row"><label>X2</label>' +
            '<input id="w_x2" type="number" step="0.5" value="' + el.x2 + '"></div>' +
          '<div class="props-row"><label>Y2</label>' +
            '<input id="w_y2" type="number" step="0.5" value="' + el.y2 + '"></div>' +
        '</div>' +

        '<div class="props-section">' +
          '<button class="btn-block" id="delBtn">🗑 Удалить</button>' +
        '</div>';

      document.getElementById('e_mat').addEventListener('change', e => {
        el.material = e.target.value;
        saveWall();
        render(); renderProps();
      });

      ['w_x1', 'w_y1', 'w_x2', 'w_y2'].forEach((id, i) => {
        const inp = document.getElementById(id);
        inp.addEventListener('change', () => {
          const v = parseFloat(inp.value);
          if (isNaN(v)) return;
          if (i === 0) el.x1 = v;
          if (i === 1) el.y1 = v;
          if (i === 2) el.x2 = v;
          if (i === 3) el.y2 = v;
          saveWall();
          render();
        });
      });

      document.getElementById('delBtn').addEventListener('click', () => {
        Api.deleteElement(el.id).catch(() => {});
        state.elements = state.elements.filter(x => x.id !== el.id);
        state.selected = null;
        if (state.heatmap) recalcHeatmap();
        render(); renderProps();
      });

      function saveWall() {
        Api.updateElement(el.id, {
          type: 'wall', material: el.material,
          x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2
        }).catch(err => console.error('save wall:', err));
        if (state.heatmap) recalcHeatmap();
      }
      return;
    }

    /* --- Фигура / Мебель / Текст --- */
    if (el.type === 'shape' || el.type === 'furniture' || el.type === 'text') {
      const icon = el.type === 'text' ? '🅰' : (el.type === 'furniture' ? '📦' : '⬛');
      const title = el.type === 'text' ? 'Текст'
                  : el.type === 'furniture' ? 'Мебель'
                  : 'Фигура';

      propsPanel.innerHTML =
        '<div class="props-header">' +
          '<div class="icon">' + icon + '</div>' +
          '<div>' +
            '<div class="title">' + title + '</div>' +
            '<div class="subtitle">' + (el.subtype || '') + '</div>' +
          '</div>' +
        '</div>' +

        (el.type === 'text' ?
          '<div class="props-section"><div class="props-row">' +
            '<label>Текст</label>' +
            '<input id="t_name" value="' + esc(el.name || '') + '"></div></div>'
          : '') +

        (el.type === 'shape' || el.type === 'furniture' ?
          '<div class="props-section"><h4>Размер, м</h4>' +
            '<div class="props-row"><label>Ширина</label>' +
              '<input id="e_w" type="number" step="0.5" value="' +
              (el.width || 1.5) + '"></div>' +
            '<div class="props-row"><label>Высота</label>' +
              '<input id="e_h" type="number" step="0.5" value="' +
              (el.height || 1) + '"></div>' +
          '</div>'
          : '') +

        '<div class="props-section">' +
          '<button class="btn-block" id="delBtn">🗑 Удалить</button>' +
        '</div>';

      if (el.type === 'text') {
        document.getElementById('t_name').addEventListener('change', () => {
          el.name = document.getElementById('t_name').value;
          Api.updateElement(el.id, {
            type: 'text', name: el.name, x: el.x, y: el.y
          }).catch(err => console.error('save text:', err));
          render();
        });
      } else {
        ['e_w', 'e_h'].forEach((id, i) => {
          const inp = document.getElementById(id);
          inp.addEventListener('change', () => {
            const v = parseFloat(inp.value);
            if (isNaN(v)) return;
            if (i === 0) el.width  = v;
            if (i === 1) el.height = v;

            if (el.type === 'furniture') {
              Api.updateElement(el.id, {
                type: 'furniture', subtype: el.subtype,
                x: el.x, y: el.y,
                width: el.width, height: el.height,
                rotation: el.rotation || 0
              }).catch(err => console.error('save furniture:', err));
            } else {
              Api.updateElement(el.id, {
                type: 'shape', subtype: el.subtype,
                material: el.material || 'brick',
                x: el.x, y: el.y,
                width: el.width, height: el.height
              }).catch(err => console.error('save shape:', err));
            }
            render();
          });
        });
      }

      document.getElementById('delBtn').addEventListener('click', () => {
        Api.deleteElement(el.id).catch(() => {});
        state.elements = state.elements.filter(x => x.id !== el.id);
        state.selected = null;
        render(); renderProps();
      });
    }
  }

  /* ============================================================
     ВКЛАДКИ ЛЕГЕНДЫ
     ============================================================ */

  document.querySelectorAll('.legend-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.legend-tab').forEach(x => x.classList.remove('active'));
      tab.classList.add('active');
      const isProps = tab.dataset.tab === 'props';
      document.getElementById('propsPanel').style.display  = isProps ? '' : 'none';
      document.getElementById('legendPanel').style.display = isProps ? 'none' : '';
    });
  });

  /* ============================================================
     МОДАЛКИ
     ============================================================ */

  /* ---- Новый проект ---- */
  document.getElementById('newProjectBtn').addEventListener('click', () => {
    document.getElementById('modalMask').classList.add('show');
  });
  document.getElementById('npCancel').addEventListener('click', () => {
    document.getElementById('modalMask').classList.remove('show');
  });
  document.getElementById('npCreate').addEventListener('click', () => {
    const name = document.getElementById('npName').value || 'Проект';
    const W = parseFloat(document.getElementById('npWidth').value) || 20;
    const H = parseFloat(document.getElementById('npHeight').value) || 30;
    const Hv = parseFloat(document.getElementById('npRoomH').value) || 3;
    const material = document.getElementById('npMaterial').value || 'concrete';

    Api.createProject({ name, width_m: W, height_m: H }).then(p => {
      // Автоматически создаём 4 стены по периметру
      const walls = [
        { type: 'wall', material, x1: 0, y1: 0, x2: W, y2: 0 },
        { type: 'wall', material, x1: W, y1: 0, x2: W, y2: H },
        { type: 'wall', material, x1: W, y1: H, x2: 0, y2: H },
        { type: 'wall', material, x1: 0, y1: H, x2: 0, y2: 0 }
      ];
      Promise.all(walls.map(w => Api.createElement(p.id, w).catch(() => null)))
        .then(() => {
          document.getElementById('modalMask').classList.remove('show');
          loadProjectData(p.id).then(() => {
            state.project.height_v = Hv;
          });
        });
    }).catch(err => {
      alert('Ошибка: ' + err.message);
    });
  });

  /* ---- Статистика ---- */
  document.getElementById('btnStats').addEventListener('click', () => {
    if (!state.heatmap) return alert('Сначала рассчитайте покрытие (🌊)');
    const s = state.heatmap.stats;

    document.getElementById('statsBody').innerHTML =
      '<div class="prop-block"><h4>Средний сигнал</h4>' +
        '<div style="font-size:22px;font-weight:600">' +
          s.avg.toFixed(1) + ' dBm</div>' +
        '<div style="font-size:11px;opacity:.7">min ' +
          s.min.toFixed(1) + ' / max ' + s.max.toFixed(1) + '</div>' +
      '</div>' +

      '<div class="prop-block"><h4>Распределение</h4>' +
        '<div class="stats-row"><span style="color:#4caf50">Отлично ≥ −65</span>' +
          '<span>' + s.excPct.toFixed(1) + '%</span></div>' +
        '<div class="stats-row"><span style="color:#ffc107">Хорошо −65…−75</span>' +
          '<span>' + s.goodPct.toFixed(1) + '%</span></div>' +
        '<div class="stats-row"><span style="color:#ff9800">Слабо −75…−85</span>' +
          '<span>' + s.weakPct.toFixed(1) + '%</span></div>' +
        '<div class="stats-row"><span style="color:#f44336">Мёртвая зона &lt; −85</span>' +
          '<span>' + s.deadPct.toFixed(1) + '%</span></div>' +
      '</div>' +

      (s.deadZones.length ?
        '<div class="prop-block"><h4>Мёртвых зон: ' + s.deadZones.length + '</h4>' +
          '<div style="font-size:11px;opacity:.7;max-height:140px;overflow:auto">' +
            s.deadZones.slice(0, 15).map(z =>
              '(' + z.x.toFixed(1) + ', ' + z.y.toFixed(1) + ') → ' +
              z.dbm.toFixed(1) + ' dBm'
            ).join('<br>') +
          '</div>' +
        '</div>'
        : '');

    document.getElementById('statsModal').classList.add('show');
  });
  document.getElementById('statsClose').addEventListener('click', () => {
    document.getElementById('statsModal').classList.remove('show');
  });

  /* ---- Спецификация ---- */
  document.getElementById('btnSpec').addEventListener('click', () => {
    if (!state.project) return alert('Создайте проект');

    const totalCable = state.aps.reduce((sum, ap) => {
      let best = Infinity;
      state.switches.forEach(sw => {
        best = Math.min(best, Math.hypot(ap.x - sw.x, ap.y - sw.y) * CABLE_COEF);
      });
      return sum + (isFinite(best) ? best : 0);
    }, 0);

    document.getElementById('specBody').innerHTML =
      '<p>Проект: <b>' + esc(state.project.name) + '</b> · Площадь: ' +
        (state.project.width_m * state.project.height_m).toFixed(1) + ' м²</p>' +

      '<table style="width:100%;font-size:12px;border-collapse:collapse;margin-top:10px">' +
        '<tr style="background:var(--panel-2)">' +
          '<th style="text-align:left;padding:6px">Категория</th>' +
          '<th style="text-align:left">Наименование</th>' +
          '<th>Кол-во</th><th>Ед.</th>' +
        '</tr>' +
        '<tr><td style="padding:6px">Точка доступа Wi-Fi</td>' +
          '<td>Generic AP</td>' +
          '<td style="text-align:center">' + state.aps.length + '</td><td>шт</td></tr>' +
        '<tr><td style="padding:6px">Коммутационное оборудование</td>' +
          '<td>PoE-коммутатор</td>' +
          '<td style="text-align:center">' + state.switches.length + '</td><td>шт</td></tr>' +
        '<tr><td style="padding:6px">Кабельная инфраструктура</td>' +
          '<td>Кабель Cat5e UTP</td>' +
          '<td style="text-align:center">' + totalCable.toFixed(1) + '</td><td>м</td></tr>' +
        '<tr><td style="padding:6px">Клиентские устройства</td>' +
          '<td>ПК, ноутбуки, IoT</td>' +
          '<td style="text-align:center">' + state.devices.length + '</td><td>шт</td></tr>' +
      '</table>';

    document.getElementById('specModal').classList.add('show');
  });
  document.getElementById('specClose').addEventListener('click', () => {
    document.getElementById('specModal').classList.remove('show');
  });

  /* ---- PoE ---- */
  document.getElementById('btnPoe').addEventListener('click', () => {
    if (!state.project) return alert('Создайте проект');

    const budget = state.switches.reduce((s, sw) => s + sw.poeBudget, 0);
    const ports  = state.switches.reduce((s, sw) => s + sw.totalPorts, 0);
    const need   = state.aps.reduce((s, ap) =>
      s + (POE[ap.band === '2.4' ? '2.4' : ap.band === '6' ? '6' : '5'] || 15.5), 0);

    const warnings = [];
    if (!state.switches.length) {
      warnings.push({ t: 'error', m: 'Коммутаторы не добавлены' });
    } else {
      if (need > budget) {
        warnings.push({ t: 'error',
          m: 'Превышен PoE-бюджет: нужно ' + need.toFixed(1) +
             ' Вт, доступно ' + budget + ' Вт' });
      } else if (need > budget * 0.8) {
        warnings.push({ t: 'warning',
          m: 'PoE-бюджет загружен на ' +
             (need / budget * 100).toFixed(0) + '%' });
      } else {
        warnings.push({ t: 'ok',
          m: 'PoE-бюджет: ' + need.toFixed(1) + ' Вт из ' + budget + ' Вт' });
      }
      if (state.aps.length > ports) {
        warnings.push({ t: 'error',
          m: 'Недостаточно портов: ' + state.aps.length +
             ' AP, доступно ' + ports });
      }
    }

    const cm = { error: '#f44336', warning: '#ff9800', ok: '#4caf50' };
    document.getElementById('poeBody').innerHTML =
      '<p>Коммутаторов: <b>' + state.switches.length + '</b> · AP: <b>' +
        state.aps.length + '</b></p>' +
      '<p>Общий бюджет: <b>' + budget + ' Вт</b> · Потребление: <b>' +
        need.toFixed(1) + ' Вт</b></p>' +
      '<p>Портов: <b>' + ports + '</b></p>' +
      '<hr style="border-color:var(--border);margin:12px 0">' +
      warnings.map(w =>
        '<div style="padding:8px 12px;border-left:3px solid ' + cm[w.t] +
        ';margin-bottom:6px;background:var(--panel-2);border-radius:3px">' +
        w.m + '</div>'
      ).join('');

    document.getElementById('poeModal').classList.add('show');
  });
  document.getElementById('poeClose').addEventListener('click', () => {
    document.getElementById('poeModal').classList.remove('show');
  });

  /* ============================================================
     ЭКСПОРТ PNG И CSV
     ============================================================ */

  document.getElementById('btnSave').addEventListener('click', exportPNG);
  document.getElementById('btnCsv').addEventListener('click',  exportCSV);

  function exportPNG() {
    if (!state.project) return alert('Создайте проект');

    L.layerSelection.style.display = 'none';
    L.layerDraft.innerHTML = '';

    const W = state.project.width_m  * PX_PER_M + 120;
    const H = state.project.height_m * PX_PER_M + 120;

    const clone = svg.cloneNode(true);
    clone.setAttribute('width', W);
    clone.setAttribute('height', H);
    clone.setAttribute('viewBox', '-60 -60 ' + W + ' ' + H);
    clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const str = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d');

      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--canvas').trim() || '#1a1a1a';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);

      if (state.heatmap && heatmapCanvas.style.display !== 'none') {
        ctx.globalAlpha = 0.75;
        ctx.drawImage(heatmapCanvas, 60, 60);
        ctx.globalAlpha = 1;
      }

      URL.revokeObjectURL(url);

      const a = document.createElement('a');
      a.download = (state.project.name || 'plan') + '.png';
      a.href = c.toDataURL('image/png');
      a.click();

      L.layerSelection.style.display = '';
    };
    img.src = url;
  }

  function exportCSV() {
    if (!state.project) return alert('Создайте проект');

    const lines = ['# Тип;Имя;X (м);Y (м);Примечание'];
    state.aps.forEach(a => lines.push(
      'AP;' + a.name + ';' + a.x + ';' + a.y +
      ';power=' + a.power + 'dBm freq=' + a.freq));
    state.switches.forEach(s => lines.push(
      'Switch;' + s.name + ';' + s.x + ';' + s.y +
      ';ports=' + s.totalPorts + ' poe=' + s.poeBudget + 'W'));
    state.devices.forEach(d => lines.push(
      'Device;' + d.name + ';' + d.x + ';' + d.y + ';type=' + d.type));
    state.elements.filter(e => e.type === 'wall').forEach((w, i) => {
      lines.push('Wall;#' + (i + 1) + ';' +
        w.x1 + ',' + w.y1 + ';' +
        w.x2 + ',' + w.y2 + ';material=' + w.material);
    });

    if (state.heatmap) {
      lines.push('');
      lines.push('# Статистика покрытия');
      const s = state.heatmap.stats;
      lines.push('avg_dbm;'  + s.avg.toFixed(1));
      lines.push('min_dbm;'  + s.min.toFixed(1));
      lines.push('max_dbm;'  + s.max.toFixed(1));
      lines.push('dead_pct;' + s.deadPct.toFixed(1));
      lines.push('');
      lines.push('# Мёртвые зоны (первые 50)');
      lines.push('x_m;y_m;rssi_dbm');
      s.deadZones.slice(0, 50).forEach(z =>
        lines.push(z.x.toFixed(2) + ';' + z.y.toFixed(2) + ';' +
                   z.dbm.toFixed(1)));
    }

    const csv = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.project.name || 'plan') + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ============================================================
     API-МАППИНГ: серверные модели ↔ локальные
     ============================================================ */

  function apiToLocalElement(e) {
    return {
      id: e.id,
      type: e.type,
      material: e.material,
      subtype: e.subtype,
      x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2,
      x: e.x, y: e.y,
      name: e.name,
      points_json: e.points_json,
      width: e.width, height: e.height,
      rotation: e.rotation
    };
  }

  function apiToLocalAP(a) {
    return {
      id: a.id,
      name: a.name,
      model: a.model,
      x: a.x, y: a.y,
      power: a.tx_power_dbm != null ? a.tx_power_dbm : 20,
      gain: a.antenna_gain != null ? a.antenna_gain : 5,
      freq: a.band === '2.4' ? 2400 : (a.band === '6' ? 6000 : 5000),
      band: a.band,
      channel: a.channel
    };
  }

  function apiToLocalDevice(d) {
    return {
      id: d.id,
      name: d.name,
      type: d.type,
      x: d.x, y: d.y,
      band: d.band,
      required_rssi: d.required_rssi,
      required_speed: d.required_speed,
      ssid_type: d.ssid_type
    };
  }

  function apiToLocalSwitch(s) {
    return {
      id: s.id,
      name: s.name,
      model: s.model,
      x: s.x, y: s.y,
      totalPorts: s.total_ports != null ? s.total_ports : 24,
      poeBudget: s.total_power_budget_w != null ? s.total_power_budget_w : 370
    };
  }

  function objectToApiPayload(kind, o) {
    if (kind === 'ap') {
      return {
        name: o.name,
        model: o.model || 'Generic AP',
        x: o.x, y: o.y,
        tx_power_dbm: o.power,
        antenna_gain: o.gain,
        band: o.freq === 2400 ? '2.4' : o.freq === 6000 ? '6' : '5',
        channel: o.channel,
        ssid_type: 'corporate'
      };
    }
    if (kind === 'device') {
      return {
        name: o.name, type: o.type, x: o.x, y: o.y,
        band: o.band || '5',
        required_rssi: o.required_rssi || -65,
        required_speed: o.required_speed || 10,
        ssid_type: o.ssid_type || 'corporate'
      };
    }
    if (kind === 'switch') {
      return {
        name: o.name, model: o.model || 'PoE Switch',
        x: o.x, y: o.y,
        total_ports: o.totalPorts,
        poe_ports: o.totalPorts,
        total_power_budget_w: o.poeBudget
      };
    }
    if (kind === 'element') {
      if (o.type === 'wall') {
        return {
          type: 'wall', material: o.material,
          x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2
        };
      }
      if (o.type === 'furniture') {
        return {
          type: 'furniture', subtype: o.subtype,
          x: o.x, y: o.y, width: o.width, height: o.height,
          rotation: o.rotation || 0
        };
      }
      if (o.type === 'text') {
        return { type: 'text', name: o.name, x: o.x, y: o.y };
      }
      if (o.type === 'shape') {
        return {
          type: 'shape', subtype: o.subtype,
          material: o.material, x: o.x, y: o.y,
          width: o.width, height: o.height
        };
      }
    }
    return null;
  }

  /* ============================================================
     ЗАГРУЗКА ПРОЕКТА С СЕРВЕРА
     ============================================================ */

  function loadProjectData(projectId) {
    state.loading = true;

    return Api.getProject(projectId).then(p => {
      state.projectId = p.id;
      state.project = {
        name: p.name,
        width_m: p.width_m,
        height_m: p.height_m,
        height_v: state.project ? state.project.height_v || 3 : 3
      };

      return Promise.all([
        Api.listElements(projectId).catch(() => []),
        Api.listAPs(projectId).catch(() => []),
        Api.listDevices(projectId).catch(() => []),
        Api.listSwitches(projectId).catch(() => [])
      ]);
    }).then(([elements, aps, devices, switches]) => {
      state.elements = (elements || []).map(apiToLocalElement);
      state.aps      = (aps || []).map(apiToLocalAP);
      state.devices  = (devices || []).map(apiToLocalDevice);
      state.switches = (switches || []).map(apiToLocalSwitch);

      // Счётчики для автоименования — берём максимум из существующих
      state.apCnt  = state.aps.length;
      state.swCnt  = state.switches.length;
      state.devCnt = state.devices.length;

      // Максимальный id + 1
      const allIds = [
        ...state.elements.map(x => x.id || 0),
        ...state.aps.map(x => x.id || 0),
        ...state.devices.map(x => x.id || 0),
        ...state.switches.map(x => x.id || 0)
      ];
      state.idSeq = Math.max(1, ...allIds) + 1;

      // Сбросить историю и выделение
      state.history = [];
      state.redoStack = [];
      state.selected = null;
      state.multiSelected = [];
      state.heatmap = null;

      // ViewBox с отступами
      applyViewBox(-60, -60,
        state.project.width_m * PX_PER_M + 120,
        state.project.height_m * PX_PER_M + 120);

      document.getElementById('zoomLabel').textContent = '100%';
      state.zoom = 1;

      canvasHint.textContent = state.project.name + ' · ' +
        state.project.width_m + '×' + state.project.height_m + ' м';

      render();
      renderProps();
      state.loading = false;
    }).catch(err => {
      console.error('loadProjectData:', err);
      state.loading = false;
      throw err;
    });
  }

  /* ============================================================
     ВЫБОР ПРОЕКТА ПРИ СТАРТЕ
     ============================================================ */

  function init() {
    buildPalette();
    renderLegendIcons();

    // Пробуем загрузить список проектов
    Api.listProjects().then(list => {
      if (list && list.length) {
        // Загружаем самый свежий
        const p = list[0];
        loadProjectData(p.id);
      } else {
        // Нет проектов — предложить создать
        canvasHint.textContent = 'Проектов нет. Нажмите «+ Новый проект».';
      }
    }).catch(err => {
      console.error('init:', err);
      canvasHint.textContent = 'Ошибка загрузки. Проверьте, что сервер запущен.';
    });
  }

  /* ============================================================
     РЕСАЙЗ ОКНА
     ============================================================ */

  window.addEventListener('resize', () => {
    if (state.heatmap) drawHeatmap();
  });

  /* ============================================================
     СТАРТ
     ============================================================ */

  init();
  console.log('[editor.js] загружен');

})();