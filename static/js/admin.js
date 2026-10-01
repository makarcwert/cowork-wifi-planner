(function () {
  API.get('/api/auth/me').then(function (u) {
    document.getElementById('userName').textContent = u.full_name;
    if (u.role !== 'admin') {
      alert('Доступ только для администратора');
      window.location.href = '/static/index.html';
      return;
    }
    loadUsers();
  });

  function loadUsers() {
    API.get('/api/users/').then(function (users) {
      var tb = document.querySelector('#usersTable tbody');
      tb.innerHTML = '';
      users.forEach(function (u) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + u.id + '</td>' +
          '<td>' + u.full_name + '</td>' +
          '<td>' + u.email + '</td>' +
          '<td>' + u.role + '</td>' +
          '<td>' + (u.is_active ? '✅' : '❌') + '</td>' +
          '<td><button class="btn" data-id="' + u.id + '">Блок</button></td>';
        tr.querySelector('button').addEventListener('click', function () {
          API.put('/api/users/' + u.id + '/block').then(loadUsers);
        });
        tb.appendChild(tr);
      });
    });
  }
})();