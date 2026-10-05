/* ============================================================
   CoworkWiFi Planner — редактор
   Логика: FSPL + стены, тепловая карта, pan/zoom, drag/resize
   Синхронизация: EditorAPI (FastAPI backend)
   ============================================================ */
(function () {
  'use strict';

  // ============================================================
  // КОНСТАНТЫ
  // ============================================================
  const PX_PER_M = 40;
  const SNAP_M = 0.5;
  const CABLE_LIMIT_M = 100;
  const CABLE_COEF = 1.1;
  const POE = { '2.4': 12.5, '5': 15.5, '6': 18.0 };
// Планы каналов для разноса (без перекрытия)
const CHANNEL_PLANS = {
  2400: [1, 6, 11],
  5000: [36, 44, 149, 157],
  6000: [1, 5, 9, 13, 17, 21, 25, 29],
};
const MAX_AUTO_APS = 16;      // защита от бесконечного цикла
const AUTO_TARGET_DEFAULT = 95;
  const MATERIALS = {
    brick:    { name:'Кирпич',      loss: 15, pattern:'pat-brick',    width: 7 },
    concrete: { name:'Бетон',       loss: 25, pattern:'pat-concrete', width: 8 },
    drywall:  { name:'Гипсокартон', loss: 4,  pattern:'pat-drywall',  width: 3 },
    wood:     { name:'Дерево',      loss: 6,  pattern:'pat-wood',     width: 6 },
    glass:    { name:'Стекло',      loss: 3,  pattern:'pat-glass',    width: 5 }
  };
// Параметры двери
const DOOR_CONFIG = {
  width_m: 0.9,          // стандартная ширина двери
  loss: 2,               // затухание двери (дБ) — как открытая стена
  swing_deg: 90,         // угол открывания
  side: 'right',         // какая сторона открывания: 'left' | 'right'
  inward: true,          // внутрь помещения или наружу
  color: '#8B4513',      // цвет полотна двери
  frame_color: '#5d3a1a' // цвет коробки
};
  // ============================================================
  // SVG-ИКОНКИ
  // ============================================================
  const SVG_START = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const ICONS = {
    ap: '<svg ' + SVG_START + '><circle cx="16" cy="16" r="2" fill="currentColor" stroke="none"/><path d="M 11 11 a7 7 0 0 1 10 0"/><path d="M 8 8 a11 11 0 0 1 16 0"/><path d="M 13 13.5 a4 4 0 0 1 6 0"/></svg>',
    switch: '<svg ' + SVG_START + '><rect x="2" y="9" width="28" height="14" rx="2" fill="#2E5EAA" stroke="#1E4080"/><path d="M 8 18 L 8 13 M 6 15 L 8 13 L 10 15" stroke="#fff"/><path d="M 13 13 L 13 18 M 11 16 L 13 18 L 15 16" stroke="#fff"/><circle cx="20" cy="16" r="1" fill="#fff" stroke="none"/><circle cx="24" cy="16" r="1" fill="#fff" stroke="none"/></svg>',
    router: '<svg ' + SVG_START + '><rect x="4" y="14" width="24" height="10" rx="2" fill="#fff"/><line x1="8" y1="14" x2="8" y2="6"/><line x1="16" y1="14" x2="16" y2="6"/><line x1="24" y1="14" x2="24" y2="6"/><circle cx="8" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="24" cy="6" r="1" fill="currentColor" stroke="none"/></svg>',
    patch: '<svg ' + SVG_START + '><rect x="3" y="12" width="26" height="8" rx="1" fill="#ddd"/><rect x="5" y="14" width="2" height="4" fill="#2E5EAA" stroke="none"/><rect x="9" y="14" width="2" height="4" fill="#2E5EAA" stroke="none"/><rect x="13" y="14" width="2" height="4" fill="#2E5EAA" stroke="none"/><rect x="17" y="14" width="2" height="4" fill="#2E5EAA" stroke="none"/></svg>',
    wlc: '<svg ' + SVG_START + '><rect x="6" y="4" width="20" height="24" rx="2" fill="#fff"/><line x1="6" y1="12" x2="26" y2="12"/><line x1="6" y1="20" x2="26" y2="20"/><circle cx="10" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="16" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="24" r="1" fill="currentColor" stroke="none"/></svg>',
    wall_brick: '<svg ' + SVG_START + '><rect x="2" y="9" width="28" height="14" fill="#B85C38" stroke="#8a3f22"/><line x1="2" y1="14" x2="30" y2="14" stroke="#8a3f22"/><line x1="2" y1="19" x2="30" y2="19" stroke="#8a3f22"/><line x1="10" y1="9" x2="10" y2="14" stroke="#8a3f22"/><line x1="21" y1="9" x2="21" y2="14" stroke="#8a3f22"/></svg>',
    wall_wood: '<svg ' + SVG_START + '><rect x="2" y="9" width="28" height="14" fill="#A0522D" stroke="#7a3a20"/><line x1="7" y1="9" x2="7" y2="23" stroke="#7a3a20"/><line x1="12" y1="9" x2="12" y2="23" stroke="#7a3a20"/><line x1="17" y1="9" x2="17" y2="23" stroke="#7a3a20"/><line x1="22" y1="9" x2="22" y2="23" stroke="#7a3a20"/></svg>',
    wall_glass: '<svg ' + SVG_START + '><rect x="2" y="10" width="28" height="12" fill="#A8D8EA" fill-opacity="0.4"/><line x1="2" y1="10" x2="30" y2="10" stroke="#5BA8C8"/><line x1="2" y1="22" x2="30" y2="22" stroke="#5BA8C8"/></svg>',
    wall_drywall: '<svg ' + SVG_START + '><rect x="2" y="10" width="28" height="12" fill="#E8E8E8"/><line x1="2" y1="10" x2="30" y2="10"/><line x1="2" y1="22" x2="30" y2="22"/></svg>',
    wall_concrete: '<svg ' + SVG_START + '><rect x="2" y="10" width="28" height="12" fill="#7A7A7A"/><circle cx="6" cy="14" r="0.7" fill="#fff" stroke="none"/><circle cx="12" cy="13" r="0.7" fill="#fff" stroke="none"/><circle cx="18" cy="15" r="0.7" fill="#fff" stroke="none"/><circle cx="24" cy="14" r="0.7" fill="#fff" stroke="none"/></svg>',
    door: '<svg ' + SVG_START + '><rect x="4" y="6" width="20" height="22" fill="none" stroke="currentColor"/><path d="M 24 6 a 20 20 0 0 1 0 22" fill="none" stroke="currentColor" stroke-dasharray="2 2"/><circle cx="20" cy="17" r="1" fill="currentColor" stroke="none"/></svg>',
    door_open: '<svg ' + SVG_START + '><rect x="6" y="4" width="20" height="24" fill="none" stroke="currentColor"/><path d="M 6 4 L 24 24" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="4" r="1.5" fill="currentColor" stroke="none"/></svg>',
    table: '<svg ' + SVG_START + '><rect x="3" y="10" width="26" height="14" fill="#A0522D" stroke="#7a3a20"/><line x1="3" y1="14" x2="29" y2="14" stroke="#7a3a20"/><line x1="3" y1="18" x2="29" y2="18" stroke="#7a3a20"/></svg>',
    chair: '<svg ' + SVG_START + '><path d="M 10 8 a5 5 0 0 1 12 0 v 8 h -12 z" fill="#ddd"/><ellipse cx="16" cy="20" rx="7" ry="3" fill="#ddd"/></svg>',
    sofa: '<svg ' + SVG_START + '><rect x="3" y="13" width="26" height="10" rx="2" fill="#ddd"/><rect x="3" y="9" width="4" height="6" rx="1" fill="#ccc"/><rect x="25" y="9" width="4" height="6" rx="1" fill="#ccc"/></svg>',
    plant: '<svg ' + SVG_START + '><path d="M 11 20 L 21 20 L 22 29 L 10 29 Z" fill="#c8a870" stroke="#8a6a40"/><path d="M 16 20 Q 8 14 6 6 Q 14 10 16 20" fill="#2ECC71" stroke="#1f8f4e"/><path d="M 16 20 Q 24 14 26 6 Q 18 10 16 20" fill="#2ECC71" stroke="#1f8f4e"/></svg>',
    pc: '<svg ' + SVG_START + '><rect x="4" y="6" width="17" height="13" rx="1" fill="#fff"/><line x1="4" y1="16" x2="21" y2="16"/><rect x="24" y="10" width="5" height="12" rx="0.5" fill="#fff"/></svg>',
    laptop: '<svg ' + SVG_START + '><rect x="6" y="7" width="20" height="14" rx="1" fill="#fff"/><path d="M 3 22 L 29 22 L 27 25 L 5 25 Z" fill="#ddd"/></svg>',
    printer: '<svg ' + SVG_START + '><rect x="8" y="4" width="16" height="7" fill="#fff"/><rect x="4" y="11" width="24" height="12" rx="1" fill="#fff"/><rect x="8" y="18" width="16" height="8" fill="#fff"/></svg>',
    scanner: '<svg ' + SVG_START + '><rect x="3" y="14" width="26" height="10" rx="1" fill="#fff"/><rect x="7" y="6" width="18" height="6" fill="#ddd" stroke="none"/></svg>',
    camera: '<svg ' + SVG_START + '><circle cx="16" cy="16" r="10" fill="#fff"/><circle cx="16" cy="16" r="6" fill="#333"/><circle cx="14" cy="14" r="1.5" fill="#fff" stroke="none"/></svg>',
    light: '<svg ' + SVG_START + ' stroke="#FF8C42"><circle cx="16" cy="16" r="4" fill="#FF8C42" fill-opacity="0.15"/><line x1="16" y1="4" x2="16" y2="8"/><line x1="16" y1="24" x2="16" y2="28"/><line x1="4" y1="16" x2="8" y2="16"/><line x1="24" y1="16" x2="28" y2="16"/></svg>',
    sensor: '<svg ' + SVG_START + ' stroke="#FF8C42"><rect x="12" y="4" width="8" height="24" rx="4" fill="#FFF3E8"/><circle cx="16" cy="22" r="2.5" fill="#FF8C42" stroke="none"/></svg>',
    lock: '<svg ' + SVG_START + ' stroke="#FF8C42"><rect x="7" y="14" width="18" height="14" rx="2" fill="#FFF3E8"/><path d="M 11 14 V 10 a5 5 0 0 1 10 0 V 14"/><circle cx="16" cy="20" r="1.5" fill="#FF8C42" stroke="none"/></svg>',
    doorphone: '<svg ' + SVG_START + ' stroke="#FF8C42"><rect x="10" y="4" width="12" height="24" rx="2" fill="#FFF3E8"/><circle cx="16" cy="11" r="3" fill="#FF8C42" stroke="none"/></svg>',
    ac: '<svg ' + SVG_START + ' stroke="#FF8C42"><rect x="3" y="9" width="26" height="12" rx="2" fill="#FFF3E8"/><line x1="7" y1="13" x2="25" y2="13"/><line x1="7" y1="16" x2="25" y2="16"/></svg>',
    rj45: '<svg ' + SVG_START + '><rect x="8" y="8" width="16" height="16" rx="1" fill="#2E5EAA"/><rect x="12" y="12" width="8" height="8" fill="#fff" stroke="none"/></svg>'
  };
  window.getEditorIcon = function (kind) {
    return ICONS[kind] || '<svg ' + SVG_START + '><circle cx="16" cy="16" r="8"/></svg>';
  };

  // ============================================================
  // СОСТОЯНИЕ
  // ============================================================
  const state = {
    project: null,
    projectId: null,
    elements: [], aps: [], switches: [], devices: [],
    selected: null, multiSelected: [],
    tool: 'select', wallMaterial: 'concrete',
    draft: null, roomPoints: [],
    drag: null,
    zoom: 1, snap: true,
    history: [], redoStack: [], clipboard: null,
    heatmap: null, heatmapMode: 'rssi',
    lastMousePos: null,
    _dirty: false,
  };
  let idSeq = 1;
  let apCnt = 0, swCnt = 0, devCnt = 0;
  const nextId = () => idSeq++;
  const LOCAL_PREFIX = -1; // для локальных id при отсутствии бэкенда

  // ============================================================
  // DOM
  // ============================================================
  const svg = document.getElementById('planSvg');
  const wrap = document.getElementById('canvasWrap');
  const heatmapCanvas = document.getElementById('heatmapCanvas');
  const selectionRectEl = document.getElementById('selectionRect');
  const snapIndicator = document.getElementById('snapIndicator');
  const propsPanel = document.getElementById('propsPanel');
  const canvasHint = document.getElementById('canvasHint');
  const paletteGroups = document.getElementById('paletteGroups');
  const projectSelect = document.getElementById('projectSelect');
  const saveStatus = document.getElementById('saveStatus');

  const L = {};
  ['layerGrid','layerCoverage','layerCables','layerRooms','layerWalls',
   'layerFurniture','layerText','layerDevices','layerIoT','layerSwitches',
   'layerAps','layerDraft','layerSelection'].forEach(id => L[id] = document.getElementById(id));

  // ============================================================
  // ТЕМА
  // ============================================================
  (function () {
    const saved = localStorage.getItem('cw_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('themeToggle');
    btn.textContent = saved === 'dark' ? '☀' : '🌙';
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('cw_theme', next);
      btn.textContent = next === 'dark' ? '☀' : '🌙';
    });
  })();

  // ============================================================
  // ПАЛИТРА
  // ============================================================
  const PALETTE = [
    { name:'Сеть', items:[
      { key:'ap', label:'AP', icon:'ap' },
      { key:'switch', label:'SW', icon:'switch' },
      { key:'router', label:'Роутер', icon:'router' },
      { key:'wlc', label:'WLC', icon:'wlc' },
      { key:'patch', label:'Патч', icon:'patch' }
    ]},
    { name:'Стены', items:[
      { key:'wall', material:'brick',    label:'Кирпич', icon:'wall_brick' },
      { key:'wall', material:'wood',     label:'Дерево', icon:'wall_wood' },
      { key:'wall', material:'glass',    label:'Стекло', icon:'wall_glass' },
      { key:'wall', material:'drywall',  label:'ГКЛ',    icon:'wall_drywall' },
      { key:'wall', material:'concrete', label:'Бетон',  icon:'wall_concrete' }
    ]},
    { name:'Проёмы', items:[
  { key:'door', label:'Дверь', icon:'door', door:true }
]},
    { name:'Мебель', items:[
      { key:'table', label:'Стол', icon:'table' },
      { key:'chair', label:'Стул', icon:'chair' },
      { key:'sofa', label:'Диван', icon:'sofa' },
      { key:'plant', label:'Растение', icon:'plant' }
    ]},
    { name:'Техника', items:[
      { key:'pc', label:'ПК', icon:'pc' },
      { key:'laptop', label:'Ноутбук', icon:'laptop' },
      { key:'printer', label:'МФУ', icon:'printer' },
      { key:'scanner', label:'Сканер', icon:'scanner' },
      { key:'camera', label:'Камера', icon:'camera' }
    ]},
    { name:'IoT', items:[
      { key:'light', label:'Свет', icon:'light', iot:true },
      { key:'sensor', label:'Датчик', icon:'sensor', iot:true },
      { key:'lock', label:'Замок', icon:'lock', iot:true },
      { key:'doorphone', label:'Домофон', icon:'doorphone', iot:true },
      { key:'ac', label:'Кондиц.', icon:'ac', iot:true }
    ]}
  ];

  function buildPalette() {
    paletteGroups.innerHTML = '';
    PALETTE.forEach(cat => {
      const sec = document.createElement('section');
      sec.className = 'palette-category open';
      sec.innerHTML = '<button class="palette-cat-header" type="button"><span class="chev">▾</span> ' + cat.name + '</button>';
      const grid = document.createElement('div');
      grid.className = 'palette-grid';
      cat.items.forEach(it => {
        const el = document.createElement('div');
        el.className = 'palette-item' + (it.iot ? ' iot' : '');
        el.draggable = true;
        el.dataset.key = it.key;
        if (it.material) el.dataset.material = it.material;
        el.innerHTML = '<div>' + window.getEditorIcon(it.icon) + '</div><span>' + it.label + '</span>';
        el.addEventListener('click', () => {
          if (it.key === 'wall') {
            state.tool = 'wall';
            state.wallMaterial = it.material;
            setActiveTool('wall');
            canvasHint.textContent = 'Стена: ' + MATERIALS[it.material].name + '. Клик — начало, клик — конец';
          } else if (it.key === 'door') {
            state.tool = 'door';
            setActiveTool('door');
            canvasHint.textContent = 'Дверь: клик по стене, чтобы вставить';
          } else {
            const pos = state.lastMousePos || {
              x: state.project ? state.project.width_m / 2 : 5,
              y: state.project ? state.project.height_m / 2 : 5
            };
            placeObject(it.key, pos.x, pos.y);
          }
        });
        el.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', JSON.stringify(it));
        });
        grid.appendChild(el);
      });
      sec.appendChild(grid);
      sec.querySelector('.palette-cat-header').addEventListener('click', () => sec.classList.toggle('open'));
      paletteGroups.appendChild(sec);
    });
  }

  document.getElementById('paletteSearch').addEventListener('input', function () {
    const q = this.value.toLowerCase();
    document.querySelectorAll('.palette-item').forEach(el => {
      const t = (el.querySelector('span') || {}).textContent || '';
      el.style.display = (!q || t.toLowerCase().includes(q)) ? '' : 'none';
    });
  });

  // ============================================================
  // КООРДИНАТЫ
  // ============================================================
  function m2px(mx, my) { return { x: mx * PX_PER_M, y: my * PX_PER_M }; }

  function svgMetrics() {
    const r = svg.getBoundingClientRect();
    const vb = (svg.getAttribute('viewBox') || '0 0 100 100').split(/[\s,]+/).map(Number);
    const vx = vb[0] || 0, vy = vb[1] || 0, vw = vb[2] || 1, vh = vb[3] || 1;
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

  function snap(v) {
    if (!state.snap) return +v.toFixed(2);
    return Math.round(v / SNAP_M) * SNAP_M;
  }

  // ============================================================
  // ИНДИКАТОР СОХРАНЕНИЯ
  // ============================================================
  let saveTimer = null;
  function flashSaved() {
    if (!saveStatus) return;
    saveStatus.textContent = '✓ Сохранено';
    saveStatus.style.color = 'var(--green)';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveStatus.textContent = ''; }, 2000);
  }
  function flashSaving() {
    if (!saveStatus) return;
    saveStatus.textContent = '⋯ Сохранение';
    saveStatus.style.color = 'var(--text-dim)';
  }
  function flashError(msg) {
    if (!saveStatus) return;
    saveStatus.textContent = '⚠ ' + (msg || 'Ошибка');
    saveStatus.style.color = 'var(--red)';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveStatus.textContent = ''; }, 4000);
  }

  // ============================================================
  // СОЗДАНИЕ ПРОЕКТА
  // ============================================================
  async function createProject({ name, width, length, height, material }) {
    let projectId = null;
    if (EditorAPI.hasToken()) {
      try {
        flashSaving();
        const p = await EditorAPI.createProject({ name, width_m: width, height_m: length });
        projectId = p.id;
        // Строим стены по периметру
        const walls = [
          { type:'wall', material, x1:0, y1:0, x2:width, y2:0 },
          { type:'wall', material, x1:width, y1:0, x2:width, y2:length },
          { type:'wall', material, x1:width, y1:length, x2:0, y2:length },
          { type:'wall', material, x1:0, y1:length, x2:0, y2:0 },
        ];
        for (const w of walls) {
          await EditorAPI.createElement(projectId, w);
        }
        flashSaved();
      } catch (err) {
        console.warn('Создание проекта через API не удалось:', err);
        flashError(err.message);
        projectId = null;
      }
    }

    state.project = { name, width_m: width, height_m: length, height_v: height, material };
    state.projectId = projectId;
    state.elements = [];
    state.aps = [];
    state.switches = [];
    state.devices = [];
    state.selected = null;
    state.multiSelected = [];
    state.history = [];
    state.redoStack = [];
    state.heatmap = null;
    state.zoom = 1;
    idSeq = 1; apCnt = 0; swCnt = 0; devCnt = 0;

    // Локально дублируем стены
    state.elements.push(
      { id:nextId(), type:'wall', material, x1:0, y1:0, x2:width, y2:0 },
      { id:nextId(), type:'wall', material, x1:width, y1:0, x2:width, y2:length },
      { id:nextId(), type:'wall', material, x1:width, y1:length, x2:0, y2:length },
      { id:nextId(), type:'wall', material, x1:0, y1:length, x2:0, y2:0 }
    );

    // Если API вернул проект — синхронизируем локальные id с сервером
    if (projectId) {
      await reloadFromBackend();
    }
    if (projectId) {
      await loadMeasurements();
    }
    applyViewBox(-60, -60, width * PX_PER_M + 120, length * PX_PER_M + 120);
    document.getElementById('zoomLabel').textContent = '100%';
    render();
    renderProps();
    canvasHint.textContent = name + ' · ' + width + '×' + length + ' м · ' + MATERIALS[material].name;
  }

  function applyViewBox(x, y, w, h) {
    svg.setAttribute('viewBox', x + ' ' + y + ' ' + w + ' ' + h);
    state._vb = { x, y, w, h };
  }

  // ============================================================
  // ЗАГРУЗКА С БЭКЕНДА
  // ============================================================
  async function reloadFromBackend() {
    if (!state.projectId) return;
    try {
      flashSaving();
      const data = await EditorAPI.loadFullProject(state.projectId);
      // Проект
      state.project = {
        name: data.project.name,
        width_m: data.project.width_m,
        height_m: data.project.height_m,
        height_v: state.project ? state.project.height_v : 3,
        material: state.project ? state.project.material : 'concrete',
      };
      // Элементы
      state.elements = (data.elements || []).map(EditorAPI.elementFromDB);
      state.aps = (data.aps || []).map(EditorAPI.apFromDB);
      state.switches = (data.switches || []).map(EditorAPI.switchFromDB);
      state.devices = (data.devices || []).map(EditorAPI.deviceFromDB);
      // Счётчики для имён
      apCnt = state.aps.length;
      swCnt = state.switches.length;
      devCnt = state.devices.length;
      // Максимальный id
      let maxId = 0;
      [...state.elements, ...state.aps, ...state.switches, ...state.devices]
        .forEach(o => { if (o.id > maxId) maxId = o.id; });
      idSeq = maxId + 1;
      flashSaved();
    } catch (err) {
      console.warn('Загрузка проекта не удалась:', err);
      flashError(err.message);
    }
  }

  async function loadProjectById(projectId) {
    try {
      flashSaving();
      const p = await EditorAPI.getProject(projectId);
      state.projectId = projectId;
      state.project = {
        name: p.name, width_m: p.width_m, height_m: p.height_m,
        height_v: 3, material: 'concrete',
      };
      await reloadFromBackend();
      applyViewBox(-60, -60, p.width_m * PX_PER_M + 120, p.height_m * PX_PER_M + 120);
      document.getElementById('zoomLabel').textContent = '100%';
      render();
      renderProps();
      canvasHint.textContent = p.name + ' · ' + p.width_m + '×' + p.height_m + ' м';
            await loadMeasurements();
      render();
    } catch (err) {
      alert('Не удалось загрузить проект: ' + err.message);
    }
  }

  async function loadProjectList() {
    if (!EditorAPI.hasToken()) return;
    try {
      const list = await EditorAPI.listProjects();
      projectSelect.innerHTML = '<option value="">— Проект —</option>';
      list.forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name;
        projectSelect.appendChild(o);
      });
      if (list.length && !state.projectId) {
        projectSelect.value = list[0].id;
        await loadProjectById(list[0].id);
      }
    } catch (err) {
      console.warn('Список проектов недоступен:', err);
    }
  }

  projectSelect.addEventListener('change', function () {
    if (!this.value) { state.project = null; render(); return; }
    loadProjectById(this.value);
  });

  // ============================================================
  // СЕТКА
  // ============================================================
  function drawGrid() {
    L.layerGrid.innerHTML = '';
    if (!state.project) return;
    const W = state.project.width_m * PX_PER_M;
    const H = state.project.height_m * PX_PER_M;

    const border = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    border.setAttribute('x', 0); border.setAttribute('y', 0);
    border.setAttribute('width', W); border.setAttribute('height', H);
    border.setAttribute('fill', 'none');
    border.setAttribute('stroke', '#444');
    border.setAttribute('stroke-width', '1.5');
    L.layerGrid.appendChild(border);

    for (let x = 0; x <= state.project.width_m; x++) {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', x * PX_PER_M); l.setAttribute('y1', 0);
      l.setAttribute('x2', x * PX_PER_M); l.setAttribute('y2', x % 5 === 0 ? -10 : -5);
      l.setAttribute('stroke', '#555'); l.setAttribute('stroke-width', '1');
      L.layerGrid.appendChild(l);
      if (x % 5 === 0 && x > 0) {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', x * PX_PER_M); t.setAttribute('y', -14);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('class', 'svg-label');
        t.textContent = x + ' м';
        L.layerGrid.appendChild(t);
      }
    }
    for (let y = 0; y <= state.project.height_m; y++) {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', 0); l.setAttribute('y1', y * PX_PER_M);
      l.setAttribute('x2', y % 5 === 0 ? -10 : -5); l.setAttribute('y2', y * PX_PER_M);
      l.setAttribute('stroke', '#555'); l.setAttribute('stroke-width', '1');
      L.layerGrid.appendChild(l);
      if (y % 5 === 0 && y > 0) {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', -14); t.setAttribute('y', y * PX_PER_M + 3);
        t.setAttribute('text-anchor', 'end');
        t.setAttribute('class', 'svg-label');
        t.textContent = y + ' м';
        L.layerGrid.appendChild(t);
      }
    }
  }

  // ============================================================
  // РАСЧЁТ СИГНАЛА
  // ============================================================
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
  const p1 = { x:ap.x, y:ap.y }, p2 = { x:px, y:py };

  // Стены — обрезаем участки, где стоит дверь
  const doors = state.elements.filter(el => el.type === 'door');
  for (const el of state.elements) {
    if (el.type !== 'wall') continue;
    if (!segInt(p1, p2, { x:el.x1, y:el.y1 }, { x:el.x2, y:el.y2 })) continue;

    // Проверяем: пересекает ли луч точку двери на этой стене?
    let doorLoss = null;
    for (const door of doors) {
      const dp = { x: door.x, y: door.y };
      // Точка пересечения луча со стеной
      const inter = lineIntersection(p1, p2, { x:el.x1, y:el.y1 }, { x:el.x2, y:el.y2 });
      if (!inter) continue;
      const dist = Math.hypot(inter.x - dp.x, inter.y - dp.y);
      const halfW = (door.width || DOOR_CONFIG.width_m) / 2;
      if (dist <= halfW + 0.05) {
        // Луч проходит через дверь
        doorLoss = DOOR_CONFIG.loss;
        break;
      }
    }

    loss += doorLoss != null ? doorLoss : (MATERIALS[el.material] || MATERIALS.concrete).loss;
  }
  return loss;
}

// Точка пересечения двух отрезков (или null)
function lineIntersection(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y)
  };
}

  function signalAt(ap, x, y) {
    const dz = (state.project.height_v || 3) - 1.2;
    const dx = ap.x - x, dy = ap.y - y;
    const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
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
// ============================================================
// РАСЧЁТ ИНТЕРФЕРЕНЦИИ
// ============================================================

// Частота канала в МГц
function channelFreq(ch, band) {
  const b = String(band);
  if (b === '2.4' || b === '2400') return 2412 + (ch - 1) * 5;
  if (b === '6' || b === '6000')    return 5955 + (ch - 1) * 5;
  return 5000 + ch * 5;  // 5 ГГц
}

// Коэффициент перекрытия каналов (0 — нет, 1 — полное)
function channelOverlap(ch1, band1, ch2, band2) {
  const b1 = String(band1), b2 = String(band2);
  if (b1 !== b2) return 0;

  const f1 = channelFreq(ch1, b1);
  const f2 = channelFreq(ch2, b2);
  const df = Math.abs(f1 - f2);
  const width = 20;  // ширина канала 20 МГц

  if (df >= width) return 0;
  return 1 - df / width;
}

// Интерференция в точке (x, y) в dBm
function interferenceAt(x, y) {
  if (state.aps.length < 2) return -100;  // нет интерференции от одной AP

  // Находим лучшую AP
  let bestAp = null, bestRssi = -Infinity;
  for (const ap of state.aps) {
    const s = signalAt(ap, x, y);
    if (s > bestRssi) { bestRssi = s; bestAp = ap; }
  }
  if (!bestAp) return -100;

  // Складываем помехи от остальных AP с учётом перекрытия каналов
  let totalLinear = 0;
  for (const ap of state.aps) {
    if (ap.id === bestAp.id) continue;
    const ov = channelOverlap(bestAp.channel, bestAp.band, ap.channel, ap.band);
    if (ov <= 0) continue;
    const rssi = signalAt(ap, x, y);
    totalLinear += ov * Math.pow(10, rssi / 10);
  }

  if (totalLinear <= 0) return -100;
  return 10 * Math.log10(totalLinear);
}
// ============================================================
// РАСЧЁТ КЛИЕНТСКОЙ НАГРУЗКИ
// ============================================================

// Профили трафика устройств (Мбит/с)
const DEVICE_TRAFFIC = {
  pc:        50,
  laptop:    30,
  printer:   10,
  scanner:   15,
  camera:    8,
  doorphone: 5,
  ac:        1,
  light:     0.5,
  sensor:    0.2,
  lock:      0.3,
  iot:       0.2,
  router:    0,     // инфраструктура, не клиент
  patch:     0,
  wlc:       0,
  switch:    0
};

// Ёмкость AP по частоте (Мбит/с)
const AP_CAPACITY = {
  2400: 100,
  5000: 400,
  6000: 600
};

// Максимум клиентов на одну AP (реалистично)
const AP_MAX_CLIENTS = 30;

function calculateLoad() {
  if (!state.aps.length) {
    return {
      aps: [],
      totalDevices: 0,
      unassigned: 0,
      warnings: [{ type:'error', text:'Нет точек доступа — добавьте хотя бы одну' }]
    };
  }

  // Инициализация контейнера для каждой AP
  const apStats = state.aps.map(ap => ({
    ap: ap,
    capacity: AP_CAPACITY[ap.freq] || 300,
    clients: [],
    totalMbps: 0,
    utilization: 0
  }));

  // Привязка каждого устройства к ближайшей AP
  let unassigned = 0;
  for (const d of state.devices) {
    const traffic = DEVICE_TRAFFIC[d.type] || 0;
    if (traffic === 0) continue;  // инфраструктура

    let best = null, bestDist = Infinity;
    for (const st of apStats) {
      const dx = d.x - st.ap.x;
      const dy = d.y - st.ap.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < bestDist) { bestDist = dist; best = st; }
    }

    // Если устройство слишком далеко (> 50 м) — считаем вне покрытия
    if (!best || bestDist > 50) {
      unassigned++;
      continue;
    }

    best.clients.push({
      name: d.name,
      type: d.type,
      traffic: traffic,
      distance: +bestDist.toFixed(1)
    });
    best.totalMbps += traffic;
  }

  // Расчёт загрузки
  for (const st of apStats) {
    st.totalMbps = +st.totalMbps.toFixed(1);
    st.utilization = Math.min(100, +((st.totalMbps / st.capacity) * 100).toFixed(1));
    st.clientCount = st.clients.length;
  }

  // Анализ
  const warnings = [];

  for (const st of apStats) {
    if (st.utilization > 80) {
      warnings.push({
        type: 'error',
        ap: st.ap.name,
        text: st.ap.name + ' загружена на ' + st.utilization + '% ' +
              '(' + st.totalMbps + ' из ' + st.capacity + ' Мбит/с) — ' +
              'возможны задержки, добавьте AP или переведите часть клиентов'
      });
    } else if (st.utilization > 60) {
      warnings.push({
        type: 'warning',
        ap: st.ap.name,
        text: st.ap.name + ' загружена на ' + st.utilization + '% — средний уровень, следите за клиентами'
      });
    }
    if (st.clientCount > AP_MAX_CLIENTS) {
      warnings.push({
        type: 'warning',
        ap: st.ap.name,
        text: st.ap.name + ' обслуживает ' + st.clientCount + ' клиентов ' +
              '(лимит ' + AP_MAX_CLIENTS + ') — реальная скорость будет ниже'
      });
    }
  }

  if (unassigned > 0) {
    warnings.push({
      type: 'warning',
      text: unassigned + ' устройств вне зоны покрытия (дальше 50 м от AP)'
    });
  }

  if (warnings.length === 0) {
    const totalUtil = apStats.reduce((s, st) => s + st.utilization, 0) / apStats.length;
    warnings.push({
      type: 'ok',
      text: 'Все AP работают в норме. Средняя загрузка ' + totalUtil.toFixed(1) + '%'
    });
  }

  const totalDevices = apStats.reduce((s, st) => s + st.clientCount, 0);

  return {
    aps: apStats,
    totalDevices: totalDevices,
    unassigned: unassigned,
    warnings: warnings
  };
}
  // ============================================================
  // ГЛАВНЫЙ РЕНДЕР
  // ============================================================
  function render() {
    if (!state.project) {
      Object.values(L).forEach(l => l.innerHTML = '');
      return;
    }
    drawGrid();
    renderWalls();
    renderDoors();
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

 // ============================================================
// СТЕНЫ С ОБРЕЗКОЙ ПОД ДВЕРЯМИ
// ============================================================
function renderWalls() {
  L.layerWalls.innerHTML = '';

  // Собираем все двери для быстрого поиска пересечений
  const doors = state.elements.filter(el => el.type === 'door');

  for (const el of state.elements) {
    if (el.type !== 'wall') continue;

    const a = m2px(el.x1, el.y1);
    const b = m2px(el.x2, el.y2);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;

    const mat = MATERIALS[el.material] || MATERIALS.concrete;
    const ux = dx / len, uy = dy / len;  // единичный вектор стены

    // Ищем двери, которые пересекают эту стену
    // Дверь имеет координаты x, y (центр) и angle (направление стены)
    // Проверяем, лежит ли центр двери на этой стене (в пределах tolerance)
    const segments = [];  // список сегментов стены для рисования
    let cursor = 0;       // откуда начинается текущий сегмент (в px от начала)

    // Сортируем двери по позиции вдоль стены
    const doorsOnWall = [];
    for (const door of doors) {
      const dp = m2px(door.x, door.y);
      // Проекция центра двери на прямую стены
      const t = ((dp.x - a.x) * ux + (dp.y - a.y) * uy) / len;
      if (t < -0.05 || t > 1.05) continue;

      // Расстояние от точки до прямой стены
      const perpX = dp.x - (a.x + ux * len * t);
      const perpY = dp.y - (a.y + uy * len * t);
      const perpDist = Math.hypot(perpX, perpY);
      if (perpDist > 12) continue;  // 12 px ≈ 0.3 м допуска

      // Проверяем, что угол двери совпадает с углом стены
      const wallAngle = Math.atan2(dy, dx);
      let angleDiff = Math.abs(door.angle - wallAngle);
      while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - 2 * Math.PI);
      if (angleDiff > 0.3 && Math.abs(angleDiff - Math.PI) > 0.3) continue;

      const doorWidthPx = (door.width || DOOR_CONFIG.width_m) * PX_PER_M;
      const startPx = Math.max(0, t * len - doorWidthPx / 2);
      const endPx = Math.min(len, t * len + doorWidthPx / 2);
      doorsOnWall.push({ door, startPx, endPx });
    }
    doorsOnWall.sort((x, y) => x.startPx - y.startPx);

    // Строим сегменты стены между дверями
    for (const d of doorsOnWall) {
      if (d.startPx > cursor + 0.5) {
        segments.push({ from: cursor, to: d.startPx });
      }
      cursor = Math.max(cursor, d.endPx);
    }
    if (cursor < len - 0.5) {
      segments.push({ from: cursor, to: len });
    }
    // Если дверей нет — одна сплошная стена
    if (!doorsOnWall.length) segments.push({ from: 0, to: len });

    // Рисуем каждый сегмент
    segments.forEach(seg => {
      const s = m2px(el.x1, el.y1);
      const x1 = s.x + ux * seg.from;
      const y1 = s.y + uy * seg.from;
      const x2 = s.x + ux * seg.to;
      const y2 = s.y + uy * seg.to;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('stroke', 'url(#' + mat.pattern + ')');
      line.setAttribute('stroke-width', mat.width);
      line.setAttribute('stroke-linecap', 'square');
      line.dataset.kind = 'element'; line.dataset.id = el.id;
      if (isSelected('element', el.id)) {
        line.setAttribute('stroke', '#2E5EAA');
        line.setAttribute('stroke-width', mat.width + 3);
      }
      line.style.cursor = 'move';
      line.addEventListener('click', e => {
        e.stopPropagation();
        if (state.tool !== 'select') return;
        if (e.shiftKey) toggleMulti('element', el.id);
        else { state.selected = { kind:'element', id:el.id }; state.multiSelected = []; }
        render(); renderProps();
      });
      line.addEventListener('mousedown', e => {
        if (state.tool === 'select') startDrag(e, 'element', el.id);
      });
      L.layerWalls.appendChild(line);
    });

    // Пунктирная длина стены + подпись (смещение по нормали)
    const nx = -uy, ny = ux;
    const off = 14;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dim = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    dim.setAttribute('x1', a.x + nx * off); dim.setAttribute('y1', a.y + ny * off);
    dim.setAttribute('x2', b.x + nx * off); dim.setAttribute('y2', b.y + ny * off);
    dim.setAttribute('stroke', '#666'); dim.setAttribute('stroke-width', '0.8');
    dim.setAttribute('stroke-dasharray', '3 3');
    dim.setAttribute('pointer-events', 'none');
    L.layerWalls.appendChild(dim);

    [a, b].forEach(pt => {
      const tk = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tk.setAttribute('x1', pt.x + nx * (off - 4)); tk.setAttribute('y1', pt.y + ny * (off - 4));
      tk.setAttribute('x2', pt.x + nx * (off + 4)); tk.setAttribute('y2', pt.y + ny * (off + 4));
      tk.setAttribute('stroke', '#666'); tk.setAttribute('stroke-width', '0.8');
      tk.setAttribute('pointer-events', 'none');
      L.layerWalls.appendChild(tk);
    });

    const lenM = Math.hypot(el.x2 - el.x1, el.y2 - el.y1).toFixed(2);
    const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lbl.setAttribute('x', mid.x + nx * off);
    lbl.setAttribute('y', mid.y + ny * off - 3);
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('class', 'svg-dim-label');
    lbl.setAttribute('pointer-events', 'none');
    lbl.textContent = lenM + ' м';
    L.layerWalls.appendChild(lbl);
  }
}

// ============================================================
// РЕНДЕР ДВЕРЕЙ С ДУГОЙ ОТКРЫВАНИЯ
// ============================================================
function renderDoors() {
  L.layerDoors = L.layerDoors || document.getElementById('layerDoors');
  if (!L.layerDoors) {
    // Создаём слой, если его нет
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.id = 'layerDoors';
    // Вставляем перед слоем walls
    if (L.layerWalls.parentNode) {
      L.layerWalls.parentNode.insertBefore(g, L.layerWalls);
    }
    L.layerDoors = g;
  }
  L.layerDoors.innerHTML = '';

  for (const el of state.elements) {
    if (el.type !== 'door') continue;

    const cx = el.x;
    const cy = el.y;
    const width = el.width || DOOR_CONFIG.width_m;
    const angle = el.angle || 0;         // направление стены (в радианах)
    const side = el.side || 'right';     // какая сторона открывания
    const inward = el.inward !== false;  // внутрь или наружу

    const p = m2px(cx, cy);
    const widthPx = width * PX_PER_M;
    const half = widthPx / 2;

    // Единичный вектор вдоль стены
    const ux = Math.cos(angle), uy = Math.sin(angle);
    // Нормаль (перпендикуляр) — в какую сторону открывается дверь
    const nx = -uy, ny = ux;

    // Направление открывания
    const dir = (side === 'right' ? 1 : -1) * (inward ? 1 : -1);

    // Точки крепления двери (петли)
    const hingeX = p.x - ux * half * dir;  // одна сторона
    const hingeY = p.y - uy * half * dir;
    const endX = p.x + ux * half * dir;    // вторая сторона
    const endY = p.y + uy * half * dir;

    // Выбираем петлю: если дверь открывается вправо от стены, петля — на другом конце
    const hingeAtStart = (side === 'right' && inward) || (side === 'left' && !inward);
    const hx = hingeAtStart ? p.x - ux * half : p.x + ux * half;
    const hy = hingeAtStart ? p.y - uy * half : p.y + uy * half;
    const ox = hingeAtStart ? p.x + ux * half : p.x - ux * half;  // противоположный конец
    const oy = hingeAtStart ? p.y + uy * half : p.y - uy * half;

    // Цвета
    const doorColor = isSelected('element', el.id) ? '#2E5EAA' : DOOR_CONFIG.color;
    const frameColor = isSelected('element', el.id) ? '#2E5EAA' : DOOR_CONFIG.frame_color;

    // 1) Коробка двери (два столбика по краям проёма)
    [ { x: p.x - ux * half, y: p.y - uy * half },
      { x: p.x + ux * half, y: p.y + uy * half } ].forEach(pt => {
      const post = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      post.setAttribute('cx', pt.x); post.setAttribute('cy', pt.y);
      post.setAttribute('r', 3);
      post.setAttribute('fill', frameColor);
      post.dataset.kind = 'element'; post.dataset.id = el.id;
      L.layerDoors.appendChild(post);
    });

    // 2) Полотно двери (линия от петли в сторону открывания)
    // Полотно длиной = widthPx, повёрнутое на 90° от стены
    const doorEndX = hx + nx * dir * widthPx;
    const doorEndY = hy + ny * dir * widthPx;

    const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    leaf.setAttribute('x1', hx); leaf.setAttribute('y1', hy);
    leaf.setAttribute('x2', doorEndX); leaf.setAttribute('y2', doorEndY);
    leaf.setAttribute('stroke', doorColor);
    leaf.setAttribute('stroke-width', '3');
    leaf.setAttribute('stroke-linecap', 'round');
    leaf.dataset.kind = 'element'; leaf.dataset.id = el.id;
    leaf.style.cursor = 'pointer';
    leaf.addEventListener('click', e => {
      e.stopPropagation();
      if (state.tool === 'select') {
        state.selected = { kind:'element', id:el.id };
        state.multiSelected = [];
        render(); renderProps();
      }
    });
    L.layerDoors.appendChild(leaf);

    // 3) Дуга открывания
    // Из точки петли (hx, hy) — дуга радиусом widthPx, от стены до конца полотна
    const arcStartAngle = Math.atan2(oy - hy, ox - hx);
    const arcEndAngle = Math.atan2(doorEndY - hy, doorEndX - hx);

    let angleDiff = arcEndAngle - arcStartAngle;
    // Нормализуем в диапазон [-π, π]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const r = widthPx;
    const sx = hx + r * Math.cos(arcStartAngle);
    const sy = hy + r * Math.sin(arcStartAngle);
    const ex = hx + r * Math.cos(arcEndAngle);
    const ey = hy + r * Math.sin(arcEndAngle);
    const largeArc = Math.abs(angleDiff) > Math.PI ? 1 : 0;
    const sweep = angleDiff > 0 ? 1 : 0;
    arc.setAttribute('d',
      'M ' + sx + ' ' + sy +
      ' A ' + r + ' ' + r + ' 0 ' + largeArc + ' ' + sweep + ' ' + ex + ' ' + ey);
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', doorColor);
    arc.setAttribute('stroke-width', '1');
    arc.setAttribute('stroke-dasharray', '4 3');
    arc.setAttribute('opacity', '0.6');
    arc.setAttribute('pointer-events', 'none');
    L.layerDoors.appendChild(arc);

    // 4) Подпись
    const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lbl.setAttribute('x', (hx + doorEndX) / 2 + nx * 12 * dir);
    lbl.setAttribute('y', (hy + doorEndY) / 2 + ny * 12 * dir);
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('class', 'svg-label');
    lbl.setAttribute('font-size', '8');
    lbl.setAttribute('pointer-events', 'none');
    lbl.textContent = 'Дверь ' + width.toFixed(2) + ' м';
    L.layerDoors.appendChild(lbl);

    // 5) Хит-зона для выбора/перетаскивания (невидимый прямоугольник)
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hit.setAttribute('x1', p.x - ux * half); hit.setAttribute('y1', p.y - uy * half);
    hit.setAttribute('x2', p.x + ux * half); hit.setAttribute('y2', p.y + uy * half);
    hit.setAttribute('stroke', 'transparent');
    hit.setAttribute('stroke-width', '20');
    hit.setAttribute('pointer-events', 'stroke');
    hit.dataset.kind = 'element'; hit.dataset.id = el.id;
    hit.style.cursor = 'move';
    hit.addEventListener('click', e => {
      e.stopPropagation();
      if (state.tool === 'select') {
        state.selected = { kind:'element', id:el.id };
        state.multiSelected = [];
        render(); renderProps();
      }
    });
    hit.addEventListener('mousedown', e => {
      if (state.tool === 'select') startDrag(e, 'element', el.id);
    });
    L.layerDoors.appendChild(hit);
  }
}

  function findAnchor(x, y, t = 0.8) {
    let best = null, bd = t;
    for (const el of state.elements) {
      if (el.type !== 'wall') continue;
      [{x:el.x1,y:el.y1},{x:el.x2,y:el.y2},{x:(el.x1+el.x2)/2,y:(el.y1+el.y2)/2}]
        .forEach(c => {
          const d = Math.hypot(c.x - x, c.y - y);
          if (d < bd) { bd = d; best = c; }
        });
    }
    return best;
  }

  function renderShapes() {
    L.layerRooms.innerHTML = '';
    for (const el of state.elements) {
      if (el.type === 'shape') {
        const p = m2px(el.x, el.y);
        const w = (el.width || 4) * PX_PER_M, h = (el.height || 3) * PX_PER_M;
        let s;
        if (el.subtype === 'ellipse') {
          s = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
          s.setAttribute('cx', p.x + w/2); s.setAttribute('cy', p.y + h/2);
          s.setAttribute('rx', w/2); s.setAttribute('ry', h/2);
        } else {
          s = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          s.setAttribute('x', p.x); s.setAttribute('y', p.y);
          s.setAttribute('width', w); s.setAttribute('height', h);
        }
        s.setAttribute('fill', 'rgba(46,94,170,.15)');
        s.setAttribute('stroke', isSelected('element', el.id) ? '#2E5EAA' : '#666');
        s.setAttribute('stroke-width', isSelected('element', el.id) ? 3 : 1.5);
        s.dataset.kind = 'element'; s.dataset.id = el.id;
        s.style.cursor = 'move';
        s.addEventListener('mousedown', e => startDrag(e, 'element', el.id));
        s.addEventListener('click', e => {
          e.stopPropagation();
          if (state.tool === 'select') {
            state.selected = { kind:'element', id:el.id };
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
          poly.dataset.kind = 'element'; poly.dataset.id = el.id;
          poly.addEventListener('click', e => {
            e.stopPropagation();
            if (state.tool === 'select') {
              state.selected = { kind:'element', id:el.id };
              state.multiSelected = [];
              render(); renderProps();
            }
          });
          L.layerRooms.appendChild(poly);
        } catch (err) {}
      }
    }
  }

  function renderFurniture() {
    L.layerFurniture.innerHTML = '';
    const ICON_MAP = { sofa:'sofa', table:'table', chair:'chair', plant:'plant' };
    for (const el of state.elements) {
      if (el.type !== 'furniture') continue;
      const p = m2px(el.x, el.y);
      const wPx = (el.width || 1.5) * PX_PER_M;
      const hPx = (el.height || 1) * PX_PER_M;
      const scale = wPx / 40;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(' + (p.x - wPx/2) + ',' + (p.y - hPx/2) + ') scale(' + scale + ')');
      g.dataset.kind = 'element'; g.dataset.id = el.id;
      g.style.cursor = 'move';
      const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      fo.setAttribute('width', 40); fo.setAttribute('height', 40);
      const div = document.createElement('div');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.style.width = '40px'; div.style.height = '40px';
      div.style.color = isSelected('element', el.id) ? '#2E5EAA' : '#c8c8c8';
      div.innerHTML = window.getEditorIcon(ICON_MAP[el.subtype] || 'table');
      fo.appendChild(div);
      g.appendChild(fo);
      g.addEventListener('mousedown', e => startDrag(e, 'element', el.id));
      g.addEventListener('click', e => {
        e.stopPropagation();
        if (state.tool === 'select') {
          state.selected = { kind:'element', id:el.id };
          state.multiSelected = [];
          render(); renderProps();
        }
      });
      L.layerFurniture.appendChild(g);
    }
  }

  function renderText() {
    L.layerText.innerHTML = '';
    for (const el of state.elements) {
      if (el.type !== 'text') continue;
      const p = m2px(el.x, el.y);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', p.x); t.setAttribute('y', p.y);
      t.setAttribute('class', 'svg-label');
      t.dataset.kind = 'element'; t.dataset.id = el.id;
      t.style.cursor = 'move';
      t.textContent = el.name || 'Текст';
      t.addEventListener('mousedown', e => startDrag(e, 'element', el.id));
      t.addEventListener('click', e => {
        e.stopPropagation();
        if (state.tool === 'select') {
          state.selected = { kind:'element', id:el.id };
          state.multiSelected = [];
          render(); renderProps();
        }
      });
      L.layerText.appendChild(t);
    }
  }

  const DEV_ICON = { pc:'pc', laptop:'laptop', printer:'printer',
                     scanner:'scanner', camera:'camera', router:'router',
                     patch:'patch', wlc:'wlc' };

  function renderDevices() {
    L.layerDevices.innerHTML = '';
    for (const d of state.devices) {
      if (!DEV_ICON[d.type]) continue;
      const p = m2px(d.x, d.y);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(' + (p.x - 16) + ',' + (p.y - 16) + ')');
      g.dataset.kind = 'device'; g.dataset.id = d.id;
      g.style.cursor = 'move';
      const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      fo.setAttribute('width', 32); fo.setAttribute('height', 32);
      const div = document.createElement('div');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.style.width = '32px'; div.style.height = '32px';
      div.style.color = isSelected('device', d.id) ? '#2E5EAA' : '#b0b0b0';
      div.innerHTML = window.getEditorIcon(DEV_ICON[d.type]);
      fo.appendChild(div);
      g.appendChild(fo);
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', 16); lbl.setAttribute('y', 44);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('class', 'svg-label');
      lbl.textContent = d.name;
      g.appendChild(lbl);
      g.addEventListener('mousedown', e => startDrag(e, 'device', d.id));
      g.addEventListener('click', e => {
        e.stopPropagation();
        if (state.tool === 'select') {
          state.selected = { kind:'device', id:d.id };
          state.multiSelected = [];
          render(); renderProps();
        }
      });
      L.layerDevices.appendChild(g);
    }
  }

  const IOT_ICON = { light:'light', sensor:'sensor', lock:'lock',
                     doorphone:'doorphone', ac:'ac' };

  function renderIoT() {
    L.layerIoT.innerHTML = '';
    for (const d of state.devices) {
      if (!IOT_ICON[d.type]) continue;
      const p = m2px(d.x, d.y);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(' + (p.x - 14) + ',' + (p.y - 14) + ')');
      g.dataset.kind = 'device'; g.dataset.id = d.id;
      g.style.cursor = 'move';
      const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      fo.setAttribute('width', 28); fo.setAttribute('height', 28);
      const div = document.createElement('div');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.style.width = '28px'; div.style.height = '28px';
      div.innerHTML = window.getEditorIcon(IOT_ICON[d.type]);
      fo.appendChild(div);
      g.appendChild(fo);
      g.addEventListener('mousedown', e => startDrag(e, 'device', d.id));
      g.addEventListener('click', e => {
        e.stopPropagation();
        if (state.tool === 'select') {
          state.selected = { kind:'device', id:d.id };
          state.multiSelected = [];
          render(); renderProps();
        }
      });
      L.layerIoT.appendChild(g);
    }
  }

  function renderSwitches() {
    L.layerSwitches.innerHTML = '';
    for (const sw of state.switches) {
      const p = m2px(sw.x, sw.y);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(' + (p.x - 20) + ',' + (p.y - 16) + ')');
      g.dataset.kind = 'switch'; g.dataset.id = sw.id;
      g.style.cursor = 'move';
      const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      fo.setAttribute('width', 40); fo.setAttribute('height', 32);
      const div = document.createElement('div');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.style.width = '40px'; div.style.height = '32px';
      div.innerHTML = window.getEditorIcon('switch');
      fo.appendChild(div);
      g.appendChild(fo);
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', 20); lbl.setAttribute('y', 44);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('class', 'svg-label');
      lbl.textContent = sw.name;
      g.appendChild(lbl);
      g.addEventListener('mousedown', e => startDrag(e, 'switch', sw.id));
      g.addEventListener('click', e => {
        e.stopPropagation();
        if (state.tool === 'select') {
          state.selected = { kind:'switch', id:sw.id };
          state.multiSelected = [];
          render(); renderProps();
        }
      });
      L.layerSwitches.appendChild(g);
    }
  }

  function renderAPs() {
    L.layerAps.innerHTML = '';
    for (const ap of state.aps) {
      const p = m2px(ap.x, ap.y);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(' + (p.x - 20) + ',' + (p.y - 20) + ')');
      g.dataset.kind = 'ap'; g.dataset.id = ap.id;
      g.style.cursor = 'move';
      const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      fo.setAttribute('width', 40); fo.setAttribute('height', 40);
      const div = document.createElement('div');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.style.width = '40px'; div.style.height = '40px';
      div.style.color = '#2E5EAA';
      div.innerHTML = window.getEditorIcon('ap');
      fo.appendChild(div);
      g.appendChild(fo);
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', 20); lbl.setAttribute('y', 52);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('class', 'svg-label');
      lbl.textContent = ap.name;
      g.appendChild(lbl);
      g.addEventListener('mousedown', e => startDrag(e, 'ap', ap.id));
      g.addEventListener('click', e => {
        e.stopPropagation();
        if (state.tool === 'select') {
          state.selected = { kind:'ap', id:ap.id };
          state.multiSelected = [];
          render(); renderProps();
        }
      });
      L.layerAps.appendChild(g);
    }
  }

  function renderCables() {
    L.layerCables.innerHTML = '';
    if (!document.getElementById('chkLayerCables').checked) return;

    if (state.switches.length) {
      for (const ap of state.aps) {
        let best = null, bd = Infinity;
        for (const sw of state.switches) {
          const d = Math.hypot(ap.x - sw.x, ap.y - sw.y) * CABLE_COEF;
          if (d < bd) { bd = d; best = sw; }
        }
        if (!best) continue;
        drawCableLine(best.x, best.y, ap.x, ap.y, bd, true);
      }
    }

    const wireless = ['pc','laptop','printer','scanner','camera','light','sensor','lock','doorphone','ac'];
    for (const d of state.devices) {
      if (!wireless.includes(d.type)) continue;
      let bestAP = null, bdAP = Infinity;
      for (const ap of state.aps) {
        const dist = Math.hypot(d.x - ap.x, d.y - ap.y);
        if (dist < bdAP) { bdAP = dist; bestAP = ap; }
      }
      if (bestAP) {
        const a = m2px(bestAP.x, bestAP.y);
        const b = m2px(d.x, d.y);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
        line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
        line.setAttribute('stroke', bdAP > 30 ? '#f44336' : '#4caf50');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '2 3');
        line.setAttribute('opacity', '0.6');
        L.layerCables.appendChild(line);
      }
    }
  }

  function drawCableLine(x1, y1, x2, y2, lenM, isMain) {
    const a = m2px(x1, y1);
    const b = m2px(x2, y2);
    const over = lenM > CABLE_LIMIT_M;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    path.setAttribute('x1', a.x); path.setAttribute('y1', a.y);
    path.setAttribute('x2', b.x); path.setAttribute('y2', b.y);
    path.setAttribute('stroke', over ? '#f44336' : '#2E5EAA');
    path.setAttribute('stroke-width', isMain ? '1.2' : '0.8');
    path.setAttribute('stroke-dasharray', '4 3');
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

  function renderCoverage() {
    L.layerCoverage.innerHTML = '';
    if (!document.getElementById('chkLayerCoverage').checked) return;
    if (state.heatmap) return;
    for (const ap of state.aps) {
      const p = m2px(ap.x, ap.y);
      let r_m = 5 + (ap.power - 10) * 0.8;
      if (ap.freq === 2400) r_m *= 1.4;
      if (ap.freq === 6000) r_m *= 0.8;
      const r_px = r_m * PX_PER_M;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
      c.setAttribute('r', r_px);
      c.setAttribute('fill', 'rgba(46,94,170,.08)');
      c.setAttribute('stroke', 'rgba(46,94,170,.5)');
      c.setAttribute('stroke-width', '1');
      c.setAttribute('stroke-dasharray', '4 4');
      c.setAttribute('pointer-events', 'none');
      L.layerCoverage.appendChild(c);
    }
  }

  // ============================================================
  // ВЫДЕЛЕНИЕ / DRAG
  // ============================================================
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
    if (kind === 'ap') return state.aps.find(x => x.id === id);
    if (kind === 'device') return state.devices.find(x => x.id === id);
    if (kind === 'switch') return state.switches.find(x => x.id === id);
    if (kind === 'element') return state.elements.find(x => x.id === id);
  }

  function startDrag(e, kind, id) {
    if (state.tool !== 'select') return;
    e.stopPropagation(); e.preventDefault();
    const inMulti = state.multiSelected.some(s => s.kind === kind && s.id === id);
    const single = state.selected && state.selected.kind === kind && state.selected.id === id;
    if (!inMulti && !single) {
      state.selected = { kind, id };
      state.multiSelected = [];
      render(); renderProps();
    }
    const list = state.multiSelected.length ? state.multiSelected : [state.selected];
    const items = [];
    for (const s of list) {
      const o = getObj(s.kind, s.id);
      if (!o) continue;
      if (s.kind === 'element' && o.type === 'wall') {
        items.push({ kind: s.kind, id: s.id, isWall: true, sx: o.x1, sy: o.y1, ex: o.x2, ey: o.y2 });
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

  async function onDragEnd() {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.body.style.cursor = '';
    if (!state.drag) return;
    const items = state.drag.items;
    state.drag = null;

    let moved = false;
    for (const it of items) {
      if (it.isX1 != null || it.nx1 != null || it.nx != null) { moved = true; break; }
    }
    if (!moved) { render(); renderProps(); return; }

    pushHistory('перемещение');

    // Сохранение на бэкенд
    if (state.projectId) {
      flashSaving();
      for (const it of items) {
        const o = getObj(it.kind, it.id);
        if (!o) continue;
        try {
          if (it.kind === 'ap') await EditorAPI.updateAP(o.id, EditorAPI.apToDB(o));
          else if (it.kind === 'switch') await EditorAPI.updateSwitch(o.id, EditorAPI.switchToDB(o));
          else if (it.kind === 'device') await EditorAPI.updateDevice(o.id, EditorAPI.deviceToDB(o));
          else if (it.kind === 'element') await EditorAPI.updateElement(o.id, EditorAPI.elementToDB(o));
        } catch (err) { flashError(err.message); }
      }
      flashSaved();
    }

    if (state.heatmap) recalcHeatmap();
    render(); renderProps();
  }

  function flashSnap(mx, my) {
    if (!state.snap) return;
    const p = m2px(snap(mx), snap(my));
    const size = SNAP_M * PX_PER_M;
    snapIndicator.style.left = (p.x - size/2) + 'px';
    snapIndicator.style.top = (p.y - size/2) + 'px';
    snapIndicator.style.width = size + 'px';
    snapIndicator.style.height = size + 'px';
    snapIndicator.style.display = 'block';
    clearTimeout(snapIndicator._t);
    snapIndicator._t = setTimeout(() => snapIndicator.style.display = 'none', 400);
  }

  // ============================================================
  // РЕСАЙЗ
  // ============================================================
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
      x1 = p.x; y1 = p.y;
      x2 = p.x + (el.width || 4) * PX_PER_M;
      y2 = p.y + (el.height || 3) * PX_PER_M;
    } else if (el.type === 'furniture') {
      const p = m2px(el.x, el.y);
      const w = (el.width || 1.5) * PX_PER_M;
      const h = (el.height || 1) * PX_PER_M;
      x1 = p.x - w/2; y1 = p.y - h/2;
      x2 = p.x + w/2; y2 = p.y + h/2;
    } else return;

    if (el.type !== 'wall') {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', x1); r.setAttribute('y', y1);
      r.setAttribute('width', x2 - x1); r.setAttribute('height', y2 - y1);
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
        { x: x1, y: y1, c: 'nwse-resize' }, { x: cx, y: y1, c: 'ns-resize' },
        { x: x2, y: y1, c: 'nesw-resize' }, { x: x2, y: cy, c: 'ew-resize' },
        { x: x2, y: y2, c: 'nwse-resize' }, { x: cx, y: y2, c: 'ns-resize' },
        { x: x1, y: y2, c: 'nesw-resize' }, { x: x1, y: cy, c: 'ew-resize' }
      ];
    }

    markers.forEach(cn => {
      const mk = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      mk.setAttribute('x', cn.x - 5); mk.setAttribute('y', cn.y - 5);
      mk.setAttribute('width', 10); mk.setAttribute('height', 10);
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

  function startWallResize(e, el, which) {
    document.body.style.cursor = 'crosshair';
    function onMove(ev) {
      const em = eventToM(ev);
      const nx = snap(em.m.x), ny = snap(em.m.y);
      if (which === 'start') { el.x1 = nx; el.y1 = ny; }
      else { el.x2 = nx; el.y2 = ny; }
      renderWalls();
      renderMarkers();
      renderMeasurements();
    }
    async function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      pushHistory('resize стены');
      if (state.projectId) {
        try {
          flashSaving();
          await EditorAPI.updateElement(el.id, EditorAPI.elementToDB(el));
          flashSaved();
        } catch (err) { flashError(err.message); }
      }
      if (state.heatmap) recalcHeatmap();
      render();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startShapeResize(e, el, mx, my, x1, y1, x2, y2) {
    const start = {
      w: el.width || (el.type === 'furniture' ? 1.5 : 4),
      h: el.height || (el.type === 'furniture' ? 1 : 3),
      x: el.x, y: el.y,
      which: (mx === x1 ? 'w' : mx === x2 ? 'e' : '') + (my === y1 ? 'n' : my === y2 ? 's' : ''),
      mm: eventToM(e).m
    };
    function onMove(ev) {
      const em = eventToM(ev);
      const dx = em.m.x - start.mm.x, dy = em.m.y - start.mm.y;
      let w = start.w, h = start.h, x = start.x, y = start.y;
      if (start.which.includes('e')) w += dx;
      if (start.which.includes('w')) { w -= dx; x += dx; }
      if (start.which.includes('s')) h += dy;
      if (start.which.includes('n')) { h -= dy; y += dy; }
      if (w < 0.5) w = 0.5;
      if (h < 0.5) h = 0.5;
      el.width = +w.toFixed(2); el.height = +h.toFixed(2);
      el.x = +snap(x).toFixed(2); el.y = +snap(y).toFixed(2);
      render();
    }
    async function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      pushHistory('resize');
      if (state.projectId && el.type === 'furniture') {
        try {
          flashSaving();
          await EditorAPI.updateElement(el.id, EditorAPI.elementToDB(el));
          flashSaved();
        } catch (err) { flashError(err.message); }
      }
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ============================================================
  // СОБЫТИЯ ХОЛСТА
  // ============================================================
  svg.addEventListener('mousemove', e => {
    if (!state.project) return;
    const em = eventToM(e);
    state.lastMousePos = { x: snap(em.m.x), y: snap(em.m.y) };
    document.getElementById('cursorPos').textContent =
      'X: ' + em.m.x.toFixed(1) + '  Y: ' + em.m.y.toFixed(1);

    if (state.tool === 'wall' && state.draft) {
      const x = snap(em.m.x), y = snap(em.m.y);
      const a = m2px(state.draft.x1, state.draft.y1);
      const b = m2px(x, y);
      let line = L.layerDraft.querySelector('line');
      if (!line) {
        line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
        line.setAttribute('stroke', '#2E5EAA');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', '6 3');
        L.layerDraft.appendChild(line);
      }
      line.setAttribute('x2', b.x);
      line.setAttribute('y2', b.y);
    }
  });

  svg.addEventListener('click', async e => {
    if (!state.project) return;
    if (e.target.closest && e.target.closest('[data-kind]')) return;
    const em = eventToM(e);
    const x = snap(em.m.x), y = snap(em.m.y);

    if (state.tool === 'wall') {
      const mat = state.wallMaterial;
      if (!state.draft) {
        const a = findAnchor(x, y);
        state.draft = { x1: a ? a.x : x, y1: a ? a.y : y };
        L.layerDraft.innerHTML = '';
        const p = m2px(state.draft.x1, state.draft.y1);
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
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
      const ex = a ? a.x : x, ey = a ? a.y : y;
      if (Math.hypot(ex - state.draft.x1, ey - state.draft.y1) < 0.3) {
        state.draft = null; L.layerDraft.innerHTML = ''; return;
      }
      const wallData = {
        id: nextId(), type:'wall', material: mat,
        x1: state.draft.x1, y1: state.draft.y1, x2: ex, y2: ey
      };
      state.elements.push(wallData);
      state.draft = null;
      L.layerDraft.innerHTML = '';
      pushHistory('стена');

      // Сохранение на бэкенд
      if (state.projectId) {
        try {
          flashSaving();
          const saved = await EditorAPI.createElement(state.projectId, {
            type: 'wall', material: mat,
            x1: wallData.x1, y1: wallData.y1, x2: wallData.x2, y2: wallData.y2
          });
          // Обновляем локальный id на серверный
          wallData.id = saved.id;
          flashSaved();
        } catch (err) { flashError(err.message); }
      }

      if (state.heatmap) recalcHeatmap();
      render();
      return;
    }
    if (state.tool === 'door') {
  // Ищем ближайшую стену
  let nearest = null;
  let nearestDist = 15;   // 15 px допуска

  for (const wall of state.elements.filter(x => x.type === 'wall')) {
    const a = m2px(wall.x1, wall.y1);
    const b = m2px(wall.x2, wall.y2);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1) continue;

    // Проекция точки на прямую
    const t = Math.max(0, Math.min(1, ((em.px - a.x) * dx + (em.py - a.y) * dy) / len2));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    const d = Math.hypot(em.px - projX, em.py - projY);

    if (d < nearestDist) {
      nearestDist = d;
      const wallLenM = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
      const projM = { x: wall.x1 + t * (wall.x2 - wall.x1), y: wall.y1 + t * (wall.y2 - wall.y1) };
      nearest = {
        wall: wall,
        point: projM,
        angle: Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1)
      };
    }
  }

  if (!nearest) {
    canvasHint.textContent = 'Кликните ближе к стене';
    return;
  }

  const doorData = {
    id: nextId(),
    type: 'door',
    x: +nearest.point.x.toFixed(2),
    y: +nearest.point.y.toFixed(2),
    angle: +nearest.angle.toFixed(4),
    width: DOOR_CONFIG.width_m,
    side: 'right',
    inward: true
  };
  state.elements.push(doorData);
  pushHistory('дверь');

  if (state.projectId) {
    try {
      flashSaving();
      const saved = await EditorAPI.createElement(state.projectId, {
        type: 'door',
        x: doorData.x, y: doorData.y,
        width: doorData.width,
        rotation: 0
      });
      if (saved && saved.id) doorData.id = saved.id;
      flashSaved();
    } catch (err) { flashError(err.message); }
  }

  // Возвращаем инструмент «Выделение»
  setActiveTool('select');
  render();
  canvasHint.textContent = 'Дверь добавлена';
  return;
} 

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

    if (state.tool === 'text') {
      const t = prompt('Введите текст:');
      if (!t) return;
      const textEl = { id:nextId(), type:'text', name: t, x, y };
      state.elements.push(textEl);
      pushHistory('текст');
      if (state.projectId) {
        try {
          flashSaving();
          const saved = await EditorAPI.createElement(state.projectId, {
            type: 'text', name: t, x, y
          });
          textEl.id = saved.id;
          flashSaved();
        } catch (err) { flashError(err.message); }
      }
      render();
      return;
    }

    if (state.tool === 'select') {
      state.selected = null;
      state.multiSelected = [];
      render(); renderProps();
    }
  });

  svg.addEventListener('dblclick', async () => {
    if (state.tool === 'room' && state.roomPoints.length >= 3) {
      const roomEl = {
        id:nextId(), type:'room', points_json: JSON.stringify(state.roomPoints)
      };
      state.elements.push(roomEl);
      state.roomPoints = [];
      L.layerDraft.innerHTML = '';
      pushHistory('комната');
      if (state.projectId) {
        try {
          flashSaving();
          const saved = await EditorAPI.createElement(state.projectId, {
            type: 'room', points_json: roomEl.points_json
          });
          roomEl.id = saved.id;
          flashSaved();
        } catch (err) { flashError(err.message); }
      }
      render();
    }
  });

  svg.addEventListener('mousedown', e => {
    if (state.tool !== 'select' || !state.project) return;
    if (e.target.closest && e.target.closest('[data-kind]')) return;
    if (e.button !== 0) return;
    const r0 = svg.getBoundingClientRect();
    const sx = e.clientX - r0.left, sy = e.clientY - r0.top;
    let moved = false;
    function onMove(ev) {
      const cx = ev.clientX - r0.left, cy = ev.clientY - r0.top;
      if (Math.hypot(cx - sx, cy - sy) < 5) return;
      moved = true;
      const left = Math.min(sx, cx), top = Math.min(sy, cy);
      const w = Math.abs(cx - sx), h = Math.abs(cy - sy);
      selectionRectEl.style.left = left + 'px';
      selectionRectEl.style.top = top + 'px';
      selectionRectEl.style.width = w + 'px';
      selectionRectEl.style.height = h + 'px';
      selectionRectEl.style.display = 'block';
    }
    function onUp(ev) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      selectionRectEl.style.display = 'none';
      if (!moved) return;
      const cx = ev.clientX - r0.left, cy = ev.clientY - r0.top;
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
      render(); renderProps();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // ============================================================
  // DRAG & DROP ИЗ ПАЛИТРЫ
  // ============================================================
  wrap.addEventListener('dragover', e => e.preventDefault());
  wrap.addEventListener('drop', async e => {
    e.preventDefault();
    if (!state.project) return;
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    let payload;
    try { payload = JSON.parse(raw); } catch (err) { return; }
    const em = eventToM(e);
    const x = snap(em.m.x), y = snap(em.m.y);
    if (payload.key === 'wall') {
      state.tool = 'wall';
      state.wallMaterial = payload.material;
      setActiveTool('wall');
      return;
    }
    await placeObject(payload.key, x, y);
  });

  // ============================================================
  // СОЗДАНИЕ ОБЪЕКТОВ
  // ============================================================
  async function placeObject(kind, x, y) {
    if (!state.project) { alert('Создайте проект'); return; }
    x = +snap(x).toFixed(2); y = +snap(y).toFixed(2);
    pushHistory('создание');

    let localObj = null;
    let serverData = null;
    let createFn = null;

    if (kind === 'switch') {
      swCnt++;
      localObj = { id:nextId(), name:'SW-' + String(swCnt).padStart(2,'0'),
        x, y, totalPorts:24, poeBudget:370 };
      state.switches.push(localObj);
      serverData = EditorAPI.switchToDB(localObj);
      createFn = EditorAPI.createSwitch;
    } else if (kind === 'ap') {
      apCnt++;
      localObj = { id:nextId(), name:'AP-' + String(apCnt).padStart(2,'0'),
        x, y, power:20, gain:5, freq:2400, band:'2.4', channel:6 };
      state.aps.push(localObj);
      serverData = EditorAPI.apToDB(localObj);
      createFn = EditorAPI.createAP;
    } else if (['pc','laptop','printer','scanner','camera','router','patch','wlc'].includes(kind)) {
      devCnt++;
      const pfx = { pc:'PC-', laptop:'LT-', printer:'MFP-', scanner:'SC-',
                    camera:'CAM-', router:'RT-', patch:'PP-', wlc:'WLC-' };
      localObj = { id:nextId(), name: pfx[kind] + String(devCnt).padStart(2,'0'),
        type:kind, x, y };
      state.devices.push(localObj);
      serverData = EditorAPI.deviceToDB(localObj);
      createFn = EditorAPI.createDevice;
    } else if (['light','sensor','lock','doorphone','ac'].includes(kind)) {
      devCnt++;
      const pfx = { light:'LT-', sensor:'TH-', lock:'LK-', doorphone:'DF-', ac:'AC-' };
      localObj = { id:nextId(), name: pfx[kind] + String(devCnt).padStart(2,'0'),
        type:kind, x, y };
      state.devices.push(localObj);
      serverData = EditorAPI.deviceToDB(localObj);
      createFn = EditorAPI.createDevice;
    } else if (['table','chair','sofa','plant'].includes(kind)) {
      localObj = { id:nextId(), type:'furniture', subtype:kind,
        x, y, width:1.5, height:1 };
      state.elements.push(localObj);
      serverData = EditorAPI.elementToDB(localObj);
      createFn = EditorAPI.createElement;
    }

    render();

    if (state.projectId && createFn && serverData) {
      try {
        flashSaving();
        const saved = await createFn(state.projectId, serverData);
        if (saved && saved.id) localObj.id = saved.id;
        flashSaved();
      } catch (err) { flashError(err.message); }
    }
  }

  function setActiveTool(name) {
    state.tool = name;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === name);
    });
  }
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
    b.addEventListener('click', () => {
      setActiveTool(b.dataset.tool);
      state.draft = null; state.roomPoints = [];
      L.layerDraft.innerHTML = '';
      canvasHint.textContent = {
        select:'Выделение', wall:'Стена: клик — начало, клик — конец',
        room:'Комната: клик по углам, двойной клик — замкнуть',
        text:'Текст: кликните на холст'
      }[b.dataset.tool] || '';
    });
  });

  // ============================================================
  // HISTORY
  // ============================================================
  function pushHistory(action) {
    state.history.push({
      action,
      snap: {
        elements: JSON.parse(JSON.stringify(state.elements)),
        aps: JSON.parse(JSON.stringify(state.aps)),
        switches: JSON.parse(JSON.stringify(state.switches)),
        devices: JSON.parse(JSON.stringify(state.devices))
      }
    });
    if (state.history.length > 50) state.history.shift();
    state.redoStack = [];
  }
  function applySnapshot(s) {
    state.elements = JSON.parse(JSON.stringify(s.elements));
    state.aps = JSON.parse(JSON.stringify(s.aps));
    state.switches = JSON.parse(JSON.stringify(s.switches));
    state.devices = JSON.parse(JSON.stringify(s.devices));
    state.selected = null; state.multiSelected = [];
    render(); renderProps();
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

  // ============================================================
  // КЛАВИАТУРА
  // ============================================================
  document.addEventListener('keydown', async e => {
    const t = (e.target.tagName || '').toLowerCase();
    if (['input','textarea','select'].includes(t)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    else if (ctrl && e.key.toLowerCase() === 'c') { e.preventDefault(); copySel(); }
    else if (ctrl && e.key.toLowerCase() === 'v') { e.preventDefault(); await pasteClip(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); await delSel(); }
    else if (e.key === 'Escape') {
      state.draft = null; state.roomPoints = [];
      L.layerDraft.innerHTML = '';
      state.selected = null; state.multiSelected = [];
      render(); renderProps();
    }
  });

  function copySel() {
    const list = state.multiSelected.length ? state.multiSelected : (state.selected ? [state.selected] : []);
    if (!list.length) return;
    state.clipboard = list.map(s => {
      const o = getObj(s.kind, s.id);
      if (!o) return null;
      const c = JSON.parse(JSON.stringify(o));
      delete c.id;
      return { kind: s.kind, payload: c };
    }).filter(Boolean);
  }
  async function pasteClip() {
    if (!state.clipboard) return;
    pushHistory('вставка');
    for (const it of state.clipboard) {
      const p = JSON.parse(JSON.stringify(it.payload));
      p.id = nextId();
      if (p.x != null) p.x = snap(p.x + 1);
      if (p.y != null) p.y = snap(p.y + 1);
      if (it.kind === 'ap') state.aps.push(p);
      else if (it.kind === 'switch') state.switches.push(p);
      else if (it.kind === 'device') state.devices.push(p);
      else if (it.kind === 'element') state.elements.push(p);

      if (state.projectId) {
        try {
          let createFn, serverData;
          if (it.kind === 'ap') { createFn = EditorAPI.createAP; serverData = EditorAPI.apToDB(p); }
          else if (it.kind === 'switch') { createFn = EditorAPI.createSwitch; serverData = EditorAPI.switchToDB(p); }
          else if (it.kind === 'device') { createFn = EditorAPI.createDevice; serverData = EditorAPI.deviceToDB(p); }
          else if (it.kind === 'element') { createFn = EditorAPI.createElement; serverData = EditorAPI.elementToDB(p); }
          const saved = await createFn(state.projectId, serverData);
          if (saved && saved.id) p.id = saved.id;
        } catch (err) { flashError(err.message); }
      }
    }
    render();
  }
  async function delSel() {
    const list = state.multiSelected.length ? state.multiSelected : (state.selected ? [state.selected] : []);
    if (!list.length) return;
    if (!confirm('Удалить ' + list.length + ' объектов?')) return;
    pushHistory('удаление');
    for (const s of list) {
      if (s.kind === 'ap') state.aps = state.aps.filter(x => x.id !== s.id);
      else if (s.kind === 'switch') state.switches = state.switches.filter(x => x.id !== s.id);
      else if (s.kind === 'device') state.devices = state.devices.filter(x => x.id !== s.id);
      else if (s.kind === 'element') state.elements = state.elements.filter(x => x.id !== s.id);

      if (state.projectId) {
        try {
          flashSaving();
          if (s.kind === 'ap') await EditorAPI.deleteAP(s.id);
          else if (s.kind === 'switch') await EditorAPI.deleteSwitch(s.id);
          else if (s.kind === 'device') await EditorAPI.deleteDevice(s.id);
          else if (s.kind === 'element') await EditorAPI.deleteElement(s.id);
          flashSaved();
        } catch (err) { flashError(err.message); }
      }
    }
    state.selected = null; state.multiSelected = [];
    if (state.heatmap) recalcHeatmap();
    render(); renderProps();
  }

  // ============================================================
  // ZOOM / PAN
  // ============================================================
  function setZoom(z) {
    const cur = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
    const cx = cur[0] + cur[2] / 2, cy = cur[1] + cur[3] / 2;
    const factor = z / state.zoom;
    const newW = cur[2] / factor, newH = cur[3] / factor;
    state.zoom = z;
    applyViewBox(cx - newW / 2, cy - newH / 2, newW, newH);
    document.getElementById('zoomLabel').textContent = Math.round(z * 100) + '%';
    if (state.heatmap) drawHeatmap();
  }
  document.getElementById('zoomIn').addEventListener('click', () => setZoom(Math.min(3, state.zoom + 0.15)));
  document.getElementById('zoomOut').addEventListener('click', () => setZoom(Math.max(0.25, state.zoom - 0.15)));

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      zoomAtPoint(e, e.deltaY > 0 ? -0.12 : 0.12);
    } else {
      panBy(-e.deltaX, -e.deltaY);
    }
  }, { passive: false });

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
    const newW = cur[2] / factor, newH = cur[3] / factor;
    const newX = mx - (mx - cur[0]) / factor;
    const newY = my - (my - cur[1]) / factor;
    state.zoom = newZoom;
    applyViewBox(newX, newY, newW, newH);
    document.getElementById('zoomLabel').textContent = Math.round(newZoom * 100) + '%';
    if (state.heatmap) drawHeatmap();
  }

  // ============================================================
  // СЛОИ
  // ============================================================
  document.getElementById('chkLayerWalls').addEventListener('change', function () {
    L.layerWalls.style.display = this.checked ? '' : 'none';
  });
  document.getElementById('chkLayerFurniture').addEventListener('change', function () {
    L.layerFurniture.style.display = this.checked ? '' : 'none';
  });
  document.getElementById('chkLayerDevices').addEventListener('change', function () {
    L.layerDevices.style.display = this.checked ? '' : 'none';
    L.layerIoT.style.display = this.checked ? '' : 'none';
  });
  document.getElementById('chkLayerCoverage').addEventListener('change', function () {
    L.layerCoverage.style.display = this.checked ? '' : 'none';
    heatmapCanvas.style.display = this.checked && state.heatmap ? 'block' : 'none';
  });
  document.getElementById('chkLayerCables').addEventListener('change', renderCables);

  document.getElementById('toggleSnap').addEventListener('click', function () {
    state.snap = !state.snap;
    this.textContent = state.snap ? 'Выкл. сетку' : 'Вкл. сетку';
    document.getElementById('snapStatus').textContent = state.snap ? 'Сетка: 0.5 м' : 'Сетка: выкл';
    document.getElementById('metaGrid').textContent = state.snap ? '0.5 м' : 'выкл';
  });

  // ============================================================
  // ТЕПЛОВАЯ КАРТА
  // ============================================================
  document.getElementById('btnRssi').addEventListener('click', () => calcHeatmap('rssi'));
  document.getElementById('btnSnr').addEventListener('click', () => calcHeatmap('snr'));
  document.getElementById('btnInterf').addEventListener('click', () => calcHeatmap('interference'));
  document.getElementById('btnLoad').addEventListener('click', showLoadReport);
document.getElementById('btnAutoPlace').addEventListener('click', showAutoPlaceModal);

document.getElementById('autoPlaceClose').addEventListener('click', () => {
  document.getElementById('autoPlaceModal').classList.remove('show');
  L.layerDraft.innerHTML = '';
  autoPlaceResult = null;
  render();
});

document.getElementById('autoPlaceCalc').addEventListener('click', previewAutoPlace);
  function calcHeatmap(mode) {
    if (!state.project) return alert('Создайте проект');
    if (!state.aps.length) return alert('Разместите хотя бы одну AP');
    state.heatmapMode = mode;
    state.heatmap = buildHeatmap(mode);
    drawHeatmap();
    heatmapCanvas.style.display = 'block';
    const names = { rssi: 'RSSI', snr: 'SNR', interference: 'Интерференция' };
    canvasHint.textContent = 'Тепловая карта: ' + (names[mode] || mode.toUpperCase());
  }
  function recalcHeatmap() {
  if (!state.heatmap) return;
  state.heatmap = buildHeatmap(state.heatmapMode);
  drawHeatmap();
  }
const NOISE_FLOOR = -95;  // уровень шума, дБм

function buildHeatmap(mode) {
  mode = mode || state.heatmapMode || 'rssi';
  const step = 0.5;
  const cols = Math.ceil(state.project.width_m / step);
  const rows = Math.ceil(state.project.height_m / step);
  const grid = [];
  let total = 0, sum = 0, dead = 0, weak = 0, good = 0, exc = 0;
  let min = Infinity, max = -Infinity;
  const deadZones = [];

  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const x = c * step + step / 2;
      const y = r * step + step / 2;

      let val;
      if (mode === 'snr') {
        val = coverageAt(x, y) - NOISE_FLOOR;
      } else if (mode === 'interference') {
        val = interferenceAt(x, y);
      } else {
        val = coverageAt(x, y);  // RSSI
      }
      row.push(val);

      total++; sum += val;
      if (val < min) min = val;
      if (val > max) max = val;

      if (mode === 'snr') {
        // SNR — чем выше, тем лучше
        if (val >= 40) exc++;
        else if (val >= 25) good++;
        else if (val >= 15) weak++;
        else { dead++; if (deadZones.length < 50) deadZones.push({ x, y, dbm: val }); }
      } else if (mode === 'interference') {
        // Интерференция — чем НИЖЕ, тем лучше
        if (val <= -95) exc++;        // нет интерференции
        else if (val <= -85) good++;  // слабая
        else if (val <= -75) weak++;  // средняя
        else { dead++; if (deadZones.length < 50) deadZones.push({ x, y, dbm: val }); }
      } else {
        // RSSI — чем выше, тем лучше
        if (val >= -65) exc++;
        else if (val >= -75) good++;
        else if (val >= -85) weak++;
        else { dead++; if (deadZones.length < 50) deadZones.push({ x, y, dbm: val }); }
      }
    }
    grid.push(row);
  }
  return { cols, rows, grid, mode, stats: {
    total, avg: sum / total, min, max,
    deadPct: dead / total * 100, weakPct: weak / total * 100,
    goodPct: good / total * 100, excPct: exc / total * 100,
    deadZones
  }};
}
  function drawHeatmap() {
    if (!state.heatmap || !state.project) return;
    const W = state.project.width_m * PX_PER_M;
    const H = state.project.height_m * PX_PER_M;
    heatmapCanvas.width = W;
    heatmapCanvas.height = H;

    const m = svgMetrics();
    const wr = wrap.getBoundingClientRect();
    const screenX = (0 - m.vx) * m.scale + m.offsetX + (m.r.left - wr.left);
    const screenY = (0 - m.vy) * m.scale + m.offsetY + (m.r.top  - wr.top);
    const screenW = W * m.scale;
    const screenH = H * m.scale;

    heatmapCanvas.style.left = screenX + 'px';
    heatmapCanvas.style.top  = screenY + 'px';
    heatmapCanvas.style.width  = screenW + 'px';
    heatmapCanvas.style.height = screenH + 'px';

    const ctx = heatmapCanvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const cw = W / state.heatmap.cols, ch = H / state.heatmap.rows;
    for (let r = 0; r < state.heatmap.rows; r++) {
      for (let c = 0; c < state.heatmap.cols; c++) {
        const v = state.heatmap.grid[r][c];
        ctx.fillStyle = colorFor(v, state.heatmapMode);
        ctx.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
      }
    }
  }
function colorFor(v, mode) {
  if (mode === 'snr') {
    if (v >= 40) return 'rgba(76,175,80,0.45)';
    if (v >= 25) return 'rgba(139,195,74,0.45)';
    if (v >= 15) return 'rgba(255,193,7,0.45)';
    if (v >= 10) return 'rgba(255,152,0,0.5)';
    return 'rgba(244,67,54,0.55)';
  }
  if (mode === 'interference') {
    // Интерференция — чем ниже, тем лучше
    if (v <= -95) return 'rgba(0,0,0,0)';            // нет помех
    if (v <= -85) return 'rgba(76,175,80,0.35)';     // слабая
    if (v <= -75) return 'rgba(255,193,7,0.45)';     // средняя
    if (v <= -65) return 'rgba(255,152,0,0.55)';     // сильная
    return 'rgba(244,67,54,0.65)';                   // критическая
  }
  // RSSI
  if (v >= -65) return 'rgba(76,175,80,0.45)';
  if (v >= -75) return 'rgba(255,193,7,0.45)';
  if (v >= -85) return 'rgba(255,152,0,0.5)';
  return 'rgba(244,67,54,0.55)';
}

  // ============================================================
  // ПАНЕЛЬ СВОЙСТВ
  // ============================================================
  function renderProps() {
    if (state.multiSelected.length > 1) {
      propsPanel.innerHTML = '<div class="props-empty"><div class="props-empty-icon">🎯</div><div>Выделено <b>' + state.multiSelected.length + '</b> объектов</div></div>';
      return;
    }
    if (!state.selected) {
      propsPanel.innerHTML = '<div class="props-empty"><div class="props-empty-icon">🎨</div><div>Выберите объект на чертеже</div></div>';
      return;
    }
    if (state.selected.kind === 'ap') return propsAP();
    if (state.selected.kind === 'device') return propsDevice();
    if (state.selected.kind === 'element') return propsElement();
    if (state.selected.kind === 'switch') return propsSwitch();
  }

  function propsAP() {
    const ap = state.aps.find(x => x.id === state.selected.id);
    if (!ap) return;
    propsPanel.innerHTML =
      '<div class="props-header"><div class="icon">📡</div><div>' +
        '<div class="title">' + esc(ap.name) + '</div>' +
        '<div class="subtitle">Точка доступа</div></div></div>' +
      '<div class="props-section"><h4>Параметры</h4>' +
        '<div class="props-row"><label>Имя</label><input id="p_name" value="' + esc(ap.name) + '"></div>' +
        '<div class="props-row"><label>Мощность, dBm</label><input id="p_tx" type="number" value="' + ap.power + '" min="5" max="30"></div>' +
        '<div class="props-row"><label>Усиление, dBi</label><input id="p_gain" type="number" value="' + ap.gain + '" min="0" max="15"></div>' +
        '<div class="props-row"><label>Частота</label><select id="p_freq">' +
          '<option value="2400"' + (ap.freq===2400?' selected':'') + '>2.4 ГГц</option>' +
          '<option value="5000"' + (ap.freq===5000?' selected':'') + '>5 ГГц</option>' +
          '<option value="6000"' + (ap.freq===6000?' selected':'') + '>6 ГГц</option>' +
        '</select></div>' +
        '<div class="props-row"><label>Канал</label><input id="p_ch" type="number" value="' + ap.channel + '"></div>' +
      '</div>' +
      '<div class="props-section"><button class="btn-block" id="delBtn">🗑 Удалить</button></div>';
    ['p_name','p_tx','p_gain','p_freq','p_ch'].forEach(id => {
      document.getElementById(id).addEventListener('input', async () => {
        ap.name = document.getElementById('p_name').value;
        ap.power = parseFloat(document.getElementById('p_tx').value) || 20;
        ap.gain = parseFloat(document.getElementById('p_gain').value) || 5;
        ap.freq = parseInt(document.getElementById('p_freq').value, 10);
        ap.channel = parseInt(document.getElementById('p_ch').value, 10) || 6;
        render();
        if (state.heatmap) recalcHeatmap();
      });
    });
    document.getElementById('delBtn').addEventListener('click', async () => {
      state.aps = state.aps.filter(x => x.id !== ap.id);
      state.selected = null;
      if (state.projectId) {
        try { await EditorAPI.deleteAP(ap.id); flashSaved(); } catch (err) { flashError(err.message); }
      }
      if (state.heatmap) recalcHeatmap();
      render(); renderProps();
    });
  }

  function propsSwitch() {
    const sw = state.switches.find(x => x.id === state.selected.id);
    if (!sw) return;
    propsPanel.innerHTML =
      '<div class="props-header"><div class="icon">🔀</div><div>' +
        '<div class="title">' + esc(sw.name) + '</div>' +
        '<div class="subtitle">PoE-коммутатор</div></div></div>' +
      '<div class="props-section"><h4>Параметры</h4>' +
        '<div class="props-row"><label>Имя</label><input id="s_name" value="' + esc(sw.name) + '"></div>' +
        '<div class="props-row"><label>Портов</label><input id="s_ports" type="number" value="' + sw.totalPorts + '"></div>' +
        '<div class="props-row"><label>PoE, Вт</label><input id="s_poe" type="number" value="' + sw.poeBudget + '"></div>' +
      '</div>' +
      '<div class="props-section"><button class="btn-block" id="delBtn">🗑 Удалить</button></div>';
    ['s_name','s_ports','s_poe'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        sw.name = document.getElementById('s_name').value;
        sw.totalPorts = parseInt(document.getElementById('s_ports').value, 10) || 24;
        sw.poeBudget = parseFloat(document.getElementById('s_poe').value) || 370;
        render();
      });
    });
    document.getElementById('delBtn').addEventListener('click', async () => {
      state.switches = state.switches.filter(x => x.id !== sw.id);
      state.selected = null;
      if (state.projectId) {
        try { await EditorAPI.deleteSwitch(sw.id); flashSaved(); } catch (err) { flashError(err.message); }
      }
      render(); renderProps();
    });
  }

  function propsDevice() {
    const d = state.devices.find(x => x.id === state.selected.id);
    if (!d) return;
    let linkInfo = '';
    const wireless = ['pc','laptop','printer','scanner','camera','light','sensor','lock','doorphone','ac'];
    if (wireless.includes(d.type) && state.aps.length) {
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
      '<div class="props-header"><div class="icon">💻</div><div>' +
        '<div class="title">' + esc(d.name) + '</div>' +
        '<div class="subtitle">' + d.type + '</div></div></div>' +
      '<div class="props-section"><div class="props-row"><label>Имя</label>' +
        '<input id="d_name" value="' + esc(d.name) + '"></div></div>' +
      linkInfo +
      '<div class="props-section"><button class="btn-block" id="delBtn">🗑 Удалить</button></div>';
    document.getElementById('d_name').addEventListener('input', () => {
      d.name = document.getElementById('d_name').value; render();
    });
    document.getElementById('delBtn').addEventListener('click', async () => {
      state.devices = state.devices.filter(x => x.id !== d.id);
      state.selected = null;
      if (state.projectId) {
        try { await EditorAPI.deleteDevice(d.id); flashSaved(); } catch (err) { flashError(err.message); }
      }
      render(); renderProps();
    });
  }

  function propsElement() {
    const el = state.elements.find(x => x.id === state.selected.id);
    if (!el) return;
    if (el.type === 'door') {
  const widthM = (el.width || DOOR_CONFIG.width_m).toFixed(2);
  const angleDeg = ((el.angle || 0) * 180 / Math.PI).toFixed(0);
  propsPanel.innerHTML =
    '<div class="props-header"><div class="icon">🚪</div><div>' +
      '<div class="title">Дверь</div>' +
      '<div class="subtitle">' + widthM + ' м · ' + angleDeg + '°</div></div></div>' +
    '<div class="props-section"><h4>Параметры</h4>' +
      '<div class="props-row"><label>Ширина, м</label><input id="door_w" type="number" step="0.1" min="0.5" max="2" value="' + (el.width || DOOR_CONFIG.width_m) + '"></div>' +
      '<div class="props-row"><label>Сторона</label><select id="door_side">' +
        '<option value="right"' + (el.side === 'right' ? ' selected' : '') + '>Вправо</option>' +
        '<option value="left"' + (el.side === 'left' ? ' selected' : '') + '>Влево</option>' +
      '</select></div>' +
      '<div class="props-row"><label>Открывание</label><select id="door_in">' +
        '<option value="true"' + (el.inward !== false ? ' selected' : '') + '>Внутрь</option>' +
        '<option value="false"' + (el.inward === false ? ' selected' : '') + '>Наружу</option>' +
      '</select></div>' +
      '<div class="props-row"><label>Угол, °</label><input id="door_angle" type="number" step="5" value="' + angleDeg + '"></div>' +
    '</div>' +
    '<div class="props-section"><button class="btn-block" id="delBtn">🗑 Удалить</button></div>';

  document.getElementById('door_w').addEventListener('input', e => {
    el.width = parseFloat(e.target.value) || DOOR_CONFIG.width_m;
    render(); renderProps();
  });
  document.getElementById('door_side').addEventListener('change', e => {
    el.side = e.target.value;
    render(); renderProps();
  });
  document.getElementById('door_in').addEventListener('change', e => {
    el.inward = e.target.value === 'true';
    render(); renderProps();
  });
  document.getElementById('door_angle').addEventListener('input', e => {
    el.angle = (parseFloat(e.target.value) || 0) * Math.PI / 180;
    render(); renderProps();
  });
  document.getElementById('delBtn').addEventListener('click', async () => {
    state.elements = state.elements.filter(x => x.id !== el.id);
    state.selected = null;
    if (state.projectId) {
      try { await EditorAPI.deleteElement(el.id); flashSaved(); } catch (err) { flashError(err.message); }
    }
    if (state.heatmap) recalcHeatmap();
    render(); renderProps();
  });
  return;
}
    if (el.type === 'wall') {
      const mat = el.material || 'concrete';
      const lenM = Math.hypot(el.x2-el.x1, el.y2-el.y1).toFixed(2);
      propsPanel.innerHTML =
        '<div class="props-header"><div class="icon">🧱</div><div>' +
          '<div class="title">Стена</div>' +
          '<div class="subtitle">' + MATERIALS[mat].name + ' · ' + lenM + ' м</div></div></div>' +
        '<div class="props-section"><h4>Материал</h4>' +
          '<div class="props-row"><select id="e_mat">' +
            Object.keys(MATERIALS).map(k =>
              '<option value="' + k + '"' + (mat===k?' selected':'') + '>' +
              MATERIALS[k].name + ' (' + MATERIALS[k].loss + ' дБ)</option>').join('') +
          '</select></div></div>' +
        '<div class="props-section"><h4>Координаты, м</h4>' +
          '<div class="props-row"><label>X1</label><input id="w_x1" type="number" step="0.5" value="' + el.x1 + '"></div>' +
          '<div class="props-row"><label>Y1</label><input id="w_y1" type="number" step="0.5" value="' + el.y1 + '"></div>' +
          '<div class="props-row"><label>X2</label><input id="w_x2" type="number" step="0.5" value="' + el.x2 + '"></div>' +
          '<div class="props-row"><label>Y2</label><input id="w_y2" type="number" step="0.5" value="' + el.y2 + '"></div>' +
        '</div>' +
        '<div class="props-section"><button class="btn-block" id="delBtn">🗑 Удалить</button></div>';
      document.getElementById('e_mat').addEventListener('change', async e => {
        el.material = e.target.value;
        if (state.projectId) {
          try { await EditorAPI.updateElement(el.id, EditorAPI.elementToDB(el)); flashSaved(); } catch (err) { flashError(err.message); }
        }
        if (state.heatmap) recalcHeatmap();
        render(); renderProps();
      });
      ['w_x1','w_y1','w_x2','w_y2'].forEach((id, i) => {
        document.getElementById(id).addEventListener('input', e => {
          const v = parseFloat(e.target.value);
          if (isNaN(v)) return;
          if (i === 0) el.x1 = v;
          if (i === 1) el.y1 = v;
          if (i === 2) el.x2 = v;
          if (i === 3) el.y2 = v;
          if (state.heatmap) recalcHeatmap();
          render();
        });
      });
      document.getElementById('delBtn').addEventListener('click', async () => {
        state.elements = state.elements.filter(x => x.id !== el.id);
        state.selected = null;
        if (state.projectId) {
          try { await EditorAPI.deleteElement(el.id); flashSaved(); } catch (err) { flashError(err.message); }
        }
        if (state.heatmap) recalcHeatmap();
        render(); renderProps();
      });
      return;
    }
    if (el.type === 'furniture' || el.type === 'text') {
      propsPanel.innerHTML =
        '<div class="props-header"><div class="icon">' + (el.type==='text'?'🅰':'📦') + '</div><div>' +
          '<div class="title">' + (el.type==='text'?'Текст':'Мебель') + '</div>' +
          '<div class="subtitle">' + (el.subtype||'') + '</div></div></div>' +
        (el.type === 'text' ?
          '<div class="props-section"><div class="props-row"><label>Текст</label>' +
          '<input id="t_name" value="' + esc(el.name||'') + '"></div></div>' : '') +
        '<div class="props-section"><button class="btn-block" id="delBtn">🗑 Удалить</button></div>';
      if (el.type === 'text') {
        document.getElementById('t_name').addEventListener('input', () => {
          el.name = document.getElementById('t_name').value; render();
        });
      }
      document.getElementById('delBtn').addEventListener('click', async () => {
        state.elements = state.elements.filter(x => x.id !== el.id);
        state.selected = null;
        if (state.projectId) {
          try { await EditorAPI.deleteElement(el.id); flashSaved(); } catch (err) { flashError(err.message); }
        }
        render(); renderProps();
      });
    }
  }

  function esc(s) {
    return String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function renderLegendIcons() {
    const grid = document.getElementById('legendGrid');
    if (!grid) return;
    const list = [
      ['ap','Точка доступа'], ['switch','Коммутатор'], ['router','Роутер'],
      ['patch','Патч-панель'], ['wlc','WLC'],
      ['pc','ПК'], ['laptop','Ноутбук'], ['printer','МФУ'],
      ['scanner','Сканер'], ['camera','Камера'],
      ['table','Стол'], ['chair','Стул'], ['sofa','Диван'], ['plant','Растение'],
      ['light','Свет'], ['sensor','Датчик'], ['lock','Замок'],
      ['doorphone','Домофон'], ['ac','Кондиционер'], ['rj45','RJ-45']
    ];
    grid.innerHTML = list.map(([k, l]) =>
      '<div class="legend-item"><span class="ic">' + window.getEditorIcon(k) + '</span>' + l + '</div>'
    ).join('');
  }

  document.querySelectorAll('.legend-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.legend-tab').forEach(x => x.classList.remove('active'));
      tab.classList.add('active');
      const isProps = tab.dataset.tab === 'props';
      document.getElementById('propsPanel').style.display = isProps ? '' : 'none';
      document.getElementById('legendPanel').style.display = isProps ? 'none' : '';
    });
  });

  // ============================================================
  // МОДАЛКА: Новый проект
  // ============================================================
  document.getElementById('newProjectBtn').addEventListener('click', () => {
    document.getElementById('modalMask').classList.add('show');
  });
  document.getElementById('npCancel').addEventListener('click', () => {
    document.getElementById('modalMask').classList.remove('show');
  });
  document.getElementById('npCreate').addEventListener('click', async () => {
    await createProject({
      name: document.getElementById('npName').value || 'Проект',
      width: parseFloat(document.getElementById('npWidth').value) || 20,
      length: parseFloat(document.getElementById('npHeight').value) || 30,
      height: parseFloat(document.getElementById('npRoomH').value) || 3,
      material: document.getElementById('npMaterial').value
    });
    document.getElementById('modalMask').classList.remove('show');
    await loadProjectList();
  });

  // ============================================================
  // СТАТИСТИКА / СПЕЦИФИКАЦИЯ / POE
  // ============================================================
document.getElementById('btnStats').addEventListener('click', () => {
  if (!state.heatmap) return alert('Сначала рассчитайте покрытие (🌊, 📶 или 🎯)');
  const s = state.heatmap.stats;
  const mode = state.heatmap.mode || 'rssi';
  const isSnr = mode === 'snr';
  const isInterf = mode === 'interference';
  const unit = isSnr ? ' дБ' : ' dBm';

  let thresholds, title, deadTitle, orderReversed = false;
  if (isSnr) {
    thresholds = { exc:'Отлично ≥ 40', good:'Хорошо 25…40', weak:'Норма 15…25', dead:'Плохо < 15' };
    title = 'Средний SNR';
    deadTitle = 'Слабых зон';
  } else if (isInterf) {
    thresholds = {
      exc:'Нет помех ≤ −95',
      good:'Слабая −95…−85',
      weak:'Средняя −85…−75',
      dead:'Сильная > −75'
    };
    title = 'Средняя интерференция';
    deadTitle = 'Зон с сильной интерференцией';
  } else {
    thresholds = { exc:'Отлично ≥ −65', good:'Хорошо −65…−75', weak:'Слабо −75…−85', dead:'Мёртвая зона < −85' };
    title = 'Средний RSSI';
    deadTitle = 'Мёртвых зон';
  }

  document.getElementById('statsBody').innerHTML =
    '<div class="prop-block"><h4>' + title + '</h4>' +
      '<div style="font-size:22px;font-weight:600">' + s.avg.toFixed(1) + unit + '</div>' +
      '<div style="font-size:11px;opacity:.7">min ' + s.min.toFixed(1) + ' / max ' + s.max.toFixed(1) + unit + '</div></div>' +
    '<div class="prop-block"><h4>Распределение (' + mode.toUpperCase() + ')</h4>' +
      '<div class="stats-row"><span style="color:#4caf50">' + thresholds.exc + '</span><span>' + s.excPct.toFixed(1) + '%</span></div>' +
      '<div class="stats-row"><span style="color:#8bc34a">' + thresholds.good + '</span><span>' + s.goodPct.toFixed(1) + '%</span></div>' +
      '<div class="stats-row"><span style="color:#ffc107">' + thresholds.weak + '</span><span>' + s.weakPct.toFixed(1) + '%</span></div>' +
      '<div class="stats-row"><span style="color:#f44336">' + thresholds.dead + '</span><span>' + s.deadPct.toFixed(1) + '%</span></div></div>' +
    (s.deadZones.length ?
      '<div class="prop-block"><h4>' + deadTitle + ': ' + s.deadZones.length + '</h4>' +
      '<div style="font-size:11px;opacity:.7;max-height:140px;overflow:auto">' +
      s.deadZones.slice(0,15).map(z =>
        '(' + z.x.toFixed(1) + ', ' + z.y.toFixed(1) + ') → ' + z.dbm.toFixed(1) + unit
      ).join('<br>') + '</div></div>' : '');
  document.getElementById('statsModal').classList.add('show');
});
// ============================================================
// ПОКАЗ ОТЧЁТА ПО НАГРУЗКЕ
// ============================================================
function showLoadReport() {
  if (!state.project) return alert('Создайте проект');
  if (!state.aps.length) return alert('Разместите хотя бы одну AP');
  if (!state.devices.length) return alert('Добавьте устройства на план');

  const data = calculateLoad();

  let html = '';

  // Сводка
  html += '<div class="prop-block">' +
    '<h4>Сводка</h4>' +
    '<div class="stats-row"><span>Точек доступа</span><span class="val">' + state.aps.length + '</span></div>' +
    '<div class="stats-row"><span>Клиентских устройств</span><span class="val">' + data.totalDevices + '</span></div>' +
    (data.unassigned > 0 ?
      '<div class="stats-row"><span style="color:#f44336">Вне зоны покрытия</span><span class="val" style="color:#f44336">' + data.unassigned + '</span></div>' : '') +
    '</div>';

  // По каждой AP
  html += '<h4 style="margin:16px 0 8px;font-size:11px;text-transform:uppercase;color:var(--text-dim);letter-spacing:.5px">Нагрузка по точкам доступа</h4>';

  if (data.aps.length === 0) {
    html += '<div style="text-align:center;padding:20px;color:var(--text-dim)">Нет точек доступа</div>';
  }

  for (const st of data.aps) {
    let color = '#4caf50';
    let badge = 'Норма';
    let badgeBg = 'rgba(76,175,80,0.15)';
    if (st.utilization > 80) { color = '#f44336'; badge = 'Перегруз'; badgeBg = 'rgba(244,67,54,0.15)'; }
    else if (st.utilization > 60) { color = '#ffc107'; badge = 'Высокая'; badgeBg = 'rgba(255,193,7,0.15)'; }

    html += '<div style="background:var(--panel-2);border-radius:4px;padding:12px;margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<div>' +
          '<div style="font-weight:600">📡 ' + esc(st.ap.name) + '</div>' +
          '<div style="font-size:11px;color:var(--text-dim)">' +
            (st.ap.freq === 2400 ? '2.4 ГГц' : st.ap.freq === 5000 ? '5 ГГц' : '6 ГГц') +
            ' · канал ' + st.ap.channel +
            ' · ёмкость ' + st.capacity + ' Мбит/с' +
          '</div>' +
        '</div>' +
        '<span style="background:' + badgeBg + ';color:' + color + ';padding:4px 10px;border-radius:10px;font-size:11px;font-weight:600">' +
          badge + ' · ' + st.utilization + '%' +
        '</span>' +
      '</div>' +
      '<div style="height:6px;background:var(--panel);border-radius:3px;overflow:hidden;margin-bottom:8px">' +
        '<div style="height:100%;width:' + st.utilization + '%;background:' + color + '"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim)">' +
        '<span>Клиентов: <strong style="color:var(--text)">' + st.clientCount + '</strong> / ' + AP_MAX_CLIENTS + '</span>' +
        '<span>Трафик: <strong style="color:var(--text)">' + st.totalMbps + '</strong> Мбит/с</span>' +
      '</div>';

    // Список устройств
    if (st.clients.length > 0) {
      html += '<details style="margin-top:8px">' +
        '<summary style="cursor:pointer;font-size:11px;color:var(--accent)">Показать устройства (' + st.clients.length + ')</summary>' +
        '<div style="margin-top:6px;font-size:11px;max-height:150px;overflow-y:auto">';

      const devNames = {
        pc:'ПК', laptop:'Ноутбук', printer:'МФУ', scanner:'Сканер',
        camera:'Камера', light:'Свет', sensor:'Датчик', lock:'Замок',
        doorphone:'Домофон', ac:'Кондиционер', iot:'IoT'
      };

      for (const c of st.clients) {
        html += '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)">' +
          '<span>' + esc(c.name) + ' <span style="color:var(--text-dim)">(' + (devNames[c.type] || c.type) + ')</span></span>' +
          '<span style="color:var(--text-dim)">' + c.traffic + ' Мбит/с · ' + c.distance + ' м</span>' +
        '</div>';
      }
      html += '</div></details>';
    }

    html += '</div>';
  }

  // Предупреждения
  if (data.warnings.length) {
    html += '<h4 style="margin:16px 0 8px;font-size:11px;text-transform:uppercase;color:var(--text-dim);letter-spacing:.5px">Рекомендации</h4>';
    const colors = { error:'#f44336', warning:'#ff9800', ok:'#4caf50' };
    for (const w of data.warnings) {
      html += '<div style="padding:8px 12px;border-left:3px solid ' + colors[w.type] + ';margin-bottom:6px;background:var(--panel-2);border-radius:3px;font-size:12px">' +
        w.text +
      '</div>';
    }
  }

  document.getElementById('loadBody').innerHTML = html;
  document.getElementById('loadModal').classList.add('show');
}
// ============================================================
// АВТОМАТИЧЕСКАЯ РАССТАНОВКА AP
// ============================================================

// Гекс-сетка: N точек равномерно по площади
function hexGridPositions(W, H, N) {
  if (N <= 0) return [];
  if (N === 1) return [{ x: W / 2, y: H / 2 }];

  const aspect = W / H;
  const cols = Math.max(1, Math.round(Math.sqrt(N * aspect)));
  const rows = Math.max(1, Math.ceil(N / cols));

  const positions = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (positions.length >= N) break;
      const offset = (r % 2) * 0.5;
      const x = (c + 0.5 + offset) * (W / cols);
      const y = (r + 0.5) * (H / rows);
      positions.push({
        x: Math.max(1.5, Math.min(W - 1.5, x)),
        y: Math.max(1.5, Math.min(H - 1.5, y)),
      });
    }
  }
  return positions;
}

// Притянуть точки к центрам масс клиентов
function attractToClients(positions, W, H, radius_m) {
  return positions.map(p => {
    // Устройства в радиусе r
    const nearby = state.devices.filter(d =>
      Math.hypot(d.x - p.x, d.y - p.y) < radius_m
    );
    if (nearby.length === 0) return p;

    // Взвешенный центр масс (вес = трафик)
    let totalW = 0, cx = 0, cy = 0;
    for (const d of nearby) {
      const w = (DEVICE_TRAFFIC[d.type] || 1);
      cx += d.x * w;
      cy += d.y * w;
      totalW += w;
    }
    if (totalW === 0) return p;
    cx /= totalW;
    cy /= totalW;

    // Смещение на 30%
    const mix = 0.3;
    let nx = p.x * (1 - mix) + cx * mix;
    let ny = p.y * (1 - mix) + cy * mix;

    return {
      x: +Math.max(1.5, Math.min(W - 1.5, nx)).toFixed(2),
      y: +Math.max(1.5, Math.min(H - 1.5, ny)).toFixed(2),
    };
  });
}

// Основной алгоритм
function autoPlaceAP(opts) {
  if (!state.project) return { error: 'Нет проекта' };

  const W = state.project.width_m;
  const H = state.project.height_m;
  const area = W * H;

  // 1. Радиус покрытия одной AP
  let radius_m = 5 + (opts.power - 10) * 0.8;
  if (opts.freq === 2400) radius_m *= 1.4;
  if (opts.freq === 6000) radius_m *= 0.8;

  // Эффективная зона покрытия (учитывает перекрытие кругов)
  const effectiveArea = Math.PI * radius_m * radius_m * 0.7;

  // 2. Расчёт по покрытию
  const N_cover = Math.ceil(area / effectiveArea);

  // 3. Расчёт по нагрузке
  const totalTraffic = state.devices.reduce((s, d) =>
    s + (DEVICE_TRAFFIC[d.type] || 0), 0);
  const capacity = AP_CAPACITY[opts.freq] || 400;
  const N_load = totalTraffic > 0
    ? Math.ceil(totalTraffic / (capacity * 0.7))
    : 0;

  // 4. Расчёт по клиентам
  const N_clients = state.devices.length > 0
    ? Math.ceil(state.devices.length / AP_MAX_CLIENTS)
    : 0;

  // 5. Итоговое количество
  const N = Math.max(N_cover, N_load, N_clients, 1);

  // 6. Расстановка
  let positions = hexGridPositions(W, H, N);
  positions = attractToClients(positions, W, H, radius_m * 1.5);

  // 7. Оценка покрытия (быстрая, шаг 1 м)
  const coverage = quickCoverageCheck(positions, opts, radius_m);

  return {
    count: N,
    positions: positions,
    coverage: coverage,
    radius_m: +radius_m.toFixed(1),
    N_cover: N_cover,
    N_load: N_load,
    N_clients: N_clients,
    totalTraffic: +totalTraffic.toFixed(1),
  };
}

// Быстрая проверка покрытия (шаг 1 м)
function quickCoverageCheck(positions, opts, radius_m) {
  if (!state.project) return 0;
  const W = state.project.width_m;
  const H = state.project.height_m;
  const step = 1.0;

  // Временно подменяем AP
  const oldAps = state.aps;
  state.aps = positions.map((p, i) => ({
    id: -1000 - i,
    name: 'tmp',
    x: p.x, y: p.y,
    power: opts.power,
    gain: 5,
    freq: opts.freq,
    band: opts.freq === 2400 ? '2.4' : opts.freq === 6000 ? '6' : '5',
    channel: 44,
  }));

  let covered = 0, total = 0;
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      const rssi = coverageAt(x, y);
      if (rssi >= -70) covered++;
      total++;
    }
  }

  state.aps = oldAps;
  return total > 0 ? Math.round(covered / total * 100) : 0;
}
// ============================================================
// UI АВТО-РАССТАНОВКИ
// ============================================================
// ============================================================
// УЛУЧШЕНИЯ АВТО-РАССТАНОВКИ AP
// 1. Учёт стен  — сдвиг AP, если она «за бетоном» от клиентов
// 2. Разнос каналов — 1/6/11 (2.4) или 36/44/149/157 (5)
// 3. Итеративная проверка — добавляем AP, пока покрытие < target
// ============================================================

// ---------- 1. Учёт стен ----------
// Считаем, сколько клиентов рядом с AP отрезано стенами.
// Если отрезана половина и больше — сдвигаем AP в сторону этих клиентов.
function adjustForWalls(positions, walls, radius_m) {
  if (!walls || !walls.length || !state.devices.length) return positions;

  const wallSegs = walls.filter(el =>
    el.type === 'wall' || el.type === 'door' || el.type === 'window'
  );
  if (!wallSegs.length) return positions;

  return positions.map(p => {
    // Клиенты в радиусе притяжения
    const nearby = state.devices.filter(d =>
      Math.hypot(d.x - p.x, d.y - p.y) < radius_m * 1.5
    );
    if (nearby.length < 2) return p;

    // Из них — те, до кого сигнал режется стенами
    const blocked = nearby.filter(d => {
      for (const w of wallSegs) {
        if (w.type === 'door') continue; // двери не считаем препятствием
        if (segInt({ x: p.x, y: p.y }, { x: d.x, y: d.y },
                    { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })) {
          return true;
        }
      }
      return false;
    });

    if (blocked.length < nearby.length * 0.5) return p;

    // Центр масс «отрезанных» клиентов
    const cx = blocked.reduce((s, d) => s + d.x, 0) / blocked.length;
    const cy = blocked.reduce((s, d) => s + d.y, 0) / blocked.length;

    // Смещаем на 30% в сторону проблемной зоны
    const mix = 0.3;
    const nx = p.x * (1 - mix) + cx * mix;
    const ny = p.y * (1 - mix) + cy * mix;

    return {
      x: +Math.max(1.5, Math.min(state.project.width_m  - 1.5, nx)).toFixed(2),
      y: +Math.max(1.5, Math.min(state.project.height_m - 1.5, ny)).toFixed(2),
    };
  });
}

// ---------- 2. Разнос каналов ----------
// Раскладываем AP по непересекающимся каналам по кругу.
function assignChannels(positions, freq) {
  const plan = CHANNEL_PLANS[freq] || CHANNEL_PLANS[5000];
  return positions.map((p, i) => ({
    ...p,
    channel: plan[i % plan.length],
  }));
}

// ---------- 3. Итеративная проверка ----------
// Пока покрытие < target — добавляем AP (до MAX_AUTO_APS).
// Возвращает финальный результат + лог итераций для UI.
function iterativeAutoPlace(opts) {
  if (!state.project) return { error: 'Нет проекта' };

  const W = state.project.width_m;
  const H = state.project.height_m;
  const area = W * H;

  // Радиус покрытия одной AP
  let radius_m = 5 + (opts.power - 10) * 0.8;
  if (opts.freq === 2400) radius_m *= 1.4;
  if (opts.freq === 6000) radius_m *= 0.8;

  const effectiveArea = Math.PI * radius_m * radius_m * 0.7;

  // Оценки N по разным критериям
  const N_cover = Math.ceil(area / effectiveArea);
  const totalTraffic = state.devices.reduce(
    (s, d) => s + (DEVICE_TRAFFIC[d.type] || 0), 0);
  const capacity = AP_CAPACITY[opts.freq] || 400;
  const N_load = totalTraffic > 0
    ? Math.ceil(totalTraffic / (capacity * 0.7)) : 0;
  const N_clients = state.devices.length > 0
    ? Math.ceil(state.devices.length / AP_MAX_CLIENTS) : 0;

  const N_start = Math.max(N_cover, N_load, N_clients, 1);
  const target = opts.target || AUTO_TARGET_DEFAULT;

  const wallSegs = state.elements.filter(el =>
    el.type === 'wall' || el.type === 'door' || el.type === 'window');

  const iterations = [];
  let final = null;

  for (let n = N_start; n <= MAX_AUTO_APS; n++) {
    // 1) гекс-сетка
    let positions = hexGridPositions(W, H, n);

    // 2) притянуть к клиентам
    positions = attractToClients(positions, W, H, radius_m * 1.5);

    // 3) сдвинуть от стен
    positions = adjustForWalls(positions, wallSegs, radius_m);

    // 4) разнести каналы
    positions = assignChannels(positions, opts.freq);

    // 5) проверить покрытие (учитывает стены через coverageAt)
    const coverage = quickCoverageCheck(positions, opts, radius_m);

    iterations.push({ n, coverage });

    final = {
      count: n,
      positions,
      coverage,
      radius_m: +radius_m.toFixed(1),
      N_cover, N_load, N_clients,
      totalTraffic: +totalTraffic.toFixed(1),
      target,
      iterations,
      achieved: coverage >= target,
    };

    if (coverage >= target) break;
  }

  return final;
}
let autoPlaceResult = null;

function showAutoPlaceModal() {
  if (!state.project) return alert('Создайте проект');

  // Сброс формы
  document.getElementById('ap_freq').value = '5000';
  document.getElementById('ap_power').value = '20';
  document.getElementById('ap_target').value = '95';
  document.getElementById('autoPlaceResult').innerHTML = '';
  autoPlaceResult = null;

  document.getElementById('autoPlaceModal').classList.add('show');
}

function previewAutoPlace() {
  const opts = {
    freq: parseInt(document.getElementById('ap_freq').value, 10),
    power: parseFloat(document.getElementById('ap_power').value) || 20,
    target: parseInt(document.getElementById('ap_target').value, 10) || AUTO_TARGET_DEFAULT,
  };

  // НОВОЕ: итеративный расчёт с учётом стен и разносом каналов
  const result = iterativeAutoPlace(opts);

  if (result.error) {
    document.getElementById('autoPlaceResult').innerHTML =
      '<div style="color:#f44336;padding:10px">' + result.error + '</div>';
    return;
  }

  autoPlaceResult = { opts: opts, result: result };

  const unit = 'Мбит/с';
  const cov = result.coverage;
  const covColor = cov >= result.target ? '#4caf50'
                 : cov >= result.target - 10 ? '#ffc107'
                 : '#f44336';

  let html = '';

  // Сводка
  html += '<div style="background:var(--panel-2);border-radius:4px;padding:12px;margin-bottom:12px">' +
    '<div style="font-size:14px;font-weight:600;margin-bottom:8px">' +
      '🎯 Рекомендуется <span style="color:var(--accent)">' + result.count + '</span> точек доступа' +
    '</div>' +
    '<div style="font-size:11px;color:var(--text-dim);line-height:1.6">' +
      'Радиус покрытия одной AP: <b>' + result.radius_m + ' м</b><br>' +
      'Старт: по покрытию <b>' + result.N_cover + '</b> · ' +
      'по нагрузке <b>' + result.N_load + '</b> · ' +
      'по клиентам <b>' + result.N_clients + '</b><br>' +
      'Общий трафик: <b>' + result.totalTraffic + ' ' + unit + '</b>' +
    '</div>' +
  '</div>';

  // Итерации
  html += '<div style="background:var(--panel-2);border-radius:4px;padding:12px;margin-bottom:12px">' +
    '<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">' +
      'Итеративная проверка покрытия (цель: ' + result.target + '%):' +
    '</div>' +
    '<div style="max-height:140px;overflow-y:auto;font-size:11px">';
  result.iterations.forEach((it, i) => {
    const ok = it.coverage >= result.target;
    const color = ok ? '#4caf50' : '#ffc107';
    const mark = ok ? '✅' : '➕';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid var(--border)">' +
      '<span>' + mark + ' Шаг ' + (i + 1) + ': <b>' + it.n + '</b> AP</span>' +
      '<span style="color:' + color + '">' + it.coverage + '%</span>' +
    '</div>';
  });
  html += '</div></div>';

  // Финальное покрытие
  html += '<div style="background:var(--panel-2);border-radius:4px;padding:12px;margin-bottom:12px">' +
    '<div style="display:flex;justify-content:space-between;margin-bottom:6px">' +
      '<span style="font-size:11px;color:var(--text-dim)">Итоговое покрытие (RSSI ≥ −70 dBm)</span>' +
      '<span style="font-weight:600;color:' + covColor + '">' + cov + '%</span>' +
    '</div>' +
    '<div style="height:6px;background:var(--panel);border-radius:3px;overflow:hidden">' +
      '<div style="height:100%;width:' + Math.min(100, cov) + '%;background:' + covColor + '"></div>' +
    '</div>' +
    (result.achieved
      ? '<div style="font-size:11px;color:#4caf50;margin-top:6px">✅ Цель достигнута</div>'
      : '<div style="font-size:11px;color:#f44336;margin-top:6px">⚠ Достигнут лимит ' +
        MAX_AUTO_APS + ' AP. Добавьте вручную или увеличьте мощность.</div>') +
  '</div>';

  // Список координат и каналов
  html += '<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">' +
    'Координаты и каналы (м):</div>';
  html += '<div style="max-height:180px;overflow-y:auto;background:var(--panel-2);border-radius:4px;padding:8px">';
  result.positions.forEach((p, i) => {
    html += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;border-bottom:1px solid var(--border)">' +
      '<span>AP-' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span style="color:var(--text-dim)">(' + p.x.toFixed(1) + ', ' + p.y.toFixed(1) +
        ') · канал ' + p.channel + '</span>' +
    '</div>';
  });
  html += '</div>';

  // Кнопка применения
  html += '<div style="display:flex;gap:8px;margin-top:14px">' +
    '<button class="btn-block" id="autoApplyBtn" ' +
      'style="background:var(--accent);color:#fff;border-color:var(--accent)">' +
      '✅ Применить</button>' +
  '</div>';

  document.getElementById('autoPlaceResult').innerHTML = html;
  document.getElementById('autoApplyBtn').addEventListener('click', applyAutoPlace);

  // Предпросмотр кружков на карте
  drawAutoPreview(result.positions, result.radius_m);
}


// Предпросмотр на карте — временно показываем кружки
function drawAutoPreview(positions, radius_m) {
  L.layerDraft.innerHTML = '';

  for (const p of positions) {
    const c = m2px(p.x, p.y);
    const r = radius_m * PX_PER_M;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', c.x);
    circle.setAttribute('cy', c.y);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', 'rgba(14,99,156,0.15)');
    circle.setAttribute('stroke', '#0e639c');
    circle.setAttribute('stroke-width', '1.5');
    circle.setAttribute('stroke-dasharray', '5 3');
    circle.setAttribute('pointer-events', 'none');
    L.layerDraft.appendChild(circle);

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', c.x);
    dot.setAttribute('cy', c.y);
    dot.setAttribute('r', 6);
    dot.setAttribute('fill', '#0e639c');
    dot.setAttribute('stroke', '#fff');
    dot.setAttribute('stroke-width', '2');
    dot.setAttribute('pointer-events', 'none');
    L.layerDraft.appendChild(dot);

    // НОВОЕ: подпись канала под точкой
    if (p.channel != null) {
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', c.x);
      lbl.setAttribute('y', c.y + 20);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('fill', '#0e639c');
      lbl.setAttribute('font-size', '10');
      lbl.setAttribute('font-weight', '600');
      lbl.setAttribute('pointer-events', 'none');
      lbl.textContent = 'ch ' + p.channel;
      L.layerDraft.appendChild(lbl);
    }
  }

  canvasHint.textContent = 'Предпросмотр: ' + positions.length + ' AP (с учётом стен и каналов)';
}

// Применение: удаляем старые AP, создаём новые
async function applyAutoPlace() {
  if (!autoPlaceResult) return;

  const { opts, result } = autoPlaceResult;
  const positions = result.positions;

  if (!confirm('Применить расстановку?\n\n' +
      '• Все существующие AP будут удалены\n' +
      '• Будет создано ' + positions.length + ' новых точек\n' +
      '• Частота: ' + (opts.freq / 1000) + ' ГГц, мощность: ' + opts.power + ' dBm')) {
    return;
  }

  // 1. Удалить существующие AP
  if (state.projectId) {
    flashSaving();
    for (const ap of state.aps) {
      try { await EditorAPI.deleteAP(ap.id); } catch (e) { /* ignore */ }
    }
  }
  state.aps = [];

  // 2. Создать новые
  apCnt = 0;
  for (const pos of positions) {
    apCnt++;
    const band = opts.freq === 2400 ? '2.4' : opts.freq === 6000 ? '6' : '5';
    // НОВОЕ: канал берём из результата разноса, а не хардкод
    const channel = pos.channel != null ? pos.channel
                  : (opts.freq === 2400 ? 6 : opts.freq === 6000 ? 37 : 44);

    const ap = {
      id: nextId(),
      name: 'AP-' + String(apCnt).padStart(2, '0'),
      x: pos.x,
      y: pos.y,
      power: opts.power,
      gain: 5,
      freq: opts.freq,
      band: band,
      channel: channel,
    };
    state.aps.push(ap);

    if (state.projectId) {
      try {
        const saved = await EditorAPI.createAP(state.projectId,
          EditorAPI.apToDB(ap));
        if (saved && saved.id) ap.id = saved.id;
      } catch (e) { flashError(e.message); }
    }
  }

  flashSaved();

  // 3. Закрыть модалку, очистить draft, отрисовать
  document.getElementById('autoPlaceModal').classList.remove('show');
  L.layerDraft.innerHTML = '';
  autoPlaceResult = null;

  render();
  if (state.heatmap) recalcHeatmap();

  canvasHint.textContent = 'Расставлено ' + state.aps.length + ' точек доступа';
}
  document.getElementById('statsClose').addEventListener('click', () => {
    document.getElementById('statsModal').classList.remove('show');
  });

  document.getElementById('btnSpec').addEventListener('click', () => {
    if (!state.project) return alert('Создайте проект');
    const totalCable = state.aps.reduce((sum, ap) => {
      let best = Infinity;
      state.switches.forEach(sw => {
        best = Math.min(best, Math.hypot(ap.x-sw.x, ap.y-sw.y) * CABLE_COEF);
      });
      return sum + (isFinite(best) ? best : 0);
    }, 0);
    document.getElementById('specBody').innerHTML =
      '<p>Проект: <b>' + esc(state.project.name) + '</b> · Площадь: ' +
        (state.project.width_m * state.project.height_m).toFixed(1) + ' м²</p>' +
      '<table style="width:100%;font-size:12px;border-collapse:collapse;margin-top:10px">' +
        '<tr style="background:var(--panel-2)"><th style="text-align:left;padding:6px">Категория</th>' +
        '<th style="text-align:left">Наименование</th><th>Кол-во</th><th>Ед.</th></tr>' +
        '<tr><td style="padding:6px">Точка доступа Wi-Fi</td><td>Generic AP</td>' +
          '<td style="text-align:center">' + state.aps.length + '</td><td>шт</td></tr>' +
        '<tr><td style="padding:6px">Коммутационное оборудование</td><td>PoE-коммутатор</td>' +
          '<td style="text-align:center">' + state.switches.length + '</td><td>шт</td></tr>' +
        '<tr><td style="padding:6px">Кабельная инфраструктура</td><td>Кабель Cat5e UTP</td>' +
          '<td style="text-align:center">' + totalCable.toFixed(1) + '</td><td>м</td></tr>' +
        '<tr><td style="padding:6px">Клиентские устройства</td><td>ПК, ноутбуки, IoT</td>' +
          '<td style="text-align:center">' + state.devices.length + '</td><td>шт</td></tr>' +
      '</table>';
    document.getElementById('specModal').classList.add('show');
  });
  document.getElementById('specClose').addEventListener('click', () => {
    document.getElementById('specModal').classList.remove('show');
  });

  document.getElementById('btnPoe').addEventListener('click', () => {
    if (!state.project) return alert('Создайте проект');
    const budget = state.switches.reduce((s, sw) => s + sw.poeBudget, 0);
    const ports = state.switches.reduce((s, sw) => s + sw.totalPorts, 0);
    const need = state.aps.reduce((s, ap) => s + (POE[ap.band] || 15.5), 0);
    const warnings = [];
    if (!state.switches.length) warnings.push({ t:'error', m:'Коммутаторы не добавлены' });
    else {
      if (need > budget) warnings.push({ t:'error', m:'Превышен PoE-бюджет: нужно ' + need.toFixed(1) + ' Вт, доступно ' + budget + ' Вт' });
      else if (need > budget * 0.8) warnings.push({ t:'warning', m:'PoE-бюджет загружен на ' + (need/budget*100).toFixed(0) + '%' });
      else warnings.push({ t:'ok', m:'PoE-бюджет: ' + need.toFixed(1) + ' Вт из ' + budget + ' Вт' });
      if (state.aps.length > ports) warnings.push({ t:'error', m:'Недостаточно портов: ' + state.aps.length + ' AP, доступно ' + ports });
    }
    const cm = { error:'#f44336', warning:'#ff9800', ok:'#4caf50' };
    document.getElementById('poeBody').innerHTML =
      '<p>Коммутаторов: <b>' + state.switches.length + '</b> · AP: <b>' + state.aps.length + '</b></p>' +
      '<p>Общий бюджет: <b>' + budget + ' Вт</b> · Потребление: <b>' + need.toFixed(1) + ' Вт</b></p>' +
      '<p>Портов: <b>' + ports + '</b></p>' +
      '<hr style="border-color:var(--border);margin:12px 0">' +
      warnings.map(w =>
        '<div style="padding:8px 12px;border-left:3px solid ' + cm[w.t] + ';margin-bottom:6px;background:var(--panel-2);border-radius:3px">' + w.m + '</div>'
      ).join('');
    document.getElementById('poeModal').classList.add('show');
  });
  document.getElementById('poeClose').addEventListener('click', () => {
    document.getElementById('poeModal').classList.remove('show');
  });
  document.getElementById('loadClose').addEventListener('click', () => {
  document.getElementById('loadModal').classList.remove('show');
});

  // ============================================================
  // ЭКСПОРТ PNG / CSV
  // ============================================================
  document.getElementById('btnSave').addEventListener('click', exportPNG);
  document.getElementById('btnCsv').addEventListener('click', exportCSV);
  document.getElementById('btnPdf').addEventListener('click', exportPDF);
  document.getElementById('btnXlsx').addEventListener('click', exportXLSX);
  document.getElementById('btnAutoFill').addEventListener('click', autoFillMeasurements);
    document.getElementById('btnPlanFact').addEventListener('click', showPlanFact);
  document.getElementById('planFactClose').addEventListener('click', () => {
    document.getElementById('planFactModal').classList.remove('show');
  });
    // ============================================================
  // 3D-ВИЗУАЛИЗАЦИЯ
  // ============================================================
  document.getElementById('btn3D').addEventListener('click', open3D);

  function open3D() {
    if (!state.project) return alert('Создайте проект');
    if (!state.aps.length) return alert('Разместите хотя бы одну AP');
    if (typeof Editor3D === 'undefined') {
      return alert('Модуль editor3d.js не подключён');
    }

    // Строим тепловую карту нужного слоя прямо здесь
    function computeHeatmap(layer) {
      const oldMode = state.heatmapMode;
      state.heatmapMode = layer;
      const hm = buildHeatmap(layer);
      state.heatmapMode = oldMode;
      return hm;
    }

    const heatmap = computeHeatmap('rssi');

    // Перехватываем переключение слоя в 3D
    Editor3D.onLayerChange = function (layer) {
      const hm = computeHeatmap(layer);
      Editor3D.open({
        project: state.project,
        elements: state.elements,
        aps: state.aps,
        heatmap: hm,
        layer: layer,
        computeHeatmap: computeHeatmap,
      });
    };

    Editor3D.open({
      project: state.project,
      elements: state.elements,
      aps: state.aps,
      heatmap: heatmap,
      layer: 'rssi',
      computeHeatmap: computeHeatmap,
    });
  }
  document.getElementById('planFactRecalc').addEventListener('click', recalcAllMeasurements);
  function exportPNG() {
    if (!state.project) return alert('Создайте проект');
    L.layerSelection.style.display = 'none';
    L.layerDraft.innerHTML = '';
    const W = state.project.width_m * PX_PER_M + 120;
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
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim() || '#1a1a1a';
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
    state.aps.forEach(a => lines.push('AP;' + a.name + ';' + a.x + ';' + a.y + ';power=' + a.power + 'dBm freq=' + a.freq));
    state.switches.forEach(s => lines.push('Switch;' + s.name + ';' + s.x + ';' + s.y + ';ports=' + s.totalPorts + ' poe=' + s.poeBudget + 'W'));
    state.devices.forEach(d => lines.push('Device;' + d.name + ';' + d.x + ';' + d.y + ';type=' + d.type));
    state.elements.filter(e => e.type === 'wall').forEach((w, i) => {
      lines.push('Wall;#' + (i+1) + ';' + w.x1 + ',' + w.y1 + ';' + w.x2 + ',' + w.y2 + ';material=' + w.material);
    });
    if (state.heatmap) {
      lines.push('');
      lines.push('# Статистика покрытия');
      const s = state.heatmap.stats;
      lines.push('avg_dbm;' + s.avg.toFixed(1));
      lines.push('min_dbm;' + s.min.toFixed(1));
      lines.push('max_dbm;' + s.max.toFixed(1));
      lines.push('dead_pct;' + s.deadPct.toFixed(1));
      lines.push('');
      lines.push('# Мёртвые зоны (первые 50)');
      lines.push('x_m;y_m;rssi_dbm');
      s.deadZones.slice(0, 50).forEach(z =>
        lines.push(z.x.toFixed(2) + ';' + z.y.toFixed(2) + ';' + z.dbm.toFixed(1)));
    }
    const csv = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.project.name || 'plan') + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  // ============================================================
  // ЭКСПОРТ PDF-ОТЧЁТА (через Report.generate → window.print)
  // ============================================================
  function exportPDF() {
    if (!state.project) return alert('Создайте проект');
    if (typeof Report === 'undefined' || !Report.generate) {
      return alert('Модуль report.js не подключён');
    }

    // Собираем данные для отчёта
    const owner = state.project.owner_name || null;
    const me = window._currentUser || { full_name: 'Инженер', email: '—' };

    // Тепловая карта (если есть) → dataURL
    let heatmapDataUrl = null;
    if (state.heatmap && heatmapCanvas.style.display !== 'none' && heatmapCanvas.width) {
      try { heatmapDataUrl = heatmapCanvas.toDataURL('image/png'); }
      catch (e) { /* canvas tainted — пропускаем */ }
    }

    // Элементы для отчёта
    const elements = state.elements.map(el => ({
      type: el.type,
      material: el.material,
      subtype: el.subtype,
      x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2,
      name: el.name,
    }));

    // AP в формате отчёта
    const aps = state.aps.map(ap => ({
      name: ap.name,
      model: ap.model || 'Generic AP',
      x: ap.x, y: ap.y,
      tx_power_dbm: ap.power,
      antenna_gain: ap.gain,
      band: ap.band,
      channel: ap.channel,
      ssid_type: 'corporate',
    }));

    // Устройства
    const devices = state.devices.map(d => ({
      name: d.name,
      type: d.type,
      x: d.x, y: d.y,
      required_rssi: -65,
    }));

    // Статистика покрытия (если есть тепловая карта)
    let stats = null;
    if (state.heatmap && state.heatmap.stats) {
      const s = state.heatmap.stats;
      stats = {
        rssi: {
          excellent: { count: 0, percent: s.excPct },
          good:      { count: 0, percent: s.goodPct },
          fair:      { count: 0, percent: s.weakPct },
          poor:      { count: 0, percent: 0 },
          dead:      { count: 0, percent: s.deadPct },
        },
      };
    }

    Report.generate({
      project: {
        name: state.project.name,
        width_m: state.project.width_m,
        height_m: state.project.height_m,
        created_at: state.project.created_at || new Date().toISOString(),
      },
      owner: owner,
      user: me,
      elements: elements,
      aps: aps,
      devices: devices,
      heatmapDataUrl: heatmapDataUrl,
      mode: state.heatmapMode || 'rssi',
      stats: stats,
      channels: null,  // можно добавить позже
    });
  }
    // ============================================================
  // ЭКСПОРТ XLSX (бэкенд собирает через openpyxl)
  // ============================================================
  async function exportXLSX() {
    if (!state.project) return alert('Создайте проект');
    if (!state.projectId) {
      return alert('Проект не сохранён на сервере — сначала сохраните');
    }

    const token = localStorage.getItem('cowork_token');
    const url = '/api/reports/' + state.projectId + '/xlsx';

    try {
      flashSaving();
      const res = await fetch(url, {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (state.project.name || 'project') + '.xlsx';
      a.click();
      URL.revokeObjectURL(a.href);
      flashSaved();
    } catch (err) {
      flashError('XLSX: ' + err.message);
      alert('Не удалось скачать XLSX: ' + err.message);
    }
  }
    // ============================================================
  // АВТОЗАМЕРЫ 4×4 (сетка по площади проекта)
  // ============================================================
  async function autoFillMeasurements() {
    if (!state.project) return alert('Создайте проект');
    if (!state.projectId) {
      return alert('Проект не сохранён на сервере — сначала сохраните');
    }
    if (!state.aps.length) return alert('Разместите хотя бы одну AP');

    const cols = 4, rows = 4;
    const W = state.project.width_m;
    const H = state.project.height_m;

    if (!confirm('Создать сетку замеров ' + cols + '×' + rows +
                 ' (' + (cols * rows) + ' точек)?\n\n' +
                 'Каждая точка будет рассчитана по физической модели ' +
                 '(FSPL + затухание на стенах).')) {
      return;
    }

    flashSaving();
    let created = 0;
    let failed = 0;
    const token = localStorage.getItem('cowork_token');

    // Замеры создаём последовательно, чтобы не перегружать бэкенд
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const x = +((c / (cols + 1)) * W).toFixed(2);
        const y = +((r / (rows + 1)) * H).toFixed(2);

        try {
          // 1. Рассчитать RSSI в точке
          const calcRes = await fetch(
            '/api/measurements/' + state.projectId +
            '/calculate?x=' + x + '&y=' + y,
            {
              method: 'POST',
              headers: Object.assign(
                { 'Content-Type': 'application/json' },
                token ? { Authorization: 'Bearer ' + token } : {}
              ),
              body: '{}',
            }
          );
          if (!calcRes.ok) throw new Error('calculate HTTP ' + calcRes.status);
          const calc = await calcRes.json();
          const rssi = calc.best ? calc.best.rssi : -100;

          // 2. Создать замер
          const createRes = await fetch(
            '/api/measurements/' + state.projectId,
            {
              method: 'POST',
              headers: Object.assign(
                { 'Content-Type': 'application/json' },
                token ? { Authorization: 'Bearer ' + token } : {}
              ),
              body: JSON.stringify({
                name: 'Авто ' + (r - 1) * cols + c,
                x: x, y: y,
                rssi: rssi,
                snr: calc.snr || null,
                interference: null,
                mode: 'auto',
              }),
            }
          );
          if (!createRes.ok) throw new Error('create HTTP ' + createRes.status);
          created++;
        } catch (err) {
          console.warn('Автозамер (' + x + ', ' + y + ') не создан:', err);
          failed++;
        }
      }
    }

    flashSaved();
    canvasHint.textContent =
      'Автозамеры: создано ' + created + ' из ' + (cols * rows) +
      (failed ? ' (' + failed + ' ошибок)' : '');

    // Обновляем список замеров, если страница измерений открыта рядом —
    // в редакторе просто показываем сообщение
    alert('Автозамеры завершены.\n\n' +
          'Создано: ' + created + '\n' +
          'Ошибок: ' + failed + '\n\n' +
          'Посмотреть список можно на странице «Измерения».');
  }
    // ============================================================
  // СРАВНЕНИЕ «ПЛАН vs ФАКТ»
  // ============================================================
  //
  // План  — RSSI, рассчитанный физической моделью (signalAt/coverageAt).
  // Факт  — RSSI, сохранённый в замере (mode = 'manual').
  //         Замеры mode = 'auto' считаются «плановыми» — у них факт == плану.
  //
  // Расхождение = |факт − план|.
  //   ≤ 3 дБ   → зелёный   (модель точная)
  //   3–6 дБ   → жёлтый    (приемлемо)
  //   > 6 дБ   → красный   (модель врёт, нужна калибровка)
  //
  // ============================================================

  // Список замеров текущего проекта (кэш)
  let measurementsCache = [];

  // Загрузить замеры с бэкенда
  async function loadMeasurements() {
    if (!state.projectId) { measurementsCache = []; return []; }
    try {
      const token = localStorage.getItem('cowork_token');
      const res = await fetch('/api/measurements/' + state.projectId, {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      measurementsCache = await res.json();
      return measurementsCache;
    } catch (err) {
      console.warn('Не удалось загрузить замеры:', err);
      measurementsCache = [];
      return [];
    }
  }

  // Рассчитать план в точке (x, y) по текущим AP и стенам
  function planRssiAt(x, y) {
    if (!state.aps.length) return -100;
    return coverageAt(x, y);
  }

  // Цвет по расхождению
  function diffColor(diff) {
    if (diff == null) return '#858585';      // серый — нет факта
    if (diff <= 3)   return '#4caf50';       // зелёный — отлично
    if (diff <= 6)   return '#ffc107';       // жёлтый — приемлемо
    return '#f44336';                        // красный — плохо
  }

  function diffLabel(diff) {
    if (diff == null) return '—';
    if (diff <= 3) return 'отлично';
    if (diff <= 6) return 'приемлемо';
    return 'калибровать';
  }

  // Открыть модалку «План/Факт»
  async function showPlanFact() {
    if (!state.project) return alert('Создайте проект');
    if (!state.projectId) return alert('Проект не сохранён на сервере');

    await loadMeasurements();

    if (!measurementsCache.length) {
      document.getElementById('planFactBody').innerHTML =
        '<div style="text-align:center;padding:30px;color:var(--text-dim)">' +
          'Замеров пока нет. Создайте их кнопкой 🔳 (автозамеры) ' +
          'или добавьте вручную, кликнув по замеру на карте.' +
        '</div>';
      document.getElementById('planFactModal').classList.add('show');
      return;
    }

    renderPlanFactTable();
    document.getElementById('planFactModal').classList.add('show');
  }

  function renderPlanFactTable() {
    const rows = measurementsCache.map(m => {
      const plan = planRssiAt(m.x, m.y);
      const fact = m.mode === 'manual' ? m.rssi : null;
      const diff = fact == null ? null : Math.abs(fact - plan);
      return { m, plan, fact, diff };
    });

    // Сводка
    const withFact = rows.filter(r => r.fact != null);
    const avgDiff = withFact.length
      ? withFact.reduce((s, r) => s + r.diff, 0) / withFact.length
      : 0;
    const maxDiff = withFact.length
      ? Math.max.apply(null, withFact.map(r => r.diff))
      : 0;
    const goodPct = withFact.length
      ? (withFact.filter(r => r.diff <= 3).length / withFact.length) * 100
      : 0;

    let html = '';

    // Сводные карточки
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">' +
      statCard('Всего замеров', rows.length, '') +
      statCard('С фактом', withFact.length, '') +
      statCard('Средн. расхождение', avgDiff.toFixed(1) + ' дБ',
               avgDiff <= 3 ? '#4caf50' : avgDiff <= 6 ? '#ffc107' : '#f44336') +
      statCard('Макс. расхождение', maxDiff.toFixed(1) + ' дБ',
               maxDiff <= 6 ? '#4caf50' : '#f44336') +
    '</div>';

    // Прогресс-бар «качество модели»
    if (withFact.length) {
      html += '<div style="background:var(--panel-2);border-radius:4px;padding:12px;margin-bottom:16px">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:11px">' +
          '<span style="color:var(--text-dim)">Точность модели (замеры с расхождением ≤ 3 дБ)</span>' +
          '<span style="font-weight:600;color:' + diffColor(avgDiff) + '">' +
            goodPct.toFixed(0) + '%</span>' +
        '</div>' +
        '<div style="height:6px;background:var(--panel);border-radius:3px;overflow:hidden">' +
          '<div style="height:100%;width:' + goodPct + '%;background:' +
            diffColor(avgDiff) + '"></div>' +
        '</div>' +
      '</div>';
    }

    // Таблица
    html += '<div style="overflow-x:auto;background:var(--panel-2);border-radius:4px">' +
      '<table style="width:100%;border-collapse:collapse;font-size:11px">' +
      '<thead><tr style="background:var(--panel);color:var(--text-dim)">' +
        '<th style="text-align:left;padding:6px 8px">#</th>' +
        '<th style="text-align:left;padding:6px 8px">Имя</th>' +
        '<th style="text-align:right;padding:6px 8px">X, м</th>' +
        '<th style="text-align:right;padding:6px 8px">Y, м</th>' +
        '<th style="text-align:right;padding:6px 8px">План</th>' +
        '<th style="text-align:right;padding:6px 8px">Факт</th>' +
        '<th style="text-align:right;padding:6px 8px">Δ, дБ</th>' +
        '<th style="text-align:left;padding:6px 8px">Статус</th>' +
        '<th style="padding:6px 8px"></th>' +
      '</tr></thead><tbody>';

    rows.forEach((r, i) => {
      const factStr = r.fact != null ? r.fact.toFixed(1) : '—';
      const diffStr = r.diff != null ? r.diff.toFixed(1) : '—';
      const color = diffColor(r.diff);
      const modeTag = r.m.mode === 'manual'
        ? '<span style="color:#2196f3;font-size:10px">ручной</span>'
        : '<span style="color:var(--text-dim);font-size:10px">авто</span>';

      html += '<tr style="border-top:1px solid var(--border)">' +
        '<td style="padding:6px 8px;color:var(--text-dim)">' + (i + 1) + '</td>' +
        '<td style="padding:6px 8px">' + esc(r.m.name || 'Замер') + ' ' + modeTag + '</td>' +
        '<td style="padding:6px 8px;text-align:right">' + r.m.x.toFixed(1) + '</td>' +
        '<td style="padding:6px 8px;text-align:right">' + r.m.y.toFixed(1) + '</td>' +
        '<td style="padding:6px 8px;text-align:right;color:var(--accent)">' +
          r.plan.toFixed(1) + '</td>' +
        '<td style="padding:6px 8px;text-align:right;color:' +
          (r.fact != null ? '#2196f3' : 'var(--text-dim)') + '">' + factStr + '</td>' +
        '<td style="padding:6px 8px;text-align:right;font-weight:600;color:' + color + '">' +
          diffStr + '</td>' +
        '<td style="padding:6px 8px"><span style="color:' + color + '">' +
          diffLabel(r.diff) + '</span></td>' +
        '<td style="padding:6px 8px">' +
          '<button class="btn-xs" data-edit="' + r.m.id + '">✎</button> ' +
          '<button class="btn-xs" data-recalc="' + r.m.id + '">🔄</button>' +
        '</td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';

    document.getElementById('planFactBody').innerHTML = html;

    // Обработчики кнопок в таблице
    document.querySelectorAll('#planFactBody button[data-edit]').forEach(b => {
      b.addEventListener('click', () => openManualEdit(parseInt(b.dataset.edit, 10)));
    });
    document.querySelectorAll('#planFactBody button[data-recalc]').forEach(b => {
      b.addEventListener('click', () => recalcOneMeasurement(parseInt(b.dataset.recalc, 10)));
    });
  }

  function statCard(label, value, color) {
    return '<div style="background:var(--panel-2);border-radius:4px;padding:10px">' +
      '<div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;' +
        'letter-spacing:.5px;margin-bottom:4px">' + label + '</div>' +
      '<div style="font-size:16px;font-weight:600;color:' +
        (color || 'var(--text)') + '">' + value + '</div>' +
    '</div>';
  }

  // Открыть форму ручного ввода для конкретного замера
  function openManualEdit(measurementId) {
    const m = measurementsCache.find(x => x.id === measurementId);
    if (!m) return;

    const plan = planRssiAt(m.x, m.y);

    // Строим форму прямо в модалке «План/Факт»
    const body = document.getElementById('planFactBody');
    body.innerHTML =
      '<div style="background:var(--panel-2);border-radius:4px;padding:16px">' +
        '<h3 style="margin-bottom:12px">📝 Ручной ввод замера</h3>' +
        '<div style="font-size:11px;color:var(--text-dim);margin-bottom:14px">' +
          'Замер #' + m.id + ' · (' + m.x.toFixed(2) + ', ' + m.y.toFixed(2) + ') м<br>' +
          'Расчётная модель: <b style="color:var(--accent)">' + plan.toFixed(1) + ' дБм</b>' +
        '</div>' +

        '<label style="display:block;font-size:11px;color:var(--text-dim);margin-bottom:4px">' +
          'Название</label>' +
        '<input id="me_name" type="text" value="' + esc(m.name || 'Замер') + '" ' +
          'style="width:100%;background:var(--panel);border:1px solid var(--border);' +
          'color:var(--text);padding:6px 8px;border-radius:3px;font-size:12px;margin-bottom:12px">' +

        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' +
          '<div>' +
            '<label style="display:block;font-size:11px;color:var(--text-dim);margin-bottom:4px">' +
              'RSSI, дБм *</label>' +
            '<input id="me_rssi" type="number" step="0.1" value="' +
              (m.mode === 'manual' ? m.rssi : plan.toFixed(1)) + '" ' +
              'style="width:100%;background:var(--panel);border:1px solid var(--border);' +
              'color:var(--text);padding:6px 8px;border-radius:3px;font-size:12px">' +
          '</div>' +
          '<div>' +
            '<label style="display:block;font-size:11px;color:var(--text-dim);margin-bottom:4px">' +
              'SNR, дБ</label>' +
            '<input id="me_snr" type="number" step="0.1" value="' +
              (m.snr != null ? m.snr : '') + '" ' +
              'style="width:100%;background:var(--panel);border:1px solid var(--border);' +
              'color:var(--text);padding:6px 8px;border-radius:3px;font-size:12px">' +
          '</div>' +
          '<div>' +
            '<label style="display:block;font-size:11px;color:var(--text-dim);margin-bottom:4px">' +
              'Интерференция, дБм</label>' +
            '<input id="me_inter" type="number" step="0.1" value="' +
              (m.interference != null ? m.interference : '') + '" ' +
              'style="width:100%;background:var(--panel);border:1px solid var(--border);' +
              'color:var(--text);padding:6px 8px;border-radius:3px;font-size:12px">' +
          '</div>' +
        '</div>' +

        // Мини-индикатор расхождения в реальном времени
        '<div id="me_diff" style="margin-top:14px;padding:10px;background:var(--panel);' +
          'border-radius:4px;font-size:12px">' +
          'Введите RSSI для оценки расхождения' +
        '</div>' +

        '<div style="display:flex;gap:8px;margin-top:16px">' +
          '<button class="btn-block" id="me_save" ' +
            'style="background:var(--accent);color:#fff;border-color:var(--accent);' +
            'flex:1">💾 Сохранить</button>' +
          '<button class="btn-block" id="me_plan" ' +
            'style="flex:1">🎯 Взять расчётное (' + plan.toFixed(1) + ')</button>' +
          '<button class="btn-block" id="me_cancel" style="flex:1">← К таблице</button>' +
        '</div>' +
      '</div>';

    // Live-пересчёт расхождения при вводе RSSI
    const rssiInput = document.getElementById('me_rssi');
    const diffBox = document.getElementById('me_diff');
    function updateDiff() {
      const v = parseFloat(rssiInput.value);
      if (isNaN(v)) {
        diffBox.innerHTML = 'Введите RSSI для оценки расхождения';
        return;
      }
      const d = Math.abs(v - plan);
      const color = diffColor(d);
      diffBox.innerHTML =
        'План: <b>' + plan.toFixed(1) + '</b> дБм · ' +
        'Факт: <b style="color:#2196f3">' + v.toFixed(1) + '</b> дБм · ' +
        'Расхождение: <b style="color:' + color + '">' + d.toFixed(1) +
        ' дБ</b> (' + diffLabel(d) + ')';
    }
    rssiInput.addEventListener('input', updateDiff);
    updateDiff();

    // Взять расчётное значение
    document.getElementById('me_plan').addEventListener('click', () => {
      rssiInput.value = plan.toFixed(1);
      updateDiff();
    });

    // Сохранить
    document.getElementById('me_save').addEventListener('click', async () => {
      const rssi = parseFloat(rssiInput.value);
      if (isNaN(rssi)) return alert('Введите RSSI');

      const payload = {
        name: document.getElementById('me_name').value || 'Замер',
        x: m.x, y: m.y,
        rssi: rssi,
        snr: parseFloat(document.getElementById('me_snr').value) || null,
        interference: parseFloat(document.getElementById('me_inter').value) || null,
        mode: 'manual',           // ← ключевое: помечаем как ручной
      };

      try {
        const token = localStorage.getItem('cowork_token');
        const res = await fetch('/api/measurements/' + m.id + '/update', {
          method: 'PUT',
          headers: Object.assign(
            { 'Content-Type': 'application/json' },
            token ? { Authorization: 'Bearer ' + token } : {}
          ),
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);

        // Обновляем кэш и возвращаемся к таблице
        await loadMeasurements();
        renderPlanFactTable();
        renderMeasurements();      // перерисовываем точки на карте
        flashSaved();
      } catch (err) {
        alert('Не удалось сохранить: ' + err.message);
      }
    });

    // Назад к таблице
    document.getElementById('me_cancel').addEventListener('click', renderPlanFactTable);
  }

  // Пересчитать один замер по физической модели (сбросить факт → авто)
  async function recalcOneMeasurement(measurementId) {
    const m = measurementsCache.find(x => x.id === measurementId);
    if (!m) return;
    const plan = planRssiAt(m.x, m.y);

    try {
      const token = localStorage.getItem('cowork_token');
      const res = await fetch('/api/measurements/' + m.id + '/update', {
        method: 'PUT',
        headers: Object.assign(
          { 'Content-Type': 'application/json' },
          token ? { Authorization: 'Bearer ' + token } : {}
        ),
        body: JSON.stringify({
          name: m.name, x: m.x, y: m.y,
          rssi: +plan.toFixed(1),
          snr: m.snr, interference: m.interference,
          mode: 'auto',
        }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      await loadMeasurements();
      renderPlanFactTable();
      renderMeasurements();
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  }

  // Пересчитать все замеры (только авто-режим, факт не трогаем)
  async function recalcAllMeasurements() {
    if (!measurementsCache.length) return;
    if (!confirm('Пересчитать все замеры по текущей модели AP?\n\n' +
                 'Ручные замеры (mode=manual) НЕ будут перезаписаны.')) return;

    flashSaving();
    let ok = 0, skip = 0, err = 0;

    for (const m of measurementsCache) {
      if (m.mode === 'manual') { skip++; continue; }
      try {
        const plan = planRssiAt(m.x, m.y);
        const token = localStorage.getItem('cowork_token');
        const res = await fetch('/api/measurements/' + m.id + '/update', {
          method: 'PUT',
          headers: Object.assign(
            { 'Content-Type': 'application/json' },
            token ? { Authorization: 'Bearer ' + token } : {}
          ),
          body: JSON.stringify({
            name: m.name, x: m.x, y: m.y,
            rssi: +plan.toFixed(1),
            snr: m.snr, interference: m.interference,
            mode: 'auto',
          }),
        });
        if (res.ok) ok++; else err++;
      } catch (e) { err++; }
    }

    await loadMeasurements();
    renderPlanFactTable();
    renderMeasurements();
    flashSaved();
    alert('Пересчёт завершён.\nОбновлено: ' + ok + '\nПропущено (ручные): ' + skip + '\nОшибок: ' + err);
  }
  // ============================================================
  // АВТОРИЗАЦИЯ
  // ============================================================
  async function initUser() {
    if (!EditorAPI.hasToken()) {
      window.location.href = '/static/login.html';
      return;
    }
    try {
      const r = await fetch('/api/auth/me', {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('cowork_token') }
      });
      if (!r.ok) throw new Error('unauthorized');
      const u = await r.json();
      const av = document.getElementById('userAvatar');
            window._currentUser = u;
      if (av) av.textContent = (u.full_name || '?').split(' ').map(s => s[0] || '').join('').slice(0, 2).toUpperCase();
      if (u.role === 'admin') {
        const al = document.getElementById('adminLink');
        if (al) al.style.display = '';
      }
    } catch (e) {
      localStorage.removeItem('cowork_token');
      window.location.href = '/static/login.html';
    }
  }

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('cowork_token');
    window.location.href = '/static/login.html';
  });

  // ============================================================
  // СТАРТ
  // ============================================================
  async function init() {
    buildPalette();
    renderLegendIcons();
    await initUser();
    await loadProjectList();
    if (!state.projectId) {
      // Если проектов нет — создаём дефолтный
      await createProject({ name:'Коворкинг КСТ', width:20, length:30, height:3, material:'concrete' });
    }
    window.addEventListener('resize', () => {
      if (state.heatmap) drawHeatmap();
    });
    renderProps();
    console.log('editor.js загружен');
  }

  init();
})();