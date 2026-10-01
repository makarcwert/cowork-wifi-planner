/* Обёртка над fetch: добавляет JWT и обрабатывает ошибки. */
(function (global) {
  var TOKEN_KEY = 'cowork_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(t) {
    localStorage.setItem(TOKEN_KEY, t);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function request(method, url, body, isForm) {
    var headers = {};
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    var payload;
    if (body && !isForm) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    } else {
      payload = body; // FormData
    }

    return fetch(url, { method: method, headers: headers, body: payload })
      .then(function (r) {
        if (r.status === 401) {
          clearToken();
          window.location.href = '/static/login.html';
          throw new Error('Unauthorized');
        }
        if (!r.ok) {
          return r.json().then(function (e) {
            throw new Error(e.detail || 'Ошибка запроса');
          });
        }
        if (r.status === 204) return null;
        return r.json();
      });
  }

  global.API = {
    get: function (u) { return request('GET', u); },
    post: function (u, b) { return request('POST', u, b); },
    postForm: function (u, f) { return request('POST', u, f, true); },
    put: function (u, b) { return request('PUT', u, b); },
    del: function (u) { return request('DELETE', u); },
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
  };
})(window);