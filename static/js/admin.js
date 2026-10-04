/* Панель администратора. */
(function () {
  var me = null;

  API.get('/api/auth/me').then(function (u) {
    me = u;
    document.getElementById('userName').textContent = u.full_name;
    if (u.role !== 'admin') {
      alert('Доступ только для администратора');
      window.location.href = '/static/index.html';
      return;
    }
    init();
  }).catch(function () {
    window.location.href = '/static/login.html';
  });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    API.clearToken();
    window.location.href = '/static/login.html';
  });

  function init() {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        var tab = t.dataset.tab;
        ['dashboard', 'users', 'projects', 'audit'].forEach(function (name) {
          var el = document.getElementById('tab-' + name);
          if (el) el.style.display = (name === tab) ? '' : 'none';
        });
        if (tab === 'dashboard') loadMetrics();
        if (tab === 'users') loadUsers();
        if (tab === 'projects') loadProjects();
        if (tab === 'audit') loadAudit();
      });
    });
    loadMetrics();

    var userModal = document.getElementById('userModal');
    document.getElementById('addUserBtn').addEventListener('click', function () {
      document.getElementById('nuName').value = '';
      document.getElementById('nuEmail').value = '';
      document.getElementById('nuPassword').value = '';
      document.getElementById('nuRole').value = 'analyst';
      userModal.classList.add('show');
    });
    document.getElementById('nuCancel').addEventListener('click', function () {
      userModal.classList.remove('show');
    });
    document.getElementById('nuCreate').addEventListener('click', function () {
      var data = {
        full_name: document.getElementById('nuName').value.trim(),
        email: document.getElementById('nuEmail').value.trim(),
        password: document.getElementById('nuPassword').value,
        role: document.getElementById('nuRole').value
      };
      if (!data.full_name || !data.email || data.password.length < 6) {
        alert('Заполните все поля (пароль минимум 6 символов)');
        return;
      }
      API.post('/api/users/', data).then(function () {
        userModal.classList.remove('show');
        loadUsers();
      }).catch(function (err) { alert(err.message); });
    });

    document.getElementById('refreshAudit').addEventListener('click', loadAudit);
  }

  // ============ ДАШБОРД ============
  function loadMetrics() {
    API.get('/api/admin/metrics').then(function (m) {
      renderMetricCards(m);
      renderBarChart('regChart', m.registrations_7d);
      renderBarChart('projChart', m.projects_7d, true);
      renderRoleChart(m.users.by_role, m.users.total);
      renderContentChart(m);
    }).catch(function (err) { console.error(err); });
  }

  function renderMetricCards(m) {
    document.getElementById('metricGrid').innerHTML =
      card('Пользователей', m.users.total,
           m.users.active + ' активных · ' + m.users.new_today + ' сегодня', 'accent') +
      card('Проектов', m.projects.total, m.projects.today + ' сегодня', 'info') +
      card('Точек доступа', m.aps.total, 'всего в системе', 'ok') +
      card('Устройств', m.devices.total, 'ПК, принтеры, IoT', 'info') +
      card('Элементов', m.elements.total, 'стены, мебель', 'warn');
  }

  function card(label, value, sub, cls) {
    return '<div class="metric-card ' + (cls || '') + '">' +
      '<div class="label">' + label + '</div>' +
      '<div class="value">' + value + '</div>' +
      '<div class="sub">' + (sub || '') + '</div></div>';
  }

  function renderBarChart(elId, data, green) {
    var max = Math.max.apply(null, data.map(function (d) { return d.count; })) || 1;
    document.getElementById(elId).innerHTML = data.map(function (d) {
      var h = (d.count / max) * 100;
      return '<div class="bar-col">' +
        '<div class="bar-count">' + d.count + '</div>' +
        '<div class="bar' + (green ? ' ok' : '') + '" style="height:' + h + '%"></div>' +
        '<div class="bar-label">' + d.label + '</div></div>';
    }).join('');
  }

  function renderRoleChart(byRole, total) {
    var roles = [
      { key: 'admin',    name: 'Админы',    color: '#e74c3c' },
      { key: 'engineer', name: 'Инженеры',  color: '#3498db' },
      { key: 'analyst',  name: 'Аналитики', color: '#6c5ce7' }
    ];
    document.getElementById('roleChart').innerHTML = roles.map(function (r) {
      var c = byRole[r.key] || 0;
      var pct = total ? (c / total) * 100 : 0;
      return '<div class="role-row">' +
        '<div class="role-name">' + r.name + '</div>' +
        '<div class="role-bar"><div class="role-fill" style="width:' + pct +
          '%;background:' + r.color + '"></div></div>' +
        '<div class="role-count">' + c + '</div></div>';
    }).join('');
  }

  function renderContentChart(m) {
    var items = [
      { name: 'AP', count: m.aps.total, color: '#6c5ce7' },
      { name: 'Устройства', count: m.devices.total, color: '#3498db' },
      { name: 'Элементы', count: m.elements.total, color: '#fdcb6e' }
    ];
    var max = Math.max.apply(null, items.map(function (i) { return i.count; })) || 1;
    document.getElementById('contentChart').innerHTML = items.map(function (i) {
      var pct = (i.count / max) * 100;
      return '<div class="role-row">' +
        '<div class="role-name">' + i.name + '</div>' +
        '<div class="role-bar"><div class="role-fill" style="width:' + pct +
          '%;background:' + i.color + '"></div></div>' +
        '<div class="role-count">' + i.count + '</div></div>';
    }).join('');
  }

  // ============ ПОЛЬЗОВАТЕЛИ ============
  function loadUsers() {
    API.get('/api/users/').then(function (users) {
      var tbody = document.querySelector('#usersTable tbody');
      tbody.innerHTML = '';
      users.forEach(function (u) {
        var tr = document.createElement('tr');
        var roleBadge = '<span class="badge ' + u.role + '">' + roleRu(u.role) + '</span>';
        var statusBadge = u.is_active
          ? '<span class="badge active">активен</span>'
          : '<span class="badge blocked">заблокирован</span>';
        var self = me && me.id === u.id;
        var actions = self
          ? '<span style="color:#bbb;font-size:11px">(это вы)</span>'
          : '<button class="btn-sm" data-act="role" data-id="' + u.id + '">Сменить роль</button>' +
            '<button class="btn-sm" data-act="block" data-id="' + u.id + '">' +
              (u.is_active ? 'Заблокировать' : 'Разблокировать') + '</button>' +
            '<button class="btn-sm danger" data-act="delete" data-id="' + u.id + '">Удалить</button>';
        tr.innerHTML =
          '<td>' + u.id + '</td>' +
          '<td>' + esc(u.full_name) + '</td>' +
          '<td>' + esc(u.email) + '</td>' +
          '<td>' + roleBadge + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td>' + fmtDate(u.created_at) + '</td>' +
          '<td>' + (u.last_login ? fmtDate(u.last_login) : '—') + '</td>' +
          '<td>' + actions + '</td>';
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('button[data-act]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = parseInt(b.dataset.id, 10);
          var act = b.dataset.act;
          var user = users.find(function (x) { return x.id === id; });
          if (act === 'block') {
            API.put('/api/users/' + id + '/block').then(loadUsers);
          } else if (act === 'delete') {
            if (!confirm('Удалить ' + user.email + '?')) return;
            API.del('/api/users/' + id).then(loadUsers)
              .catch(function (err) { alert(err.message); });
          } else if (act === 'role') {
            var roles = ['analyst', 'engineer', 'admin'];
            var names = { analyst: 'Аналитик', engineer: 'Инженер', admin: 'Администратор' };
            var newRole = prompt('Текущая: ' + names[user.role] +
              '\nВведите новую: analyst / engineer / admin', user.role);
            if (!newRole || roles.indexOf(newRole) < 0) return;
            API.put('/api/users/' + id + '/role?role=' + newRole).then(loadUsers)
              .catch(function (err) { alert(err.message); });
          }
        });
      });
    });
  }

  function roleRu(role) {
    return { admin: 'Админ', engineer: 'Инженер', analyst: 'Аналитик' }[role] || role;
  }

  // ============ ПРОЕКТЫ ============
  function loadProjects() {
    API.get('/api/admin/projects').then(function (list) {
      var tbody = document.querySelector('#projectsTable tbody');
      tbody.innerHTML = '';
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="9"><div class="empty">' +
          '<div class="big">📁</div>Проектов пока нет</div></td></tr>';
        return;
      }
      list.forEach(function (p) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + p.id + '</td>' +
          '<td><strong>' + esc(p.name) + '</strong></td>' +
          '<td>' + (p.owner_name ? esc(p.owner_name) +
            '<br><span style="color:#999;font-size:11px">' + esc(p.owner_email) + '</span>' : '—') + '</td>' +
          '<td>' + p.width_m + '×' + p.height_m + ' м</td>' +
          '<td>' + p.elements_count + '</td>' +
          '<td>' + p.devices_count + '</td>' +
          '<td>' + p.aps_count + '</td>' +
          '<td>' + fmtDate(p.created_at) + '</td>' +
          '<td>' +
            '<button class="btn-sm" data-pdf="' + p.id + '">📄 Отчёт</button>' +
            '<button class="btn-sm" data-csv="' + p.id + '">📊 CSV</button>' +
            '<button class="btn-sm" data-xlsx="' + p.id + '">📗 XLSX</button>' +
            '<button class="btn-sm danger" data-del="' + p.id + '">Удалить</button>' +
          '</td>';
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('button[data-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = parseInt(b.dataset.del, 10);
          if (!confirm('Удалить проект #' + id + '?')) return;
          API.del('/api/projects/' + id).then(loadProjects)
            .catch(function (err) { alert(err.message); });
        });
      });
      tbody.querySelectorAll('button[data-csv]').forEach(function (b) {
        b.addEventListener('click', function () { exportFile(parseInt(b.dataset.csv, 10), 'csv'); });
      });
      tbody.querySelectorAll('button[data-xlsx]').forEach(function (b) {
        b.addEventListener('click', function () { exportFile(parseInt(b.dataset.xlsx, 10), 'xlsx'); });
      });
      tbody.querySelectorAll('button[data-pdf]').forEach(function (b) {
        b.addEventListener('click', function () { exportPdf(parseInt(b.dataset.pdf, 10)); });
      });
    });
  }

  function exportFile(projectId, format) {
    var token = API.getToken();
    if (!token) { alert('Не авторизован'); return; }
    fetch('/api/reports/' + projectId + '/' + format, {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error(e.detail || 'Ошибка'); });
      return r.blob();
    }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'project_' + projectId + '.' + format;
      a.click();
      URL.revokeObjectURL(url);
    }).catch(function (err) { alert(err.message); });
  }

  function exportPdf(projectId) {
    API.get('/api/reports/' + projectId + '/data')
      .then(function (data) {
        Promise.all([
          API.get('/api/projects/' + projectId + '/aps'),
          API.get('/api/projects/' + projectId + '/devices'),
          API.get('/api/projects/' + projectId + '/elements'),
        ]).then(function (r) {
          if (!window.Report) {
            alert('Модуль отчёта не загружен');
            return;
          }
          window.Report.generate({
            project: data.project,
            aps: r[0], devices: r[1], elements: r[2],
            owner: data.owner ? (data.owner.name + ' <' + data.owner.email + '>') : '—',
            user: data.generated_by,
            stats: data.coverage_stats,
            channels: data.channels,
            heatmapDataUrl: null,
            mode: 'rssi',
          });
        });
      })
      .catch(function (err) { alert('Ошибка: ' + err.message); });
  }

  // ============ ЖУРНАЛ ============
  function loadAudit() {
    API.get('/api/admin/audit-log?limit=100').then(function (logs) {
      var tbody = document.querySelector('#auditTable tbody');
      tbody.innerHTML = '';
      if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty">' +
          '<div class="big">📜</div>Журнал пуст</div></td></tr>';
        return;
      }
      logs.forEach(function (l) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + fmtDate(l.created_at) + '</td>' +
          '<td>' + (l.user_name ? esc(l.user_name) : '—') +
            '<br><span style="color:#999;font-size:11px">' +
            (l.user_email ? esc(l.user_email) : '') + '</span></td>' +
          '<td><code>' + esc(l.action) + '</code></td>' +
          '<td>' + (l.entity || '—') + '</td>' +
          '<td>' + (l.entity_id || '—') + '</td>';
        tbody.appendChild(tr);
      });
    }).catch(function (err) { console.error(err); });
  }

  // ============ Утилиты ============
  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      var pad = function (n) { return n < 10 ? '0' + n : n; };
      return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() +
        ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    } catch (e) { return iso; }
  }
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();