/* ============================================================
   CoworkWiFi Planner — SVG-иконки
   Стиль: viewBox 100×100, stroke 5, currentColor
   Адаптируются под тёмную/светлую тему автоматически
   ============================================================ */
(function (global) {
  'use strict';

  var ICONS = {

    // ============================================================
    // СЕТЬ
    // ============================================================
    ap:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="10" y="60" width="80" height="20" rx="3"/>' +
        '<line x1="22" y1="60" x2="22" y2="20"/>' +
        '<line x1="42" y1="60" x2="42" y2="20"/>' +
        '<circle cx="20" cy="70" r="1.5" fill="currentColor"/>' +
        '<circle cx="30" cy="70" r="1.5" fill="currentColor"/>' +
        '<circle cx="40" cy="70" r="1.5" fill="currentColor"/>' +
        '<path d="M 55 35 A 15 15 0 0 1 65 50"/>' +
        '<path d="M 50 40 A 22 22 0 0 1 65 55"/>' +
        '<path d="M 45 45 A 30 30 0 0 1 65 60"/>' +
      '</svg>',

    switch:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="10" y="15" width="80" height="12" rx="2"/>' +
        '<rect x="10" y="35" width="80" height="12" rx="2"/>' +
        '<rect x="10" y="55" width="80" height="12" rx="2"/>' +
        '<rect x="10" y="75" width="80" height="12" rx="2"/>' +
        '<g fill="currentColor" stroke="none">' +
          '<circle cx="20" cy="30" r="2"/><circle cx="35" cy="30" r="2"/><circle cx="50" cy="30" r="2"/><circle cx="65" cy="30" r="2"/><circle cx="80" cy="30" r="2"/>' +
          '<circle cx="20" cy="50" r="2"/><circle cx="35" cy="50" r="2"/><circle cx="50" cy="50" r="2"/><circle cx="65" cy="50" r="2"/><circle cx="80" cy="50" r="2"/>' +
          '<circle cx="20" cy="70" r="2"/><circle cx="35" cy="70" r="2"/><circle cx="50" cy="70" r="2"/><circle cx="65" cy="70" r="2"/><circle cx="80" cy="70" r="2"/>' +
        '</g>' +
      '</svg>',

    router:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="10" y="15" width="80" height="25" rx="3"/>' +
        '<line x1="25" y1="15" x2="25" y2="5"/>' +
        '<line x1="75" y1="15" x2="75" y2="5"/>' +
        '<circle cx="25" cy="5" r="2" fill="currentColor"/>' +
        '<circle cx="75" cy="5" r="2" fill="currentColor"/>' +
        '<g fill="currentColor" stroke="none">' +
          '<circle cx="20" cy="27" r="2"/><circle cx="30" cy="27" r="2"/><circle cx="40" cy="27" r="2"/><circle cx="50" cy="27" r="2"/>' +
        '</g>' +
        '<path d="M 40 40 V 50 M 30 40 V 50 H 70 V 40"/>' +
        '<rect x="10" y="55" width="25" height="20" rx="2"/>' +
        '<rect x="60" y="55" width="30" height="20" rx="2"/>' +
        '<line x1="50" y1="50" x2="50" y2="65"/>' +
        '<circle cx="50" cy="65" r="3"/>' +
        '<line x1="53" y1="65" x2="70" y2="55"/>' +
        '<line x1="47" y1="65" x2="25" y2="55"/>' +
      '</svg>',

    wlc:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M 25 12 L 30 8 H 70 L 75 12 V 88 L 70 92 H 30 L 25 88 Z"/>' +
        '<rect x="33" y="20" width="34" height="12" rx="1"/>' +
        '<rect x="33" y="36" width="34" height="12" rx="1"/>' +
        '<circle cx="50" cy="65" r="3" fill="currentColor"/>' +
        '<circle cx="50" cy="78" r="3" fill="currentColor"/>' +
      '</svg>',

    patch:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="10" y="15" width="32" height="42"/>' +
        '<rect x="17" y="22" width="18" height="28"/>' +
        '<rect x="35" y="28" width="32" height="42"/>' +
        '<rect x="42" y="35" width="18" height="28"/>' +
        '<rect x="60" y="42" width="32" height="42"/>' +
        '<rect x="67" y="49" width="18" height="28"/>' +
      '</svg>',

    // ============================================================
    // СТЕНЫ И ПРОЁМЫ
    // ============================================================
    wall_brick:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round">' +
        '<rect x="10" y="20" width="80" height="60"/>' +
        '<line x1="10" y1="40" x2="90" y2="40"/>' +
        '<line x1="10" y1="60" x2="90" y2="60"/>' +
        '<line x1="35" y1="20" x2="35" y2="40"/>' +
        '<line x1="65" y1="20" x2="65" y2="40"/>' +
        '<line x1="25" y1="40" x2="25" y2="60"/>' +
        '<line x1="50" y1="40" x2="50" y2="60"/>' +
        '<line x1="75" y1="40" x2="75" y2="60"/>' +
        '<line x1="35" y1="60" x2="35" y2="80"/>' +
        '<line x1="65" y1="60" x2="65" y2="80"/>' +
      '</svg>',

    wall_wood:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<ellipse cx="50" cy="20" rx="20" ry="8"/>' +
        '<path d="M 30 20 V 78 A 20 8 0 0 0 70 78 V 20"/>' +
        '<ellipse cx="50" cy="20" rx="10" ry="4"/>' +
        '<line x1="35" y1="40" x2="35" y2="50"/>' +
        '<line x1="50" y1="55" x2="50" y2="65"/>' +
      '</svg>',

    wall_glass:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round">' +
        '<rect x="15" y="10" width="70" height="80"/>' +
        '<rect x="22" y="17" width="56" height="66"/>' +
        '<line x1="50" y1="17" x2="50" y2="83"/>' +
        '<line x1="22" y1="50" x2="78" y2="50"/>' +
      '</svg>',

    wall_drywall:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="15" y="15" width="70" height="10" rx="2"/>' +
        '<path d="M 15 25 Q 22.5 35 30 25 Q 37.5 35 45 25 Q 52.5 35 60 25 Q 67.5 35 75 25 Q 82.5 35 85 25"/>' +
        '<rect x="15" y="40" width="70" height="10" rx="2"/>' +
        '<path d="M 15 50 Q 22.5 60 30 50 Q 37.5 60 45 50 Q 52.5 60 60 50 Q 67.5 60 75 50 Q 82.5 60 85 50"/>' +
        '<rect x="15" y="65" width="70" height="10" rx="2"/>' +
        '<path d="M 15 75 Q 22.5 85 30 75 Q 37.5 85 45 75 Q 52.5 85 60 75 Q 67.5 85 75 75 Q 82.5 85 85 75"/>' +
      '</svg>',

    wall_concrete:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M 15 45 L 25 35 H 75 L 85 45 V 85 H 15 Z"/>' +
        '<line x1="30" y1="35" x2="30" y2="15"/>' +
        '<line x1="50" y1="35" x2="50" y2="10"/>' +
        '<line x1="70" y1="35" x2="70" y2="15"/>' +
        '<line x1="20" y1="25" x2="80" y2="25"/>' +
      '</svg>',

    door:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round">' +
        '<rect x="20" y="10" width="60" height="80"/>' +
        '<rect x="26" y="16" width="48" height="68"/>' +
        '<circle cx="65" cy="52" r="3" fill="currentColor"/>' +
      '</svg>',

    // ============================================================
    // МЕБЕЛЬ
    // ============================================================
    table:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M 15 30 L 85 30 L 92 45 H 8 Z"/>' +
        '<line x1="15" y1="45" x2="15" y2="88"/>' +
        '<line x1="35" y1="45" x2="35" y2="88"/>' +
        '<line x1="65" y1="45" x2="65" y2="88"/>' +
        '<line x1="85" y1="45" x2="85" y2="88"/>' +
      '</svg>',

    chair:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M 30 15 H 70 L 68 45 H 32 Z"/>' +
        '<line x1="38" y1="15" x2="40" y2="45"/>' +
        '<line x1="50" y1="15" x2="50" y2="45"/>' +
        '<line x1="62" y1="15" x2="60" y2="45"/>' +
        '<rect x="22" y="45" width="56" height="8" rx="2"/>' +
        '<line x1="25" y1="53" x2="25" y2="88"/>' +
        '<line x1="75" y1="53" x2="75" y2="88"/>' +
      '</svg>',

    sofa:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M 22 40 V 30 A 10 10 0 0 1 32 20 H 68 A 10 10 0 0 1 78 30 V 40"/>' +
        '<path d="M 10 50 A 10 10 0 0 1 25 50 V 65 H 75 V 50 A 10 10 0 0 1 90 50 V 80 H 10 Z"/>' +
        '<line x1="20" y1="80" x2="20" y2="90"/>' +
        '<line x1="80" y1="80" x2="80" y2="90"/>' +
      '</svg>',

    plant:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M 30 65 H 70 L 65 90 H 35 Z"/>' +
        '<line x1="25" y1="65" x2="75" y2="65"/>' +
        '<path d="M 50 65 V 45 Q 30 35 20 42 Q 25 55 50 50"/>' +
        '<path d="M 50 55 Q 70 42 80 48 Q 75 60 50 55"/>' +
        '<path d="M 50 45 V 30 Q 48 22 42 18"/>' +
        '<path d="M 50 30 Q 55 20 62 18 Q 60 30 50 30"/>' +
      '</svg>',

    // ============================================================
    // ТЕХНИКА
    // ============================================================
    pc:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="10" y="20" width="22" height="65" rx="2"/>' +
        '<line x1="15" y1="28" x2="27" y2="28"/>' +
        '<circle cx="21" cy="75" r="2.5" fill="currentColor"/>' +
        '<rect x="38" y="20" width="55" height="40" rx="2"/>' +
        '<rect x="43" y="25" width="45" height="30"/>' +
        '<line x1="65" y1="60" x2="65" y2="68"/>' +
        '<rect x="53" y="68" width="24" height="8" rx="2"/>' +
      '</svg>',

    laptop:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="20" y="20" width="60" height="42" rx="2"/>' +
        '<rect x="26" y="26" width="48" height="30"/>' +
        '<path d="M 8 72 L 92 72 L 88 82 H 12 Z"/>' +
        '<rect x="42" y="67" width="16" height="3" fill="currentColor"/>' +
      '</svg>',

    printer:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="20" y="15" width="25" height="12" fill="currentColor"/>' +
        '<line x1="35" y1="20" x2="85" y2="8" stroke-width="4"/>' +
        '<rect x="12" y="35" width="76" height="30" rx="3"/>' +
        '<circle cx="70" cy="45" r="3" fill="currentColor"/>' +
        '<circle cx="80" cy="45" r="3" fill="currentColor"/>' +
        '<rect x="25" y="65" width="50" height="22" rx="2" fill="currentColor"/>' +
      '</svg>',

    scanner:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="15" y="60" width="70" height="25" rx="3"/>' +
        '<path d="M 15 60 L 50 20 L 65 20 L 35 60 Z"/>' +
        '<circle cx="78" cy="73" r="2.5" fill="currentColor"/>' +
        '<line x1="65" y1="60" x2="65" y2="85"/>' +
      '</svg>',

    camera:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="45" cy="48" r="30"/>' +
        '<circle cx="45" cy="48" r="12"/>' +
        '<path d="M 72 32 A 35 35 0 0 1 72 64"/>' +
        '<path d="M 65 75 L 85 85 L 85 75"/>' +
      '</svg>',

    // ============================================================
    // IoT
    // ============================================================
    light:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M 30 45 A 20 20 0 1 1 70 45 C 70 60 60 65 60 70 H 40 C 40 65 30 60 30 45 Z"/>' +
        '<line x1="40" y1="78" x2="60" y2="78"/>' +
        '<line x1="42" y1="86" x2="58" y2="86"/>' +
        '<line x1="50" y1="10" x2="50" y2="20"/>' +
        '<line x1="20" y1="30" x2="28" y2="36"/>' +
        '<line x1="80" y1="30" x2="72" y2="36"/>' +
        '<line x1="12" y1="55" x2="22" y2="55"/>' +
        '<line x1="88" y1="55" x2="78" y2="55"/>' +
      '</svg>',

    sensor:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M 10 50 H 25 L 32 20 L 42 80 L 50 40 L 55 50 H 60"/>' +
        '<circle cx="68" cy="50" r="4" fill="currentColor"/>' +
        '<path d="M 75 40 A 15 15 0 0 1 75 60"/>' +
        '<path d="M 82 32 A 25 25 0 0 1 82 68"/>' +
        '<path d="M 89 24 A 35 35 0 0 1 89 76"/>' +
      '</svg>',

    lock:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="20" y="42" width="60" height="45" rx="6"/>' +
        '<path d="M 30 42 V 28 A 20 20 0 0 1 70 28 V 42"/>' +
        '<circle cx="50" cy="62" r="5" fill="currentColor"/>' +
      '</svg>',

    doorphone:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M 15 45 L 25 35 H 75 L 85 45 V 85 H 15 Z"/>' +
        '<line x1="30" y1="35" x2="30" y2="10"/>' +
        '<line x1="50" y1="35" x2="50" y2="10"/>' +
        '<line x1="70" y1="35" x2="70" y2="10"/>' +
        '<line x1="25" y1="20" x2="35" y2="20"/>' +
        '<line x1="45" y1="20" x2="55" y2="20"/>' +
        '<line x1="65" y1="20" x2="75" y2="20"/>' +
      '</svg>',

    ac:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="10" y="20" width="80" height="28" rx="4"/>' +
        '<line x1="10" y1="42" x2="90" y2="42"/>' +
        '<path d="M 75 28 V 38 M 70 33 H 80 M 71 29 L 79 37 M 71 37 L 79 29" stroke-width="2"/>' +
        '<g fill="currentColor" stroke="none">' +
          '<circle cx="20" cy="58" r="2.5"/><circle cx="35" cy="58" r="2.5"/><circle cx="50" cy="58" r="2.5"/><circle cx="65" cy="58" r="2.5"/><circle cx="80" cy="58" r="2.5"/>' +
          '<circle cx="20" cy="73" r="2.5"/><circle cx="35" cy="73" r="2.5"/><circle cx="50" cy="73" r="2.5"/><circle cx="65" cy="73" r="2.5"/><circle cx="80" cy="73" r="2.5"/>' +
          '<circle cx="20" cy="88" r="2.5"/><circle cx="35" cy="88" r="2.5"/><circle cx="50" cy="88" r="2.5"/><circle cx="65" cy="88" r="2.5"/><circle cx="80" cy="88" r="2.5"/>' +
        '</g>' +
      '</svg>',

    // ============================================================
    // UI (метрики, экспорт)
    // ============================================================
    sun:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">' +
        '<circle cx="50" cy="50" r="18"/>' +
        '<line x1="50" y1="15" x2="50" y2="25"/>' +
        '<line x1="50" y1="75" x2="50" y2="85"/>' +
        '<line x1="15" y1="50" x2="25" y2="50"/>' +
        '<line x1="75" y1="50" x2="85" y2="50"/>' +
        '<line x1="25" y1="25" x2="32" y2="32"/>' +
        '<line x1="75" y1="75" x2="68" y2="68"/>' +
        '<line x1="25" y1="75" x2="32" y2="68"/>' +
        '<line x1="75" y1="25" x2="68" y2="32"/>' +
      '</svg>',

    moon:
      '<svg viewBox="0 0 100 100" fill="currentColor" stroke="none">' +
        '<path d="M 60 20 A 35 35 0 1 0 85 70 A 25 25 0 1 1 60 20 Z"/>' +
      '</svg>',

    lightning:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M 58 15 L 32 48 L 52 48 L 42 85 L 70 47 L 50 47 Z"/>' +
      '</svg>',

    target:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round">' +
        '<rect x="10" y="10" width="80" height="80" rx="8"/>' +
        '<circle cx="50" cy="50" r="28"/>' +
        '<circle cx="50" cy="50" r="16"/>' +
        '<circle cx="50" cy="50" r="5" fill="currentColor"/>' +
      '</svg>',

    chart:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="15" y="20" width="70" height="50"/>' +
        '<path d="M 25 55 L 40 40 L 55 55 L 75 35"/>' +
        '<circle cx="25" cy="55" r="2.5" fill="currentColor"/>' +
        '<circle cx="40" cy="40" r="2.5" fill="currentColor"/>' +
        '<circle cx="55" cy="55" r="2.5" fill="currentColor"/>' +
        '<circle cx="75" cy="35" r="2.5" fill="currentColor"/>' +
        '<line x1="50" y1="70" x2="50" y2="85"/>' +
        '<line x1="35" y1="85" x2="65" y2="85"/>' +
      '</svg>',

    xlsx:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round">' +
        '<path d="M 25 12 H 70 L 82 25 V 88 H 25 Z"/>' +
        '<path d="M 70 12 V 25 H 82"/>' +
        '<line x1="32" y1="22" x2="32" y2="78" stroke-dasharray="2 4" stroke-width="3"/>' +
        '<text x="58" y="58" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="currentColor" stroke="none">XLSX</text>' +
      '</svg>',

    csv:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round">' +
        '<path d="M 25 12 H 70 L 82 25 V 88 H 25 Z"/>' +
        '<path d="M 70 12 V 25 H 82"/>' +
        '<text x="53" y="58" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="currentColor" stroke="none">CSV</text>' +
      '</svg>',

    png:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round">' +
        '<path d="M 25 12 H 70 L 82 25 V 88 H 25 Z"/>' +
        '<path d="M 70 12 V 25 H 82"/>' +
        '<text x="53" y="58" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="currentColor" stroke="none">PNG</text>' +
      '</svg>',

    // ============================================================
    // ДОПОЛНИТЕЛЬНЫЕ (не в палитре, но в наборе)
    // ============================================================
    camera_dome:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M 22 28 L 78 15 L 80 27 L 24 33 Z"/>' +
        '<line x1="50" y1="33" x2="50" y2="42"/>' +
        '<path d="M 15 55 Q 15 30 50 30 Q 85 30 85 55"/>' +
        '<path d="M 15 55 V 75 Q 15 90 50 90 Q 85 90 85 75 V 55"/>' +
        '<circle cx="50" cy="70" r="11"/>' +
      '</svg>',

    video:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="15" y="15" width="60" height="70"/>' +
        '<rect x="15" y="15" width="10" height="10" fill="currentColor"/>' +
        '<rect x="15" y="35" width="10" height="10" fill="currentColor"/>' +
        '<rect x="15" y="55" width="10" height="10" fill="currentColor"/>' +
        '<rect x="15" y="75" width="10" height="10" fill="currentColor"/>' +
        '<rect x="65" y="15" width="10" height="10" fill="currentColor"/>' +
        '<rect x="65" y="35" width="10" height="10" fill="currentColor"/>' +
        '<rect x="65" y="55" width="10" height="10" fill="currentColor"/>' +
        '<path d="M 60 65 L 65 55 L 70 65 L 80 70 L 70 75 L 65 85 L 60 75 L 50 70 Z" fill="currentColor"/>' +
      '</svg>',

    calendar:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round">' +
        '<rect x="15" y="15" width="70" height="70"/>' +
        '<line x1="15" y1="32" x2="85" y2="32"/>' +
        '<line x1="32" y1="15" x2="32" y2="85"/>' +
        '<line x1="50" y1="15" x2="50" y2="85"/>' +
        '<line x1="68" y1="15" x2="68" y2="85"/>' +
        '<line x1="15" y1="50" x2="85" y2="50"/>' +
        '<line x1="15" y1="68" x2="85" y2="68"/>' +
        '<g fill="currentColor" stroke="none">' +
          '<circle cx="23" cy="23" r="2.5"/><circle cx="41" cy="23" r="2.5"/><circle cx="59" cy="23" r="2.5"/><circle cx="77" cy="23" r="2.5"/>' +
          '<circle cx="23" cy="41" r="2.5"/><circle cx="23" cy="59" r="2.5"/><circle cx="23" cy="77" r="2.5"/>' +
        '</g>' +
      '</svg>',

    analyst:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="50" cy="20" r="9"/>' +
        '<path d="M 50 30 V 50 L 25 45 L 20 55 M 50 50 L 75 45 L 80 55"/>' +
        '<line x1="35" y1="65" x2="35" y2="88"/>' +
        '<line x1="65" y1="65" x2="65" y2="88"/>' +
        '<path d="M 35 55 V 65 H 65 V 55"/>' +
        '<path d="M 15 40 L 22 22 L 28 40 Z"/>' +
        '<rect x="76" y="32" width="14" height="14"/>' +
      '</svg>',

    spinner:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4">' +
        '<circle cx="30" cy="30" r="8"/>' +
        '<circle cx="50" cy="20" r="10"/>' +
        '<circle cx="70" cy="35" r="4" fill="currentColor"/>' +
        '<circle cx="80" cy="55" r="5" fill="currentColor"/>' +
        '<circle cx="70" cy="75" r="6"/>' +
        '<circle cx="50" cy="85" r="7"/>' +
        '<circle cx="30" cy="75" r="8"/>' +
        '<circle cx="20" cy="55" r="9"/>' +
      '</svg>',

    team:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="25" cy="28" r="8"/>' +
        '<rect x="15" y="40" width="20" height="25"/>' +
        '<line x1="20" y1="65" x2="20" y2="88"/>' +
        '<line x1="30" y1="65" x2="30" y2="88"/>' +
        '<circle cx="50" cy="26" r="9"/>' +
        '<rect x="40" y="40" width="20" height="25"/>' +
        '<line x1="45" y1="65" x2="45" y2="88"/>' +
        '<line x1="55" y1="65" x2="55" y2="88"/>' +
        '<circle cx="75" cy="24" r="10"/>' +
        '<rect x="63" y="38" width="24" height="27"/>' +
        '<line x1="70" y1="65" x2="70" y2="88"/>' +
        '<line x1="80" y1="65" x2="80" y2="88"/>' +
        '<path d="M 68 50 L 73 55 L 82 42" stroke-width="3"/>' +
      '</svg>',

    barcode:
      '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="12" y="15" width="76" height="70" rx="8"/>' +
        '<line x1="22" y1="30" x2="22" y2="58"/>' +
        '<line x1="32" y1="25" x2="32" y2="58"/>' +
        '<line x1="42" y1="20" x2="42" y2="58"/>' +
        '<line x1="52" y1="25" x2="52" y2="58"/>' +
        '<line x1="62" y1="30" x2="62" y2="58"/>' +
        '<line x1="72" y1="25" x2="72" y2="58"/>' +
        '<path d="M 25 70 Q 50 85 75 70"/>' +
      '</svg>'
  };

  // ============================================================
  // ПУБЛИЧНОЕ API
  // ============================================================
  var FALLBACK =
    '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="50" cy="50" r="30" stroke-dasharray="5 5"/>' +
    '</svg>';

  global.getEditorIcon = function (kind) {
    return ICONS[kind] || FALLBACK;
  };

  global.EditorIcons = ICONS;

  // Все иконки на месте, заглушек больше нет
  global.MISSING_ICONS = [];

  console.log('[icons.js] успешно загружено иконок:', Object.keys(ICONS).length);

})(window);