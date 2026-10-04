/* ============================================================
   CoworkWiFi Planner — страница измерений
   ============================================================ */
(function () {
  'use strict';

  var project = null;
  var tool = 'select';
  var selected = null;
  var measurements = [];
  var walls = [];
  var zoom = 1;
  var drag = null;

  var PX_PER_M = 40;
  var SNAP_M = 0.5;

  var svg              = document.getElementById('planSvg');
  var layerWalls       = document.getElementById('layerWalls');
  var layerMeasurements = document.getElementById('layerMeasurements');
  var layerDraft       = document.getElementById('layerDraft');
  var heatmapCanvas    = document.getElementById('heatmapCanvas');
  var projectSelect    = document.getElementById('projectSelect');
  var propsPanel       = document.getElementById('propsPanel');
  var canvasHint       = document.getElementById('canvasHint');
  var measList         = document.getElementById('measList');
  var measCount        = document.getElementById('measCount');

  // ============================================================
  // АВТОРИЗАЦИЯ
  // ============================================================
  API.get('/api/auth/me')
    .then(function (u) {
      var un = document.getElementById('userName');
      if (un) un.textContent = u.full_name;
      if (u.role === 'admin') {
        var al = document.getElementById('adminLink');
        if (al) al.style.display = '';
      }
      loadProjects();
    })
    .catch(function () {
      window.location.href = '/static/login.html';
    });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    API.clearToken();
    window.location.href = '/static/login.html';
  });

  // ============================================================
  // ЗАГРУЗКА ПРОЕКТОВ
  // ============================================================
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
    zoom = 1;
    applyViewBox();
    var zl = document.getElementById('zoomLabel');
    if (zl) zl.textContent = '100%';
    canvasHint.textContent = p.name + ' — ' + p.width_m + '×' + p.height_m + ' м';
    var mp = document.getElementById('metaProjectName');
    if (mp) mp.textContent = p.name;
    loadAll();
  }

  function applyViewBox() {
    if (!project) return;
    var W = project.width_m * PX_PER_M;
    var H = project.height_m * PX_PER_M;
    svg.setAttribute('viewBox', '0 0 ' + (W / zoom) + ' ' + (H / zoom));
  }

  function loadAll() {
    if (!project) return;
    Promise.all([
      API.get('/api/projects/' + project.id + '/elements'),
      API.get('/api/measurements/' + project.id)
    ]).then(function (r) {
      walls = (r[0] || []).filter(function (el) {
        return el.type === 'wall' || el.type === 'door' || el.type === 'window';
      });
      measurements = r[1] || [];
      render();
    });
  }

  // ============================================================
  // КООРДИНАТЫ
  // ============================================================
  function m2px(mx, my) { return { x: mx * PX_PER_M, y: my * PX_PER_M }; }

  function svgMetrics() {
    var r = svg.getBoundingClientRect();
    var vb = (svg.getAttribute('viewBox') || '0 0 100 100')
      .split(/[\s,]+/).map(Number);
    var vx = vb[0] || 0, vy = vb[1] || 0;
    var vw = vb[2] || 1, vh = vb[3] || 1;
    var scale = Math.min(r.width / vw, r.height / vh);
    var offsetX = (r.width - vw * scale) / 2;
    var offsetY = (r.height - vh * scale) / 2;
    return { r, vx, vy, vw, vh, scale, offsetX, offsetY };
  }

  function eventToM(e) {
    var m = svgMetrics();
    var px = (e.clientX - m.r.left - m.offsetX) / m.scale + m.vx;
    var py = (e.clientY - m.r.top - m.offsetY) / m.scale + m.vy;
    return { px: px, py: py, m: { x: px / PX_PER_M, y: py / PX_PER_M } };
  }

  // ============================================================
  // РЕНДЕР
  // ============================================================
  var WALL_COLORS = {
    concrete: '#7A7A7A', brick: '#B85C38', drywall: '#E8E8E8',
    wood: '#A0522D', glass: '#A8D8EA'
  };
  var WALL_WIDTHS = { concrete: 8, brick: 7, drywall: 3, wood: 6, glass: 5 };

  function render() {
    renderWalls();
    renderMeasurements();
    renderMeasList();
  }

  function renderWalls() {
    layerWalls.innerHTML = '';
    if (!project) return;
    walls.forEach(function (w) {
      var a = m2px(w.x1, w.y1);
      var b = m2px(w.x2, w.y2);
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      line.setAttribute('stroke-linecap', 'square');
      if (w.type === 'door') {
        line.setAttribute('stroke', '#8e44ad');
        line.setAttribute('stroke-width', '4');
        line.setAttribute('stroke-dasharray', '8 4');
      } else if (w.type === 'window') {
        line.setAttribute('stroke', '#3498db');
        line.setAttribute('stroke-width', '5');
      } else {
        line.setAttribute('stroke', WALL_COLORS[w.material] || WALL_COLORS.concrete);
        line.setAttribute('stroke-width', WALL_WIDTHS[w.material] || 6);
      }
      layerWalls.appendChild(line);
    });
  }

  function rssiColor(rssi) {
    if (rssi >= -65) return '#4caf50';
    if (rssi >= -75) return '#ffc107';
    if (rssi >= -85) return '#ff9800';
    return '#f44336';
  }

  function renderMeasurements() {
    layerMeasurements.innerHTML = '';
    measurements.forEach(function (m) {
      var p = m2px(m.x, m.y);
      var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
      g.setAttribute('data-id', m.id);
      g.style.cursor = 'pointer';

      var isSel = selected && selected.id === m.id;
      if (isSel) {
        var halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        halo.setAttribute('r', '18');
        halo.setAttribute('fill', 'rgba(14,99,156,.2)');
        g.appendChild(halo);
      }

      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('r', '10');
      c.setAttribute('fill', rssiColor(m.rssi));
      c.setAttribute('stroke', isSel ? '#ffcc00' : '#fff');
      c.setAttribute('stroke-width', isSel ? '4' : '2');
      g.appendChild(c);

      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('y', '-14');
      t.setAttribute('font-size', '10');
      t.setAttribute('fill', '#fff');
      t.setAttribute('font-weight', '600');
      t.textContent = m.rssi.toFixed(0) + ' dBm';
      g.appendChild(t);

      g.addEventListener('mousedown', function (e) {
        if (tool === 'select') startDrag(e, m.id);
      });
      g.addEventListener('click', function (e) {
        e.stopPropagation();
        if (tool === 'select') {
          selected = { kind: 'measurement', id: m.id };
          render();
          renderProps();
        }
      });
      layerMeasurements.appendChild(g);
    });
  }

  function renderMeasList() {
    measCount.textContent = measurements.length;
    var mc = document.getElementById('metaMeasCount');
    if (mc) mc.textContent = measurements.length;

    measList.innerHTML = '';
    measurements.forEach(function (m) {
      var item = document.createElement('div');
      item.className = 'meas-item' + (selected && selected.id === m.id ? ' active' : '');
      item.style.cssText =
        'display:flex;justify-content:space-between;align-items:center;' +
        'padding:6px 8px;background:var(--panel-2);border:1px solid var(--border);' +
        'border-radius:3px;cursor:pointer;font-size:12px;gap:6px';
      item.innerHTML =
        '<span style="display:flex;align-items:center;gap:6px">' +
          '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;' +
            'background:' + rssiColor(m.rssi) + '"></span>' +
          '<span>' + (m.name || 'Замер') + ' · ' + m.rssi.toFixed(0) + ' дБм</span>' +
        '</span>' +
        '<span style="color:#f44336;cursor:pointer;font-weight:700" data-del="' +
          m.id + '">✕</span>';

      item.addEventListener('click', function (e) {
        if (e.target.dataset.del) return;
        selected = { kind: 'measurement', id: m.id };
        render();
        renderProps();
      });
      item.querySelector('[data-del]').addEventListener('click', function (e) {
        e.stopPropagation();
        if (!confirm('Удалить замер?')) return;
        API.del('/api/measurements/' + m.id).then(function () {
          if (selected && selected.id === m.id) selected = null;
          loadAll();
          renderProps();
        });
      });
      measList.appendChild(item);
    });
  }

  // ============================================================
  // ПЕРЕТАСКИВАНИЕ
  // ============================================================
  function startDrag(e, id) {
    e.stopPropagation();
    drag = { id: id };
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e) {
    if (!drag) return;
    var em = eventToM(e);
    var mm = {
      x: Math.max(0, Math.min(project.width_m, em.m.x)),
      y: Math.max(0, Math.min(project.height_m, em.m.y))
    };
    drag._m = mm;
    var g = svg.querySelector('[data-id="' + drag.id + '"]');
    if (g) g.setAttribute('transform',
      'translate(' + (mm.x * PX_PER_M) + ',' + (mm.y * PX_PER_M) + ')');
  }

  function onDragEnd() {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    if (!drag || !drag._m) { drag = null; return; }
    var d = drag; var m = d._m; drag = null;
    var meas = measurements.find(function (x) { return x.id === d.id; });
    if (!meas) return;

    API.post('/api/measurements/' + project.id + '/calculate?x=' +
             m.x.toFixed(2) + '&y=' + m.y.toFixed(2), {})
      .then(function (data) {
        var newRssi = data.best ? data.best.rssi : -100;
        return API.put('/api/measurements/' + meas.id + '/update', {
          name: meas.name, x: +m.x.toFixed(2), y: +m.y.toFixed(2),
          rssi: newRssi, snr: data.snr || null,
          interference: meas.interference, mode: 'auto'
        });
      })
      .then(loadAll)
      .catch(function () { loadAll(); });
  }

  // ============================================================
  // ИНСТРУМЕНТЫ
  // ============================================================
  document.querySelectorAll('.tool-btn[data-tool]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.tool-btn[data-tool]').forEach(function (x) {
        x.classList.remove('active');
      });
      b.classList.add('active');
      tool = b.dataset.tool;
      var mt = document.getElementById('metaTool');
      if (mt) mt.textContent = tool === 'measure' ? 'Добавить замер' : 'Выделение';
      canvasHint.textContent = tool === 'measure'
        ? 'Кликните на холсте, чтобы добавить замер'
        : (project ? project.name : 'Выберите проект');
    });
  });

  // ============================================================
  // КЛИК ПО ХОЛСТУ
  // ============================================================
  svg.addEventListener('click', function (e) {
    if (!project) return;
    if (e.target.closest && e.target.closest('[data-id]')) return;
    var em = eventToM(e);
    var x = em.m.x, y = em.m.y;

    if (tool === 'measure') {
      API.post('/api/measurements/' + project.id + '/calculate?x=' +
               x.toFixed(2) + '&y=' + y.toFixed(2), {})
        .then(function (data) {
          var rssi = data.best ? data.best.rssi : -100;
          return API.post('/api/measurements/' + project.id, {
            name: 'Замер ' + (measurements.length + 1),
            x: +x.toFixed(2), y: +y.toFixed(2),
            rssi: rssi, snr: data.snr || null,
            interference: null, mode: 'auto'
          });
        })
        .then(function (m) {
          selected = { kind: 'measurement', id: m.id };
          loadAll();
          renderProps();
        })
        .catch(function (err) { alert(err.message); });
      return;
    }
    if (tool === 'select') {
      selected = null;
      render();
      renderProps();
    }
  });

  // ============================================================
  // ТЕПЛОВАЯ КАРТА
  // ============================================================
  document.getElementById('showHeatmap').addEventListener('click', function () {
    if (!project) { alert('Выберите проект'); return; }
    canvasHint.textContent = 'Расчёт покрытия...';
    API.post('/api/measurements/' + project.id + '/preview', { grid_size_m: 0.5 })
      .then(function (data) {
        renderHeatmap(data);
        heatmapCanvas.style.display = 'block';
        canvasHint.textContent = 'Покрытие: AP ' + (data.aps || []).length +
          ' · стен ' + (data.walls_count || 0);
      })
      .catch(function (err) {
        alert(err.message);
        canvasHint.textContent = project.name;
      });
  });

  function rssiToColor(rssi) {
    if (rssi >= -65) return 'rgba(76,175,80,0.5)';
    if (rssi >= -75) return 'rgba(255,193,7,0.5)';
    if (rssi >= -85) return 'rgba(255,152,0,0.55)';
    if (rssi >= -95) return 'rgba(244,67,54,0.55)';
    return 'rgba(180,40,40,0.6)';
  }

  function renderHeatmap(data) {
    if (!data || !data.grid) return;
    var W = project.width_m * PX_PER_M;
    var H = project.height_m * PX_PER_M;
    heatmapCanvas.width = W;
    heatmapCanvas.height = H;

    var m = svgMetrics();
    var wr = svg.parentElement.getBoundingClientRect();
    var screenX = (0 - m.vx) * m.scale + m.offsetX + (m.r.left - wr.left);
    var screenY = (0 - m.vy) * m.scale + m.offsetY + (m.r.top - wr.top);
    var screenW = W * m.scale;
    var screenH = H * m.scale;

    heatmapCanvas.style.left = screenX + 'px';
    heatmapCanvas.style.top = screenY + 'px';
    heatmapCanvas.style.width = screenW + 'px';
    heatmapCanvas.style.height = screenH + 'px';

    var ctx = heatmapCanvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    var cw = W / data.cols;
    var ch = H / data.rows;
    for (var r = 0; r < data.rows; r++) {
      for (var c = 0; c < data.cols; c++) {
        ctx.fillStyle = rssiToColor(data.grid[r][c]);
        ctx.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
      }
    }
  }

  // ============================================================
  // АВТОЗАПОЛНЕНИЕ
  // ============================================================
  document.getElementById('autoFillBtn').addEventListener('click', function () {
    if (!project) return;
    if (!confirm('Создать сетку замеров 4×4?')) return;
    var cols = 4, rows = 4;
    var promises = [];
    for (var r = 1; r <= rows; r++) {
      for (var c = 1; c <= cols; c++) {
        (function (r, c) {
          var x = (c / (cols + 1)) * project.width_m;
          var y = (r / (rows + 1)) * project.height_m;
          promises.push(
            API.post('/api/measurements/' + project.id + '/calculate?x=' +
                     x.toFixed(2) + '&y=' + y.toFixed(2), {})
              .then(function (data) {
                return API.post('/api/measurements/' + project.id, {
                  name: 'Авто ' + (measurements.length + 1),
                  x: +x.toFixed(2), y: +y.toFixed(2),
                  rssi: data.best ? data.best.rssi : -100,
                  snr: data.snr || null,
                  interference: null, mode: 'auto'
                });
              })
          );
        })(r, c);
      }
    }
    Promise.all(promises).then(function () {
      loadAll();
      canvasHint.textContent = 'Автозаполнение завершено';
    });
  });

  // ============================================================
  // ЭКСПОРТ CSV
  // ============================================================
  document.getElementById('exportCsvBtn').addEventListener('click', function () {
    if (!project || !measurements.length) { alert('Нет замеров'); return; }
    var lines = ['id,name,x_m,y_m,rssi_dbm,snr_db,interference_dbm,mode,measured_at'];
    measurements.forEach(function (m) {
      lines.push([m.id, '"' + (m.name || '') + '"', m.x, m.y, m.rssi,
                  m.snr || '', m.interference || '', m.mode, m.measured_at].join(','));
    });
    var csv = lines.join('\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'measurements_project_' + project.id + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  // ============================================================
  // СЛОИ
  // ============================================================
  document.getElementById('layerWalls').addEventListener('change', function () {
    layerWalls.style.display = this.checked ? '' : 'none';
  });
  document.getElementById('layerCoverage').addEventListener('change', function () {
    heatmapCanvas.style.display = this.checked && heatmapCanvas.width ? 'block' : 'none';
  });

  // ============================================================
  // ZOOM
  // ============================================================
  document.getElementById('zoomIn').addEventListener('click', function () {
    zoom = Math.min(3, zoom + 0.25);
    var zl = document.getElementById('zoomLabel');
    if (zl) zl.textContent = Math.round(zoom * 100) + '%';
    applyViewBox();
  });
  document.getElementById('zoomOut').addEventListener('click', function () {
    zoom = Math.max(0.25, zoom - 0.25);
    var zl = document.getElementById('zoomLabel');
    if (zl) zl.textContent = Math.round(zoom * 100) + '%';
    applyViewBox();
  });

  // ============================================================
  // ПРАВАЯ ПАНЕЛЬ
  // ============================================================
  function renderProps() {
    if (!selected) {
      propsPanel.innerHTML =
        '<div class="props-empty">' +
          '<div class="props-empty-icon">📍</div>' +
          '<div>Выберите замер<br>или добавьте новый</div>' +
        '</div>';
      return;
    }
    var m = measurements.find(function (x) { return x.id === selected.id; });
    if (!m) return;

    propsPanel.innerHTML =
      '<div class="props-header">' +
        '<div class="icon">📍</div>' +
        '<div>' +
          '<div class="title">' + esc(m.name || 'Замер') + '</div>' +
          '<div class="subtitle">' + m.mode + ' · ' +
            m.x.toFixed(1) + ', ' + m.y.toFixed(1) + ' м</div>' +
        '</div>' +
      '</div>' +

      '<div class="props-section"><h4>Идентификация</h4>' +
        '<div class="props-row"><label>Название</label>' +
          '<input id="m_name" value="' + esc(m.name || '') + '"></div>' +
      '</div>' +

      '<div class="props-section"><h4>Измерения</h4>' +
        '<div class="props-row"><label>RSSI, дБм</label>' +
          '<input id="m_rssi" type="number" step="0.1" value="' + m.rssi + '"></div>' +
        '<div class="props-row"><label>SNR, дБ</label>' +
          '<input id="m_snr" type="number" step="0.1" value="' + (m.snr || '') + '"></div>' +
        '<div class="props-row"><label>Интерференция</label>' +
          '<input id="m_inter" type="number" step="0.1" value="' +
          (m.interference || '') + '"></div>' +
      '</div>' +

      '<div class="props-section">' +
        '<button class="btn-block" id="recalcBtn">🔄 Рассчитать по физике</button>' +
      '</div>' +

      '<div class="props-section">' +
        '<button class="btn-block" id="saveBtn">💾 Сохранить</button>' +
        '<button class="btn-block" id="delBtn" ' +
          'style="margin-top:6px;color:#f44336">🗑 Удалить замер</button>' +
      '</div>';

    document.getElementById('recalcBtn').addEventListener('click', function () {
      API.post('/api/measurements/' + project.id + '/calculate?x=' +
               m.x + '&y=' + m.y, {}).then(function (data) {
        document.getElementById('m_rssi').value = data.best ? data.best.rssi : -100;
        document.getElementById('m_snr').value = data.snr || '';
      });
    });

    document.getElementById('saveBtn').addEventListener('click', function () {
      var payload = {
        name: v('m_name'), x: m.x, y: m.y,
        rssi: parseFloat(v('m_rssi')),
        snr: v('m_snr') ? parseFloat(v('m_snr')) : null,
        interference: v('m_inter') ? parseFloat(v('m_inter')) : null,
        mode: 'manual'
      };
      API.put('/api/measurements/' + m.id + '/update', payload)
        .then(loadAll)
        .catch(function (err) { alert(err.message); });
    });

    document.getElementById('delBtn').addEventListener('click', function () {
      if (!confirm('Удалить замер?')) return;
      API.del('/api/measurements/' + m.id).then(function () {
        selected = null;
        loadAll();
        renderProps();
      });
    });
  }

  function v(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ============================================================
  // ВКЛАДКИ ЛЕГЕНДЫ
  // ============================================================
  document.querySelectorAll('.legend-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.legend-tab').forEach(function (x) {
        x.classList.remove('active');
      });
      tab.classList.add('active');
      var isProps = tab.dataset.tab === 'props';
      document.getElementById('propsPanel').style.display = isProps ? '' : 'none';
      document.getElementById('legendPanel').style.display = isProps ? 'none' : '';
    });
  });

  console.log('[measurements.js] загружен');
})();