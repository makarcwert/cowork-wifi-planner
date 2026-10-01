/* Редактор: стены, комнаты, двери, окна, мебель, устройства, AP, текст. */
(function () {
    // ============ Состояние ============
    var project = null;
    var tool = 'select';
    var selected = null;         // {kind, id}
    var elements = [];
    var devices = [];
    var aps = [];

    var draft = null;            // для wall (клик-клик) и room
    var roomPoints = [];         // для комнаты

    var drag = null;
    var zoom = 1;

    // ============ SVG-слои ============
    var svg = document.getElementById('planSvg');
    var layerCoverage = document.getElementById('layerCoverage');
    var layerRooms = document.getElementById('layerRooms');
    var layerWalls = document.getElementById('layerWalls');
    var layerFurniture = document.getElementById('layerFurniture');
    var layerText = document.getElementById('layerText');
    var layerDevices = document.getElementById('layerDevices');
    var layerAps = document.getElementById('layerAps');
    var layerDraft = document.getElementById('layerDraft');

    var projectSelect = document.getElementById('projectSelect');
    var propsPanel = document.getElementById('propsPanel');
    var canvasHint = document.getElementById('canvasHint');
    var canvasWrap = document.getElementById('canvasWrap');

    var PX_PER_M = 40;           // 40 пикселей = 1 метр

    // ============ Авторизация ============
    API.get('/api/auth/me').then(function (u) {
        document.getElementById('userName').textContent = u.full_name;
        if (u.role === 'admin') {
            document.getElementById('adminLink').style.display = '';
        }
        loadProjects();
    }).catch(function () {
        window.location.href = '/static/login.html';
    });

    document.getElementById('logoutBtn').addEventListener('click', function () {
        API.clearToken();
        window.location.href = '/static/login.html';
    });

    // ============ Проекты ============
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
        draft = null;
        roomPoints = [];
        resizeCanvas();
        loadAll();
        canvasHint.textContent = p.name + ' — ' + p.width_m + '×' + p.height_m + ' м';
    }

    function resizeCanvas() {
        if (!project) return;
        svg.setAttribute('width', project.width_m * PX_PER_M * zoom);
        svg.setAttribute('height', project.height_m * PX_PER_M * zoom);
    }

    // ============ Загрузка всех данных ============
    function loadAll() {
        if (!project) return;
        Promise.all([
            API.get('/api/projects/' + project.id + '/elements'),
            API.get('/api/projects/' + project.id + '/devices'),
            API.get('/api/projects/' + project.id + '/aps'),
        ]).then(function (r) {
            elements = r[0] || [];
            devices = r[1] || [];
            aps = r[2] || [];
            render();
        });
    }

    // ============ Преобразование координат ============
    function m2px(mx, my) {
        return { x: mx * PX_PER_M * zoom, y: my * PX_PER_M * zoom };
    }
    function px2m(px, py) {
        return { x: px / (PX_PER_M * zoom), y: py / (PX_PER_M * zoom) };
    }
    function eventToM(e) {
        var r = svg.getBoundingClientRect();
        var px = e.clientX - r.left;
        var py = e.clientY - r.top;
        return { px: px, py: py, m: px2m(px, py) };
    }

    // ============ Стили стен ============
    function wallColor(mat) {
        return {
            concrete: '#3a3a4a', brick: '#8e5a3a', drywall: '#a0a0b0',
            wood: '#b07a4a', glass: '#5bb8e8'
        }[mat] || '#3a3a4a';
    }
    function wallWidth(mat) {
        return { concrete: 6, brick: 5, drywall: 3, wood: 4, glass: 4 }[mat] || 4;
    }

    // ============ Главный рендер ============
    function render() {
        if (!project) {
            layerRooms.innerHTML = layerWalls.innerHTML = layerFurniture.innerHTML = '';
            layerText.innerHTML = layerDevices.innerHTML = layerAps.innerHTML = '';
            layerCoverage.innerHTML = '';
            return;
        }
        resizeCanvas();
        renderRooms();
        renderWalls();
        renderFurniture();
        renderText();
        renderDevices();
        renderAPs();
        renderCoverage();
    }

    // ============ Комнаты ============
    function renderRooms() {
        layerRooms.innerHTML = '';
        elements.filter(function (el) { return el.type === 'room'; }).forEach(function (el) {
            var pts = JSON.parse(el.points_json || '[]');
            if (pts.length < 3) return;
            var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            var str = pts.map(function (p) {
                var q = m2px(p.x, p.y);
                return q.x + ',' + q.y;
            }).join(' ');
            poly.setAttribute('points', str);
            poly.setAttribute('fill', 'rgba(108,92,231,.05)');
            poly.setAttribute('stroke', '#6c5ce7');
            poly.setAttribute('stroke-width', '2');
            poly.setAttribute('data-kind', 'element');
            poly.setAttribute('data-id', el.id);
            poly.style.cursor = 'pointer';
            poly.addEventListener('click', function (e) {
                e.stopPropagation();
                if (tool === 'select') { selected = { kind: 'element', id: el.id }; render(); renderProps(); }
            });
            layerRooms.appendChild(poly);
        });
    }

    // ============ Стены, двери, окна ============
    function renderWalls() {
        layerWalls.innerHTML = '';
        elements.filter(function (el) {
            return el.type === 'wall' || el.type === 'door' || el.type === 'window';
        }).forEach(function (el) {
            var a = m2px(el.x1, el.y1);
            var b = m2px(el.x2, el.y2);
            var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
            line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
            line.setAttribute('stroke-linecap', 'round');

            if (el.type === 'wall') {
                line.setAttribute('stroke', wallColor(el.material));
                line.setAttribute('stroke-width', wallWidth(el.material));
            } else if (el.type === 'door') {
                line.setAttribute('stroke', '#8e44ad');
                line.setAttribute('stroke-width', '4');
                line.setAttribute('stroke-dasharray', '8 4');
            } else {
                line.setAttribute('stroke', '#3498db');
                line.setAttribute('stroke-width', '5');
            }

            var isSel = selected && selected.kind === 'element' && selected.id === el.id;
            if (isSel) {
                line.setAttribute('stroke', '#6c5ce7');
                line.setAttribute('stroke-width', '7');
            }

            line.setAttribute('data-kind', 'element');
            line.setAttribute('data-id', el.id);
            line.style.cursor = 'pointer';
            line.addEventListener('click', function (e) {
                e.stopPropagation();
                if (tool === 'select') { selected = { kind: 'element', id: el.id }; render(); renderProps(); }
            });
            layerWalls.appendChild(line);
        });
    }

    // ============ Мебель ============
    var FURN_ICON = { sofa: '🛋', table: '🪑', chair: '💺', plant: '🌿' };

    function renderFurniture() {
        layerFurniture.innerHTML = '';
        elements.filter(function (el) { return el.type === 'furniture'; }).forEach(function (el) {
            var p = m2px(el.x, el.y);
            var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
            g.setAttribute('data-kind', 'element');
            g.setAttribute('data-id', el.id);
            g.style.cursor = 'move';

            var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('y', '6');
            t.setAttribute('font-size', '22');
            t.textContent = FURN_ICON[el.subtype] || '📦';
            g.appendChild(t);

            if (selected && selected.kind === 'element' && selected.id === el.id) {
                var h = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                h.setAttribute('r', 18); h.setAttribute('fill', 'none');
                h.setAttribute('stroke', '#6c5ce7'); h.setAttribute('stroke-width', '2');
                g.appendChild(h);
            }

            g.addEventListener('mousedown', function (e) {
                if (tool === 'select') startDrag(e, 'element', el.id);
            });
            g.addEventListener('click', function (e) {
                e.stopPropagation();
                if (tool === 'select') { selected = { kind: 'element', id: el.id }; render(); renderProps(); }
            });
            layerFurniture.appendChild(g);
        });
    }

    // ============ Текст ============
    function renderText() {
        layerText.innerHTML = '';
        elements.filter(function (el) { return el.type === 'text'; }).forEach(function (el) {
            var p = m2px(el.x, el.y);
            var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            t.setAttribute('x', p.x); t.setAttribute('y', p.y);
            t.setAttribute('font-size', '14');
            t.setAttribute('fill', '#2c2c3a');
            t.setAttribute('font-weight', '600');
            t.setAttribute('data-kind', 'element');
            t.setAttribute('data-id', el.id);
            t.style.cursor = 'move';
            t.textContent = el.name || 'Текст';
            t.addEventListener('mousedown', function (e) {
                if (tool === 'select') startDrag(e, 'element', el.id);
            });
            t.addEventListener('click', function (e) {
                e.stopPropagation();
                if (tool === 'select') { selected = { kind: 'element', id: el.id }; render(); renderProps(); }
            });
            layerText.appendChild(t);
        });
    }

    // ============ Устройства ============
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
            r.setAttribute('x', -12); r.setAttribute('y', -12);
            r.setAttribute('width', 24); r.setAttribute('height', 24);
            r.setAttribute('rx', 4);
            r.setAttribute('fill', '#dfe6e9');
            r.setAttribute('stroke', '#b2bec3');
            g.appendChild(r);

            var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('y', '5');
            t.setAttribute('font-size', '14');
            t.textContent = DEV_ICON[d.type] || '📦';
            g.appendChild(t);

            if (selected && selected.kind === 'device' && selected.id === d.id) {
                r.setAttribute('stroke', '#6c5ce7');
                r.setAttribute('stroke-width', '3');
            }

            g.addEventListener('mousedown', function (e) {
                if (tool === 'select') startDrag(e, 'device', d.id);
            });
            g.addEventListener('click', function (e) {
                e.stopPropagation();
                if (tool === 'select') { selected = { kind: 'device', id: d.id }; render(); renderProps(); }
            });
            layerDevices.appendChild(g);
        });
    }

    // ============ Точки доступа ============
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
            c.setAttribute('r', 14);
            c.setAttribute('fill', '#6c5ce7');
            c.setAttribute('stroke', '#fff');
            c.setAttribute('stroke-width', '2');
            g.appendChild(c);

            var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('y', '5');
            t.setAttribute('font-size', '13');
            t.setAttribute('fill', '#fff');
            t.textContent = '📡';
            g.appendChild(t);

            var lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            lbl.setAttribute('text-anchor', 'middle');
            lbl.setAttribute('y', '30');
            lbl.setAttribute('font-size', '10');
            lbl.setAttribute('fill', '#555');
            lbl.setAttribute('font-weight', '600');
            lbl.textContent = ap.name;
            g.appendChild(lbl);

            if (selected && selected.kind === 'ap' && selected.id === ap.id) {
                var h = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                h.setAttribute('r', 24); h.setAttribute('fill', 'rgba(108,92,231,.2)');
                g.appendChild(h);
            }

            g.addEventListener('mousedown', function (e) {
                if (tool === 'select') startDrag(e, 'ap', ap.id);
            });
            g.addEventListener('click', function (e) {
                e.stopPropagation();
                if (tool === 'select') { selected = { kind: 'ap', id: ap.id }; render(); renderProps(); }
            });
            layerAps.appendChild(g);
        });
    }

    // ============ Зона покрытия (упрощённая: круг) ============
    function renderCoverage() {
        layerCoverage.innerHTML = '';
        if (!document.getElementById('layerCoverage').checked) return;
        aps.forEach(function (ap) {
            var p = m2px(ap.x, ap.y);
            // Радиус в метрах: базовая эмпирика по мощности и частоте
            var r_m = 5 + (ap.tx_power_dbm - 10) * 0.8;
            if (ap.band === '2.4') r_m *= 1.4;
            if (ap.band === '6') r_m *= 0.8;
            var r_px = r_m * PX_PER_M * zoom;

            var grad = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
            var gid = 'grad_' + ap.id;
            grad.setAttribute('id', gid);
            grad.innerHTML =
                '<stop offset="0%" stop-color="#00b894" stop-opacity="0.35"/>' +
                '<stop offset="60%" stop-color="#fdcb6e" stop-opacity="0.18"/>' +
                '<stop offset="100%" stop-color="#ff6b6b" stop-opacity="0"/>';
            var defs = svg.querySelector('defs') || svg.insertBefore(
                document.createElementNS('http://www.w3.org/2000/svg', 'defs'), svg.firstChild
            );
            var old = defs.querySelector('#' + gid);
            if (old) old.remove();
            defs.appendChild(grad);

            var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
            c.setAttribute('r', r_px);
            c.setAttribute('fill', 'url(#' + gid + ')');
            c.setAttribute('pointer-events', 'none');
            layerCoverage.appendChild(c);
        });
    }

    // ============ Перетаскивание ============
    function startDrag(e, kind, id) {
        e.stopPropagation();
        drag = { kind: kind, id: id };
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
    }

    function onDragMove(e) {
        if (!drag) return;
        var r = svg.getBoundingClientRect();
        var px = e.clientX - r.left;
        var py = e.clientY - r.top;
        var mm = px2m(px, py);
        // Ограничить
        mm.x = Math.max(0, Math.min(project.width_m, mm.x));
        mm.y = Math.max(0, Math.min(project.height_m, mm.y));
        drag._m = mm;
        var g = svg.querySelector('[data-kind="' + drag.kind + '"][data-id="' + drag.id + '"]');
        if (g && g.tagName === 'g') {
            g.setAttribute('transform', 'translate(' + (mm.x * PX_PER_M * zoom) + ',' + (mm.y * PX_PER_M * zoom) + ')');
        }
    }

    function onDragEnd() {
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        if (!drag || !drag._m) { drag = null; return; }
        var d = drag; drag = null;
        var m = d._m;

        if (d.kind === 'ap') {
            var ap = aps.find(function (x) { return x.id === d.id; });
            if (!ap) return;
            var p = Object.assign({}, ap, { x: +m.x.toFixed(2), y: +m.y.toFixed(2) });
            delete p.id; delete p.project_id;
            API.put('/api/projects/aps/' + ap.id, p).then(loadAll);
        } else if (d.kind === 'device') {
            var dev = devices.find(function (x) { return x.id === d.id; });
            if (!dev) return;
            var p2 = Object.assign({}, dev, { x: +m.x.toFixed(2), y: +m.y.toFixed(2) });
            delete p2.id; delete p2.project_id;
            API.put('/api/projects/devices/' + dev.id, p2).then(loadAll);
        } else if (d.kind === 'element') {
            var el = elements.find(function (x) { return x.id === d.id; });
            if (!el) return;
            var p3 = Object.assign({}, el, { x: +m.x.toFixed(2), y: +m.y.toFixed(2) });
            delete p3.id; delete p3.project_id;
            API.put('/api/projects/elements/' + el.id, p3).then(loadAll);
        }
    }

    // ============ Инструменты ============
    document.querySelectorAll('.tool-btn').forEach(function (b) {
        b.addEventListener('click', function () {
            document.querySelectorAll('.tool-btn').forEach(function (x) { x.classList.remove('active'); });
            b.classList.add('active');
            tool = b.dataset.tool;
            draft = null;
            roomPoints = [];
            layerDraft.innerHTML = '';
            canvasHint.textContent = ({
                select: 'Кликните по объекту для выделения',
                wall: 'Клик — начало стены. Клик — конец.',
                room: 'Клик по углам комнаты. Двойной клик — завершить.',
                door: 'Клик-клик — дверь',
                window: 'Клик-клик — окно',
                text: 'Кликните, чтобы ввести текст'
            })[tool] || '';
        });
    });

    // ============ Клик по холсту ============
    svg.addEventListener('click', function (e) {
        if (!project) return;
        if (e.target.closest('[data-kind]')) return; // клик по объекту
        var em = eventToM(e);
        var x = em.m.x, y = em.m.y;

        // Стены / двери / окна (клик-клик)
        if (tool === 'wall' || tool === 'door' || tool === 'window') {
            console.log('=== КЛИК ПО ХОЛСТУ ===', 'tool:', tool, 'x:', x.toFixed(2), 'y:', y.toFixed(2), 'draft:', draft);
            if (!draft) {
                draft = { x1: x, y1: y };
                console.log('>>> НАЧАЛО стены:', draft);
                canvasHint.textContent = 'Клик — конец линии';
                drawDraftLine(em.px, em.py, em.px, em.py);
                return;
            }
            var p = {
                type: tool === 'wall' ? 'wall' : (tool === 'door' ? 'door' : 'window'),
                material: tool === 'wall' ? document.getElementById('wallMaterial').value : null,
                x1: +draft.x1.toFixed(2), y1: +draft.y1.toFixed(2),
                x2: +x.toFixed(2), y2: +y.toFixed(2)
            };
            console.log('>>> СОЗДАЮ стену:', p);
            API.post('/api/projects/' + project.id + '/elements', p).then(function () {
                draft = null;
                layerDraft.innerHTML = '';
                canvasHint.textContent = 'Клик — начало стены';
                loadAll();
            });
            return;
        }

        // Комната
        if (tool === 'room') {
            roomPoints.push({ x: +x.toFixed(2), y: +y.toFixed(2) });
            drawRoomDraft();
            canvasHint.textContent = 'Точек: ' + roomPoints.length + '. Двойной клик — замкнуть';
            return;
        }

        // Текст
        if (tool === 'text') {
            var txt = prompt('Введите текст:');
            if (!txt) return;
            API.post('/api/projects/' + project.id + '/elements', {
                type: 'text', name: txt,
                x: +x.toFixed(2), y: +y.toFixed(2)
            }).then(loadAll);
            return;
        }

        // Select — снять выделение
        if (tool === 'select') {
            selected = null;
            render();
            renderProps();
        }
    });

    // Двойной клик по холсту — замкнуть комнату
    svg.addEventListener('dblclick', function (e) {
        if (tool !== 'room' || roomPoints.length < 3) return;
        API.post('/api/projects/' + project.id + '/elements', {
            type: 'room',
            points_json: JSON.stringify(roomPoints)
        }).then(function () {
            roomPoints = [];
            layerDraft.innerHTML = '';
            canvasHint.textContent = 'Комната создана';
            loadAll();
        });
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
        if (roomPoints.length < 2) return;
        var pts = roomPoints.map(function (p) {
            var q = m2px(p.x, p.y);
            return q.x + ',' + q.y;
        }).join(' ');
        var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        poly.setAttribute('points', pts);
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', '#6c5ce7');
        poly.setAttribute('stroke-width', '2');
        poly.setAttribute('stroke-dasharray', '6 3');
        layerDraft.appendChild(poly);
        // Отметки углов
        roomPoints.forEach(function (p) {
            var q = m2px(p.x, p.y);
            var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            c.setAttribute('cx', q.x); c.setAttribute('cy', q.y);
            c.setAttribute('r', 4); c.setAttribute('fill', '#6c5ce7');
            layerDraft.appendChild(c);
        });
    }

    // ============ Библиотека объектов (клик → клик по холсту) ============
    document.querySelectorAll('.lib-item').forEach(function (item) {
        item.addEventListener('click', function () {
            if (!project) { alert('Создайте или выберите проект'); return; }
            var add = item.dataset.add;
            canvasHint.textContent = 'Кликните по холсту, чтобы разместить';
            var handler = function (e) {
                if (e.target.closest('[data-kind]')) return;
                var em = eventToM(e);
                svg.removeEventListener('click', handler);
                canvasHint.textContent = project.name;
                placeObject(add, em.m.x, em.m.y);
            };
            svg.addEventListener('click', handler);
        });
    });

    function placeObject(kind, xm, ym) {
        xm = +xm.toFixed(2); ym = +ym.toFixed(2);
        if (kind === 'ap') {
            var n = aps.length + 1;
            API.post('/api/projects/' + project.id + '/aps', {
                name: 'AP-' + (n < 10 ? '0' + n : n), model: 'Generic AP',
                x: xm, y: ym, tx_power_dbm: 20, antenna_gain: 6,
                band: '5', channel: 44, ssid_type: 'corporate'
            }).then(loadAll);
            return;
        }
        if (['pc', 'laptop', 'printer', 'scanner', 'camera', 'iot'].indexOf(kind) >= 0) {
            var names = {
                pc: 'ПК', laptop: 'Ноутбук', printer: 'Принтер',
                scanner: 'Сканер', camera: 'Камера', iot: 'IoT'
            };
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
                x: xm, y: ym, width: 1.5, height: 1
            }).then(loadAll);
            return;
        }
    }

    // ============ Слои ============
    ['layerWalls', 'layerFurniture', 'layerDevices', 'layerCoverage'].forEach(function (id) {
        document.getElementById(id).addEventListener('change', function () {
            var map = {
                layerWalls: layerWalls,
                layerFurniture: layerFurniture,
                layerDevices: layerDevices,
                layerCoverage: layerCoverage
            };
            map[id].style.display = this.checked ? '' : 'none';
        });
    });

    // ============ Zoom ============
    document.getElementById('zoomIn').addEventListener('click', function () {
        zoom = Math.min(3, zoom + 0.25);
        document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
        render();
    });
    document.getElementById('zoomOut').addEventListener('click', function () {
        zoom = Math.max(0.25, zoom - 0.25);
        document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
        render();
    });

    // ============ Модальное окно: новый проект ============
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

    // ============ Правая панель ============
    function renderProps() {
        if (!selected) {
            propsPanel.innerHTML =
                '<div class="props-empty"><div class="big">🎨</div>' +
                '<div>Выберите объект на холсте</div></div>';
            return;
        }
        if (selected.kind === 'ap') propsAP();
        else if (selected.kind === 'device') propsDevice();
        else if (selected.kind === 'element') propsElement();
    }

    function propsAP() {
        var ap = aps.find(function (x) { return x.id === selected.id; });
        if (!ap) return;
        propsPanel.innerHTML =
            head('📡', ap.name, ap.model || 'Точка доступа') +
            sect('Параметры',
                row('Имя', '<input id="p_name" value="' + esc(ap.name) + '">') +
                row('Модель', '<input id="p_model" value="' + esc(ap.model || '') + '">') +
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
                '<div style="font-size:12px;color:#777">X: ' + ap.x.toFixed(2) + ' м, Y: ' + ap.y.toFixed(2) + ' м</div>'
            ) +
            sect('', '<button class="btn-primary" id="saveBtn">Сохранить</button>' +
                '<button class="btn-danger" id="delBtn">Удалить</button>');
        bindSaveDelete(function () {
            return {
                name: v('p_name'), model: v('p_model'), x: ap.x, y: ap.y,
                tx_power_dbm: parseFloat(v('p_tx')), antenna_gain: parseFloat(v('p_gain')),
                band: v('p_band'), channel: parseInt(v('p_ch'), 10), ssid_type: v('p_ssid')
            };
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
                '<div style="font-size:12px;color:#777">X: ' + d.x.toFixed(2) + ' м, Y: ' + d.y.toFixed(2) + ' м</div>'
            ) +
            sect('', '<button class="btn-primary" id="saveBtn">Сохранить</button>' +
                '<button class="btn-danger" id="delBtn">Удалить</button>');
        bindSaveDelete(function () {
            return {
                name: v('d_name'), type: d.type, x: d.x, y: d.y, band: d.band,
                required_rssi: parseFloat(v('d_rssi')), required_speed: parseFloat(v('d_speed')),
                ssid_type: d.ssid_type
            };
        }, '/api/projects/devices/' + d.id);
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
                return {
                    type: 'wall', material: v('e_mat'),
                    x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2
                };
            }, '/api/projects/elements/' + el.id);
            return;
        }

        if (el.type === 'furniture' || el.type === 'text') {
            var label = el.type === 'furniture' ? (FURN_ICON[el.subtype] || '📦') + ' Мебель' : '🅰 Текст';
            propsPanel.innerHTML =
                head(el.type === 'text' ? '🅰' : (FURN_ICON[el.subtype] || '📦'), label, '') +
                (el.type === 'text' ?
                    sect('Текст', row('Содержимое', '<input id="t_name" value="' + esc(el.name || '') + '">')) : '') +
                sect('Позиция',
                    '<div style="font-size:12px;color:#777">X: ' + el.x.toFixed(2) + ' м, Y: ' + el.y.toFixed(2) + ' м</div>'
                ) +
                sect('', (el.type === 'text' ? '<button class="btn-primary" id="saveBtn">Сохранить</button>' : '') +
                    '<button class="btn-danger" id="delBtn">Удалить</button>');

            var del = function () {
                if (!confirm('Удалить?')) return;
                API.del('/api/projects/elements/' + el.id).then(function () {
                    selected = null; loadAll(); renderProps();
                });
            };
            document.getElementById('delBtn').addEventListener('click', del);
            if (el.type === 'text') {
                document.getElementById('saveBtn').addEventListener('click', function () {
                    API.put('/api/projects/elements/' + el.id, {
                        type: 'text', name: v('t_name'), x: el.x, y: el.y
                    }).then(loadAll);
                });
            }
            return;
        }

        // Двери, окна, комнаты — только удаление
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
    // ============ ОТЛАДКА ============
    window.__debug = function () {
        return {
            project: project,
            elementsCount: elements.length,
            devicesCount: devices.length,
            apsCount: aps.length,
            wallsInDom: layerWalls.children.length,
            furnitureInDom: layerFurniture.children.length,
            devicesInDom: layerDevices.children.length,
            apsInDom: layerAps.children.length,
            svgWidth: svg.getAttribute('width'),
            svgHeight: svg.getAttribute('height'),
            hint: canvasHint.textContent,
            tool: tool
        };
    };
    console.log('editor.js загружен. Вызовите __debug() для диагностики.');
})();