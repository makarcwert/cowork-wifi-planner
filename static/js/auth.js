/* Логин и регистрация. */
(function () {
  var loginForm = document.getElementById('loginForm');
  var registerForm = document.getElementById('registerForm');
  var msg = document.getElementById('msg');

  document.getElementById('showRegister').addEventListener('click', function (e) {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
  });

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('email').value;
    var password = document.getElementById('password').value;

    var form = new FormData();
    form.append('username', email); // OAuth2 ожидает username
    form.append('password', password);

    API.postForm('/api/auth/login', form)
      .then(function (data) {
        API.setToken(data.access_token);
        window.location.href = '/static/index.html';
      })
      .catch(function (err) {
        msg.textContent = err.message;
        msg.className = 'msg error';
      });
  });

  registerForm.addEventListener('submit', function (e) {
    e.preventDefault();
    API.post('/api/auth/register', {
      email: document.getElementById('regEmail').value,
      password: document.getElementById('regPassword').value,
      full_name: document.getElementById('regName').value,
      role: document.getElementById('regRole').value,
    })
      .then(function () {
        msg.textContent = 'Аккаунт создан. Теперь войдите.';
        msg.className = 'msg success';
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
      })
      .catch(function (err) {
        msg.textContent = err.message;
        msg.className = 'msg error';
      });
  });
})();