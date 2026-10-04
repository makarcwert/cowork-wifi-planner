/* Генерация PDF-отчёта через print-to-PDF браузера. */
(function (global) {

  function generateReport(opts) {
    var p = opts.project;
    var now = new Date();
    var dateStr = now.toLocaleString('ru-RU');

    var html = '<!DOCTYPE html><html lang="ru"><head>' +
      '<meta charset="UTF-8"><title>Отчёт — ' + esc(p.name) + '</title>' +
      '<style>' + getStyles() + '</style></head><body>';

    html += '<div class="header">' +
      '<div class="logo">📡 CoworkWiFi Planner</div>' +
      '<h1>Отчёт о проектировании беспроводной сети</h1>' +
      '<div class="meta">Сформирован: ' + dateStr + '</div>' +
      '</div>';

    html += '<h2>1. Общая информация</h2>' +
      '<table class="info-table">' +
      '<tr><td>Название проекта</td><td><strong>' + esc(p.name) + '</strong></td></tr>' +
      '<tr><td>Размеры помещения</td><td>' + p.width_m + ' × ' + p.height_m +
        ' м (' + (p.width_m * p.height_m).toFixed(1) + ' м²)</td></tr>' +
      '<tr><td>Владелец проекта</td><td>' + esc(opts.owner || '—') + '</td></tr>' +
      '<tr><td>Дата создания</td><td>' + fmtDate(p.created_at) + '</td></tr>' +
      '<tr><td>Отчёт сформировал</td><td>' + esc(opts.user.full_name) +
        ' (' + opts.user.email + ')</td></tr>' +
      '</table>';

    html += '<h2>2. Точки доступа</h2>';
    if (opts.aps && opts.aps.length) {
      html += '<table class="data-table"><thead><tr>' +
        '<th>№</th><th>Имя</th><th>Модель</th><th>X, м</th><th>Y, м</th>' +
        '<th>P, дБм</th><th>G, dBi</th><th>Диапазон</th><th>Канал</th><th>SSID</th>' +
        '</tr></thead><tbody>';
      opts.aps.forEach(function (ap, i) {
        var ssidNames = { corporate: 'Корпоративный', guest: 'Гостевой', iot: 'IoT' };
        html += '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td>' + esc(ap.name) + '</td>' +
          '<td>' + esc(ap.model || '—') + '</td>' +
          '<td>' + ap.x.toFixed(2) + '</td>' +
          '<td>' + ap.y.toFixed(2) + '</td>' +
          '<td>' + ap.tx_power_dbm + '</td>' +
          '<td>' + ap.antenna_gain + '</td>' +
          '<td>' + ap.band + ' ГГц</td>' +
          '<td>' + ap.channel + '</td>' +
          '<td>' + (ssidNames[ap.ssid_type] || ap.ssid_type) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<p class="empty">Точки доступа не размещены.</p>';
    }

    html += '<h2>3. Клиентские устройства</h2>';
    if (opts.devices && opts.devices.length) {
      var devNames = { pc: 'ПК', laptop: 'Ноутбук', printer: 'Принтер',
                       scanner: 'Сканер', camera: 'Камера', iot: 'IoT-датчик',
                       switch: 'Коммутатор' };
      var byType = {};
      opts.devices.forEach(function (d) {
        byType[d.type] = (byType[d.type] || 0) + 1;
      });
      html += '<table class="data-table"><thead><tr>' +
        '<th>Тип</th><th>Количество</th><th>Требуемый RSSI</th>' +
        '</tr></thead><tbody>';
      Object.keys(byType).forEach(function (t) {
        var sample = opts.devices.filter(function (d) { return d.type === t; })[0];
        html += '<tr>' +
          '<td>' + (devNames[t] || t) + '</td>' +
          '<td>' + byType[t] + '</td>' +
          '<td>≥ ' + sample.required_rssi + ' дБм</td>' +
          '</tr>';
      });
      html += '</tbody></table>' +
        '<p class="note">Всего устройств: <strong>' + opts.devices.length + '</strong></p>';
    } else {
      html += '<p class="empty">Устройства не добавлены.</p>';
    }

    html += '<h2>4. Архитектура помещения</h2>';
    var walls = (opts.elements || []).filter(function (el) { return el.type === 'wall'; });
    var doors = (opts.elements || []).filter(function (el) { return el.type === 'door'; });
    var windows = (opts.elements || []).filter(function (el) { return el.type === 'window'; });
    if (walls.length || doors.length || windows.length) {
      var matNames = { concrete: 'Бетон', brick: 'Кирпич', drywall: 'Гипсокартон',
                       wood: 'Дерево', glass: 'Стекло' };
      var matAtten = { concrete: 14, brick: 9, drywall: 4, wood: 3.5, glass: 6.5 };
      var matStats = {};
      walls.forEach(function (w) {
        var m = w.material || 'concrete';
        if (!matStats[m]) matStats[m] = { count: 0, length: 0 };
        matStats[m].count++;
        matStats[m].length += Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
      });
      html += '<table class="data-table"><thead><tr>' +
        '<th>Материал</th><th>Кол-во стен</th><th>Общая длина</th>' +
        '<th>Затухание (дБ)</th></tr></thead><tbody>';
      Object.keys(matStats).forEach(function (m) {
        html += '<tr>' +
          '<td>' + (matNames[m] || m) + '</td>' +
          '<td>' + matStats[m].count + '</td>' +
          '<td>' + matStats[m].length.toFixed(1) + ' м</td>' +
          '<td>' + (matAtten[m] || '—') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>' +
        '<p class="note">Двери: <strong>' + doors.length + '</strong> · ' +
        'Окна: <strong>' + windows.length + '</strong></p>';
    } else {
      html += '<p class="empty">Стены не заданы.</p>';
    }

    if (opts.heatmapDataUrl) {
      html += '<h2>5. Тепловая карта покрытия</h2>' +
        '<div class="map-title">Слой: ' + opts.mode.toUpperCase() + '</div>' +
        '<div class="map"><img src="' + opts.heatmapDataUrl + '" alt="Тепловая карта"></div>';
    }

    if (opts.stats) {
      html += '<h2>6. Статистика покрытия</h2>';
      html += '<table class="data-table"><thead><tr>' +
        '<th>Уровень RSSI</th><th>% площади</th><th>Ячеек</th>' +
        '</tr></thead><tbody>';
      var rssiNames = { excellent: 'Отлично (≥ −55 дБм)', good: 'Хорошо (−65…−55)',
                        fair: 'Норма (−75…−65)', poor: 'Слабо (−85…−75)',
                        dead: 'Мёртвая зона (< −85)' };
      ['excellent','good','fair','poor','dead'].forEach(function (k) {
        if (opts.stats.rssi[k]) {
          html += '<tr><td>' + rssiNames[k] + '</td>' +
            '<td>' + opts.stats.rssi[k].percent + '%</td>' +
            '<td>' + opts.stats.rssi[k].count + '</td></tr>';
        }
      });
      html += '</tbody></table>';
    }

    if (opts.channels && opts.channels.recommendations) {
      html += '<h2>7. Анализ каналов и рекомендации</h2>';
      if (opts.channels.by_channel && opts.channels.by_channel.length) {
        html += '<table class="data-table"><thead><tr>' +
          '<th>Диапазон</th><th>Канал</th><th>Кол-во AP</th></tr></thead><tbody>';
        opts.channels.by_channel.forEach(function (c) {
          html += '<tr><td>' + c.band + ' ГГц</td><td>' + c.channel +
            '</td><td>' + c.count + '</td></tr>';
        });
        html += '</tbody></table>';
      }
      html += '<div class="recommendations">';
      opts.channels.recommendations.forEach(function (r) {
        var cls = r.type === 'error' ? 'rec-error'
                : r.type === 'warning' ? 'rec-warning' : 'rec-ok';
        var icon = r.type === 'error' ? '❌'
                 : r.type === 'warning' ? '⚠️' : '✅';
        html += '<div class="rec ' + cls + '">' + icon + ' ' + esc(r.text) + '</div>';
      });
      html += '</div>';
    }

    html += '<div class="footer">' +
      '<p>Отчёт сформирован автоматически в системе <strong>CoworkWiFi Planner</strong>.</p>' +
      '<p>Курсовой проект 2026–2027 · Скрыпкин М. Ю. · группа СИП-323/24</p>' +
      '</div>';

    html += '<div class="print-bar no-print">' +
      '<button onclick="window.print()">🖨 Сохранить в PDF</button>' +
      '<button onclick="window.close()">Закрыть</button>' +
      '</div>';

    html += '</body></html>';

    var w = window.open('', '_blank');
    if (!w) {
      alert('Разрешите всплывающие окна для экспорта отчёта');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function getStyles() {
    return '@page{size:A4;margin:18mm 16mm}' +
      '*{box-sizing:border-box}' +
      'body{font-family:"Segoe UI",Arial,sans-serif;color:#2c2c3a;margin:0;padding:0;line-height:1.5;font-size:12px}' +
      '.header{text-align:center;border-bottom:3px solid #6c5ce7;padding-bottom:16px;margin-bottom:24px}' +
      '.header .logo{font-size:14px;color:#6c5ce7;font-weight:700;margin-bottom:8px}' +
      '.header h1{font-size:22px;margin:8px 0;color:#2c2c3a}' +
      '.header .meta{font-size:11px;color:#777}' +
      'h2{font-size:15px;color:#6c5ce7;border-bottom:1px solid #e0e0e5;padding-bottom:6px;margin:22px 0 12px}' +
      'table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px}' +
      'th{background:#f5f5fa;padding:7px 9px;text-align:left;font-weight:600;color:#555;border-bottom:1px solid #e0e0e5}' +
      'td{padding:6px 9px;border-bottom:1px solid #f0f0f5}' +
      '.info-table td:first-child{width:180px;color:#777}' +
      '.map{margin:12px 0;text-align:center;border:1px solid #e0e0e5;border-radius:8px;padding:8px;background:#fafafa}' +
      '.map img{max-width:100%;height:auto}' +
      '.map-title{font-size:11px;color:#777;margin-bottom:6px}' +
      '.empty{color:#999;font-style:italic;padding:8px 0}' +
      '.note{color:#777;font-size:11px}' +
      '.recommendations{margin:10px 0}' +
      '.rec{padding:8px 12px;margin:6px 0;border-radius:6px;border-left:3px solid #ddd;font-size:11px;line-height:1.4}' +
      '.rec-ok{background:#e8f7f0;border-color:#00b894}' +
      '.rec-warning{background:#fef7e6;border-color:#e67e22}' +
      '.rec-error{background:#fdecea;border-color:#e74c3c}' +
      '.footer{margin-top:30px;padding-top:14px;border-top:1px solid #e0e0e5;text-align:center;color:#999;font-size:10px}' +
      '.print-bar{position:fixed;top:12px;right:12px;z-index:100;display:flex;gap:8px}' +
      '.print-bar button{background:#6c5ce7;color:#fff;border:none;padding:10px 18px;' +
        'border-radius:8px;cursor:pointer;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,.15)}' +
      '.print-bar button:last-child{background:#e0e0e5;color:#555}' +
      '@media print{.no-print{display:none!important}h2{page-break-after:avoid}table{page-break-inside:avoid}}';
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('ru-RU'); }
    catch (e) { return iso; }
  }

  global.Report = { generate: generateReport };
})(window);