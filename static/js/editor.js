/* Редактор плана CoworkWiFi Planner.
   Возможности: палитра с SVG-иконками, drag-and-drop, магнитная сетка 0.5 м,
   undo/redo, копирование, поворот, множественное выделение, resize-маркеры,
   фигуры (прямоугольник/эллипс/треугольник) с материалом,
   обрезка покрытия стенами, связи устройств с коммутаторами. */
(function () {
  // ==================== СОСТОЯНИЕ ====================
  var project = null;
  var tool = 'select';
  var selected = null;
  var multiSelected = [];
  var elements = [];
  var devices = [];
  var aps = [];
  var switches = [];
  var cableLinks = [];
  var deviceLinks = [];

  var draft = null;
  var roomPoints = [];
  var drag = null;
  var resize = null;
  var zoom = 1;
  var snapEnabled = true;
  var SNAP_M = 0.5;

  var history = [];
  var redoStack = [];
  var clipboard = null;

  var selectionRect = null;

  var ssidProfiles = [];
  var editingSsidId = null;
  var currentWlc = null;
  var optimizationResult = null;
  var lastHeatmapMode = 'rssi';

  // ==================== SVG-СЛОИ ====================
  var svg = document.getElementById('planSvg');
  var layerCoverage = document.getElementById('layerCoverage');
  var layerDeviceLinks = document.getElementById('layerDeviceLinks');
  var layerCables = document.getElementById('layerCables');
  var layerRooms = document.getElementById('layerRooms');
  var layerWalls = document.getElementById('layerWalls');
  var layerFurniture = document.getElementById('layerFurniture');
  var layerText = document.getElementById('layerText');
  var layerDevices = document.getElementById('layerDevices');
  var layerSwitches = document.getElementById('layerSwitches');
  var layerAps = document.getElementById('layerAps');
  var layerDraft = document.getElementById('layerDraft');
  var layerSelection = document.getElementById('layerSelection');

  var projectSelect = document.getElementById('projectSelect');
  var propsPanel = document.getElementById('propsPanel');
  var canvasHint = document.getElementById('canvasHint');
  var heatmapCanvas = document.getElementById('heatmapCanvas');
  var canvasWrap = document.getElementById('canvasWrap');
  var selectionRectEl = document.getElementById('selectionRect');
  var snapIndicator = document.getElementById('snapIndicator');

  var PX_PER_M = 40;

  var WALL_COLORS = {
    concrete: '#6b6b7b', brick: '#c0392b', drywall: '#d4d4dc',
    wood: '#8b5a2b', glass: '#87ceeb'
  };
  var WALL_WIDTHS = { concrete: 8, brick: 7, drywall: 3, wood: 6, glass: 4 };

  // ==================== АВТОРИЗАЦИЯ ====================
  API.get('/api/auth/me').then(function (u) {
    document.getElementById('userName').textContent = u.full_name;
    if (u.role === 'admin') document.getElementById('adminLink').style.display = '';
    if (u.role === 'admin' || u.role === 'analyst') {
      var pdfBlock = document.getElementById('pdfAdminBlock');
      if (pdfBlock) pdfBlock.style.display = '';
    }
    loadProjects();
  }).catch(function () {
    window.location.href = '/static/login.html';
  });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    API.clearToken();
    window.location.href = '/static/login.html';
  });

  // ==================== УТИЛИТЫ ====================
  function snap(v) {
    if (!snapEnabled) return +v.toFixed(2);
    return Math.round(v / SNAP_M) * SNAP_M;
  }

  function updateSnapBadge() {
    var st = document.getElementById('snapStatus');
    var btn = document.getElementById('toggleSnap');
    if (!st || !btn) return;
    if (snapEnabled) {
      st.className = 'snap-on';
      st.textContent = '0.5 м';
      btn.textContent = 'Выкл. сетку';
    } else {
      st.className = 'snap-off';
      st.textContent = 'выкл';
      btn.textContent = 'Вкл. сетку';
    }
  }

  var toggleSnapBtn = document.getElementById('toggleSnap');
  if (toggleSnapBtn) {
    toggleSnapBtn.addEventListener('click', function () {
      snapEnabled = !snapEnabled;
      updateSnapBadge();
    });
  }

  function flashSnapIndicator(mx, my) {
    if (!snapIndicator || !snapEnabled) return;
    var p = m2px(snap(mx), snap(my));
    var size = SNAP_M * PX_PER_M;
    snapIndicator.style.left = (p.x - size / 2) + 'px';
    snapIndicator.style.top = (p.y - size / 2) + 'px';
    snapIndicator.style.width = size + 'px';
    snapIndicator.style.height = size + 'px';
    snapIndicator.style.display = 'block';
    clearTimeout(snapIndicator._t);
    snapIndicator._t = setTimeout(function () {
      snapIndicator.style.display = 'none';
    }, 400);
  }

  // ==================== HISTORY ====================
  function pushHistory(action) {
    history.push({
      action: action,
      snapshot: {
        elements: JSON.parse(JSON.stringify(elements)),
        devices: JSON.parse(JSON.stringify(devices)),
        aps: JSON.parse(JSON.stringify(aps)),
        switches: JSON.parse(JSON.stringify(switches))
      }
    });
    if (history.length > 50) history.shift();
    redoStack = [];
  }

  function undo() {
    if (!history.length) { canvasHint.textContent = 'Нечего отменять'; return; }
    var last = history.pop();
    redoStack.push(last);
    applySnapshot(last.snapshot);
    canvasHint.textContent = 'Отменено: ' + last.action;
  }

  function redo() {
    if (!redoStack.length) { canvasHint.textContent = 'Нечего повторять'; return; }
    var item = redoStack.pop();
    history.push(item);
    applySnapshot(item.snapshot);
    canvasHint.textContent = 'Повторено: ' + item.action;
  }

  function applySnapshot(snap) {
    elements = JSON.parse(JSON.stringify(snap.elements));
    devices = JSON.parse(JSON.stringify(snap.devices));
    aps = JSON.parse(JSON.stringify(snap.aps));
    switches = JSON.parse(JSON.stringify(snap.switches));
    buildCableLinks();
    render();
  }

  // ==================== ПРОЕКТЫ ====================
  function loadProjects() {
    API.get('/api/projects/').then(function (list) {
      projectSelect.innerHTML = '<option value="">— Выберите —</option>';
      list.forEach(function (p) {
        var o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name + ' (' + p.width_m + '×' + p.height_m + ' м)';
        projectSelect.appendChild(o);
      });
      if (list.length) {
        projectSelect.value = list[0].id;
        selectProject(list[0]);
      }
    });
  }

  projectSelect.addEventListener('change', function () {
    if (!this.value) { project = null; render(); return; }
    API.get('/api/projects/' + this.value).then(selectProject);
  });

  function selectProject(p) {
    project = p;
    selected = null;
    multiSelected = [];
    draft = null;
    roomPoints = [];
    history = [];
    redoStack = [];
    zoom = 1;
    document.getElementById('zoomLabel').textContent = '100%';
    applyViewBox();
    loadAll();
    loadSsid();
    canvasHint.textContent = p.name + ' — ' + p.width_m + '×' + p.height_m + ' м';
  }

  function applyViewBox() {
    if (!project) return;
    var W = project.width_m * PX_PER_M;
    var H = project.height_m * PX_PER_M;
    svg.setAttribute('viewBox', '0 0 ' + (W / zoom) + ' ' + (H / zoom));
  }

  // ==================== ЗАГРУЗКА ====================
  function loadAll() {
    if (!project) return;
    Promise.all([
      API.get('/api/projects/' + project.id + '/elements'),
      API.get('/api/projects/' + project.id + '/devices'),
      API.get('/api/projects/' + project.id + '/aps'),
      API.get('/api/infra/' + project.id + '/switches'),
      API.get('/api/infra/' + project.id + '/device-connections').catch(function () {
        return { links: [] };
      })
    ]).then(function (r) {
      elements = r[0] || [];
      devices = r[1] || [];
      aps = r[2] || [];
      switches = r[3] || [];
      deviceLinks = (r[4] && r[4].links) ? r[4].links : [];
      buildCableLinks();
      render();
    }).catch(function (err) {
      console.error('Ошибка загрузки:', err);
      elements = []; devices = []; aps = []; switches = []; deviceLinks = [];
      render();
    });
  }

  function buildCableLinks() {
    cableLinks = [];
    aps.forEach(function (ap) {
      var bestSw = null, bestDist = Infinity;
      switches.forEach(function (s) {
        if (s.x == null || s.y == null) return;
        var dx = ap.x - s.x, dy = ap.y - s.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) { bestDist = d; bestSw = s; }
      });
      if (bestSw) {
        cableLinks.push({
          from: { x: bestSw.x, y: bestSw.y, name: bestSw.name },
          to: { x: ap.x, y: ap.y, name: ap.name },
          length_m: +(bestDist * 1.1).toFixed(1)
        });
      }
    });
  }

  // ==================== КООРДИНАТЫ ====================
  function m2px(mx, my) { return { x: mx * PX_PER_M, y: my * PX_PER_M }; }
  function eventToM(e) {
    var r = svg.getBoundingClientRect();
    var vb = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
    var vx = vb[0] || 0, vy = vb[1] || 0, vw = vb[2], vh = vb[3];
    var scale = Math.min(r.width / vw, r.height / vh);
    var px = (e.clientX - r.left) / scale + vx;
    var py = (e.clientY - r.top) / scale + vy;
    return { px: px, py: py, m: { x: px / PX_PER_M, y: py / PX_PER_M } };
  }

  // ==================== ВЫДЕЛЕНИЕ ====================
  function isSelected(kind, id) {
    if (selected && selected.kind === kind && selected.id === id) return true;
    return multiSelected.some(function (s) { return s.kind === kind && s.id === id; });
  }
  function clearSelection() {
    selected = null;
    multiSelected = [];
  }
  function toggleMulti(kind, id) {
    var idx = multiSelected.findIndex(function (s) { return s.kind === kind && s.id === id; });
    if (idx >= 0) multiSelected.splice(idx, 1);
    else multiSelected.push({ kind: kind, id: id });
    selected = null;
  }

  // ==================== СОЗДАНИЕ ОБЪЕКТОВ ====================
  function placeObject(kind, xm, ym) {
    if (!project) { alert('Сначала выберите проект'); return; }
    xm = +xm.toFixed(2); ym = +ym.toFixed(2);
    pushHistory('создание ' + kind);

    if (kind === 'switch') {
      var n = switches.length + 1;
      API.post('/api/infra/' + project.id + '/switches', {
        name: 'SW-' + (n < 10 ? '0' + n : n),
        model: 'Generic PoE Switch',
        x: xm, y: ym,
        total_power_budget_w: 370, total_ports: 24, poe_ports: 24, location: ''
      }).then(loadAll);
      return;
    }

    if (kind === 'ap') {
      var n2 = aps.length + 1;
      API.post('/api/projects/' + project.id + '/aps', {
        name: 'AP-' + (n2 < 10 ? '0' + n2 : n2), model: 'Generic AP',
        x: xm, y: ym, tx_power_dbm: 20, antenna_gain: 6,
        band: '5', channel: 44, ssid_type: 'corporate'
      }).then(loadAll);
      return;
    }

    if (['pc', 'laptop', 'printer', 'scanner', 'camera', 'iot'].indexOf(kind) >= 0) {
      var names = { pc: 'ПК', laptop: 'Ноутбук', printer: 'Принтер',
                    scanner: 'Сканер', camera: 'Камера', iot: 'IoT' };
      API.post('/api/projects/' + project.id + '/devices', {
        name: names[kind] + '-' + (devices.length + 1),
        type: kind, x: xm, y: ym, band: '5',
        required_rssi: -65, required_speed: 10, ssid_type: 'corporate'
      }).then(loadAll);
      return;
    }

    if (['sofa', 'table', 'chair', 'plant'].indexOf(kind) >= 0) {
      API.post('/api/projects/' + project.id + '/elements', {
        type: 'furniture', subtype: kind,
        x: xm, y: ym, width: 1.5, height: 1, rotation: 0
      }).then(loadAll);
      return;
    }
  }

  // ==================== СОЗДАНИЕ ФИГУРЫ (прямоугольник/эллипс/треугольник) ====================
  function createShape(kind, material, xm, ym) {
    if (!project) { alert('Сначала выберите проект'); return; }
    var shapeType;
    if (kind === 'shape_rect') shapeType = 'rect';
    else if (kind === 'shape_ellipse') shapeType = 'ellipse';
    else if (kind === 'shape_triangle') shapeType = 'triangle';
    else shapeType = 'rect';

    var w = 4, h = 3;
    xm = +xm.toFixed(2); ym = +ym.toFixed(2);
    pushHistory('создание фигуры ' + shapeType);

    API.post('/api/projects/' + project.id + '/elements', {
      type: 'shape',
      subtype: shapeType,
      material: material || 'brick',
      x: xm, y: ym,
      width: w, height: h
    }).then(loadAll).catch(function (err) { alert(err.message); });
  }

  // ==================== РЕНДЕР ====================
  function render() {
    if (!project) {
      [layerCoverage, layerDeviceLinks, layerCables, layerRooms, layerWalls,
       layerFurniture, layerText, layerDevices, layerSwitches, layerAps,
       layerSelection].forEach(function (l) {
        if (l) l.innerHTML = '';
      });
      return;
    }
    renderCoverage();
    renderDeviceLinks();
    renderCables();
    renderRooms();
    renderWalls();
    renderShapes();
    renderFurniture();
    renderText();
    renderDevices();
    renderSwitches();
    renderAPs();
    renderSelectionMarkers();
  }

  // ==================== СТЕНЫ (тип wall) ====================
  function renderWalls() {
    layerWalls.innerHTML = '';
    elements.filter(function (el) {
      return el.type === 'wall' || el.type === 'door' || el.type === 'window';
    }).forEach(function (el) {
      var a = m2px(el.x1, el.y1);
      var b = m2px(el.x2, el.y2);
      if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5) return;

      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('data-kind', 'element');
      line.setAttribute('data-id', el.id);

      if (el.type === 'wall') {
        line.setAttribute('stroke', WALL_COLORS[el.material] || WALL_COLORS.concrete);
        line.setAttribute('stroke-width', WALL_WIDTHS[el.material] || 6);
      } else if (el.type === 'door') {
        line.setAttribute('stroke', '#8e44ad');
        line.setAttribute('stroke-width', '4');
        line.setAttribute('stroke-dasharray', '8 4');
      } else {
        line.setAttribute('stroke', '#3498db');
        line.setAttribute('stroke-width', '5');
      }

      if (isSelected('element', el.id)) {
        line.setAttribute('stroke', '#ffcc00');
        line.setAttribute('stroke-width', '10');
      }

      line.style.cursor = 'pointer';
      line.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (tool === 'select') {
          if (ev.shiftKey) toggleMulti('element', el.id);
          else { selected = { kind: 'element', id: el.id }; multiSelected = []; }
          render(); renderProps();
        }
      });
      layerWalls.appendChild(line);
    });
  }

  // ==================== ФИГУРЫ (тип shape) ====================
  function renderShapes() {
    layerFurniture = layerFurniture; // чтобы не потерять ссылку
    elements.filter(function (el) { return el.type === 'shape'; }).forEach(function (el) {
      var p = m2px(el.x, el.y);
      var w = (el.width || 4) * PX_PER_M;
      var h = (el.height || 3) * PX_PER_M;
      var color = WALL_COLORS[el.material] || WALL_COLORS.brick;
      var stroke = '#2c2c3a';

      var shape;
      if (el.subtype === 'ellipse') {
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        shape.setAttribute('cx', p.x + w / 2);
        shape.setAttribute('cy', p.y + h / 2);
        shape.setAttribute('rx', w / 2);
        shape.setAttribute('ry', h / 2);
      } else if (el.subtype === 'triangle') {
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        shape.setAttribute('points',
          (p.x + w / 2) + ',' + p.y + ' ' +
          (p.x + w) + ',' + (p.y + h) + ' ' +
          p.x + ',' + (p.y + h));
      } else {
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        shape.setAttribute('x', p.x);
        shape.setAttribute('y', p.y);
        shape.setAttribute('width', w);
        shape.setAttribute('height', h);
        shape.setAttribute('rx', 2);
      }

      shape.setAttribute('fill', color);
      shape.setAttribute('fill-opacity', '0.6');
      shape.setAttribute('stroke', isSelected('element', el.id) ? '#ffcc00' : stroke);
      shape.setAttribute('stroke-width', isSelected('element', el.id) ? '4' : '2');
      shape.setAttribute('data-kind', 'element');
      shape.setAttribute('data-id', el.id);
      shape.style.cursor = 'move';

      shape.addEventListener('mousedown', function (ev) {
        if (tool === 'select') startDrag(ev, 'element', el.id);
      });
      shape.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (tool === 'select') {
          if (ev.shiftKey) toggleMulti('element', el.id);
          else { selected = { kind: 'element', id: el.id }; multiSelected = []; }
          render(); renderProps();
        }
      });

      // Помещаем фигуры в отдельный слой (используем layerRooms для них)
      layerRooms.appendChild(shape);
    });
  }

  // ==================== КОМНАТЫ (полигоны) ====================
  function renderRooms() {
    // Очищаем только полигоны-комнаты, не трогая фигуры
    // Вместо этого создаём отдельный слой в HTML. Пока совмещаем.
    // Здесь оставлено для обратной совместимости, если room создан как type='room'
    elements.filter(function (el) { return el.type === 'room'; }).forEach(function (el) {
      var pts;
      try { pts = JSON.parse(el.points_json || '[]'); } catch (e) { pts = []; }
      if (pts.length < 3) return;
      var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', pts.map(function (p) {
        var q = m2px(p.x, p.y); return q.x + ',' + q.y;
      }).join(' '));
      poly.setAttribute('fill', 'rgba(108,92,231,.06)');
      poly.setAttribute('stroke', isSelected('element', el.id) ? '#ffcc00' : '#6c5ce7');
      poly.setAttribute('stroke-width', isSelected('element', el.id) ? '4' : '2');
      poly.setAttribute('data-kind', 'element');
      poly.setAttribute('data-id', el.id);
      poly.style.cursor = 'pointer';
      poly.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (tool === 'select') {
          if (ev.shiftKey) toggleMulti('element', el.id);
          else { selected = { kind: 'element', id: el.id }; multiSelected = []; }
          render(); renderProps();
        }
      });
      layerRooms.appendChild(poly);
    });
  }

  // ==================== МЕБЕЛЬ ====================
  var FURN_ICON = { sofa: '🛋', table: '🪑', chair: '💺', plant: '🌿' };

  function renderFurniture() {
    layerFurniture.innerHTML = '';
    elements.filter(function (el) { return el.type === 'furniture'; }).forEach(function (el) {
      var p = m2px(el.x, el.y);
      var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform',
        'translate(' + p.x + ',' + p.y + ') rotate(' + (el.rotation || 0) + ')');
      g.setAttribute('data-kind', 'element');
      g.setAttribute('data-id', el.id);
      g.style.cursor = 'move';

      var bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bg.setAttribute('r', '16');
      bg.setAttribute('fill', 'rgba(108,92,231,0.12)');
      g.appendChild(bg);

      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('y', '8');
      t.setAttribute('font-size', '22');
      t.textContent = FURN_ICON[el.subtype] || '📦';
      g.appendChild(t);

      if (isSelected('element', el.id)) {
        var h = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        h.setAttribute('r', 22); h.setAttribute('fill', 'none');
        h.setAttribute('stroke', '#ffcc00'); h.setAttribute('stroke-width', '3');
        g.appendChild(h);
      }

      g.addEventListener('mousedown', function (ev) {
        if (tool === 'select') startDrag(ev, 'element', el.id);
      });
      g.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (tool === 'select') {
          if (ev.shiftKey) toggleMulti('element', el.id);
          else { selected = { kind: 'element', id: el.id }; multiSelected = []; }
          render(); renderProps();
        }
      });
      layerFurniture.appendChild(g);
    });
  }

  // ==================== ТЕКСТ ====================
  function renderText() {
    layerText.innerHTML = '';
    elements.filter(function (el) { return el.type === 'text'; }).forEach(function (el) {
      var p = m2px(el.x, el.y);
      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', p.x); t.setAttribute('y', p.y);
      t.setAttribute('font-size', '16');
      t.setAttribute('fill', isSelected('element', el.id) ? '#ffcc00' : '#2c2c3a');
      t.setAttribute('font-weight', '600');
      t.setAttribute('data-kind', 'element');
      t.setAttribute('data-id', el.id);
      t.style.cursor = 'move';
      t.textContent = el.name || 'Текст';
      t.addEventListener('mousedown', function (ev) {
        if (tool === 'select') startDrag(ev, 'element', el.id);
      });
      t.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (tool === 'select') {
          if (ev.shiftKey) toggleMulti('element', el.id);
          else { selected = { kind: 'element', id: el.id }; multiSelected = []; }
          render(); renderProps();
        }
      });
      layerText.appendChild(t);
    });
  }

  // ==================== УСТРОЙСТВА ====================
  var DEV_ICON = {
    pc: '🖥', laptop: '💻', printer: '🖨', scanner: '📠',
    camera: '📹', iot: '🌡', switch: '🔀'
  };

  function renderDevices() {
    layerDevices.innerHTML = '';
    devices.forEach(function (d) {
      var p = m2px(d.x, d.y);
      var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
      g.setAttribute('data-kind', 'device');
      g.setAttribute('data-id', d.id);
      g.style.cursor = 'move';

      var r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', -14); r.setAttribute('y', -14);
      r.setAttribute('width', 28); r.setAttribute('height', 28);
      r.setAttribute('rx', 5);
      r.setAttribute('fill', '#ffffff');
      r.setAttribute('stroke', isSelected('device', d.id) ? '#ffcc00' : '#7b7bff');
      r.setAttribute('stroke-width', isSelected('device', d.id) ? '4' : '2');
      g.appendChild(r);

      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('y', '7');
      t.setAttribute('font-size', '18');
      t.textContent = DEV_ICON[d.type] || '📦';
      g.appendChild(t);

      g.addEventListener('mousedown', function (ev) {
        if (tool === 'select') startDrag(ev, 'device', d.id);
      });
      g.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (tool === 'select') {
          if (ev.shiftKey) toggleMulti('device', d.id);
          else { selected = { kind: 'device', id: d.id }; multiSelected = []; }
          render(); renderProps();
        }
      });
      layerDevices.appendChild(g);
    });
  }

  // ==================== КОММУТАТОРЫ ====================
  function renderSwitches() {
    layerSwitches.innerHTML = '';
    switches.forEach(function (sw) {
      if (sw.x == null || sw.y == null) return;
      var p = m2px(sw.x, sw.y);
      var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
      g.setAttribute('data-kind', 'switch');
      g.setAttribute('data-id', sw.id);
      g.style.cursor = 'move';

      var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', -16); rect.setAttribute('y', -12);
      rect.setAttribute('width', 32); rect.setAttribute('height', 24);
      rect.setAttribute('rx', 4);
      rect.setAttribute('fill', '#2c3e50');
      rect.setAttribute('stroke', isSelected('switch', sw.id) ? '#ffcc00' : '#fff');
      rect.setAttribute('stroke-width', isSelected('switch', sw.id) ? '3' : '2');
      g.appendChild(rect);

      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('y', '6');
      t.setAttribute('font-size', '13');
      t.setAttribute('fill', '#fff');
      t.textContent = '🔀';
      g.appendChild(t);

      var lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('y', '26');
      lbl.setAttribute('font-size', '10');
      lbl.setAttribute('fill', '#333');
      lbl.setAttribute('font-weight', '600');
      lbl.textContent = sw.name;
      g.appendChild(lbl);

      g.addEventListener('mousedown', function (e) {
        if (tool === 'select') startDrag(e, 'switch', sw.id);
      });
      g.addEventListener('click', function (e) {
        e.stopPropagation();
        if (tool === 'select') {
          if (e.shiftKey) toggleMulti('switch', sw.id);
          else { selected = { kind: 'switch', id: sw.id }; multiSelected = []; }
          render(); renderProps();
        }
      });
      layerSwitches.appendChild(g);
    });
  }

  // ==================== AP ====================
  function renderAPs() {
    layerAps.innerHTML = '';
    aps.forEach(function (ap) {
      var p = m2px(ap.x, ap.y);
      var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
      g.setAttribute('data-kind', 'ap');
      g.setAttribute('data-id', ap.id);
      g.style.cursor = 'move';

      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('r', 16);
      c.setAttribute('fill', '#6c5ce7');
      c.setAttribute('stroke', '#fff');
      c.setAttribute('stroke-width', '2');
      g.appendChild(c);

      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('y', '6');
      t.setAttribute('font-size', '15');
      t.setAttribute('fill', '#fff');
      t.textContent = '📡';
      g.appendChild(t);

      var lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('y', '34');
      lbl.setAttribute('font-size', '11');
      lbl.setAttribute('fill', '#333');
      lbl.setAttribute('font-weight', '600');
      lbl.textContent = ap.name;
      g.appendChild(lbl);

      if (isSelected('ap', ap.id)) {
        var h = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        h.setAttribute('r', 26); h.setAttribute('fill', 'rgba(255,204,0,.25)');
        g.insertBefore(h, c);
      }

      g.addEventListener('mousedown', function (ev) {
        if (tool === 'select') startDrag(ev, 'ap', ap.id);
      });
      g.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (tool === 'select') {
          if (ev.shiftKey) toggleMulti('ap', ap.id);
          else { selected = { kind: 'ap', id: ap.id }; multiSelected = []; }
          render(); renderProps();
        }
      });
      layerAps.appendChild(g);
    });
  }

  // ==================== RESIZE-МАРКЕРЫ ====================
  function renderSelectionMarkers() {
    layerSelection.innerHTML = '';
    // Маркеры показываем только для одиночного выделения фигуры/комнаты
    if (!selected || selected.kind !== 'element') return;
    var el = elements.find(function (x) { return x.id === selected.id; });
    if (!el) return;
    if (el.type !== 'shape' && el.type !== 'room') return;

    var p = m2px(el.x, el.y);
    var w = (el.width || 4) * PX_PER_M;
    var h = (el.height || 3) * PX_PER_M;

    // 4 угла + 4 середины сторон
    var pts = [
      { x: p.x,         y: p.y,         corner: 'tl' },
      { x: p.x + w / 2, y: p.y,         corner: 'tc' },
      { x: p.x + w,     y: p.y,         corner: 'tr' },
      { x: p.x + w,     y: p.y + h / 2, corner: 'rc' },
      { x: p.x + w,     y: p.y + h,     corner: 'br' },
      { x: p.x + w / 2, y: p.y + h,     corner: 'bc' },
      { x: p.x,         y: p.y + h,     corner: 'bl' },
      { x: p.x,         y: p.y + h / 2, corner: 'lc' }
    ];

    pts.forEach(function (pt) {
      var m = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      m.setAttribute('x', pt.x - 5);
      m.setAttribute('y', pt.y - 5);
      m.setAttribute('width', 10);
      m.setAttribute('height', 10);
      m.setAttribute('class', 'resize-marker');
      m.setAttribute('data-el-id', el.id);
      m.setAttribute('data-corner', pt.corner);
      m.style.pointerEvents = 'all';
      m.style.cursor = cursorForCorner(pt.corner);
      m.addEventListener('mousedown', function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        startResize(ev, el, pt.corner);
      });
      layerSelection.appendChild(m);
    });
  }

  function cursorForCorner(corner) {
    if (corner === 'tl' || corner === 'br') return 'nwse-resize';
    if (corner === 'tr' || corner === 'bl') return 'nesw-resize';
    if (corner === 'tc' || corner === 'bc') return 'ns-resize';
    if (corner === 'lc' || corner === 'rc') return 'ew-resize';
    return 'nwse-resize';
  }

  function startResize(e, el, corner) {
    resize = {
      el: el,
      corner: corner,
      startW: el.width || 4,
      startH: el.height || 3,
      startX: el.x,
      startY: el.y,
      mouseStartM: eventToM(e).m
    };
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  }

  function onResizeMove(e) {
    if (!resize) return;
    var em = eventToM(e);
    var dx = em.m.x - resize.mouseStartM.x;
    var dy = em.m.y - resize.mouseStartM.y;

    var w = resize.startW;
    var h = resize.startH;
    var x = resize.startX;
    var y = resize.startY;

    if (resize.corner === 'br') { w = resize.startW + dx; h = resize.startH + dy; }
    else if (resize.corner === 'tr') { w = resize.startW + dx; h = resize.startH - dy; y = resize.startY + dy; }
    else if (resize.corner === 'bl') { w = resize.startW - dx; h = resize.startH + dy; x = resize.startX + dx; }
    else if (resize.corner === 'tl') { w = resize.startW - dx; h = resize.startH - dy; x = resize.startX + dx; y = resize.startY + dy; }
    else if (resize.corner === 'rc') { w = resize.startW + dx; }
    else if (resize.corner === 'lc') { w = resize.startW - dx; x = resize.startX + dx; }
    else if (resize.corner === 'bc') { h = resize.startH + dy; }
    else if (resize.corner === 'tc') { h = resize.startH - dy; y = resize.startY + dy; }

    if (w < 0.5) w = 0.5;
    if (h < 0.5) h = 0.5;

    resize._new = {
      x: +snap(x).toFixed(2),
      y: +snap(y).toFixed(2),
      width: +snap(w).toFixed(2),
      height: +snap(h).toFixed(2)
    };
    // Обновляем визуально
    render();
  }

  function onResizeEnd() {
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
    if (!resize || !resize._new) { resize = null; return; }
    var el = resize.el;
    var nn = resize._new;
    resize = null;

    pushHistory('изменение размера');
    API.put('/api/projects/elements/' + el.id, {
      type: 'shape',
      subtype: el.subtype || 'rect',
      material: el.material || 'brick',
      x: nn.x, y: nn.y,
      width: nn.width, height: nn.height
    }).then(loadAll).catch(function (err) { alert(err.message); });
  }

  // ==================== ПЕРЕТАСКИВАНИЕ ====================
  function getObjectPosition(kind, id) {
    var arr;
    if (kind === 'ap') arr = aps;
    else if (kind === 'device') arr = devices;
    else if (kind === 'switch') arr = switches;
    else if (kind === 'element') arr = elements;
    else return null;
    return arr.find(function (x) { return x.id === id; });
  }

  function startDrag(e, kind, id) {
    if (tool !== 'select') return;
    e.stopPropagation();
    e.preventDefault();

    var alreadyInMulti = multiSelected.some(function (s) { return s.kind === kind && s.id === id; });
    var isSingleton = selected && selected.kind === kind && selected.id === id;
    if (!alreadyInMulti && !isSingleton) {
      selected = { kind: kind, id: id };
      multiSelected = [];
      render();
      renderProps();
    }

    var toDrag = [];
    if (multiSelected.length) {
      multiSelected.forEach(function (s) {
        var obj = getObjectPosition(s.kind, s.id);
        if (obj && obj.x != null) toDrag.push({ kind: s.kind, id: s.id, startX: obj.x, startY: obj.y });
      });
    } else if (selected) {
      var obj = getObjectPosition(selected.kind, selected.id);
      if (obj && obj.x != null) toDrag.push({ kind: selected.kind, id: selected.id, startX: obj.x, startY: obj.y });
    }

    if (!toDrag.length) return;

    var em = eventToM(e);
    drag = {
      items: toDrag,
      mouseStartM: { x: em.m.x, y: em.m.y }
    };
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e) {
    if (!drag) return;
    var em = eventToM(e);
    var dx = em.m.x - drag.mouseStartM.x;
    var dy = em.m.y - drag.mouseStartM.y;

    var first = drag.items[0];
    var newX = first.startX + dx;
    var newY = first.startY + dy;
    var snappedX = snap(newX);
    var snappedY = snap(newY);
    var snapDX = snappedX - first.startX;
    var snapDY = snappedY - first.startY;

    drag.items.forEach(function (item) {
      item._newX = item.startX + snapDX;
      item._newY = item.startY + snapDY;
      var g = svg.querySelector('[data-kind="' + item.kind + '"][data-id="' + item.id + '"]');
      if (g && g.tagName.toLowerCase() === 'g') {
        var pos = m2px(item._newX, item._newY);
        var obj = getObjectPosition(item.kind, item.id);
        var rot = obj && obj.rotation ? obj.rotation : 0;
        g.setAttribute('transform',
          'translate(' + pos.x + ',' + pos.y + ')' +
          (rot ? ' rotate(' + rot + ')' : ''));
      }
    });

    flashSnapIndicator(snappedX, snappedY);
  }

  function onDragEnd() {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    if (!drag || !drag.items.length) { drag = null; return; }
    var items = drag.items;
    drag = null;

    pushHistory('перемещение');

    var promises = items.map(function (item) {
      var obj = getObjectPosition(item.kind, item.id);
      if (!obj) return Promise.resolve();
      var payload = Object.assign({}, obj, { x: +item._newX.toFixed(2), y: +item._newY.toFixed(2) });
      delete payload.id; delete payload.project_id; delete payload.created_at;
      var url;
      if (item.kind === 'ap') url = '/api/projects/aps/' + item.id;
      else if (item.kind === 'device') url = '/api/projects/devices/' + item.id;
      else if (item.kind === 'element') url = '/api/projects/elements/' + item.id;
      else if (item.kind === 'switch') url = '/api/infra/switches/' + item.id;
      else return Promise.resolve();
      return API.put(url, payload);
    });
    Promise.all(promises).then(loadAll).catch(function (err) {
      console.error(err);
      loadAll();
    });
  }

  // ==================== ПАЛИТРА ====================
  // Инициализация SVG-иконок в палитре
  document.querySelectorAll('.palette-item [data-icon]').forEach(function (el) {
    var key = el.dataset.icon;
    if (window.getEditorIcon) {
      el.innerHTML = window.getEditorIcon(key);
    }
  });

  document.querySelectorAll('.palette-item').forEach(function (item) {
    // --- Клик — добавить в центр (для стен — линейный режим) ---
    item.addEventListener('click', function (e) {
      if (!project) { alert('Создайте или выберите проект'); return; }
      e.preventDefault();
      var kind = item.dataset.add;
      var material = item.dataset.material;

      // Стена (линейный режим)
      if (kind && kind.indexOf('wall_') === 0) {
        tool = 'wall';
        var matSelect = document.getElementById('wallMaterial');
        if (matSelect && material) matSelect.value = material;
        document.querySelectorAll('.tool-btn[data-tool]').forEach(function (b) {
          b.classList.toggle('active', b.dataset.tool === 'wall');
        });
        canvasHint.textContent = 'Линейный режим стены (' + material + '). Клик — начало, клик — конец, Esc — отмена.';
        return;
      }

      // Фигура
      if (kind && kind.indexOf('shape_') === 0) {
        var shapeMat = (document.getElementById('shapeMaterial') || {value: 'brick'}).value;
        createShape(kind, shapeMat, snap(project.width_m / 2), snap(project.height_m / 2));
        return;
      }

      // Обычный объект
      placeObject(kind, snap(project.width_m / 2), snap(project.height_m / 2));
      canvasHint.textContent = 'Объект добавлен в центр';
    });

    // --- Drag&drop ---
    item.addEventListener('dragstart', function (e) {
      if (!project) { e.preventDefault(); return; }
      var kind = item.dataset.add;
      var material = item.dataset.material;
      e.dataTransfer.setData('text/plain', JSON.stringify({ kind: kind, material: material || null }));
      e.dataTransfer.effectAllowed = 'copy';
      item.classList.add('dragging');

      var ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.id = 'dragGhost';
      if (window.getEditorIcon) ghost.innerHTML = window.getEditorIcon(kind);
      document.body.appendChild(ghost);
    });

    item.addEventListener('dragend', function () {
      item.classList.remove('dragging');
      var g = document.getElementById('dragGhost');
      if (g) g.remove();
    });
  });

  document.addEventListener('drag', function (e) {
    var ghost = document.getElementById('dragGhost');
    if (ghost && e.clientX && e.clientY) {
      ghost.style.left = e.clientX + 'px';
      ghost.style.top = e.clientY + 'px';
    }
  });

  canvasWrap.addEventListener('dragover', function (e) {
    if (!project) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    canvasWrap.classList.add('drag-over');
    var ghost = document.getElementById('dragGhost');
    if (ghost && e.clientX && e.clientY) {
      ghost.style.left = e.clientX + 'px';
      ghost.style.top = e.clientY + 'px';
    }
  });

  canvasWrap.addEventListener('dragleave', function (e) {
    if (e.target === canvasWrap || !canvasWrap.contains(e.relatedTarget)) {
      canvasWrap.classList.remove('drag-over');
    }
  });

  canvasWrap.addEventListener('drop', function (e) {
    e.preventDefault();
    canvasWrap.classList.remove('drag-over');
    var ghost = document.getElementById('dragGhost');
    if (ghost) ghost.remove();
    if (!project) return;

    var raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    var payload;
    try { payload = JSON.parse(raw); } catch (err) { payload = { kind: raw }; }

    var em = eventToM(e);
    var x = snap(em.m.x);
    var y = snap(em.m.y);

    // Стена — создаём прямоугольную комнату
    if (payload.kind && payload.kind.indexOf('wall_') === 0) {
      createWallRoom(payload.material || 'concrete', x, y);
      return;
    }
    // Фигура
    if (payload.kind && payload.kind.indexOf('shape_') === 0) {
      var shapeMat = (document.getElementById('shapeMaterial') || {value: 'brick'}).value;
      createShape(payload.kind, shapeMat, x, y);
      return;
    }
    // Обычный объект
    placeObject(payload.kind, x, y);
  });

  // ==================== КОМНАТЫ ИЗ 4 СТЕН ====================
  function createWallRoom(material, x, y) {
    var w = 4, h = 3;
    pushHistory('создание комнаты из стен');
    var p1 = API.post('/api/projects/' + project.id + '/elements', {
      type: 'wall', material: material,
      x1: +(x).toFixed(2), y1: +(y).toFixed(2),
      x2: +(x + w).toFixed(2), y2: +(y).toFixed(2)
    });
    var p2 = API.post('/api/projects/' + project.id + '/elements', {
      type: 'wall', material: material,
      x1: +(x + w).toFixed(2), y1: +(y).toFixed(2),
      x2: +(x + w).toFixed(2), y2: +(y + h).toFixed(2)
    });
    var p3 = API.post('/api/projects/' + project.id + '/elements', {
      type: 'wall', material: material,
      x1: +(x + w).toFixed(2), y1: +(y + h).toFixed(2),
      x2: +(x).toFixed(2), y2: +(y + h).toFixed(2)
    });
    var p4 = API.post('/api/projects/' + project.id + '/elements', {
      type: 'wall', material: material,
      x1: +(x).toFixed(2), y1: +(y + h).toFixed(2),
      x2: +(x).toFixed(2), y2: +(y).toFixed(2)
    });
    Promise.all([p1, p2, p3, p4]).then(function () {
      canvasHint.textContent = 'Создана комната ' + w + '×' + h + ' м из ' + material;
      loadAll();
    }).catch(function (err) { alert(err.message); });
  }

  // ==================== ИНСТРУМЕНТЫ ====================
  document.querySelectorAll('.tool-btn[data-tool]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.tool-btn[data-tool]').forEach(function (x) {
        x.classList.remove('active');
      });
      b.classList.add('active');
      tool = b.dataset.tool;
      draft = null;
      roomPoints = [];
      layerDraft.innerHTML = '';
      canvasHint.textContent = ({
        select: 'Кликните по объекту. Shift+клик — множественное. Рамка — выделить несколько.',
        wall: 'Клик — начало стены. Клик — конец.',
        room: 'Клик по углам. Двойной клик — замкнуть.',
        door: 'Клик-клик — дверь',
        window: 'Клик-клик — окно',
        text: 'Кликните, чтобы ввести текст'
      })[tool] || '';
    });
  });

  // ==================== КЛИК ПО ХОЛСТУ ====================
  svg.addEventListener('click', function (e) {
    if (!project) return;
    if (e.target.closest && e.target.closest('[data-kind]')) return;
    var em = eventToM(e);
    var x = em.m.x, y = em.m.y;

    if (tool === 'wall' || tool === 'door' || tool === 'window') {
      if (!draft) {
        draft = { x1: snap(x), y1: snap(y) };
        canvasHint.textContent = 'Клик — конец линии';
        drawDraftLine(em.px, em.py, em.px, em.py);
        return;
      }
      pushHistory('создание ' + tool);
      var matEl = document.getElementById('wallMaterial');
      var p = {
        type: tool === 'wall' ? 'wall' : (tool === 'door' ? 'door' : 'window'),
        material: tool === 'wall' ? (matEl ? matEl.value : 'concrete') : null,
        x1: +draft.x1.toFixed(2), y1: +draft.y1.toFixed(2),
        x2: +snap(x).toFixed(2), y2: +snap(y).toFixed(2)
      };
      API.post('/api/projects/' + project.id + '/elements', p).then(function () {
        draft = null;
        layerDraft.innerHTML = '';
        canvasHint.textContent = 'Клик — начало стены';
        loadAll();
      }).catch(function (err) { alert(err.message); });
      return;
    }

    if (tool === 'room') {
      roomPoints.push({ x: snap(x), y: snap(y) });
      drawRoomDraft();
      canvasHint.textContent = 'Точек: ' + roomPoints.length + '. Двойной клик — замкнуть';
      return;
    }

    if (tool === 'text') {
      var txt = prompt('Введите текст:');
      if (!txt) return;
      pushHistory('создание текста');
      API.post('/api/projects/' + project.id + '/elements', {
        type: 'text', name: txt,
        x: +snap(x).toFixed(2), y: +snap(y).toFixed(2)
      }).then(loadAll);
      return;
    }

    if (tool === 'select') {
      clearSelection();
      render();
      renderProps();
    }
  });

  svg.addEventListener('dblclick', function (e) {
    if (tool === 'room' && roomPoints.length >= 3 && project) {
      pushHistory('создание комнаты');
      API.post('/api/projects/' + project.id + '/elements', {
        type: 'room', points_json: JSON.stringify(roomPoints)
      }).then(function () {
        roomPoints = [];
        layerDraft.innerHTML = '';
        canvasHint.textContent = 'Комната создана';
        loadAll();
      });
      return;
    }
    if (tool === 'select' && project && !(e.target.closest && e.target.closest('[data-kind]'))) {
      var em = eventToM(e);
      API.post('/api/measurements/' + project.id + '/calculate?x=' +
               em.m.x.toFixed(2) + '&y=' + em.m.y.toFixed(2), {})
        .then(function (data) {
          if (data.best) {
            canvasHint.textContent = '📍 (' + data.x.toFixed(1) + ', ' +
              data.y.toFixed(1) + ') · ' + data.best.ap_name + ' · RSSI ' +
              data.best.rssi + ' дБм · SNR ' + data.snr + ' дБ';
          } else {
            canvasHint.textContent = 'Нет покрытия';
          }
        }).catch(function () {});
    }
  });

  function drawDraftLine(x1, y1, x2, y2) {
    layerDraft.innerHTML = '';
    var l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1);
    l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    l.setAttribute('stroke', '#6c5ce7');
    l.setAttribute('stroke-width', '2');
    l.setAttribute('stroke-dasharray', '6 3');
    layerDraft.appendChild(l);
  }

  function drawRoomDraft() {
    layerDraft.innerHTML = '';
    if (roomPoints.length < 1) return;
    var pts = roomPoints.map(function (p) {
      var q = m2px(p.x, p.y); return q.x + ',' + q.y;
    }).join(' ');
    var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', pts);
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', '#6c5ce7');
    poly.setAttribute('stroke-width', '2');
    poly.setAttribute('stroke-dasharray', '6 3');
    layerDraft.appendChild(poly);
    roomPoints.forEach(function (p) {
      var q = m2px(p.x, p.y);
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', q.x); c.setAttribute('cy', q.y);
      c.setAttribute('r', 4); c.setAttribute('fill', '#6c5ce7');
      layerDraft.appendChild(c);
    });
  }

  // ==================== МНОЖЕСТВЕННОЕ ВЫДЕЛЕНИЕ ====================
  svg.addEventListener('mousedown', function (e) {
    if (tool !== 'select' || !project) return;
    if (e.target.closest && e.target.closest('[data-kind]')) return;
    if (e.button !== 0) return;

    var startRect = svg.getBoundingClientRect();
    var startX = e.clientX - startRect.left;
    var startY = e.clientY - startRect.top;
    var moved = false;

    function onMove(ev) {
      var curX = ev.clientX - startRect.left;
      var curY = ev.clientY - startRect.top;
      var dx = Math.abs(curX - startX);
      var dy = Math.abs(curY - startY);
      if (dx < 5 && dy < 5) return;
      moved = true;
      var left = Math.min(startX, curX);
      var top = Math.min(startY, curY);
      var width = Math.abs(curX - startX);
      var height = Math.abs(curY - startY);
      selectionRectEl.style.left = left + 'px';
      selectionRectEl.style.top = top + 'px';
      selectionRectEl.style.width = width + 'px';
      selectionRectEl.style.height = height + 'px';
      selectionRectEl.style.display = 'block';
      selectionRect = { left: left, top: top, right: left + width, bottom: top + height };
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      selectionRectEl.style.display = 'none';
      if (!moved) { selectionRect = null; return; }

      var r = svg.getBoundingClientRect();
      var vb = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
      var s = Math.min(r.width / vb[2], r.height / vb[3]);
      var rectInSvg = {
        left: selectionRect.left / s,
        top: selectionRect.top / s,
        right: selectionRect.right / s,
        bottom: selectionRect.bottom / s
      };

      var picked = [];
      aps.forEach(function (o) {
        var p = m2px(o.x, o.y);
        if (p.x >= rectInSvg.left && p.x <= rectInSvg.right &&
            p.y >= rectInSvg.top && p.y <= rectInSvg.bottom) {
          picked.push({ kind: 'ap', id: o.id });
        }
      });
      devices.forEach(function (o) {
        var p = m2px(o.x, o.y);
        if (p.x >= rectInSvg.left && p.x <= rectInSvg.right &&
            p.y >= rectInSvg.top && p.y <= rectInSvg.bottom) {
          picked.push({ kind: 'device', id: o.id });
        }
      });
      elements.filter(function (el) {
        return el.type === 'furniture' || el.type === 'text';
      }).forEach(function (o) {
        var p = m2px(o.x, o.y);
        if (p.x >= rectInSvg.left && p.x <= rectInSvg.right &&
            p.y >= rectInSvg.top && p.y <= rectInSvg.bottom) {
          picked.push({ kind: 'element', id: o.id });
        }
      });
      switches.forEach(function (o) {
        if (o.x == null) return;
        var p = m2px(o.x, o.y);
        if (p.x >= rectInSvg.left && p.x <= rectInSvg.right &&
            p.y >= rectInSvg.top && p.y <= rectInSvg.bottom) {
          picked.push({ kind: 'switch', id: o.id });
        }
      });

      multiSelected = picked;
      selected = null;
      render();
      renderProps();
      if (picked.length) canvasHint.textContent = 'Выделено: ' + picked.length + ' объектов';
      selectionRect = null;
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // ==================== КОПИРОВАНИЕ / ВСТАВКА ====================
  function copySelected() {
    var items = multiSelected.length ? multiSelected : (selected ? [selected] : []);
    if (!items.length) return;
    clipboard = items.map(function (s) {
      var obj = getObjectPosition(s.kind, s.id);
      if (!obj) return null;
      var copy = JSON.parse(JSON.stringify(obj));
      delete copy.id; delete copy.project_id; delete copy.created_at;
      return { kind: s.kind, payload: copy };
    }).filter(Boolean);
    canvasHint.textContent = 'Скопировано: ' + clipboard.length;
  }

  function pasteFromClipboard() {
    if (!clipboard || !clipboard.length || !project) return;
    pushHistory('вставка');
    var promises = clipboard.map(function (item) {
      var p = JSON.parse(JSON.stringify(item.payload));
      if (p.x != null) p.x = snap(p.x + 1);
      if (p.y != null) p.y = snap(p.y + 1);
      var url;
      if (item.kind === 'ap') url = '/api/projects/' + project.id + '/aps';
      else if (item.kind === 'device') url = '/api/projects/' + project.id + '/devices';
      else if (item.kind === 'element') url = '/api/projects/' + project.id + '/elements';
      else if (item.kind === 'switch') url = '/api/infra/' + project.id + '/switches';
      else return Promise.resolve();
      return API.post(url, p);
    });
    Promise.all(promises).then(function () {
      canvasHint.textContent = 'Вставлено: ' + promises.length;
      loadAll();
    });
  }

  function duplicateSelected() { copySelected(); pasteFromClipboard(); }

  // ==================== ПОВОРОТ ====================
  function rotateSelected() {
    var items = multiSelected.length ? multiSelected : (selected ? [selected] : []);
    if (!items.length) return;
    pushHistory('поворот');
    var promises = items.map(function (s) {
      if (s.kind !== 'element') return Promise.resolve();
      var el = elements.find(function (x) { return x.id === s.id; });
      if (!el || el.type !== 'furniture') return Promise.resolve();
      var rot = ((el.rotation || 0) + 15) % 360;
      var payload = Object.assign({}, el, { rotation: rot });
      delete payload.id; delete payload.project_id;
      return API.put('/api/projects/elements/' + el.id, payload);
    });
    Promise.all(promises).then(loadAll);
  }

  // ==================== УДАЛЕНИЕ ====================
  function deleteSelected() {
    var items = multiSelected.length ? multiSelected : (selected ? [selected] : []);
    if (!items.length) return;
    if (!confirm('Удалить ' + items.length + ' объектов?')) return;
    pushHistory('удаление');
    var promises = items.map(function (s) {
      var url;
      if (s.kind === 'ap') url = '/api/projects/aps/' + s.id;
      else if (s.kind === 'device') url = '/api/projects/devices/' + s.id;
      else if (s.kind === 'element') url = '/api/projects/elements/' + s.id;
      else if (s.kind === 'switch') url = '/api/infra/switches/' + s.id;
      else return Promise.resolve();
      return API.del(url);
    });
    Promise.all(promises).then(function () {
      clearSelection();
      loadAll();
      renderProps();
    });
  }

  // ==================== КЛАВИАТУРА ====================
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    var ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault(); undo();
    } else if (ctrl && (e.key.toLowerCase() === 'y' ||
                       (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault(); redo();
    } else if (ctrl && e.key.toLowerCase() === 'c') {
      e.preventDefault(); copySelected();
    } else if (ctrl && e.key.toLowerCase() === 'v') {
      e.preventDefault(); pasteFromClipboard();
    } else if (ctrl && e.key.toLowerCase() === 'd') {
      e.preventDefault(); duplicateSelected();
    } else if (e.key.toLowerCase() === 'r' && !ctrl) {
      e.preventDefault(); rotateSelected();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault(); deleteSelected();
    } else if (e.key === 'Escape') {
      if (draft) {
        draft = null;
        layerDraft.innerHTML = '';
        canvasHint.textContent = 'Рисование отменено';
      }
      if (roomPoints.length) {
        roomPoints = [];
        layerDraft.innerHTML = '';
      }
      clearSelection();
      render();
      renderProps();
    }
  });

  // ==================== СЛОИ ====================
  document.getElementById('chkLayerWalls').addEventListener('change', function () {
    layerWalls.style.display = this.checked ? '' : 'none';
  });
  document.getElementById('chkLayerFurniture').addEventListener('change', function () {
    layerFurniture.style.display = this.checked ? '' : 'none';
  });
  document.getElementById('chkLayerDevices').addEventListener('change', function () {
    layerDevices.style.display = this.checked ? '' : 'none';
  });
  document.getElementById('chkLayerCoverage').addEventListener('change', function () {
    layerCoverage.style.display = this.checked ? '' : 'none';
  });
  var cablesChk = document.getElementById('layerCablesChk');
  if (cablesChk) cablesChk.addEventListener('change', function () { renderCables(); });

  var wallBlockChk = document.getElementById('chkWallBlockCoverage');
  if (wallBlockChk) wallBlockChk.addEventListener('change', function () { renderCoverage(); });

  var deviceLinksChk = document.getElementById('chkDeviceLinks');
  if (deviceLinksChk) deviceLinksChk.addEventListener('change', function () { renderDeviceLinks(); });

  // ==================== ZOOM ====================
  document.getElementById('zoomIn').addEventListener('click', function () {
    zoom = Math.min(3, zoom + 0.25);
    document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
    applyViewBox();
  });
  document.getElementById('zoomOut').addEventListener('click', function () {
    zoom = Math.max(0.25, zoom - 0.25);
    document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
    applyViewBox();
  });

  // ==================== МОДАЛКА ПРОЕКТА ====================
  var mask = document.getElementById('modalMask');
  document.getElementById('newProjectBtn').addEventListener('click', function () {
    mask.classList.add('show');
  });
  document.getElementById('npCancel').addEventListener('click', function () {
    mask.classList.remove('show');
  });
  document.getElementById('npCreate').addEventListener('click', function () {
    var name = document.getElementById('npName').value || 'Проект';
    var w = parseFloat(document.getElementById('npWidth').value) || 30;
    var h = parseFloat(document.getElementById('npHeight').value) || 20;
    API.post('/api/projects/', { name: name, width_m: w, height_m: h })
      .then(function (p) {
        mask.classList.remove('show');
        loadProjects();
        setTimeout(function () {
          projectSelect.value = p.id;
          selectProject(p);
        }, 200);
      }).catch(function (err) { alert(err.message); });
  });

  // ==================== КАРТЫ / АНАЛИЗ ====================
  document.getElementById('showHeatmap').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    var gs = parseFloat(document.getElementById('gridSize').value) || 0.5;
    canvasHint.textContent = 'Расчёт покрытия...';
    API.post('/api/measurements/' + project.id + '/preview', { grid_size_m: gs })
      .then(function (data) {
        drawGridOnCanvas(data, rssiToColor);
        lastHeatmapMode = 'rssi';
        heatmapCanvas.style.display = 'block';
        canvasHint.textContent = 'Покрытие: AP ' + (data.aps || []).length +
          ' · стен ' + (data.walls_count || 0);
      })
      .catch(function (err) { alert(err.message); canvasHint.textContent = project.name; });
  });

  document.getElementById('showSnr').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    var gs = parseFloat(document.getElementById('gridSize').value) || 0.5;
    canvasHint.textContent = 'Расчёт SNR...';
    API.post('/api/measurements/' + project.id + '/snr', { grid_size_m: gs })
      .then(function (data) {
        drawGridOnCanvas(data, snrToColor);
        lastHeatmapMode = 'snr';
        heatmapCanvas.style.display = 'block';
        canvasHint.textContent = 'SNR рассчитан';
      })
      .catch(function (err) { alert(err.message); canvasHint.textContent = project.name; });
  });

  document.getElementById('showInterference').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    var gs = parseFloat(document.getElementById('gridSize').value) || 0.5;
    canvasHint.textContent = 'Расчёт интерференции...';
    API.post('/api/measurements/' + project.id + '/interference', { grid_size_m: gs })
      .then(function (data) {
        drawGridOnCanvas(data, interferenceToColor);
        lastHeatmapMode = 'interference';
        heatmapCanvas.style.display = 'block';
        canvasHint.textContent = 'Интерференция рассчитана';
      })
      .catch(function (err) { alert(err.message); canvasHint.textContent = project.name; });
  });

  document.getElementById('hideHeatmap').addEventListener('click', function () {
    heatmapCanvas.style.display = 'none';
  });

  document.getElementById('showChannels').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    var panel = document.getElementById('channelsPanel');
    if (!panel) return;
    panel.style.display = 'block';
    panel.innerHTML = 'Загрузка...';
    API.get('/api/measurements/' + project.id + '/channels').then(function (data) {
      var html = '<div style="font-weight:600;color:#6c5ce7;margin-bottom:6px">📻 Анализ каналов</div>';
      if (data.by_channel && data.by_channel.length) {
        html += '<div style="color:#777;margin-bottom:6px">Используемые каналы:</div>';
        data.by_channel.forEach(function (c) {
          html += '<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:11px">' +
            '<span>' + c.band + ' ГГц · канал ' + c.channel + '</span>' +
            '<span style="color:#6c5ce7;font-weight:600">' + c.count + ' AP</span></div>';
        });
      }
      html += '<div style="margin-top:10px;color:#777">Рекомендации:</div>';
      (data.recommendations || []).forEach(function (rec) {
        var color = rec.type === 'error' ? '#e74c3c'
                  : rec.type === 'warning' ? '#e67e22' : '#00b894';
        var icon = rec.type === 'error' ? '❌'
                 : rec.type === 'warning' ? '⚠️' : '✅';
        html += '<div style="background:#fff;border-left:3px solid ' + color +
          ';padding:6px 8px;margin:4px 0;border-radius:4px;font-size:11px;line-height:1.4">' +
          icon + ' ' + rec.text + '</div>';
      });
      panel.innerHTML = html;
    });
  });

  document.getElementById('showStats').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    var modal = document.getElementById('statsModal');
    var body = document.getElementById('statsBody');
    modal.classList.add('show');
    body.innerHTML = 'Загрузка...';
    API.get('/api/measurements/' + project.id + '/coverage-stats').then(function (s) {
      var rssiNames = { excellent: 'Отлично (≥ −55)', good: 'Хорошо (−65…−55)',
                        fair: 'Норма (−75…−65)', poor: 'Слабо (−85…−75)',
                        dead: 'Мёртвая зона (< −85)' };
      var snrNames = { excellent: 'Отлично (≥ 40)', good: 'Хорошо (25…40)',
                       fair: 'Норма (15…25)', poor: 'Плохо (< 15)' };
      var html = '<h3>RSSI</h3><table class="stats-table">';
      Object.keys(s.rssi).forEach(function (k) {
        html += '<tr><td>' + rssiNames[k] + '</td><td>' + s.rssi[k].percent +
          '%</td><td>' + s.rssi[k].count + '</td></tr>';
      });
      html += '</table><h3>SNR</h3><table class="stats-table">';
      Object.keys(s.snr).forEach(function (k) {
        html += '<tr><td>' + snrNames[k] + '</td><td>' + s.snr[k].percent +
          '%</td><td>' + s.snr[k].count + '</td></tr>';
      });
      html += '</table>';
      body.innerHTML = html;
    });
  });

  function rssiToColor(rssi) {
    if (rssi >= -55) return 'rgba(0,184,148,0.55)';
    if (rssi >= -65) return 'rgba(160,220,120,0.55)';
    if (rssi >= -72) return 'rgba(253,203,110,0.55)';
    if (rssi >= -80) return 'rgba(255,159,64,0.55)';
    if (rssi >= -88) return 'rgba(255,107,107,0.55)';
    return 'rgba(180,40,40,0.6)';
  }
  function snrToColor(snr) {
    if (snr >= 40) return 'rgba(0,184,148,0.55)';
    if (snr >= 25) return 'rgba(160,220,120,0.55)';
    if (snr >= 15) return 'rgba(253,203,110,0.55)';
    if (snr >= 10) return 'rgba(255,159,64,0.55)';
    return 'rgba(230,60,60,0.65)';
  }
  function interferenceToColor(interf) {
    if (interf <= -95) return 'rgba(0,0,0,0)';
    if (interf <= -85) return 'rgba(160,220,120,0.35)';
    if (interf <= -75) return 'rgba(253,203,110,0.45)';
    if (interf <= -65) return 'rgba(255,159,64,0.55)';
    return 'rgba(230,60,60,0.65)';
  }

  function drawGridOnCanvas(data, colorFn) {
    if (!data || !data.grid) return;
    var W = project.width_m * PX_PER_M;
    var H = project.height_m * PX_PER_M;
    heatmapCanvas.width = W; heatmapCanvas.height = H;
    var ctx = heatmapCanvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    var cw = W / data.cols, ch = H / data.rows;
    for (var r = 0; r < data.rows; r++) {
      for (var c = 0; c < data.cols; c++) {
        ctx.fillStyle = colorFn(data.grid[r][c]);
        ctx.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
      }
    }
  }

  // ==================== ПОКРЫТИЕ С ОБРЕЗКОЙ ====================
  function renderCoverage() {
    layerCoverage.innerHTML = '';
    var chkCov = document.getElementById('chkLayerCoverage');
    if (chkCov && !chkCov.checked) return;
    if (!project) return;

    var chkBlock = document.getElementById('chkWallBlockCoverage');
    var blockCoverage = chkBlock ? chkBlock.checked : true;

    var walls = elements.filter(function (el) {
      return el.type === 'wall';
    }).map(function (el) {
      return { x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2, material: el.material };
    });

    aps.forEach(function (ap) {
      var p = m2px(ap.x, ap.y);
      var r_m = 5 + (ap.tx_power_dbm - 10) * 0.8;
      if (ap.band === '2.4') r_m *= 1.4;
      if (ap.band === '6') r_m *= 0.8;
      var r_px = r_m * PX_PER_M;

      if (blockCoverage && walls.length > 0) {
        var rays = 72;
        var points = [];
        for (var i = 0; i < rays; i++) {
          var angle = (i / rays) * Math.PI * 2;
          var dxr = Math.cos(angle);
          var dyr = Math.sin(angle);
          var hitDist = r_m;
          for (var w = 0; w < walls.length; w++) {
            var wall = walls[w];
            var d = rayWallDistance(ap.x, ap.y,
              ap.x + dxr * r_m, ap.y + dyr * r_m,
              wall.x1, wall.y1, wall.x2, wall.y2);
            if (d !== null && d < hitDist) hitDist = d;
          }
          var px = ap.x + dxr * hitDist;
          var py = ap.y + dyr * hitDist;
          var q = m2px(px, py);
          points.push(q.x + ',' + q.y);
        }

        var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', points.join(' '));
        poly.setAttribute('fill', 'rgba(108, 92, 231, 0.15)');
        poly.setAttribute('stroke', 'rgba(108, 92, 231, 0.5)');
        poly.setAttribute('stroke-width', '1');
        poly.setAttribute('stroke-dasharray', '4 4');
        poly.setAttribute('pointer-events', 'none');
        layerCoverage.appendChild(poly);

        var defs = svg.querySelector('defs');
        var clipId = 'clip_ap_' + ap.id;
        var oldClip = defs.querySelector('#' + clipId);
        if (oldClip) oldClip.remove();
        var clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clip.setAttribute('id', clipId);
        var clipPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        clipPoly.setAttribute('points', points.join(' '));
        clip.appendChild(clipPoly);
        defs.appendChild(clip);

        var gid = 'grad_ap_' + ap.id;
        var old = defs.querySelector('#' + gid);
        if (old) old.remove();
        var grad = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
        grad.setAttribute('id', gid);
        var s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', '#00b894'); s1.setAttribute('stop-opacity', '0.55');
        var s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s2.setAttribute('offset', '55%'); s2.setAttribute('stop-color', '#fdcb6e'); s2.setAttribute('stop-opacity', '0.35');
        var s3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s3.setAttribute('offset', '100%'); s3.setAttribute('stop-color', '#ff6b6b'); s3.setAttribute('stop-opacity', '0.15');
        grad.appendChild(s1); grad.appendChild(s2); grad.appendChild(s3);
        defs.appendChild(grad);

        var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
        c.setAttribute('r', r_px);
        c.setAttribute('fill', 'url(#' + gid + ')');
        c.setAttribute('clip-path', 'url(#' + clipId + ')');
        c.setAttribute('pointer-events', 'none');
        layerCoverage.appendChild(c);
      } else {
        var defs = svg.querySelector('defs');
        var gid = 'grad_ap_' + ap.id;
        var old = defs.querySelector('#' + gid);
        if (old) old.remove();
        var grad = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
        grad.setAttribute('id', gid);
        var s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', '#00b894'); s1.setAttribute('stop-opacity', '0.35');
        var s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s2.setAttribute('offset', '60%'); s2.setAttribute('stop-color', '#fdcb6e'); s2.setAttribute('stop-opacity', '0.18');
        var s3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s3.setAttribute('offset', '100%'); s3.setAttribute('stop-color', '#ff6b6b'); s3.setAttribute('stop-opacity', '0');
        grad.appendChild(s1); grad.appendChild(s2); grad.appendChild(s3);
        defs.appendChild(grad);
        var c2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c2.setAttribute('cx', p.x); c2.setAttribute('cy', p.y);
        c2.setAttribute('r', r_px);
        c2.setAttribute('fill', 'url(#' + gid + ')');
        c2.setAttribute('pointer-events', 'none');
        layerCoverage.appendChild(c2);
      }
    });
  }

  function rayWallDistance(ax, ay, bx, by, x1, y1, x2, y2) {
    var r_px = bx - ax, r_py = by - ay;
    var s_px = x2 - x1, s_py = y2 - y1;
    var denom = r_px * s_py - r_py * s_px;
    if (Math.abs(denom) < 1e-10) return null;
    var t = ((x1 - ax) * s_py - (y1 - ay) * s_px) / denom;
    var u = ((x1 - ax) * r_py - (y1 - ay) * r_px) / denom;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return t * Math.sqrt(r_px * r_px + r_py * r_py);
  }

  // ==================== СВЯЗИ УСТРОЙСТВ ====================
  function renderDeviceLinks() {
    layerDeviceLinks.innerHTML = '';
    var chk = document.getElementById('chkDeviceLinks');
    if (chk && !chk.checked) return;
    deviceLinks.forEach(function (link) {
      if (link.from_x == null || link.to_x == null) return;
      var a = m2px(link.from_x, link.from_y);
      var b = m2px(link.to_x, link.to_y);
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      line.setAttribute('stroke', link.exceeds_limit ? '#e74c3c' : '#10b981');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-dasharray', '4 3');
      line.setAttribute('opacity', '0.7');
      layerDeviceLinks.appendChild(line);

      var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', (a.x + b.x) / 2);
      dot.setAttribute('cy', (a.y + b.y) / 2);
      dot.setAttribute('r', '2');
      dot.setAttribute('fill', link.exceeds_limit ? '#e74c3c' : '#10b981');
      layerDeviceLinks.appendChild(dot);
    });
  }

  // ==================== КАБЕЛИ СКС ====================
  function renderCables() {
    layerCables.innerHTML = '';
    var chk = document.getElementById('layerCablesChk');
    if (chk && !chk.checked) return;
    cableLinks.forEach(function (link) {
      var a = m2px(link.from.x, link.from.y);
      var b = m2px(link.to.x, link.to.y);
      var midX = (a.x + b.x) / 2;
      var midY = (a.y + b.y) / 2;
      var dx = b.x - a.x, dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var ctrlX = midX - dy / len * len * 0.15;
      var ctrlY = midY + dx / len * len * 0.15;

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M ' + a.x + ' ' + a.y +
                             ' Q ' + ctrlX + ' ' + ctrlY + ' ' + b.x + ' ' + b.y);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', link.length_m > 100 ? '#e74c3c' : '#95a5a6');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-dasharray', '6 4');
      path.setAttribute('opacity', '0.7');
      layerCables.appendChild(path);

      var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', (a.x + ctrlX + b.x) / 3);
      label.setAttribute('y', (a.y + ctrlY + b.y) / 3 - 4);
      label.setAttribute('font-size', '9');
      label.setAttribute('fill', link.length_m > 100 ? '#c0392b' : '#7f8c8d');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-weight', '600');
      label.textContent = link.length_m + ' м';
      layerCables.appendChild(label);
    });
  }

  // ==================== ПРАВАЯ ПАНЕЛЬ ====================
  function renderProps() {
    if (multiSelected.length > 1) {
      propsPanel.innerHTML =
        '<div class="props-empty"><div class="big">🎯</div>' +
        '<div>Выделено <strong>' + multiSelected.length + '</strong> объектов</div>' +
        '<div style="margin-top:12px;font-size:11px;color:#999">' +
        'R — повернуть · Ctrl+D — дубль<br>Delete — удалить · Esc — снять</div></div>';
      return;
    }
    if (!selected) {
      propsPanel.innerHTML =
        '<div class="props-empty"><div class="big">🎨</div>' +
        '<div>Выберите объект на холсте</div></div>';
      return;
    }
    if (selected.kind === 'ap') propsAP();
    else if (selected.kind === 'device') propsDevice();
    else if (selected.kind === 'element') propsElement();
    else if (selected.kind === 'switch') propsSwitch();
  }

  function propsAP() {
    var ap = aps.find(function (x) { return x.id === selected.id; });
    if (!ap) return;
    propsPanel.innerHTML =
      head('📡', ap.name, ap.model || 'Точка доступа') +
      sect('Параметры',
        row('Имя', '<input id="p_name" value="' + esc(ap.name) + '">') +
        row('Модель', '<select id="p_model"><option value="">— выберите —</option></select>') +
        row('Мощность, dBm', '<input id="p_tx" type="number" value="' + ap.tx_power_dbm + '">') +
        row('Усиление, dBi', '<input id="p_gain" type="number" value="' + ap.antenna_gain + '">') +
        row('Частота', '<select id="p_band">' +
          '<option value="2.4"' + (ap.band === '2.4' ? ' selected' : '') + '>2.4 ГГц</option>' +
          '<option value="5"' + (ap.band === '5' ? ' selected' : '') + '>5 ГГц</option>' +
          '<option value="6"' + (ap.band === '6' ? ' selected' : '') + '>6 ГГц</option>' +
        '</select>') +
        row('Канал', '<input id="p_ch" type="number" value="' + ap.channel + '">')
      ) +
      sect('SSID',
        row('Тип', '<select id="p_ssid">' +
          '<option value="corporate"' + (ap.ssid_type === 'corporate' ? ' selected' : '') + '>Корпоративный</option>' +
          '<option value="guest"' + (ap.ssid_type === 'guest' ? ' selected' : '') + '>Гостевой</option>' +
          '<option value="iot"' + (ap.ssid_type === 'iot' ? ' selected' : '') + '>IoT</option>' +
        '</select>')
      ) +
      sect('Позиция',
        '<div style="font-size:12px;color:#777">X: ' + ap.x.toFixed(2) +
        ' м, Y: ' + ap.y.toFixed(2) + ' м</div>'
      ) +
      sect('', '<button class="btn-primary" id="saveBtn">Сохранить</button>' +
               '<button class="btn-danger" id="delBtn">Удалить</button>');

    API.get('/api/ap-models/').then(function (catalog) {
      var sel = document.getElementById('p_model');
      if (!sel) return;
      catalog.forEach(function (item) {
        var opt = document.createElement('option');
        opt.value = item.vendor + ' ' + item.model;
        opt.textContent = item.vendor + ' · ' + item.model + ' (' + item.standard + ')';
        opt.dataset.tx = item.tx_power_dbm;
        opt.dataset.gain = item.antenna_gain;
        opt.dataset.band = item.band;
        sel.appendChild(opt);
      });
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === (ap.model || '')) { sel.selectedIndex = i; break; }
      }
      sel.addEventListener('change', function () {
        var opt = sel.options[sel.selectedIndex];
        if (!opt.dataset.tx) return;
        document.getElementById('p_tx').value = opt.dataset.tx;
        document.getElementById('p_gain').value = opt.dataset.gain;
        var b = (opt.dataset.band || '').split('/').pop();
        if (b === '2.4' || b === '5' || b === '6') document.getElementById('p_band').value = b;
      });
    });

    bindSaveDelete(function () {
      return { name: v('p_name'), model: v('p_model'), x: ap.x, y: ap.y,
        tx_power_dbm: parseFloat(v('p_tx')), antenna_gain: parseFloat(v('p_gain')),
        band: v('p_band'), channel: parseInt(v('p_ch'), 10), ssid_type: v('p_ssid') };
    }, '/api/projects/aps/' + ap.id);
  }

  function propsDevice() {
    var d = devices.find(function (x) { return x.id === selected.id; });
    if (!d) return;
    propsPanel.innerHTML =
      head(DEV_ICON[d.type] || '📦', d.name, 'Устройство · ' + d.type) +
      sect('Параметры',
        row('Имя', '<input id="d_name" value="' + esc(d.name) + '">') +
        row('Требуемый RSSI', '<input id="d_rssi" type="number" value="' + d.required_rssi + '">') +
        row('Скорость, Мбит/с', '<input id="d_speed" type="number" value="' + d.required_speed + '">')
      ) +
      sect('Позиция',
        '<div style="font-size:12px;color:#777">X: ' + d.x.toFixed(2) +
        ' м, Y: ' + d.y.toFixed(2) + ' м</div>'
      ) +
      sect('', '<button class="btn-primary" id="saveBtn">Сохранить</button>' +
               '<button class="btn-danger" id="delBtn">Удалить</button>');
    bindSaveDelete(function () {
      return { name: v('d_name'), type: d.type, x: d.x, y: d.y, band: d.band,
        required_rssi: parseFloat(v('d_rssi')), required_speed: parseFloat(v('d_speed')),
        ssid_type: d.ssid_type };
    }, '/api/projects/devices/' + d.id);
  }

  function propsSwitch() {
    var sw = switches.find(function (x) { return x.id === selected.id; });
    if (!sw) return;
    propsPanel.innerHTML =
      head('🔀', sw.name, sw.model || 'PoE-коммутатор') +
      sect('Параметры',
        row('Имя', '<input id="sw_name2" value="' + esc(sw.name) + '">') +
        row('Модель', '<input id="sw_model2" value="' + esc(sw.model || '') + '">') +
        row('Расположение', '<input id="sw_loc2" value="' + esc(sw.location || '') + '">') +
        row('PoE-бюджет, Вт', '<input id="sw_budget2" type="number" value="' + sw.total_power_budget_w + '">') +
        row('Всего портов', '<input id="sw_ports2" type="number" value="' + sw.total_ports + '">') +
        row('PoE-портов', '<input id="sw_poe2" type="number" value="' + sw.poe_ports + '">')
      ) +
      sect('Позиция',
        '<div style="font-size:12px;color:#777">X: ' + (sw.x || 0).toFixed(2) +
        ' м, Y: ' + (sw.y || 0).toFixed(2) + ' м</div>'
      ) +
      sect('', '<button class="btn-primary" id="saveBtn">Сохранить</button>' +
               '<button class="btn-danger" id="delBtn">Удалить</button>');

    document.getElementById('saveBtn').addEventListener('click', function () {
      API.put('/api/infra/switches/' + sw.id, {
        name: v('sw_name2'), model: v('sw_model2'), location: v('sw_loc2'),
        x: sw.x, y: sw.y,
        total_power_budget_w: parseFloat(v('sw_budget2')) || 370,
        total_ports: parseInt(v('sw_ports2'), 10) || 24,
        poe_ports: parseInt(v('sw_poe2'), 10) || 24
      }).then(loadAll);
    });
    document.getElementById('delBtn').addEventListener('click', function () {
      if (!confirm('Удалить коммутатор ' + sw.name + '?')) return;
      API.del('/api/infra/switches/' + sw.id).then(function () {
        selected = null; loadAll(); renderProps();
      });
    });
  }

  function propsElement() {
    var el = elements.find(function (x) { return x.id === selected.id; });
    if (!el) return;

    if (el.type === 'wall') {
      var names = { concrete: 'Бетон', brick: 'Кирпич', drywall: 'Гипсокартон', wood: 'Дерево', glass: 'Стекло' };
      var len = Math.hypot(el.x2 - el.x1, el.y2 - el.y1).toFixed(2);
      propsPanel.innerHTML =
        head('🧱', 'Стена', names[el.material] || el.material) +
        sect('Свойства',
          row('Материал', '<select id="e_mat">' +
            Object.keys(names).map(function (k) {
              return '<option value="' + k + '"' + (el.material === k ? ' selected' : '') + '>' + names[k] + '</option>';
            }).join('') + '</select>') +
          '<div style="font-size:12px;color:#777;margin-top:6px">Длина: ' + len + ' м</div>'
        ) +
        sect('', '<button class="btn-primary" id="saveBtn">Сохранить</button>' +
                 '<button class="btn-danger" id="delBtn">Удалить</button>');
      bindSaveDelete(function () {
        return { type: 'wall', material: v('e_mat'),
          x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 };
      }, '/api/projects/elements/' + el.id);
      return;
    }

    if (el.type === 'shape') {
      var shapeNames = { concrete: 'Бетон', brick: 'Кирпич', drywall: 'Гипсокартон', wood: 'Дерево', glass: 'Стекло' };
      var shapeTypeNames = { rect: 'Прямоугольник', ellipse: 'Эллипс', triangle: 'Треугольник' };
      propsPanel.innerHTML =
        head('⬛', shapeTypeNames[el.subtype] || 'Фигура', shapeNames[el.material] || el.material) +
        sect('Свойства',
          row('Материал', '<select id="e_mat">' +
            Object.keys(shapeNames).map(function (k) {
              return '<option value="' + k + '"' + (el.material === k ? ' selected' : '') + '>' + shapeNames[k] + '</option>';
            }).join('') + '</select>') +
          row('Ширина, м', '<input id="e_w" type="number" step="0.5" value="' + (el.width || 4) + '">') +
          row('Высота, м', '<input id="e_h" type="number" step="0.5" value="' + (el.height || 3) + '">')
        ) +
        sect('Позиция',
          '<div style="font-size:12px;color:#777">X: ' + el.x.toFixed(2) +
          ' м, Y: ' + el.y.toFixed(2) + ' м</div>'
        ) +
        sect('', '<button class="btn-primary" id="saveBtn">Сохранить</button>' +
                 '<button class="btn-danger" id="delBtn">Удалить</button>');
      bindSaveDelete(function () {
        return { type: 'shape', subtype: el.subtype, material: v('e_mat'),
          x: el.x, y: el.y,
          width: parseFloat(v('e_w')) || 4,
          height: parseFloat(v('e_h')) || 3 };
      }, '/api/projects/elements/' + el.id);
      return;
    }

    if (el.type === 'furniture' || el.type === 'text') {
      propsPanel.innerHTML =
        head(el.type === 'text' ? '🅰' : (FURN_ICON[el.subtype] || '📦'),
             el.type === 'furniture' ? 'Мебель' : 'Текст', '') +
        (el.type === 'text' ?
          sect('Текст', row('Содержимое', '<input id="t_name" value="' + esc(el.name || '') + '">')) : '') +
        (el.type === 'furniture' ?
          sect('Поворот',
            row('Угол, °', '<input id="e_rot" type="number" step="15" value="' + (el.rotation || 0) + '">') +
            '<button class="btn-primary" id="rotBtn" style="margin-top:6px">🔄 Повернуть +15°</button>'
          ) : '') +
        sect('Позиция',
          '<div style="font-size:12px;color:#777">X: ' + el.x.toFixed(2) +
          ' м, Y: ' + el.y.toFixed(2) + ' м</div>'
        ) +
        sect('', (el.type === 'text' ? '<button class="btn-primary" id="saveBtn">Сохранить</button>' : '') +
                 '<button class="btn-danger" id="delBtn">Удалить</button>');

      document.getElementById('delBtn').addEventListener('click', function () {
        if (!confirm('Удалить?')) return;
        API.del('/api/projects/elements/' + el.id).then(function () {
          selected = null; loadAll(); renderProps();
        });
      });
      if (el.type === 'text') {
        document.getElementById('saveBtn').addEventListener('click', function () {
          API.put('/api/projects/elements/' + el.id, {
            type: 'text', name: v('t_name'), x: el.x, y: el.y
          }).then(loadAll);
        });
      }
      if (el.type === 'furniture') {
        var rotBtn = document.getElementById('rotBtn');
        if (rotBtn) rotBtn.addEventListener('click', function () {
          var newRot = ((el.rotation || 0) + 15) % 360;
          API.put('/api/projects/elements/' + el.id, {
            type: 'furniture', subtype: el.subtype,
            x: el.x, y: el.y, width: el.width, height: el.height,
            rotation: newRot
          }).then(loadAll);
        });
      }
      return;
    }

    propsPanel.innerHTML =
      head('🚪', el.type === 'room' ? 'Комната' : (el.type === 'door' ? 'Дверь' : 'Окно'), '') +
      sect('', '<button class="btn-danger" id="delBtn">Удалить</button>');
    document.getElementById('delBtn').addEventListener('click', function () {
      if (!confirm('Удалить?')) return;
      API.del('/api/projects/elements/' + el.id).then(function () {
        selected = null; loadAll(); renderProps();
      });
    });
  }

  function bindSaveDelete(payloadFn, url) {
    document.getElementById('saveBtn').addEventListener('click', function () {
      API.put(url, payloadFn()).then(loadAll).catch(function (err) { alert(err.message); });
    });
    document.getElementById('delBtn').addEventListener('click', function () {
      if (!confirm('Удалить?')) return;
      API.del(url).then(function () {
        selected = null; loadAll(); renderProps();
      });
    });
  }

  function head(icon, title, subtitle) {
    return '<div class="props-header"><div class="icon">' + icon + '</div>' +
      '<div><div class="title">' + esc(title) + '</div>' +
      '<div class="subtitle">' + esc(subtitle || '') + '</div></div></div>';
  }
  function sect(title, body) {
    return '<div class="props-section">' + (title ? '<h4>' + title + '</h4>' : '') + body + '</div>';
  }
  function row(label, input) {
    return '<div class="props-row"><label>' + label + '</label>' + input + '</div>';
  }
  function v(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function esc(s) {
    return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ==================== SSID ====================
  function loadSsid() {
    if (!project) return;
    API.get('/api/ssid/' + project.id).then(function (list) {
      ssidProfiles = list;
      renderSsidList();
    });
  }

  function renderSsidList() {
    var el = document.getElementById('ssidList');
    if (!el) return;
    el.innerHTML = '';
    if (!ssidProfiles.length) {
      el.innerHTML = '<div style="font-size:11px;color:#999;padding:6px 0">' +
        'Нет профилей. Нажмите «Добавить SSID».</div>';
      return;
    }
    ssidProfiles.forEach(function (s) {
      var typeNames = { corporate: 'Корп.', guest: 'Гост.', iot: 'IoT' };
      var div = document.createElement('div');
      div.style.cssText = 'background:#f8f7ff;border-radius:6px;' +
        'padding:8px 10px;margin-bottom:4px;font-size:11px;cursor:pointer;' +
        'display:flex;justify-content:space-between;align-items:center';
      div.innerHTML =
        '<div><div style="font-weight:600;color:#2c2c3a">🔐 ' + esc(s.name) + '</div>' +
        '<div style="color:#999;font-size:10px">' +
          typeNames[s.type] + ' · ' + s.auth_method + ' · ' + s.encryption +
        '</div></div>' +
        '<span class="del" style="color:#e74c3c;cursor:pointer;font-size:14px">✕</span>';
      div.addEventListener('click', function (e) {
        if (e.target.classList.contains('del')) return;
        openSsidModal(s);
      });
      div.querySelector('.del').addEventListener('click', function (e) {
        e.stopPropagation();
        if (!confirm('Удалить профиль ' + s.name + '?')) return;
        API.del('/api/ssid/item/' + s.id).then(loadSsid);
      });
      el.appendChild(div);
    });
  }

  function openSsidModal(s) {
    editingSsidId = s ? s.id : null;
    document.getElementById('ssidModalTitle').textContent =
      s ? 'Редактировать SSID' : 'Новый SSID-профиль';
    document.getElementById('s_name').value = s ? s.name : '';
    document.getElementById('s_type').value = s ? s.type : 'corporate';
    document.getElementById('s_auth').value = s ? s.auth_method : 'RADIUS';
    document.getElementById('s_enc').value = s ? s.encryption : 'WPA2-Enterprise';
    document.getElementById('s_vlan').value = s && s.vlan_id ? s.vlan_id : '';
    document.getElementById('s_bw').value = s && s.bandwidth_limit_mbps ? s.bandwidth_limit_mbps : 0;
    document.getElementById('s_iso').checked = s ? s.client_isolation : false;
    document.getElementById('s_int').checked = s ? s.access_to_internal : false;
    document.getElementById('s_net').checked = s ? s.access_to_internet : true;
    document.getElementById('s_cp').checked = s ? s.captive_portal : false;
    document.getElementById('s_desc').value = s ? (s.description || '') : '';
    document.getElementById('ssidModal').classList.add('show');
  }

  var addSsidBtn = document.getElementById('addSsidBtn');
  if (addSsidBtn) addSsidBtn.addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    openSsidModal(null);
  });
  var sCancel = document.getElementById('s_cancel');
  if (sCancel) sCancel.addEventListener('click', function () {
    document.getElementById('ssidModal').classList.remove('show');
  });
  var sSave = document.getElementById('s_save');
  if (sSave) sSave.addEventListener('click', function () {
    var data = {
      name: document.getElementById('s_name').value.trim(),
      type: document.getElementById('s_type').value,
      auth_method: document.getElementById('s_auth').value,
      encryption: document.getElementById('s_enc').value,
      vlan_id: document.getElementById('s_vlan').value ? parseInt(document.getElementById('s_vlan').value, 10) : null,
      client_isolation: document.getElementById('s_iso').checked,
      access_to_internal: document.getElementById('s_int').checked,
      access_to_internet: document.getElementById('s_net').checked,
      captive_portal: document.getElementById('s_cp').checked,
      bandwidth_limit_mbps: parseFloat(document.getElementById('s_bw').value) || null,
      description: document.getElementById('s_desc').value
    };
    if (!data.name) { alert('Введите имя профиля'); return; }
    var promise = editingSsidId
      ? API.put('/api/ssid/item/' + editingSsidId, data)
      : API.post('/api/ssid/' + project.id, data);
    promise.then(function () {
      document.getElementById('ssidModal').classList.remove('show');
      loadSsid();
    }).catch(function (err) { alert(err.message); });
  });

  // ==================== WLC ====================
  document.getElementById('wlcBtn').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    document.getElementById('wlcModal').classList.add('show');
    document.getElementById('wlcBody').innerHTML = 'Загрузка...';
    API.get('/api/infra/' + project.id + '/wlc').then(function (list) {
      currentWlc = list.length ? list[0] : null;
      renderWlcForm();
    });
  });
  document.getElementById('wlcClose').addEventListener('click', function () {
    document.getElementById('wlcModal').classList.remove('show');
  });

  function renderWlcForm() {
    var w = currentWlc || {
      name: 'WLC-01', model: '', ip_address: '', location: '',
      load_balancing: true, band_steering: true,
      fast_roaming_802_11r: true, roaming_802_11k: true, roaming_802_11v: true,
      auto_channel: true, auto_power: true,
      nms_enabled: true, nms_poll_interval_sec: 60, firmware_auto_update: false,
      description: ''
    };
    var html =
      '<label>Имя</label><input id="w_name" value="' + esc(w.name) + '">' +
      '<label>Модель</label><input id="w_model" value="' + esc(w.model || '') + '">' +
      '<label>IP-адрес</label><input id="w_ip" value="' + esc(w.ip_address || '') + '">' +
      '<label>Расположение</label><input id="w_loc" value="' + esc(w.location || '') + '">' +
      '<h3 style="font-size:12px;margin-top:16px;color:#6c5ce7">Управление AP</h3>' +
      checkbox('w_lb', 'Балансировка нагрузки', w.load_balancing) +
      checkbox('w_bs', 'Band Steering', w.band_steering) +
      checkbox('w_r', 'Быстрый роуминг 802.11r', w.fast_roaming_802_11r) +
      checkbox('w_k', 'Roaming 802.11k', w.roaming_802_11k) +
      checkbox('w_v', 'Roaming 802.11v', w.roaming_802_11v) +
      checkbox('w_ac', 'Auto Channel', w.auto_channel) +
      checkbox('w_ap', 'Auto Power', w.auto_power) +
      '<h3 style="font-size:12px;margin-top:16px;color:#6c5ce7">NMS</h3>' +
      checkbox('w_nms', 'Мониторинг включён', w.nms_enabled) +
      '<label>Интервал опроса, сек</label><input type="number" id="w_poll" value="' + w.nms_poll_interval_sec + '">' +
      checkbox('w_fw', 'Автообновление прошивок', w.firmware_auto_update) +
      '<label>Описание</label><textarea id="w_desc" rows="2" style="width:100%;padding:6px;border:1px solid #d0d0d8;border-radius:6px;font-size:12px;box-sizing:border-box">' +
        esc(w.description || '') + '</textarea>' +
      '<div class="modal-btns">' +
        (currentWlc ? '<button class="cancel" id="wlcDel" style="background:#e74c3c;color:#fff">Удалить</button>' : '') +
        '<button class="ok" id="wlcSave">Сохранить</button>' +
      '</div>';
    document.getElementById('wlcBody').innerHTML = html;
    document.getElementById('wlcSave').addEventListener('click', saveWlc);
    var del = document.getElementById('wlcDel');
    if (del) del.addEventListener('click', deleteWlc);
  }

  function checkbox(id, label, checked) {
    return '<label style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px">' +
      '<input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '> ' + label + '</label>';
  }

  function saveWlc() {
    var data = {
      name: document.getElementById('w_name').value,
      model: document.getElementById('w_model').value,
      ip_address: document.getElementById('w_ip').value,
      location: document.getElementById('w_loc').value,
      load_balancing: document.getElementById('w_lb').checked,
      band_steering: document.getElementById('w_bs').checked,
      fast_roaming_802_11r: document.getElementById('w_r').checked,
      roaming_802_11k: document.getElementById('w_k').checked,
      roaming_802_11v: document.getElementById('w_v').checked,
      auto_channel: document.getElementById('w_ac').checked,
      auto_power: document.getElementById('w_ap').checked,
      nms_enabled: document.getElementById('w_nms').checked,
      nms_poll_interval_sec: parseInt(document.getElementById('w_poll').value, 10) || 60,
      firmware_auto_update: document.getElementById('w_fw').checked,
      description: document.getElementById('w_desc').value
    };
    var promise = currentWlc
      ? API.put('/api/infra/wlc/' + currentWlc.id, data)
      : API.post('/api/infra/' + project.id + '/wlc', data);
    promise.then(function (w) {
      currentWlc = w;
      canvasHint.textContent = 'WLC ' + w.name + ' сохранён';
      document.getElementById('wlcModal').classList.remove('show');
    }).catch(function (err) { alert(err.message); });
  }

  function deleteWlc() {
    if (!currentWlc || !confirm('Удалить WLC?')) return;
    API.del('/api/infra/wlc/' + currentWlc.id).then(function () {
      currentWlc = null;
      document.getElementById('wlcModal').classList.remove('show');
    });
  }

  // ==================== КОММУТАТОР ====================
  document.getElementById('addSwitchBtn').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    ['sw_name', 'sw_model', 'sw_loc'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('switchModal').classList.add('show');
  });
  document.getElementById('sw_cancel').addEventListener('click', function () {
    document.getElementById('switchModal').classList.remove('show');
  });
  document.getElementById('sw_save').addEventListener('click', function () {
    var data = {
      name: document.getElementById('sw_name').value.trim() || 'SW-01',
      model: document.getElementById('sw_model').value,
      location: document.getElementById('sw_loc').value,
      total_power_budget_w: parseFloat(document.getElementById('sw_budget').value) || 370,
      total_ports: parseInt(document.getElementById('sw_ports').value, 10) || 24,
      poe_ports: parseInt(document.getElementById('sw_poe').value, 10) || 24
    };
    API.post('/api/infra/' + project.id + '/switches', data)
      .then(function (s) {
        canvasHint.textContent = 'Коммутатор ' + s.name + ' добавлен';
        document.getElementById('switchModal').classList.remove('show');
        loadAll();
      }).catch(function (err) { alert(err.message); });
  });

  // ==================== PoE / СКС / Нагрузка ====================
  document.getElementById('poeBtn').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    document.getElementById('infraResultTitle').textContent = '⚡ PoE-бюджет';
    document.getElementById('infraResultModal').classList.add('show');
    document.getElementById('infraResultBody').innerHTML = 'Загрузка...';
    API.get('/api/infra/' + project.id + '/poe-budget').then(function (d) {
      var html =
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">' +
          box('Коммутаторов', d.switches_count) +
          box('AP', d.aps_count) +
          box('Загрузка', d.utilization_percent + '%') +
        '</div>' +
        '<div style="background:#f8f7ff;border-radius:8px;padding:10px;font-size:12px;margin-bottom:12px">' +
          'Потребление: <strong>' + d.total_consumption_w + ' Вт</strong> из <strong>' +
          d.total_budget_w + ' Вт</strong></div>';
      (d.warnings || []).forEach(function (w) {
        html += '<div class="load-warning ' + w.type + '">' + esc(w.text) + '</div>';
      });
      document.getElementById('infraResultBody').innerHTML = html;
    });
  });

  document.getElementById('cableBtn').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    document.getElementById('infraResultTitle').textContent = '🔌 Анализ СКС';
    document.getElementById('infraResultModal').classList.add('show');
    document.getElementById('infraResultBody').innerHTML = 'Загрузка...';
    API.get('/api/infra/' + project.id + '/cable-analysis').then(function (d) {
      var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">' +
        box('Линий', d.cables_count || 0) +
        box('Общая длина', (d.total_length_m || 0) + ' м') + '</div>';
      if (d.cables && d.cables.length) {
        html += '<table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:12px">' +
          '<tr style="background:#fafafa"><th style="padding:6px;text-align:left">AP</th>' +
          '<th style="padding:6px;text-align:left">Коммутатор</th>' +
          '<th style="padding:6px;text-align:right">Длина</th>' +
          '<th style="padding:6px;text-align:center">OK</th></tr>';
        d.cables.forEach(function (c) {
          html += '<tr><td style="padding:4px;border-bottom:1px solid #f0f0f5">' + esc(c.ap_name) + '</td>' +
            '<td style="padding:4px;border-bottom:1px solid #f0f0f5">' + esc(c.switch_name) + '</td>' +
            '<td style="padding:4px;border-bottom:1px solid #f0f0f5;text-align:right">' + c.length_m + ' м</td>' +
            '<td style="padding:4px;border-bottom:1px solid #f0f0f5;text-align:center">' + (c.ok ? '✅' : '❌') + '</td></tr>';
        });
        html += '</table>';
      }
      (d.warnings || []).forEach(function (w) {
        html += '<div class="load-warning ' + w.type + '">' + esc(w.text) + '</div>';
      });
      document.getElementById('infraResultBody').innerHTML = html;
    });
  });

  document.getElementById('infraResultClose').addEventListener('click', function () {
    document.getElementById('infraResultModal').classList.remove('show');
  });

  function box(label, val) {
    return '<div style="background:#f8f7ff;border-radius:8px;padding:10px;text-align:center">' +
      '<div style="font-size:10px;color:#999;text-transform:uppercase;margin-bottom:4px">' + label + '</div>' +
      '<div style="font-size:16px;font-weight:700">' + val + '</div></div>';
  }

  document.getElementById('showLoad').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    document.getElementById('loadModal').classList.add('show');
    document.getElementById('loadBody').innerHTML = 'Загрузка...';
    API.get('/api/measurements/' + project.id + '/load').then(function (data) {
      var html = '<div class="load-summary">' +
        '<div class="box"><div class="lbl">Устройств</div><div class="val">' + (data.devices_total || 0) + '</div></div>' +
        '<div class="box"><div class="lbl">Ёмкость</div><div class="val">' + (data.total_capacity_mbps || 0) + '</div></div>' +
        '<div class="box"><div class="lbl">Загрузка</div><div class="val">' + (data.total_utilization_percent || 0) + '%</div></div>' +
        '</div>';
      (data.aps || []).forEach(function (ap) {
        var util = ap.utilization_percent;
        var color = util >= 80 ? '#e74c3c' : util >= 60 ? '#fdcb6e' : '#00b894';
        html += '<div class="load-ap">' +
          '<div class="head"><span>📡 ' + esc(ap.ap_name) + ' (' + ap.band + ' ГГц)</span>' +
          '<span class="badge" style="background:#f0f0f5;color:' + color + '">' + util + '%</span></div>' +
          '<div class="progress"><div style="width:' + Math.min(100, util) + '%;background:' + color + '"></div></div>' +
          '<div class="stats"><span>Клиентов: <strong>' + ap.assigned_count + '</strong></span>' +
          '<span>Трафик: <strong>' + ap.total_speed_mbps + '</strong> Мбит/с</span></div>' +
          '</div>';
      });
      (data.warnings || []).forEach(function (w) {
        html += '<div class="load-warning ' + w.type + '">' + esc(w.text) + '</div>';
      });
      document.getElementById('loadBody').innerHTML = html;
    }).catch(function (err) {
      document.getElementById('loadBody').innerHTML = '<span style="color:#e74c3c">' + err.message + '</span>';
    });
  });
  document.getElementById('loadClose').addEventListener('click', function () {
    document.getElementById('loadModal').classList.remove('show');
  });

  document.getElementById('showConnections').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    document.getElementById('infraResultTitle').textContent = '🔌 Связи устройств';
    document.getElementById('infraResultModal').classList.add('show');
    document.getElementById('infraResultBody').innerHTML = 'Загрузка...';
    API.get('/api/infra/' + project.id + '/device-connections').then(function (d) {
      var html =
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">' +
          box('Коммутаторов', d.switches_count || 0) +
          box('Устройств', d.devices_count || 0) +
          box('AP', d.aps_count || 0) +
        '</div>';
      if (d.links && d.links.length) {
        html += '<table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:12px">' +
          '<tr style="background:#fafafa"><th style="padding:6px;text-align:left">Коммутатор</th>' +
          '<th style="padding:6px;text-align:left">Устройство/AP</th>' +
          '<th style="padding:6px;text-align:right">Длина</th></tr>';
        d.links.forEach(function (l) {
          html += '<tr><td style="padding:4px;border-bottom:1px solid #f0f0f5">' + esc(l.from_name) + '</td>' +
            '<td style="padding:4px;border-bottom:1px solid #f0f0f5">' + esc(l.to_name) + '</td>' +
            '<td style="padding:4px;border-bottom:1px solid #f0f0f5;text-align:right;color:' +
            (l.exceeds_limit ? '#e74c3c' : '#555') + '">' + l.length_m + ' м</td></tr>';
        });
        html += '</table>';
      }
      (d.warnings || []).forEach(function (w) {
        html += '<div class="load-warning ' + w.type + '">' + esc(w.text) + '</div>';
      });
      document.getElementById('infraResultBody').innerHTML = html;
    });
  });

  // ==================== ОПТИМИЗАЦИЯ ====================
  document.getElementById('optimizeBtn').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    document.getElementById('opt_result').innerHTML = '';
    document.getElementById('optimizeModal').classList.add('show');
  });
  document.getElementById('opt_cancel').addEventListener('click', function () {
    document.getElementById('optimizeModal').classList.remove('show');
  });
  document.getElementById('opt_run').addEventListener('click', function () {
    var coverage = parseFloat(document.getElementById('opt_coverage').value) || 95;
    var rssi = parseFloat(document.getElementById('opt_rssi').value) || -70;
    var power = parseFloat(document.getElementById('opt_power').value) || 20;
    var band = document.getElementById('opt_band').value;
    document.getElementById('opt_result').innerHTML = 'Расчёт...';
    API.post('/api/measurements/' + project.id + '/optimize-placement?target_coverage=' +
             coverage + '&target_rssi=' + rssi + '&ap_power=' + power + '&band=' + band, {})
      .then(function (data) {
        optimizationResult = data;
        var html = '<div style="background:#f8f7ff;border-radius:8px;padding:12px;margin-bottom:10px">' +
          '<div style="font-size:13px;margin-bottom:6px">Рекомендуется <strong>' + data.recommended_count + '</strong> AP</div>' +
          '<div style="font-size:11px;color:#777">Покрытие: <strong>' + data.coverage_percent + '%</strong></div></div>';
        html += '<button class="btn-primary" id="opt_apply" style="margin-top:12px">✅ Применить</button>';
        document.getElementById('opt_result').innerHTML = html;
        document.getElementById('opt_apply').addEventListener('click', applyOptimization);
      })
      .catch(function (err) {
        document.getElementById('opt_result').innerHTML = '<span style="color:#e74c3c">' + err.message + '</span>';
      });
  });

  function applyOptimization() {
    if (!optimizationResult) return;
    if (!confirm('Создать ' + optimizationResult.recommended_count + ' точек?')) return;
    API.post('/api/measurements/' + project.id + '/apply-placement', optimizationResult.positions)
      .then(function () {
        document.getElementById('optimizeModal').classList.remove('show');
        loadAll();
      });
  }

  // ==================== СПЕЦИФИКАЦИЯ ====================
  document.getElementById('specBtn').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    document.getElementById('infraResultTitle').textContent = '📋 Спецификация';
    document.getElementById('infraResultModal').classList.add('show');
    document.getElementById('infraResultBody').innerHTML = 'Загрузка...';
    API.get('/api/infra/' + project.id + '/specification').then(function (d) {
      var html = '<div style="background:#f8f7ff;border-radius:8px;padding:10px;font-size:12px;margin-bottom:12px">' +
        'Проект: <strong>' + esc(d.project_name) + '</strong></div>';
      if (d.items.length) {
        html += '<table style="width:100%;font-size:11px;border-collapse:collapse">' +
          '<tr style="background:#fafafa"><th style="padding:6px;text-align:left">Категория</th>' +
          '<th style="padding:6px;text-align:left">Наименование</th>' +
          '<th style="padding:6px;text-align:left">Модель</th>' +
          '<th style="padding:6px;text-align:right">Кол-во</th></tr>';
        d.items.forEach(function (it) {
          html += '<tr><td style="padding:5px;border-bottom:1px solid #f0f0f5">' + esc(it.category) + '</td>' +
            '<td style="padding:5px;border-bottom:1px solid #f0f0f5">' + esc(it.name) + '</td>' +
            '<td style="padding:5px;border-bottom:1px solid #f0f0f5">' + esc(it.model) + '</td>' +
            '<td style="padding:5px;border-bottom:1px solid #f0f0f5;text-align:right">' + it.qty + ' ' + it.unit + '</td></tr>';
        });
        html += '</table>';
      }
      document.getElementById('infraResultBody').innerHTML = html;
    });
  });

  // ==================== ЭКСПОРТ ====================
  document.getElementById('exportPngBtn').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    // Скрываем ghost-элементы и выделение
    var oldSel = layerSelection.style.display;
    layerSelection.style.display = 'none';

    // Формируем SVG как строку
    var svgClone = svg.cloneNode(true);
    // Удаляем временные слои
    var selLayer = svgClone.querySelector('#layerSelection');
    if (selLayer) selLayer.remove();
    var draftLayer = svgClone.querySelector('#layerDraft');
    if (draftLayer) draftLayer.innerHTML = '';

    svgClone.setAttribute('width', project.width_m * PX_PER_M);
    svgClone.setAttribute('height', project.height_m * PX_PER_M);
    var svgString = new XMLSerializer().serializeToString(svgClone);
    var svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(svgBlob);

    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = project.width_m * PX_PER_M;
      canvas.height = project.height_m * PX_PER_M;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (blob) {
        var dlUrl = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = dlUrl;
        a.download = (project.name || 'plan') + '.png';
        a.click();
        URL.revokeObjectURL(dlUrl);
      }, 'image/png');
      layerSelection.style.display = oldSel;
    };
    img.onerror = function () {
      alert('Ошибка экспорта PNG');
      layerSelection.style.display = oldSel;
    };
    img.src = url;
  });

  document.getElementById('exportSvgBtn').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    var svgClone = svg.cloneNode(true);
    var selLayer = svgClone.querySelector('#layerSelection');
    if (selLayer) selLayer.remove();
    var draftLayer = svgClone.querySelector('#layerDraft');
    if (draftLayer) draftLayer.innerHTML = '';
    svgClone.setAttribute('width', project.width_m * PX_PER_M);
    svgClone.setAttribute('height', project.height_m * PX_PER_M);
    var svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      new XMLSerializer().serializeToString(svgClone);
    var blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (project.name || 'plan') + '.svg';
    a.click();
    URL.revokeObjectURL(url);
  });

  // ==================== LOCALSTORAGE ====================
  var STORAGE_KEY = 'coworkwifi_planner_state';

  document.getElementById('saveLocalBtn').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    var state = {
      project: project,
      elements: elements,
      devices: devices,
      aps: aps,
      switches: switches,
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      canvasHint.textContent = 'Сохранено в браузер: ' + new Date().toLocaleTimeString('ru-RU');
    } catch (e) {
      alert('Ошибка сохранения: ' + e.message);
    }
  });

  document.getElementById('loadLocalBtn').addEventListener('click', function () {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { alert('Нет сохранённых данных в браузере'); return; }
    try {
      var state = JSON.parse(raw);
      if (!state.project) throw new Error('Повреждённые данные');
      alert('Загружено сохранение от ' + new Date(state.savedAt).toLocaleString('ru-RU') +
            '\nПроект: ' + state.project.name +
            '\nДля просмотра выберите проект "' + state.project.name + '" в списке.');
    } catch (e) {
      alert('Ошибка загрузки: ' + e.message);
    }
  });

  document.getElementById('clearLocalBtn').addEventListener('click', function () {
    if (!confirm('Очистить сохранённые данные в браузере?')) return;
    localStorage.removeItem(STORAGE_KEY);
    canvasHint.textContent = 'Хранилище очищено';
  });

  // ==================== ФИНАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ ====================
  window.__debug = function () {
    return {
      project: project,
      elementsCount: elements.length,
      devicesCount: devices.length,
      apsCount: aps.length,
      switchesCount: switches.length,
      wallsInDom: layerWalls.children.length,
      hint: canvasHint.textContent
    };
  };

  updateSnapBadge();
  console.log('editor.js загружен (полная версия)');
})();