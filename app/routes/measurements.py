"""Измерения, покрытие, SNR, интерференция, нагрузка, оптимизация."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import math

from ..database import get_db
from ..models import (
    Project, PlanElement, AccessPoint, Measurement, ClientDevice, PoESwitch,
)
from ..schemas import MeasurementCreate, MeasurementOut, HeatmapRequest
from ..physics import (
    calculate_heatmap, calculate_rssi,
    calculate_interference_map, analyze_channels,
    calculate_snr_map, coverage_statistics,
    calculate_load, optimize_placement,
)

router = APIRouter()


def _load_aps(db, project_id):
    aps = db.query(AccessPoint).filter(
        AccessPoint.project_id == project_id
    ).all()
    return [{"id": ap.id, "name": ap.name, "x": ap.x, "y": ap.y,
             "tx_power_dbm": ap.tx_power_dbm,
             "antenna_gain": ap.antenna_gain,
             "band": ap.band, "channel": ap.channel} for ap in aps]


def _load_walls(db, project_id):
    els = db.query(PlanElement).filter(
        PlanElement.project_id == project_id,
        PlanElement.type.in_(["wall", "door", "window"])
    ).all()
    return [{"x1": el.x1, "y1": el.y1, "x2": el.x2, "y2": el.y2,
             "material": el.material or "concrete",
             "type": el.type} for el in els]


# ============================================================
# Тепловые карты и расчёты
# ============================================================

@router.post("/{project_id}/preview")
def preview_heatmap(project_id: int, req: HeatmapRequest,
                    db: Session = Depends(get_db)):
    p = db.query(Project).get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Проект не найден")
    aps = _load_aps(db, project_id)
    walls = _load_walls(db, project_id)
    if not aps:
        raise HTTPException(status_code=400, detail="Нет точек доступа")
    grid_size = max(0.25, min(2.0, req.grid_size_m))
    result = calculate_heatmap(p.width_m, p.height_m, aps, walls, grid_size)
    result["aps"] = aps
    result["walls_count"] = len(walls)
    return result


@router.post("/{project_id}/calculate")
def calculate_at_point(project_id: int, x: float, y: float,
                       db: Session = Depends(get_db)):
    aps = _load_aps(db, project_id)
    walls = _load_walls(db, project_id)
    if not aps:
        raise HTTPException(status_code=400, detail="Нет точек доступа")
    results = []
    best = None
    for ap in aps:
        rssi = calculate_rssi(ap, x, y, walls)
        results.append({"ap_id": ap["id"], "ap_name": ap["name"],
                        "rssi": round(rssi, 1)})
        if best is None or rssi > best["rssi"]:
            best = {"ap_id": ap["id"], "ap_name": ap["name"],
                    "rssi": round(rssi, 1)}
    return {"x": x, "y": y, "best": best, "all": results,
            "noise_floor": -90.0,
            "snr": round(best["rssi"] - (-90.0), 1) if best else None}


@router.post("/{project_id}/interference")
def interference_map(project_id: int, req: HeatmapRequest,
                     db: Session = Depends(get_db)):
    p = db.query(Project).get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Проект не найден")
    aps = _load_aps(db, project_id)
    walls = _load_walls(db, project_id)
    if not aps:
        raise HTTPException(status_code=400, detail="Нет точек доступа")
    grid_size = max(0.25, min(2.0, req.grid_size_m))
    result = calculate_interference_map(p.width_m, p.height_m,
                                        aps, walls, grid_size)
    result["aps"] = aps
    return result


@router.get("/{project_id}/channels")
def channels_report(project_id: int, db: Session = Depends(get_db)):
    aps = _load_aps(db, project_id)
    return analyze_channels(aps)


@router.post("/{project_id}/snr")
def snr_map(project_id: int, req: HeatmapRequest,
            db: Session = Depends(get_db)):
    p = db.query(Project).get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Проект не найден")
    aps = _load_aps(db, project_id)
    walls = _load_walls(db, project_id)
    if not aps:
        raise HTTPException(status_code=400, detail="Нет точек доступа")
    grid_size = max(0.25, min(2.0, req.grid_size_m))
    result = calculate_snr_map(p.width_m, p.height_m, aps, walls, grid_size)
    result["aps"] = aps
    return result


@router.get("/{project_id}/coverage-stats")
def coverage_stats(project_id: int, db: Session = Depends(get_db)):
    p = db.query(Project).get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Проект не найден")
    aps = _load_aps(db, project_id)
    walls = _load_walls(db, project_id)
    if not aps:
        raise HTTPException(status_code=400, detail="Нет точек доступа")
    return coverage_statistics(p.width_m, p.height_m, aps, walls)


@router.get("/{project_id}/load")
def load_analysis(project_id: int, db: Session = Depends(get_db)):
    if not db.query(Project).get(project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    aps = _load_aps(db, project_id)
    devs = db.query(ClientDevice).filter(
        ClientDevice.project_id == project_id
    ).all()
    devices = [{"id": d.id, "name": d.name, "type": d.type,
                "x": d.x, "y": d.y,
                "required_rssi": d.required_rssi,
                "required_speed": d.required_speed} for d in devs]
    return calculate_load(aps, devices)


@router.post("/{project_id}/optimize-placement")
def optimize_ap_placement(project_id: int,
                          target_coverage: float = 95.0,
                          target_rssi: float = -70.0,
                          ap_power: float = 20.0,
                          band: str = "5",
                          db: Session = Depends(get_db)):
    p = db.query(Project).get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Проект не найден")
    walls = _load_walls(db, project_id)
    return optimize_placement(p.width_m, p.height_m, walls,
                              target_coverage=target_coverage,
                              target_rssi=target_rssi,
                              ap_power=ap_power, band=band)


@router.post("/{project_id}/apply-placement")
def apply_placement(project_id: int, positions: list[dict],
                    db: Session = Depends(get_db)):
    p = db.query(Project).get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Проект не найден")
    existing = db.query(AccessPoint).filter(
        AccessPoint.project_id == project_id).count()
    created = []
    for i, pos in enumerate(positions):
        ap = AccessPoint(
            project_id=project_id,
            name=f"AP-{existing + i + 1:02d}",
            model="Auto-placed",
            x=float(pos.get("x", 0)),
            y=float(pos.get("y", 0)),
            tx_power_dbm=20.0, antenna_gain=6.0,
            band="5", channel=36 + (i % 8) * 4,
            ssid_type="corporate",
        )
        db.add(ap)
        db.commit()
        db.refresh(ap)
        created.append({"id": ap.id, "name": ap.name, "x": ap.x, "y": ap.y})
    return {"created": created, "count": len(created)}


# ============================================================
# CRUD измерений
# ============================================================

@router.get("/{project_id}", response_model=list[MeasurementOut])
def list_measurements(project_id: int, db: Session = Depends(get_db)):
    return db.query(Measurement).filter(
        Measurement.project_id == project_id
    ).order_by(Measurement.id.desc()).all()


@router.post("/{project_id}",
             response_model=MeasurementOut, status_code=201)
def create_measurement(project_id: int, data: MeasurementCreate,
                       db: Session = Depends(get_db)):
    if not db.query(Project).get(project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    m = Measurement(project_id=project_id, user_id=None, **data.dict())
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.put("/{measurement_id}/update", response_model=MeasurementOut)
def update_measurement(measurement_id: int, data: MeasurementCreate,
                       db: Session = Depends(get_db)):
    m = db.query(Measurement).get(measurement_id)
    if not m:
        raise HTTPException(status_code=404, detail="Измерение не найдено")
    for k, v in data.dict().items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/{measurement_id}", status_code=204)
def delete_measurement(measurement_id: int, db: Session = Depends(get_db)):
    m = db.query(Measurement).get(measurement_id)
    if not m:
        raise HTTPException(status_code=404, detail="Измерение не найдено")
    db.delete(m)
    db.commit()


# ============================================================
# Подключение устройств к коммутаторам
# ============================================================

@router.get("/{project_id}/device-connections")
def device_connections(project_id: int, db: Session = Depends(get_db)):
    """Связи «устройство → ближайший коммутатор»."""
    if not db.query(Project).get(project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")

    switches = db.query(PoESwitch).filter(
        PoESwitch.project_id == project_id).all()
    devices = db.query(ClientDevice).filter(
        ClientDevice.project_id == project_id).all()
    aps = db.query(AccessPoint).filter(
        AccessPoint.project_id == project_id).all()

    devices = [d for d in devices if d.x is not None and d.y is not None]
    aps = [a for a in aps if a.x is not None and a.y is not None]

    if not switches:
        return {"links": [], "warnings": [
            {"type": "error", "text": "Нет коммутаторов — устройства подключить некуда."}
        ]}

    valid_switches = [s for s in switches if s.x is not None and s.y is not None]
    if not valid_switches:
        return {"links": [], "warnings": [
            {"type": "error", "text": "У коммутаторов не заданы координаты."}
        ]}

    sw_load = {sw.id: {"switch": sw, "used_ports": 0,
                       "total_ports": sw.poe_ports or sw.total_ports or 24}
               for sw in valid_switches}

    links = []
    warnings = []

    all_endpoints = []
    for ap in aps:
        all_endpoints.append({"kind": "ap", "id": ap.id, "name": ap.name,
                              "x": ap.x, "y": ap.y})
    for d in devices:
        all_endpoints.append({"kind": "device", "id": d.id, "name": d.name,
                              "x": d.x, "y": d.y, "type": d.type})

    for ep in all_endpoints:
        best = None
        for sw in valid_switches:
            if sw_load[sw.id]["used_ports"] >= sw_load[sw.id]["total_ports"]:
                continue
            dx = ep["x"] - sw.x
            dy = ep["y"] - sw.y
            dist = math.sqrt(dx * dx + dy * dy) * 1.1
            if best is None or dist < best["dist"]:
                best = {"sw": sw, "dist": dist}
        if best is None:
            warnings.append({
                "type": "warning",
                "text": f"{ep['name']}: не хватает портов на коммутаторах",
            })
            continue
        sw_load[best["sw"].id]["used_ports"] += 1
        links.append({
            "from_kind": "switch", "from_id": best["sw"].id,
            "from_name": best["sw"].name,
            "from_x": best["sw"].x, "from_y": best["sw"].y,
            "to_kind": ep["kind"], "to_id": ep["id"],
            "to_name": ep["name"],
            "length_m": round(best["dist"], 1),
            "exceeds_limit": best["dist"] > 100,
        })

    for sw_id, info in sw_load.items():
        if info["used_ports"] >= info["total_ports"]:
            warnings.append({
                "type": "error",
                "text": f"Коммутатор {info['switch'].name} загружен полностью "
                        f"({info['used_ports']}/{info['total_ports']})",
            })

    if not warnings:
        warnings.append({"type": "ok",
                         "text": f"Все {len(links)} устройств подключены к коммутаторам."})

    return {
        "links": links,
        "switches_count": len(valid_switches),
        "devices_count": len(devices),
        "aps_count": len(aps),
        "warnings": warnings,
    }