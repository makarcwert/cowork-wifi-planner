/* ============================================================
   CoworkWiFi Planner — панель администратора
   ============================================================ */
(function () {
  'use strict';

  var me = null;
  var allUsers = [];
  var allProjects = [];
  var currentTab = 'dashboard';

  // ---- Утилита: Уведомления (Toast) ----
  function showToast(message, type) {
    var container = document.getElementById('toast-container');
    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'success');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  // ---- Проверка авторизации ----
  API.get('/api/auth/me')
    .then(function (u) {
      me = u;
      document.getElementById('userName').textContent = u.full_name;
      document.getElementById('userAvatar').textContent = (u.full_name || '?').split(' ').map(s => s[0] || '').join('').slice(0, 2).toUpperCase();

      if (u.role !== 'admin') {
        alert('Доступ только для администратора');
        window.location.href = '/static/index.html';
        return;
      }
      init();
    })
    .catch(function () {
      window.location.href = '/static/login.html';
    });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    API.clearToken();
    window.location.href = '/static/login.html';
  });

  // ============================================================
  // ИНИЦИАЛИЗАЦИЯ
  // ============================================================
  function init() {
    // Вкладки
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        currentTab = t.dataset.tab;
        
        ['dashboard', 'users', 'projects', 'audit'].forEach(function (name) {
          document.getElementById('tab-' + name).style.display = (name === currentTab) ? '' : 'none';
        });

        // Очистка поиска при переключении
        var su = document.getElementById('searchUsers');
        var sp = document.getElementById('searchProjects');
        if (su) su.value = '';
        if (sp) sp.value = '';

        if (currentTab === 'dashboard') loadMetrics();
        if (currentTab === 'users') loadUsers();
        if (currentTab === 'projects') loadProjects();
        if (currentTab === 'audit') loadAudit();
      });
    });

    // Поиск по пользователям
    document.getElementById('searchUsers').addEventListener('input', function() {
      var q = this.value.toLowerCase();
      renderUsers(allUsers.filter(u => 
        (u.full_name||'').toLowerCase().includes(q) || 
        (u.email||'').toLowerCase().includes(q)
      ));
    });

    // Поиск по проектам
    document.getElementById('searchProjects').addEventListener('input', function() {
      var q = this.value.toLowerCase();
      renderProjects(allProjects.filter(p => 
        (p.name||'').toLowerCase().includes(q) || 
        (p.owner_name||'').toLowerCase().includes(q)
      ));
    });

    loadMetrics();
    initModals();
  }

  // ============================================================
  // МОДАЛКИ
  // ============================================================
  var userModal = document.getElementById('userModal');
  var roleModal = document.getElementById('roleModal');
  var roleTargetId = null;

  function initModals() {
    document.getElementById('addUserBtn').addEventListener('click', function () {
      document.getElementById('nuName').value = '';
      document.getElementById('nuEmail').value = '';
      document.getElementById('nuPassword').value = '';
      document.getElementById('nuRole').value = 'analyst';
      userModal.classList.add('show');
    });
    document.getElementById('nuCancel').addEventListener('click', () => userModal.classList.remove('show'));
    document.getElementById('nuCreate').addEventListener('click', function () {
      var data = {
        full_name: document.getElementById('nuName').value.trim(),
        email: document.getElementById('nuEmail').value.trim(),
        password: document.getElementById('nuPassword').value,
        role: document.getElementById('nuRole').value
      };
      if (!data.full_name || !data.email || data.password.length < 6) {
        return showToast('Заполните все поля (пароль > 6 символов)', 'error');
      }
      API.post('/api/users/', data)
        .then(function () {
          userModal.classList.remove('show');
          showToast('Пользователь ' + data.full_name + ' создан');
          loadUsers();
        })
        .catch(function (err) { showToast(err.message, 'error'); });
    });

    document.getElementById('roleCancel').addEventListener('click', () => roleModal.classList.remove('show'));
    document.getElementById('roleSave').addEventListener('click', function () {
      var newRole = document.getElementById('roleSelect').value;
      API.put('/api/users/' + roleTargetId + '/role?role=' + newRole)
        .then(function () {
          roleModal.classList.remove('show');
          showToast('Роль успешно изменена');
          loadUsers();
        })
        .catch(function (err) { showToast(err.message, 'error'); });
    });
  }

  // ============================================================
  // ДАШБОРД
  // ============================================================
  function loadMetrics() {
    API.get('/api/admin/metrics').then(function (m) {
      document.getElementById('metricGrid').innerHTML =
        card('Пользователи', m.users.total, m.users.active + ' активных') +
        card('Проекты', m.projects.total, m.projects.total_area + ' м² спроектировано') +
        card('Точки доступа', m.aps.total, 'всего в системе') +
        card('Устройства', m.devices.total, 'техника и IoT') +
        card('Элементы', m.elements.total, 'стены, мебель');
      
      renderBarChart('regChart', m.registrations_7d);
      renderBarChart('projChart', m.projects_7d, true);
      renderRoleChart(m.users.by_role, m.users.total);
      renderContentChart(m);
    }).catch(function (err) { console.error(err); });
  }

  function card(label, value, sub) {
    return '<div class="metric-card"><div class="label">' + label + '</div><div class="value">' + value + '</div><div class="sub">' + (sub || '') + '</div></div>';
  }

  function renderBarChart(elId, data, green) {
    var max = Math.max.apply(null, data.map(function (d) { return d.count; })) || 1;
    document.getElementById(elId).innerHTML = data.map(function (d) {
      var h = (d.count / max) * 100;
      return '<div class="bar-col"><div class="bar-count">' + d.count + '</div><div class="bar' + (green ? ' ok' : '') + '" style="height:' + h + '%"></div><div class="bar-label">' + d.label + '</div></div>';
    }).join('');
  }

  function renderRoleChart(byRole, total) {
    var roles = [{ key: 'admin', name: 'Администраторы', color: '#f44336' }, { key: 'engineer', name: 'Инженеры', color: '#0e639c' }, { key: 'analyst', name: 'Аналитики', color: '#858585' }];
    document.getElementById('roleChart').innerHTML = roles.map(function (r) {
      var c = byRole[r.key] || 0, pct = total ? (c / total) * 100 : 0;
      return '<div class="role-row"><div class="role-name">' + r.name + '</div><div class="role-bar"><div class="role-fill" style="width:' + pct + '%;background:' + r.color + '"></div></div><div class="role-count">' + c + '</div></div>';
    }).join('');
  }

  function renderContentChart(m) {
    var items = [{ name: 'Точки доступа', count: m.aps.total, color: '#0e639c' }, { name: 'Устройства', count: m.devices.total, color: '#3498db' }, { name: 'Элементы плана', count: m.elements.total, color: '#ffc107' }];
    var max = Math.max.apply(null, items.map(function (i) { return i.count; })) || 1;
    document.getElementById('contentChart').innerHTML = items.map(function (i) {
      var pct = (i.count / max) * 100;
      return '<div class="role-row"><div class="role-name">' + i.name + '</div><div class="role-bar"><div class="role-fill" style="width:' + pct + '%;background:' + i.color + '"></div></div><div class="role-count">' + i.count + '</div></div>';
    }).join('');
  }

  // ============================================================
  // ПОЛЬЗОВАТЕЛИ
  // ============================================================
  function loadUsers() {
    API.get('/api/users/').then(function (users) {
      allUsers = users;
      renderUsers(users);
    });
  }

  function renderUsers(users) {
    var tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '';
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-dim)">Ничего не найдено</td></tr>';
      return;
    }
    users.forEach(function (u) {
      var tr = document.createElement('tr');
      var roleBadge = '<span class="badge ' + u.role + '">' + roleRu(u.role) + '</span>';
      var statusBadge = u.is_active ? '<span class="badge active">Активен</span>' : '<span class="badge blocked">Заблокирован</span>';
      var self = me && me.id === u.id;
      
      var actions = self ? '<span style="color:var(--text-dim);font-size:12px">Текущий профиль</span>'
        : '<button class="btn-sm" data-act="role" data-id="' + u.id + '" style="padding:4px 8px;margin-right:4px;">Роль</button>' +
          '<button class="btn-sm" data-act="block" data-id="' + u.id + '" style="padding:4px 8px;margin-right:4px;">' + (u.is_active ? 'Заблокировать' : 'Разблокировать') + '</button>' +
          '<button class="btn-sm" data-act="delete" data-id="' + u.id + '" style="padding:4px 8px;color:#f44336;">Удалить</button>';

      tr.innerHTML = '<td>' + u.id + '</td><td><strong>' + esc(u.full_name) + '</strong></td><td>' + esc(u.email) + '</td><td>' + roleBadge + '</td><td>' + statusBadge + '</td><td>' + fmtDate(u.created_at) + '</td><td>' + (u.last_login ? fmtDate(u.last_login) : '—') + '</td><td style="white-space:nowrap">' + actions + '</td>';
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('button[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = parseInt(b.dataset.id, 10);
        var act = b.dataset.act;
        var user = allUsers.find(function (x) { return x.id === id; });

        if (act === 'block') {
          API.put('/api/users/' + id + '/block').then(function () {
            showToast(user.is_active ? 'Пользователь заблокирован' : 'Пользователь разблокирован');
            loadUsers();
          }).catch(err => showToast(err.message, 'error'));
        } else if (act === 'delete') {
          if (!confirm('Удалить пользователя ' + user.email + '?')) return;
          API.del('/api/users/' + id).then(function () {
            showToast('Пользователь удалён');
            loadUsers();
          }).catch(err => showToast(err.message, 'error'));
        } else if (act === 'role') {
          roleTargetId = id;
          document.getElementById('roleModalEmail').textContent = 'Сотрудник: ' + user.email;
          document.getElementById('roleSelect').value = user.role;
          roleModal.classList.add('show');
        }
      });
    });
  }

  // ============================================================
  // ПРОЕКТЫ
  // ============================================================
  function loadProjects() {
    API.get('/api/admin/projects').then(function (list) {
      allProjects = list;
      renderProjects(list);
    });
  }

  function renderProjects(list) {
    var tbody = document.querySelector('#projectsTable tbody');
    tbody.innerHTML = '';
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-dim)">Проектов не найдено</td></tr>';
      return;
    }
    list.forEach(function (p) {
      var tr = document.createElement('tr');
      var ownerHtml = p.owner_name ? '<strong>' + esc(p.owner_name) + '</strong><br><span style="font-size:11px;color:var(--text-dim)">' + esc(p.owner_email) + '</span>' : '<span style="color:var(--text-dim)">Нет владельца</span>';
      tr.innerHTML = '<td>' + p.id + '</td><td><strong>' + esc(p.name) + '</strong></td><td>' + ownerHtml + '</td><td>' + p.width_m + ' × ' + p.height_m + ' м</td><td>' + p.elements_count + '</td><td>' + p.aps_count + '</td><td>' + fmtDate(p.created_at) + '</td><td><button class="btn-sm" data-del="' + p.id + '" style="padding:4px 8px;color:#f44336;">Удалить</button></td>';
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('button[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = parseInt(b.dataset.del, 10);
        if (!confirm('Удалить проект #' + id + '?')) return;
        API.del('/api/projects/' + id).then(function () {
          showToast('Проект удалён');
          loadProjects();
        }).catch(err => showToast(err.message, 'error'));
      });
    });
  }

  // ============================================================
  // ЖУРНАЛ
  // ============================================================
  function loadAudit() {
    API.get('/api/admin/audit-log?limit=100').then(function (logs) {
      var tbody = document.querySelector('#auditTable tbody');
      tbody.innerHTML = '';
      if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-dim)">Журнал пуст</td></tr>';
        return;
      }
      logs.forEach(function (l) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' + fmtDate(l.created_at) + '</td><td>' + (l.user_name ? esc(l.user_name) : '—') + '<br><span style="font-size:11px;color:var(--text-dim)">' + (l.user_email ? esc(l.user_email) : '') + '</span></td><td><code>' + esc(l.action) + '</code></td><td>' + (l.entity || '—') + '</td><td>' + (l.entity_id || '—') + '</td>';
        tbody.appendChild(tr);
      });
    }).catch(function (err) { showToast('Ошибка загрузки журнала', 'error'); });
  }

  // ============================================================
  // УТИЛИТЫ
  // ============================================================
  function roleRu(role) { return { admin: 'Админ', engineer: 'Инженер', analyst: 'Аналитик' }[role] || role; }
  
  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      var pad = function (n) { return n < 10 ? '0' + n : n; };
      return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    } catch (e) { return iso; }
  }
  
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
})();