"""Движок расчёта распространения Wi-Fi сигнала."""
import math

WALL_ATTENUATION = {
    "concrete": 14.0, "brick": 9.0, "drywall": 4.0,
    "wood": 3.5, "glass": 6.5, "door": 2.0, "window": 3.0,
}

BAND_INFO = {
    "2.4": {"channels": list(range(1, 15)), "spacing_mhz": 5, "width_mhz": 20},
    "5": {"channels": [36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112,
                       116, 120, 124, 128, 132, 136, 140, 149, 153, 157, 161, 165],
          "spacing_mhz": 20, "width_mhz": 20},
    "6": {"channels": list(range(1, 234, 4)), "spacing_mhz": 20, "width_mhz": 20},
}

BASE_NOISE_FLOOR_DBM = -95.0

DEVICE_PROFILES = {
    "pc": {"speed_mbps": 50}, "laptop": {"speed_mbps": 30},
    "printer": {"speed_mbps": 10}, "scanner": {"speed_mbps": 15},
    "camera": {"speed_mbps": 8}, "iot": {"speed_mbps": 1},
    "switch": {"speed_mbps": 100}, "phone": {"speed_mbps": 10},
    "tablet": {"speed_mbps": 15},
}

AP_THROUGHPUT = {"2.4": 100, "5": 400, "6": 600}

AP_POWER_CONSUMPTION = {"2.4": 12.0, "5": 15.5, "6": 18.0}


def path_loss(distance_m, band, n=3.0):
    if distance_m < 1.0:
        distance_m = 1.0
    if band == "2.4":
        pl_d0, n = 40.0, 2.7
    elif band == "6":
        pl_d0, n = 48.0, 3.2
    else:
        pl_d0, n = 47.0, 3.0
    return pl_d0 + 10.0 * n * math.log10(distance_m)


def _segments_intersect(p1, p2, p3, p4):
    x1, y1 = p1
    x2, y2 = p2
    x3, y3 = p3
    x4, y4 = p4
    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(denom) < 1e-10:
        return False
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
    u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom
    return 0.0 <= t <= 1.0 and 0.0 <= u <= 1.0


def walls_between(ap_x, ap_y, px, py, walls):
    total = 0.0
    for w in walls:
        if _segments_intersect((ap_x, ap_y), (px, py),
                                (w["x1"], w["y1"]), (w["x2"], w["y2"])):
            total += WALL_ATTENUATION.get(w.get("material"), 8.0)
    return total


def calculate_rssi(ap, px, py, walls):
    dx = px - ap["x"]
    dy = py - ap["y"]
    d = math.sqrt(dx * dx + dy * dy)
    if d < 0.5:
        d = 0.5
    pl = path_loss(d, ap.get("band", "5"))
    waf = walls_between(ap["x"], ap["y"], px, py, walls)
    return ap["tx_power_dbm"] + ap["antenna_gain"] - pl - waf


def calculate_best_rssi(aps, px, py, walls):
    if not aps:
        return -100.0
    best = -100.0
    for ap in aps:
        rssi = calculate_rssi(ap, px, py, walls)
        if rssi > best:
            best = rssi
    return best


def calculate_heatmap(width_m, height_m, aps, walls, grid_size_m=0.5):
    cols = int(width_m / grid_size_m) + 1
    rows = int(height_m / grid_size_m) + 1
    grid = []
    for r in range(rows):
        row = []
        y = r * grid_size_m
        for c in range(cols):
            x = c * grid_size_m
            row.append(round(calculate_best_rssi(aps, x, y, walls), 1))
        grid.append(row)
    return {"grid": grid, "cols": cols, "rows": rows,
            "grid_size_m": grid_size_m,
            "width_m": width_m, "height_m": height_m,
            "layer_type": "rssi"}


def channel_freq(ch, band):
    if band == "2.4":
        return 2412 + (ch - 1) * 5
    if band == "5":
        return 5000 + ch * 5
    if band == "6":
        return 5955 + (ch - 1) * 5
    return 0


def channel_overlap(ch1, band1, ch2, band2):
    if band1 != band2:
        return 0.0
    if ch1 == ch2:
        return 1.0
    info = BAND_INFO.get(band1, BAND_INFO["5"])
    width = info["width_mhz"]
    f1 = channel_freq(ch1, band1)
    f2 = channel_freq(ch2, band2)
    df = abs(f1 - f2)
    if df >= width:
        return 0.0
    return round(1.0 - df / width, 3)


def calculate_interference(aps, px, py, walls):
    if not aps:
        return -100.0
    best = None
    for ap in aps:
        rssi = calculate_rssi(ap, px, py, walls)
        if best is None or rssi > best["rssi"]:
            best = {"ap": ap, "rssi": rssi}
    if best is None:
        return -100.0
    total_lin = 0.0
    for ap in aps:
        if ap["id"] == best["ap"]["id"]:
            continue
        ov = channel_overlap(best["ap"].get("channel", 36), best["ap"].get("band", "5"),
                              ap.get("channel", 36), ap.get("band", "5"))
        if ov <= 0:
            continue
        rssi = calculate_rssi(ap, px, py, walls)
        total_lin += ov * (10 ** (rssi / 10.0))
    if total_lin <= 0:
        return -100.0
    return round(10.0 * math.log10(total_lin), 1)


def calculate_interference_map(width_m, height_m, aps, walls, grid_size_m=0.5):
    cols = int(width_m / grid_size_m) + 1
    rows = int(height_m / grid_size_m) + 1
    grid = []
    for r in range(rows):
        row = []
        y = r * grid_size_m
        for c in range(cols):
            x = c * grid_size_m
            row.append(round(calculate_interference(aps, x, y, walls), 1))
        grid.append(row)
    return {"grid": grid, "cols": cols, "rows": rows,
            "grid_size_m": grid_size_m,
            "width_m": width_m, "height_m": height_m,
            "layer_type": "interference"}


def analyze_channels(aps):
    by_channel = {}
    for ap in aps:
        key = (ap.get("band", "5"), ap.get("channel", 36))
        by_channel.setdefault(key, []).append(ap["name"])
    conflicts = []
    for (band, ch), names in by_channel.items():
        if len(names) > 1:
            conflicts.append({"band": band, "channel": ch,
                              "count": len(names), "aps": names,
                              "severity": "high" if len(names) > 2 else "medium"})
    recommendations = []
    ch24 = [ch for (band, ch) in by_channel if band == "2.4"]
    bad24 = [ch for ch in ch24 if ch not in (1, 6, 11)]
    if bad24:
        recommendations.append({"type": "warning",
            "text": "В 2.4 ГГц используйте только каналы 1, 6, 11. Найдены: " +
                    ", ".join(str(c) for c in bad24)})
    for c in conflicts:
        if c["severity"] == "high":
            recommendations.append({"type": "error",
                "text": f"Канал {c['channel']} ({c['band']} ГГц) используют "
                        f"{c['count']} точки: " + ", ".join(c["aps"])})
        else:
            recommendations.append({"type": "warning",
                "text": f"Канал {c['channel']} ({c['band']} ГГц) используют "
                        f"2 точки: " + ", ".join(c["aps"])})
    if not conflicts and not bad24:
        recommendations.append({"type": "ok",
            "text": "Конфликтов каналов не обнаружено."})
    return {"by_channel": [{"band": k[0], "channel": k[1], "count": len(v), "aps": v}
                           for k, v in sorted(by_channel.items())],
            "conflicts": conflicts, "recommendations": recommendations}


def effective_noise_floor(interference_dbm):
    if interference_dbm is None:
        return BASE_NOISE_FLOOR_DBM
    return max(BASE_NOISE_FLOOR_DBM, interference_dbm)


def calculate_snr_at(aps, px, py, walls):
    rssi = calculate_best_rssi(aps, px, py, walls)
    interf = calculate_interference(aps, px, py, walls)
    nf = effective_noise_floor(interf)
    return round(rssi - nf, 1)


def calculate_snr_map(width_m, height_m, aps, walls, grid_size_m=0.5):
    cols = int(width_m / grid_size_m) + 1
    rows = int(height_m / grid_size_m) + 1
    grid = []
    for r in range(rows):
        row = []
        y = r * grid_size_m
        for c in range(cols):
            x = c * grid_size_m
            row.append(calculate_snr_at(aps, x, y, walls))
        grid.append(row)
    return {"grid": grid, "cols": cols, "rows": rows,
            "grid_size_m": grid_size_m,
            "width_m": width_m, "height_m": height_m,
            "layer_type": "snr"}


def coverage_statistics(width_m, height_m, aps, walls, grid_size_m=0.5):
    cols = int(width_m / grid_size_m) + 1
    rows = int(height_m / grid_size_m) + 1
    total = cols * rows
    rssi_bins = {"excellent": 0, "good": 0, "fair": 0, "poor": 0, "dead": 0}
    snr_bins = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
    for r in range(rows):
        for c in range(cols):
            x = c * grid_size_m
            y = r * grid_size_m
            rssi = calculate_best_rssi(aps, x, y, walls)
            snr = calculate_snr_at(aps, x, y, walls)
            if rssi >= -55: rssi_bins["excellent"] += 1
            elif rssi >= -65: rssi_bins["good"] += 1
            elif rssi >= -75: rssi_bins["fair"] += 1
            elif rssi >= -85: rssi_bins["poor"] += 1
            else: rssi_bins["dead"] += 1
            if snr >= 40: snr_bins["excellent"] += 1
            elif snr >= 25: snr_bins["good"] += 1
            elif snr >= 15: snr_bins["fair"] += 1
            else: snr_bins["poor"] += 1
    def pct(n): return round(n / total * 100, 1) if total else 0.0
    return {"total_cells": total,
            "rssi": {k: {"count": v, "percent": pct(v)} for k, v in rssi_bins.items()},
            "snr": {k: {"count": v, "percent": pct(v)} for k, v in snr_bins.items()}}


def calculate_load(aps, devices):
    if not aps:
        return {"aps": [], "devices_total": len(devices),
                "warnings": [{"type": "error", "text": "Нет точек доступа"}]}
    ap_stats = []
    for ap in aps:
        ap_stats.append({
            "ap_id": ap["id"], "ap_name": ap["name"],
            "band": ap.get("band", "5"),
            "max_throughput": AP_THROUGHPUT.get(ap.get("band", "5"), 300),
            "max_clients": 30, "clients": [],
            "assigned_count": 0, "total_speed_mbps": 0.0,
            "utilization_percent": 0.0,
        })
    for d in devices:
        profile = DEVICE_PROFILES.get(d.get("type"), {"speed_mbps": 10})
        best = None
        for i, ap in enumerate(aps):
            dx = d["x"] - ap["x"]; dy = d["y"] - ap["y"]
            dist = math.sqrt(dx * dx + dy * dy)
            if best is None or dist < best["dist"]:
                best = {"index": i, "dist": dist}
        if best is None:
            continue
        st = ap_stats[best["index"]]
        st["clients"].append({"id": d.get("id"), "name": d.get("name"),
                              "type": d.get("type"),
                              "distance_m": round(best["dist"], 2),
                              "speed_mbps": profile["speed_mbps"]})
        st["assigned_count"] += 1
        st["total_speed_mbps"] += profile["speed_mbps"]
    warnings = []
    total_devices = 0
    total_capacity = 0
    total_load = 0.0
    for st in ap_stats:
        st["total_speed_mbps"] = round(st["total_speed_mbps"], 1)
        st["utilization_percent"] = round(
            st["total_speed_mbps"] / st["max_throughput"] * 100, 1) if st["max_throughput"] else 0
        total_devices += st["assigned_count"]
        total_capacity += st["max_throughput"]
        total_load += st["total_speed_mbps"]
        if st["assigned_count"] > st["max_clients"]:
            warnings.append({"type": "error", "ap": st["ap_name"],
                "text": f"AP {st['ap_name']} обслуживает {st['assigned_count']} "
                        f"клиентов (лимит {st['max_clients']})"})
        if st["utilization_percent"] >= 80:
            warnings.append({"type": "error", "ap": st["ap_name"],
                "text": f"AP {st['ap_name']} загружена на {st['utilization_percent']}%"})
        elif st["utilization_percent"] >= 60:
            warnings.append({"type": "warning", "ap": st["ap_name"],
                "text": f"AP {st['ap_name']} загружена на {st['utilization_percent']}%"})
    total_utilization = round(total_load / total_capacity * 100, 1) if total_capacity else 0
    if not warnings:
        warnings.append({"type": "ok", "ap": None,
            "text": f"Все AP в норме. Общая загрузка: {total_utilization}%"})
    return {"aps": ap_stats, "devices_total": total_devices,
            "total_capacity_mbps": total_capacity,
            "total_load_mbps": round(total_load, 1),
            "total_utilization_percent": total_utilization,
            "warnings": warnings}


def _heatmap_coverage_percent(width_m, height_m, aps, walls,
                              grid_size_m=1.0, target_rssi=-70.0):
    cols = int(width_m / grid_size_m) + 1
    rows = int(height_m / grid_size_m) + 1
    total = cols * rows
    covered = 0
    for r in range(rows):
        for c in range(cols):
            x = c * grid_size_m
            y = r * grid_size_m
            if calculate_best_rssi(aps, x, y, walls) >= target_rssi:
                covered += 1
    return round(covered / total * 100, 1) if total else 0.0


def _find_weakest_point(width_m, height_m, aps, walls, grid_size_m=1.0):
    cols = int(width_m / grid_size_m) + 1
    rows = int(height_m / grid_size_m) + 1
    worst = {"rssi": 0, "x": 0, "y": 0}
    for r in range(rows):
        for c in range(cols):
            x = c * grid_size_m
            y = r * grid_size_m
            rssi = calculate_best_rssi(aps, x, y, walls)
            if rssi < worst["rssi"]:
                worst = {"rssi": round(rssi, 1), "x": x, "y": y}
    return worst


def _hex_grid_positions(width_m, height_m, count):
    if count <= 0:
        return []
    if count == 1:
        return [{"x": width_m / 2, "y": height_m / 2}]
    aspect = width_m / height_m
    cols = max(1, round((count * aspect) ** 0.5))
    rows = max(1, (count + cols - 1) // cols)
    positions = []
    for r in range(rows):
        for c in range(cols):
            if len(positions) >= count:
                break
            offset = (r % 2) * 0.5
            x = (c + 0.5 + offset) * (width_m / cols)
            y = (r + 0.5) * (height_m / rows)
            if x > width_m:
                x = width_m - 0.5
            positions.append({"x": round(x, 2), "y": round(y, 2)})
    return positions


def optimize_placement(width_m, height_m, walls, target_coverage=95.0,
                       target_rssi=-70.0, ap_power=20.0, antenna_gain=6.0,
                       band="5", max_aps=12):
    best = None
    iterations = 0
    for n in range(1, max_aps + 1):
        iterations += 1
        positions = _hex_grid_positions(width_m, height_m, n)
        temp_aps = [{"id": -1, "name": f"AP-{i+1}",
                     "x": pos["x"], "y": pos["y"],
                     "tx_power_dbm": ap_power, "antenna_gain": antenna_gain,
                     "band": band} for i, pos in enumerate(positions)]
        coverage = _heatmap_coverage_percent(width_m, height_m, temp_aps, walls,
                                              target_rssi=target_rssi)
        best = {"recommended_count": n, "positions": positions,
                "coverage_percent": coverage, "target_coverage": target_coverage}
        if coverage >= target_coverage:
            break
    worst = _find_weakest_point(width_m, height_m,
        [{"id": i, "x": p["x"], "y": p["y"],
          "tx_power_dbm": ap_power, "antenna_gain": antenna_gain, "band": band}
         for i, p in enumerate(best["positions"])], walls, grid_size_m=1.0)
    best["worst_point"] = worst
    best["iterations"] = iterations
    best["status"] = ("optimum" if best["coverage_percent"] >= target_coverage
                      else "insufficient")
    return best
def wall_blocks(ap_x, ap_y, px, py, walls):
    """Есть ли стена между AP и точкой (для визуальной обрезки покрытия)."""
    for w in walls:
        if _segments_intersect(
            (ap_x, ap_y), (px, py),
            (w["x1"], w["y1"]), (w["x2"], w["y2"])
        ):
            return True
    return False


def point_visible_from_ap(ap_x, ap_y, px, py, walls, max_walls=1):
    """Видна ли точка из AP. Разрешаем проход через max_walls стен
    (сигнал сильно ослабляется, но не исчезает)."""
    count = 0
    for w in walls:
        if _segments_intersect(
            (ap_x, ap_y), (px, py),
            (w["x1"], w["y1"]), (w["x2"], w["y2"])
        ):
            count += 1
            if count > max_walls:
                return False
    return True
    