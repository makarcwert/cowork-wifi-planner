/* SVG-иконки для палитры редактора. Размер 32×32, цвет currentColor. */
(function (global) {
  var SVG = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" ' +
            'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
            'stroke-linejoin="round"';

  var ICONS = {
    // ============ СЕТЬ ============
    ap: '<svg ' + SVG + '>' +
      '<circle cx="16" cy="18" r="3" fill="currentColor" stroke="none"/>' +
      '<path d="M9 12 a10 10 0 0 1 14 0"/>' +
      '<path d="M5 8 a16 16 0 0 1 22 0"/>' +
      '<path d="M12 15 a6 6 0 0 1 8 0"/>' +
      '<line x1="16" y1="21" x2="16" y2="28"/>' +
      '</svg>',

    switch: '<svg ' + SVG + '>' +
      '<rect x="3" y="10" width="26" height="12" rx="2"/>' +
      '<rect x="6" y="13" width="3" height="6" fill="currentColor" stroke="none"/>' +
      '<rect x="11" y="13" width="3" height="6" fill="currentColor" stroke="none"/>' +
      '<rect x="16" y="13" width="3" height="6" fill="currentColor" stroke="none"/>' +
      '<rect x="21" y="13" width="3" height="6" fill="currentColor" stroke="none"/>' +
      '<line x1="6" y1="6" x2="6" y2="10"/>' +
      '<line x1="26" y1="6" x2="26" y2="10"/>' +
      '</svg>',

    // ============ СТЕНЫ ============
    wall_brick: '<svg ' + SVG + '>' +
      '<rect x="3" y="8" width="26" height="16" rx="1" fill="#c0392b" stroke="#8a2820"/>' +
      '<line x1="3" y1="13" x2="29" y2="13" stroke="#8a2820"/>' +
      '<line x1="3" y1="18" x2="29" y2="18" stroke="#8a2820"/>' +
      '<line x1="10" y1="8" x2="10" y2="13" stroke="#8a2820"/>' +
      '<line x1="21" y1="8" x2="21" y2="13" stroke="#8a2820"/>' +
      '<line x1="6" y1="13" x2="6" y2="18" stroke="#8a2820"/>' +
      '<line x1="16" y1="13" x2="16" y2="18" stroke="#8a2820"/>' +
      '<line x1="26" y1="13" x2="26" y2="18" stroke="#8a2820"/>' +
      '<line x1="10" y1="18" x2="10" y2="24" stroke="#8a2820"/>' +
      '<line x1="21" y1="18" x2="21" y2="24" stroke="#8a2820"/>' +
      '</svg>',

    wall_wood: '<svg ' + SVG + '>' +
      '<rect x="3" y="8" width="26" height="16" rx="1" fill="#8b5a2b" stroke="#5d3a1a"/>' +
      '<line x1="9" y1="8" x2="9" y2="24" stroke="#5d3a1a"/>' +
      '<line x1="15" y1="8" x2="15" y2="24" stroke="#5d3a1a"/>' +
      '<line x1="21" y1="8" x2="21" y2="24" stroke="#5d3a1a"/>' +
      '<line x1="27" y1="8" x2="27" y2="24" stroke="#5d3a1a"/>' +
      '</svg>',

    wall_drywall: '<svg ' + SVG + '>' +
      '<rect x="3" y="8" width="26" height="16" rx="1" fill="#e8e8f0" stroke="#b0b0c0"/>' +
      '<circle cx="8" cy="14" r="1" fill="#b0b0c0" stroke="none"/>' +
      '<circle cx="16" cy="14" r="1" fill="#b0b0c0" stroke="none"/>' +
      '<circle cx="24" cy="14" r="1" fill="#b0b0c0" stroke="none"/>' +
      '<circle cx="12" cy="19" r="1" fill="#b0b0c0" stroke="none"/>' +
      '<circle cx="20" cy="19" r="1" fill="#b0b0c0" stroke="none"/>' +
      '</svg>',

    wall_concrete: '<svg ' + SVG + '>' +
      '<rect x="3" y="8" width="26" height="16" rx="1" fill="#6b6b7b" stroke="#4a4a5a"/>' +
      '<circle cx="7" cy="12" r="0.8" fill="#fff" stroke="none" opacity=".5"/>' +
      '<circle cx="14" cy="11" r="0.8" fill="#fff" stroke="none" opacity=".5"/>' +
      '<circle cx="22" cy="13" r="0.8" fill="#fff" stroke="none" opacity=".5"/>' +
      '<circle cx="10" cy="17" r="0.8" fill="#fff" stroke="none" opacity=".5"/>' +
      '<circle cx="18" cy="18" r="0.8" fill="#fff" stroke="none" opacity=".5"/>' +
      '<circle cx="26" cy="19" r="0.8" fill="#fff" stroke="none" opacity=".5"/>' +
      '<circle cx="12" cy="21" r="0.8" fill="#fff" stroke="none" opacity=".5"/>' +
      '<circle cx="20" cy="14" r="0.8" fill="#fff" stroke="none" opacity=".5"/>' +
      '</svg>',

    wall_glass: '<svg ' + SVG + '>' +
      '<rect x="3" y="8" width="26" height="16" rx="1" fill="#b3e0f5" stroke="#5bb8e8" opacity=".7"/>' +
      '<path d="M 6 10 L 12 10 L 6 20 L 6 10 Z" fill="#fff" opacity=".6" stroke="none"/>' +
      '<line x1="3" y1="8" x2="29" y2="8" stroke="#5bb8e8"/>' +
      '<line x1="3" y1="24" x2="29" y2="24" stroke="#5bb8e8"/>' +
      '</svg>',

    // ============ МЕБЕЛЬ ============
    sofa: '<svg ' + SVG + '>' +
      '<rect x="4" y="14" width="24" height="10" rx="2"/>' +
      '<rect x="4" y="10" width="4" height="6" rx="1"/>' +
      '<rect x="24" y="10" width="4" height="6" rx="1"/>' +
      '<rect x="8" y="12" width="16" height="4" rx="1" fill="currentColor" stroke="none" opacity=".3"/>' +
      '<line x1="8" y1="24" x2="8" y2="27"/>' +
      '<line x1="24" y1="24" x2="24" y2="27"/>' +
      '</svg>',

    chair: '<svg ' + SVG + '>' +
      '<rect x="8" y="4" width="16" height="12" rx="1"/>' +
      '<rect x="6" y="16" width="20" height="4" rx="1"/>' +
      '<line x1="10" y1="20" x2="10" y2="28"/>' +
      '<line x1="22" y1="20" x2="22" y2="28"/>' +
      '</svg>',

    table: '<svg ' + SVG + '>' +
      '<rect x="3" y="10" width="26" height="3" rx="1"/>' +
      '<line x1="7" y1="13" x2="7" y2="26"/>' +
      '<line x1="25" y1="13" x2="25" y2="26"/>' +
      '</svg>',

    plant: '<svg ' + SVG + '>' +
      '<path d="M 12 20 L 20 20 L 22 28 L 10 28 Z"/>' +
      '<path d="M 16 20 Q 8 16 6 8 Q 14 12 16 20"/>' +
      '<path d="M 16 20 Q 24 16 26 8 Q 18 12 16 20"/>' +
      '<path d="M 16 20 L 16 6"/>' +
      '</svg>',

    // ============ ТЕХНИКА ============
    pc: '<svg ' + SVG + '>' +
      '<rect x="4" y="6" width="24" height="16" rx="1"/>' +
      '<line x1="12" y1="26" x2="20" y2="26"/>' +
      '<line x1="16" y1="22" x2="16" y2="26"/>' +
      '</svg>',

    laptop: '<svg ' + SVG + '>' +
      '<rect x="6" y="8" width="20" height="13" rx="1"/>' +
      '<path d="M 3 21 L 29 21 L 27 24 L 5 24 Z"/>' +
      '</svg>',

    printer: '<svg ' + SVG + '>' +
      '<rect x="8" y="4" width="16" height="6" rx="1"/>' +
      '<rect x="4" y="10" width="24" height="12" rx="1"/>' +
      '<rect x="8" y="18" width="16" height="10" rx="1"/>' +
      '<circle cx="24" cy="14" r="1" fill="currentColor" stroke="none"/>' +
      '</svg>',

    scanner: '<svg ' + SVG + '>' +
      '<rect x="3" y="12" width="26" height="8" rx="1"/>' +
      '<rect x="6" y="6" width="20" height="6" rx="1" opacity=".5"/>' +
      '<circle cx="24" cy="16" r="1" fill="currentColor" stroke="none"/>' +
      '</svg>',

    camera: '<svg ' + SVG + '>' +
      '<path d="M 6 12 L 26 12 L 26 22 L 6 22 Z"/>' +
      '<circle cx="16" cy="17" r="4"/>' +
      '<circle cx="16" cy="17" r="1.5" fill="currentColor" stroke="none"/>' +
      '<line x1="10" y1="8" x2="14" y2="12"/>' +
      '<line x1="22" y1="8" x2="18" y2="12"/>' +
      '</svg>',

        iot: '<svg ' + SVG + '>' +
      '<rect x="8" y="10" width="16" height="14" rx="2"/>' +
      '<circle cx="16" cy="17" r="2" fill="currentColor" stroke="none"/>' +
      '<line x1="12" y1="10" x2="12" y2="6"/>' +
      '<line x1="20" y1="10" x2="20" y2="6"/>' +
      '<line x1="6" y1="14" x2="8" y2="14"/>' +
      '<line x1="24" y1="14" x2="26" y2="14"/>' +
      '<line x1="6" y1="20" x2="8" y2="20"/>' +
      '<line x1="24" y1="20" x2="26" y2="20"/>' +
      '</svg>',

    shape_rect: '<svg ' + SVG + '>' +
      '<rect x="4" y="6" width="24" height="20" rx="1" fill="currentColor" opacity=".15" stroke="currentColor"/>' +
      '</svg>',

    shape_ellipse: '<svg ' + SVG + '>' +
      '<ellipse cx="16" cy="16" rx="12" ry="10" fill="currentColor" opacity=".15" stroke="currentColor"/>' +
      '</svg>',

    shape_triangle: '<svg ' + SVG + '>' +
      '<path d="M 16 4 L 28 26 L 4 26 Z" fill="currentColor" opacity=".15" stroke="currentColor"/>' +
      '</svg>'
  };

  global.EditorIcons = ICONS;
  global.getEditorIcon = function (kind) {
    return ICONS[kind] || '<svg ' + SVG + '><circle cx="16" cy="16" r="8"/></svg>';
  };
})(window);