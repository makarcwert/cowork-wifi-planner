/* ============================================================
   CoworkWiFi Planner — SVG-иконки в стиле технического чертежа
   Флэт, тонкие линии, единый viewBox 32×32
   ============================================================ */
(function (global) {
  'use strict';

  // Общие атрибуты для всех иконок
  var S = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" ' +
          'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

  // ============================================================
  // СЕТЬ
  // ============================================================

  // Точка доступа — Wi-Fi круги
  var ICON_AP =
    '<svg ' + S + '>' +
      '<circle cx="16" cy="16" r="2" fill="currentColor" stroke="none"/>' +
      '<path d="M 11 11 a7 7 0 0 1 10 0"/>' +
      '<path d="M 8 8 a11 11 0 0 1 16 0"/>' +
      '<path d="M 13 13.5 a4 4 0 0 1 6 0"/>' +
    '</svg>';

  // Коммутатор — синий прямоугольник со стрелками
  var ICON_SWITCH =
    '<svg ' + S + '>' +
      '<rect x="2" y="9" width="28" height="14" rx="2" fill="#2E5EAA" stroke="#1E4080"/>' +
      '<path d="M 8 18 L 8 13 M 6 15 L 8 13 L 10 15" stroke="#fff"/>' +
      '<path d="M 13 13 L 13 18 M 11 16 L 13 18 L 15 16" stroke="#fff"/>' +
      '<circle cx="20" cy="16" r="1" fill="#fff" stroke="none"/>' +
      '<circle cx="24" cy="16" r="1" fill="#fff" stroke="none"/>' +
    '</svg>';

  // Роутер — с антеннами
  var ICON_ROUTER =
    '<svg ' + S + '>' +
      '<rect x="4" y="14" width="24" height="10" rx="2" fill="#fff"/>' +
      '<line x1="8" y1="14" x2="8" y2="6"/>' +
      '<line x1="16" y1="14" x2="16" y2="6"/>' +
      '<line x1="24" y1="14" x2="24" y2="6"/>' +
      '<circle cx="8" cy="6" r="1" fill="currentColor" stroke="none"/>' +
      '<circle cx="16" cy="6" r="1" fill="currentColor" stroke="none"/>' +
      '<circle cx="24" cy="6" r="1" fill="currentColor" stroke="none"/>' +
      '<circle cx="9" cy="19" r="0.8" fill="currentColor" stroke="none"/>' +
      '<circle cx="14" cy="19" r="0.8" fill="currentColor" stroke="none"/>' +
      '<circle cx="19" cy="19" r="0.8" fill="currentColor" stroke="none"/>' +
      '<circle cx="24" cy="19" r="0.8" fill="currentColor" stroke="none"/>' +
    '</svg>';

  // Патч-панель — рейка с портами
  var ICON_PATCH =
    '<svg ' + S + '>' +
      '<rect x="3" y="12" width="26" height="8" rx="1" fill="#ddd"/>' +
      '<rect x="5" y="14" width="2" height="4" fill="#2E5EAA" stroke="none"/>' +
      '<rect x="9" y="14" width="2" height="4" fill="#2E5EAA" stroke="none"/>' +
      '<rect x="13" y="14" width="2" height="4" fill="#2E5EAA" stroke="none"/>' +
      '<rect x="17" y="14" width="2" height="4" fill="#2E5EAA" stroke="none"/>' +
      '<rect x="21" y="14" width="2" height="4" fill="#2E5EAA" stroke="none"/>' +
      '<rect x="25" y="14" width="2" height="4" fill="#2E5EAA" stroke="none"/>' +
    '</svg>';

  // WLC — контроллер
  var ICON_WLC =
    '<svg ' + S + '>' +
      '<rect x="6" y="4" width="20" height="24" rx="2" fill="#fff"/>' +
      '<line x1="6" y1="12" x2="26" y2="12"/>' +
      '<line x1="6" y1="20" x2="26" y2="20"/>' +
      '<circle cx="10" cy="8" r="1" fill="currentColor" stroke="none"/>' +
      '<circle cx="10" cy="16" r="1" fill="currentColor" stroke="none"/>' +
      '<circle cx="10" cy="24" r="1" fill="currentColor" stroke="none"/>' +
      '<line x1="14" y1="8" x2="22" y2="8"/>' +
      '<line x1="14" y1="16" x2="22" y2="16"/>' +
      '<line x1="14" y1="24" x2="22" y2="24"/>' +
    '</svg>';

  // ============================================================
  // СТЕНЫ (палитра)
  // ============================================================

  var ICON_WALL_BRICK =
    '<svg ' + S + '>' +
      '<rect x="2" y="9" width="28" height="14" fill="#B85C38" stroke="#8a3f22"/>' +
      '<line x1="2" y1="14" x2="30" y2="14" stroke="#8a3f22"/>' +
      '<line x1="2" y1="19" x2="30" y2="19" stroke="#8a3f22"/>' +
      '<line x1="10" y1="9" x2="10" y2="14" stroke="#8a3f22"/>' +
      '<line x1="21" y1="9" x2="21" y2="14" stroke="#8a3f22"/>' +
      '<line x1="6" y1="14" x2="6" y2="19" stroke="#8a3f22"/>' +
      '<line x1="16" y1="14" x2="16" y2="19" stroke="#8a3f22"/>' +
      '<line x1="26" y1="14" x2="26" y2="19" stroke="#8a3f22"/>' +
      '<line x1="10" y1="19" x2="10" y2="23" stroke="#8a3f22"/>' +
      '<line x1="21" y1="19" x2="21" y2="23" stroke="#8a3f22"/>' +
    '</svg>';

  var ICON_WALL_WOOD =
    '<svg ' + S + '>' +
      '<rect x="2" y="9" width="28" height="14" fill="#A0522D" stroke="#7a3a20"/>' +
      '<line x1="7" y1="9" x2="7" y2="23" stroke="#7a3a20"/>' +
      '<line x1="12" y1="9" x2="12" y2="23" stroke="#7a3a20"/>' +
      '<line x1="17" y1="9" x2="17" y2="23" stroke="#7a3a20"/>' +
      '<line x1="22" y1="9" x2="22" y2="23" stroke="#7a3a20"/>' +
      '<line x1="27" y1="9" x2="27" y2="23" stroke="#7a3a20"/>' +
    '</svg>';

  var ICON_WALL_GLASS =
    '<svg ' + S + '>' +
      '<rect x="2" y="10" width="28" height="12" fill="#A8D8EA" fill-opacity="0.4"/>' +
      '<line x1="2" y1="10" x2="30" y2="10" stroke="#5BA8C8"/>' +
      '<line x1="2" y1="22" x2="30" y2="22" stroke="#5BA8C8"/>' +
      '<path d="M 5 22 L 11 10 L 15 10 L 9 22 Z" fill="#fff" fill-opacity="0.5" stroke="none"/>' +
    '</svg>';

  var ICON_WALL_DRYWALL =
    '<svg ' + S + '>' +
      '<rect x="2" y="10" width="28" height="12" fill="#E8E8E8"/>' +
      '<line x1="2" y1="10" x2="30" y2="10"/>' +
      '<line x1="2" y1="22" x2="30" y2="22"/>' +
    '</svg>';

  var ICON_WALL_CONCRETE =
    '<svg ' + S + '>' +
      '<rect x="2" y="10" width="28" height="12" fill="#7A7A7A"/>' +
      '<circle cx="6" cy="14" r="0.7" fill="#fff" stroke="none"/>' +
      '<circle cx="12" cy="13" r="0.7" fill="#fff" stroke="none"/>' +
      '<circle cx="18" cy="15" r="0.7" fill="#fff" stroke="none"/>' +
      '<circle cx="24" cy="14" r="0.7" fill="#fff" stroke="none"/>' +
      '<circle cx="9" cy="18" r="0.7" fill="#fff" stroke="none"/>' +
      '<circle cx="15" cy="19" r="0.7" fill="#fff" stroke="none"/>' +
      '<circle cx="21" cy="18" r="0.7" fill="#fff" stroke="none"/>' +
      '<circle cx="27" cy="19" r="0.7" fill="#fff" stroke="none"/>' +
    '</svg>';

  // ============================================================
  // МЕБЕЛЬ
  // ============================================================

  var ICON_TABLE =
    '<svg ' + S + '>' +
      '<rect x="3" y="10" width="26" height="14" fill="#A0522D" stroke="#7a3a20"/>' +
      '<line x1="3" y1="14" x2="29" y2="14" stroke="#7a3a20"/>' +
      '<line x1="3" y1="18" x2="29" y2="18" stroke="#7a3a20"/>' +
      '<line x1="3" y1="21" x2="29" y2="21" stroke="#7a3a20"/>' +
    '</svg>';

  var ICON_CHAIR =
    '<svg ' + S + '>' +
      '<path d="M 10 8 a5 5 0 0 1 12 0 v 8 h -12 z" fill="#ddd"/>' +
      '<ellipse cx="16" cy="20" rx="7" ry="3" fill="#ddd"/>' +
      '<line x1="11" y1="23" x2="11" y2="27"/>' +
      '<line x1="21" y1="23" x2="21" y2="27"/>' +
    '</svg>';

  var ICON_SOFA =
    '<svg ' + S + '>' +
      '<rect x="3" y="13" width="26" height="10" rx="2" fill="#ddd"/>' +
      '<rect x="3" y="9" width="4" height="6" rx="1" fill="#ccc"/>' +
      '<rect x="25" y="9" width="4" height="6" rx="1" fill="#ccc"/>' +
      '<line x1="7" y1="23" x2="7" y2="26"/>' +
      '<line x1="25" y1="23" x2="25" y2="26"/>' +
    '</svg>';

  var ICON_PLANT =
    '<svg ' + S + '>' +
      '<path d="M 11 20 L 21 20 L 22 29 L 10 29 Z" fill="#c8a870" stroke="#8a6a40"/>' +
      '<path d="M 16 20 Q 8 14 6 6 Q 14 10 16 20" fill="#2ECC71" stroke="#1f8f4e"/>' +
      '<path d="M 16 20 Q 24 14 26 6 Q 18 10 16 20" fill="#2ECC71" stroke="#1f8f4e"/>' +
      '<line x1="16" y1="20" x2="16" y2="5" stroke="#1f8f4e"/>' +
    '</svg>';

  // ============================================================
  // ТЕХНИКА
  // ============================================================

  var ICON_PC =
    '<svg ' + S + '>' +
      '<rect x="4" y="6" width="17" height="13" rx="1" fill="#fff"/>' +
      '<line x1="4" y1="16" x2="21" y2="16"/>' +
      '<circle cx="12.5" cy="18" r="0.8" fill="currentColor" stroke="none"/>' +
      '<line x1="10" y1="19" x2="15" y2="19"/>' +
      '<line x1="12.5" y1="19" x2="12.5" y2="22"/>' +
      '<line x1="9" y1="22" x2="16" y2="22"/>' +
      '<rect x="24" y="10" width="5" height="12" rx="0.5" fill="#fff"/>' +
      '<circle cx="26.5" cy="12" r="0.6" fill="currentColor" stroke="none"/>' +
    '</svg>';

  var ICON_LAPTOP =
    '<svg ' + S + '>' +
      '<rect x="6" y="7" width="20" height="14" rx="1" fill="#fff"/>' +
      '<path d="M 3 22 L 29 22 L 27 25 L 5 25 Z" fill="#ddd"/>' +
    '</svg>';

  var ICON_PRINTER =
    '<svg ' + S + '>' +
      '<rect x="8" y="4" width="16" height="7" fill="#fff"/>' +
      '<rect x="4" y="11" width="24" height="12" rx="1" fill="#fff"/>' +
      '<rect x="8" y="18" width="16" height="8" fill="#fff"/>' +
      '<line x1="6" y1="15" x2="10" y2="15" stroke="#2E5EAA" stroke-width="2"/>' +
      '<circle cx="24" cy="15" r="0.8" fill="#2E5EAA" stroke="none"/>' +
      '<line x1="11" y1="21" x2="21" y2="21"/>' +
      '<line x1="11" y1="23" x2="21" y2="23"/>' +
    '</svg>';

  var ICON_SCANNER =
    '<svg ' + S + '>' +
      '<rect x="3" y="14" width="26" height="10" rx="1" fill="#fff"/>' +
      '<line x1="3" y1="17" x2="29" y2="17"/>' +
      '<rect x="7" y="6" width="18" height="6" fill="#ddd" stroke="none"/>' +
      '<circle cx="24" cy="19" r="0.8" fill="currentColor" stroke="none"/>' +
    '</svg>';

  var ICON_CAMERA =
    '<svg ' + S + '>' +
      '<circle cx="16" cy="16" r="10" fill="#fff"/>' +
      '<circle cx="16" cy="16" r="6" fill="#333"/>' +
      '<circle cx="14" cy="14" r="1.5" fill="#fff" stroke="none"/>' +
    '</svg>';

  // ============================================================
  // IoT (оранжевые)
  // ============================================================

  var ICON_LIGHT =
    '<svg ' + S + ' stroke="#FF8C42">' +
      '<circle cx="16" cy="16" r="4" fill="#FF8C42" fill-opacity="0.15"/>' +
      '<line x1="16" y1="4" x2="16" y2="8"/>' +
      '<line x1="16" y1="24" x2="16" y2="28"/>' +
      '<line x1="4" y1="16" x2="8" y2="16"/>' +
      '<line x1="24" y1="16" x2="28" y2="16"/>' +
      '<line x1="8" y1="8" x2="11" y2="11"/>' +
      '<line x1="24" y1="24" x2="21" y2="21"/>' +
      '<line x1="8" y1="24" x2="11" y2="21"/>' +
      '<line x1="24" y1="8" x2="21" y2="11"/>' +
    '</svg>';

  var ICON_SENSOR =
    '<svg ' + S + ' stroke="#FF8C42">' +
      '<rect x="12" y="4" width="8" height="24" rx="4" fill="#FFF3E8"/>' +
      '<circle cx="16" cy="22" r="2.5" fill="#FF8C42" stroke="none"/>' +
      '<line x1="16" y1="8" x2="16" y2="16"/>' +
    '</svg>';

  var ICON_LOCK =
    '<svg ' + S + ' stroke="#FF8C42">' +
      '<rect x="7" y="14" width="18" height="14" rx="2" fill="#FFF3E8"/>' +
      '<path d="M 11 14 V 10 a5 5 0 0 1 10 0 V 14"/>' +
      '<circle cx="16" cy="20" r="1.5" fill="#FF8C42" stroke="none"/>' +
      '<line x1="16" y1="21" x2="16" y2="25"/>' +
    '</svg>';

  var ICON_DOORPHONE =
    '<svg ' + S + ' stroke="#FF8C42">' +
      '<rect x="10" y="4" width="12" height="24" rx="2" fill="#FFF3E8"/>' +
      '<circle cx="16" cy="11" r="3" fill="#FF8C42" stroke="none"/>' +
      '<circle cx="16" cy="20" r="1" fill="#FF8C42" stroke="none"/>' +
      '<line x1="13" y1="24" x2="19" y2="24"/>' +
    '</svg>';

  var ICON_AC =
    '<svg ' + S + ' stroke="#FF8C42">' +
      '<rect x="3" y="9" width="26" height="12" rx="2" fill="#FFF3E8"/>' +
      '<line x1="7" y1="13" x2="25" y2="13"/>' +
      '<line x1="7" y1="16" x2="25" y2="16"/>' +
      '<path d="M 8 25 q 3 -2 4 0 q 3 -2 4 0 q 3 -2 4 0 q 3 -2 4 0" fill="none"/>' +
    '</svg>';

  // ============================================================
  // ПРОЧЕЕ
  // ============================================================

  var ICON_RJ45 =
    '<svg ' + S + '>' +
      '<rect x="8" y="8" width="16" height="16" rx="1" fill="#2E5EAA"/>' +
      '<rect x="12" y="12" width="8" height="8" fill="#fff" stroke="none"/>' +
    '</svg>';

  var ICON_COVERAGE =
    '<svg ' + S + '>' +
      '<circle cx="16" cy="16" r="12" fill="none" stroke-dasharray="3 3"/>' +
    '</svg>';

  var ICON_CABLE =
    '<svg ' + S + '>' +
      '<path d="M 4 26 V 14 H 14 V 6 H 28"/>' +
    '</svg>';

  var ICON_SHAPE_RECT =
    '<svg ' + S + '>' +
      '<rect x="4" y="8" width="24" height="16" rx="1" fill="currentColor" opacity=".15"/>' +
    '</svg>';

  var ICON_SHAPE_ELLIPSE =
    '<svg ' + S + '>' +
      '<ellipse cx="16" cy="16" rx="12" ry="8" fill="currentColor" opacity=".15"/>' +
    '</svg>';

  var ICON_SHAPE_TRIANGLE =
    '<svg ' + S + '>' +
      '<polygon points="16,4 28,26 4,26" fill="currentColor" opacity=".15"/>' +
    '</svg>';

  // ============================================================
  // РЕГИСТРАЦИЯ ИКОНОК
  // ============================================================

  var ICONS = {
    // Сеть
    ap: ICON_AP,
    switch: ICON_SWITCH,
    router: ICON_ROUTER,
    patch: ICON_PATCH,
    wlc: ICON_WLC,

    // Стены
    wall_brick: ICON_WALL_BRICK,
    wall_wood: ICON_WALL_WOOD,
    wall_glass: ICON_WALL_GLASS,
    wall_drywall: ICON_WALL_DRYWALL,
    wall_concrete: ICON_WALL_CONCRETE,

    // Мебель
    table: ICON_TABLE,
    chair: ICON_CHAIR,
    sofa: ICON_SOFA,
    plant: ICON_PLANT,

    // Техника
    pc: ICON_PC,
    laptop: ICON_LAPTOP,
    printer: ICON_PRINTER,
    scanner: ICON_SCANNER,
    camera: ICON_CAMERA,

    // IoT
    light: ICON_LIGHT,
    sensor: ICON_SENSOR,
    lock: ICON_LOCK,
    doorphone: ICON_DOORPHONE,
    ac: ICON_AC,

    // Прочее
    rj45: ICON_RJ45,
    coverage: ICON_COVERAGE,
    cable: ICON_CABLE,

    // Фигуры
    shape_rect: ICON_SHAPE_RECT,
    shape_ellipse: ICON_SHAPE_ELLIPSE,
    shape_triangle: ICON_SHAPE_TRIANGLE,

    // Псевдонимы для удобства (совместимость со старым кодом)
    iot: ICON_SENSOR
  };

  // ============================================================
  // ПУБЛИЧНОЕ API
  // ============================================================

  // Получить SVG-иконку по ключу
  global.getEditorIcon = function (kind) {
    return ICONS[kind] ||
      '<svg ' + S + '><circle cx="16" cy="16" r="8"/></svg>';
  };

  // Прямой доступ ко всем иконкам
  global.EditorIcons = ICONS;

  // Список для легенды: [ключ, отображаемое имя]
  global.EditorLegendList = [
    ['ap', 'Точка доступа'],
    ['switch', 'Коммутатор'],
    ['router', 'Роутер'],
    ['patch', 'Патч-панель'],
    ['wlc', 'WLC'],
    ['pc', 'ПК'],
    ['laptop', 'Ноутбук'],
    ['printer', 'МФУ'],
    ['scanner', 'Сканер'],
    ['camera', 'Камера'],
    ['table', 'Стол'],
    ['chair', 'Стул'],
    ['sofa', 'Диван'],
    ['plant', 'Растение'],
    ['light', 'Освещение'],
    ['sensor', 'Датчик'],
    ['lock', 'Умный замок'],
    ['doorphone', 'Домофон'],
    ['ac', 'Кондиционер'],
    ['rj45', 'RJ-45'],
    ['coverage', 'Покрытие'],
    ['cable', 'Кабель']
  ];

})(window);