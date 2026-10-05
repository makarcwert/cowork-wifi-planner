/* ============================================================
   EditorAPI — обёртка над FastAPI CoworkWiFi Planner
   Загружает/сохраняет проект в БД. При отсутствии API — работает в памяти.
   ============================================================ */
(function (global) {
  'use strict';

  const BASE = '/api';

  // -------------------- HTTP helpers --------------------
  function getToken() {
    return localStorage.getItem('cowork_token') || '';
  }

  function authHeaders(extra) {
    const h = Object.assign({}, extra || {});
    const t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  async function request(method, path, body) {
    const opts = {
      method: method,
      headers: authHeaders(body ? { 'Content-Type': 'application/json' } : {}),
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    if (!res.ok) {
      const txt = await res.text();
      let msg = txt;
      try { msg = JSON.parse(txt).detail || txt; } catch (e) {}
      throw new Error(method + ' ' + path + ' → ' + res.status + ': ' + msg);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // -------------------- Проекты --------------------
  async function listProjects() {
    return request('GET', '/projects/');
  }
  async function createProject({ name, width_m, height_m }) {
    return request('POST', '/projects/', { name, width_m, height_m });
  }
  async function getProject(id) {
    return request('GET', '/projects/' + id);
  }
  async function deleteProject(id) {
    return request('DELETE', '/projects/' + id);
  }

  // -------------------- Элементы (стены, мебель, текст, комнаты) --------------------
  async function listElements(projectId) {
    return request('GET', '/projects/' + projectId + '/elements');
  }
  async function createElement(projectId, data) {
    return request('POST', '/projects/' + projectId + '/elements', data);
  }
  async function updateElement(elementId, data) {
    return request('PUT', '/projects/elements/' + elementId, data);
  }
  async function deleteElement(elementId) {
    return request('DELETE', '/projects/elements/' + elementId);
  }

  // -------------------- AP --------------------
  async function listAPs(projectId) {
    return request('GET', '/projects/' + projectId + '/aps');
  }
  async function createAP(projectId, data) {
    return request('POST', '/projects/' + projectId + '/aps', data);
  }
  async function updateAP(apId, data) {
    return request('PUT', '/projects/aps/' + apId, data);
  }
  async function deleteAP(apId) {
    return request('DELETE', '/projects/aps/' + apId);
  }

  // -------------------- Устройства --------------------
  async function listDevices(projectId) {
    return request('GET', '/projects/' + projectId + '/devices');
  }
  async function createDevice(projectId, data) {
    return request('POST', '/projects/' + projectId + '/devices', data);
  }
  async function updateDevice(deviceId, data) {
    return request('PUT', '/projects/devices/' + deviceId, data);
  }
  async function deleteDevice(deviceId) {
    return request('DELETE', '/projects/devices/' + deviceId);
  }

  // -------------------- Коммутаторы --------------------
  async function listSwitches(projectId) {
    return request('GET', '/infra/' + projectId + '/switches');
  }
  async function createSwitch(projectId, data) {
    return request('POST', '/infra/' + projectId + '/switches', data);
  }
  async function updateSwitch(switchId, data) {
    return request('PUT', '/infra/switches/' + switchId, data);
  }
  async function deleteSwitch(switchId) {
    return request('DELETE', '/infra/switches/' + switchId);
  }

  // -------------------- Адаптеры: формат проекта ↔ формат бэкенда --------------------

  // Материал стен: название в БД
  const MATERIAL_DB = {
    brick: 'brick', concrete: 'concrete', drywall: 'drywall',
    wood: 'wood', glass: 'glass',
  };

  // Загрузка ВСЕГО проекта целиком
  async function loadFullProject(projectId) {
    const [project, elements, aps, devices, switches] = await Promise.all([
      getProject(projectId),
      listElements(projectId),
      listAPs(projectId),
      listDevices(projectId),
      listSwitches(projectId).catch(() => []),
    ]);
    return { project, elements, aps, devices, switches };
  }

  // Адаптер: элемент БД → наш формат
  function elementFromDB(el) {
    if (el.type === 'wall' || el.type === 'door' || el.type === 'window') {
      return {
        id: el.id,
        type: 'wall',
        material: el.material || 'concrete',
        x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2,
      };
    }
    if (el.type === 'text') {
      return { id: el.id, type: 'text', name: el.name || 'Текст', x: el.x, y: el.y };
    }
    if (el.type === 'furniture') {
      return {
        id: el.id, type: 'furniture', subtype: el.subtype,
        x: el.x, y: el.y,
        width: el.width || 1.5, height: el.height || 1,
        rotation: el.rotation || 0,
      };
    }
    if (el.type === 'shape') {
      return {
        id: el.id, type: 'shape', subtype: el.subtype || 'rect',
        material: el.material || 'brick',
        x: el.x, y: el.y,
        width: el.width || 4, height: el.height || 3,
      };
    }
    if (el.type === 'room') {
      return { id: el.id, type: 'room', points_json: el.points_json };
    }
    return el;
  }

  // Адаптер: наш формат → элемент БД
  function elementToDB(el) {
    if (el.type === 'wall') {
      return {
        type: 'wall',
        material: MATERIAL_DB[el.material] || 'concrete',
        x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2,
      };
    }
    if (el.type === 'text') {
      return { type: 'text', name: el.name, x: el.x, y: el.y };
    }
    if (el.type === 'furniture') {
      return {
        type: 'furniture', subtype: el.subtype,
        x: el.x, y: el.y,
        width: el.width || 1.5, height: el.height || 1,
        rotation: el.rotation || 0,
      };
    }
    if (el.type === 'shape') {
      return {
        type: 'shape', subtype: el.subtype,
        material: el.material || 'brick',
        x: el.x, y: el.y,
        width: el.width || 4, height: el.height || 3,
      };
    }
    if (el.type === 'room') {
      return { type: 'room', points_json: el.points_json };
    }
    return el;
  }

  // Адаптер AP: БД → наш формат
  function apFromDB(ap) {
    const band = ap.band || '5';
    const freq = band === '2.4' ? 2400 : band === '6' ? 6000 : 5000;
    return {
      id: ap.id,
      name: ap.name,
      x: ap.x, y: ap.y,
      power: ap.tx_power_dbm || 20,
      gain: ap.antenna_gain || 5,
      freq: freq,
      band: band,
      channel: ap.channel || 44,
      model: ap.model || 'Generic AP',
    };
  }

  // AP: наш формат → БД
  function apToDB(ap) {
    const band = ap.freq === 2400 ? '2.4' : ap.freq === 6000 ? '6' : '5';
    return {
      name: ap.name,
      model: ap.model || 'Generic AP',
      x: ap.x, y: ap.y,
      tx_power_dbm: ap.power || 20,
      antenna_gain: ap.gain || 5,
      band: band,
      channel: ap.channel || 44,
      ssid_type: 'corporate',
    };
  }

  // Адаптер коммутатора
  function switchFromDB(sw) {
    return {
      id: sw.id,
      name: sw.name,
      x: sw.x || 0, y: sw.y || 0,
      totalPorts: sw.total_ports || 24,
      poeBudget: sw.total_power_budget_w || 370,
    };
  }
  function switchToDB(sw) {
    return {
      name: sw.name,
      model: sw.model || 'Generic PoE Switch',
      x: sw.x, y: sw.y,
      total_ports: sw.totalPorts || 24,
      poe_ports: sw.totalPorts || 24,
      total_power_budget_w: sw.poeBudget || 370,
      location: '',
    };
  }

  // Адаптер устройства
  function deviceFromDB(d) {
    return {
      id: d.id,
      name: d.name,
      type: d.type,
      x: d.x, y: d.y,
    };
  }
  function deviceToDB(d) {
    return {
      name: d.name,
      type: d.type,
      x: d.x, y: d.y,
      band: '5',
      required_rssi: -65,
      required_speed: 10,
      ssid_type: 'corporate',
    };
  }

  // -------------------- Экспорт --------------------
  global.EditorAPI = {
    // Проекты
    listProjects,
    createProject,
    getProject,
    deleteProject,
    loadFullProject,

    // Элементы
    listElements, createElement, updateElement, deleteElement,
    elementFromDB, elementToDB,

    // AP
    listAPs, createAP, updateAP, deleteAP,
    apFromDB, apToDB,

    // Устройства
    listDevices, createDevice, updateDevice, deleteDevice,
    deviceFromDB, deviceToDB,

    // Коммутаторы
    listSwitches, createSwitch, updateSwitch, deleteSwitch,
    switchFromDB, switchToDB,

    // Прочее
    hasToken: () => !!getToken(),
  };
})(window);