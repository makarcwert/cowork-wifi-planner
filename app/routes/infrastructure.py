"""Инфраструктура: WLC, PoE-коммутаторы, СКС, спецификация."""
import math
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    User, Project, AccessPoint, WLC, PoESwitch, CableRun, AuditLog,
)
from ..schemas import WLCCreate, WLCOut, PoESwitchCreate, PoESwitchOut
from ..deps import get_current_user, require_role
from ..physics import AP_POWER_CONSUMPTION

router = APIRouter()

CABLE_LIMIT_M = {"Cat5e": 100.0, "Cat6": 100.0, "Cat6a": 100.0}


# ============================================================
# WLC
# ============================================================

@router.get("/{project_id}/wlc", response_model=list[WLCOut])
def list_wlc(project_id: int, db: Session = Depends(get_db),
             _: User = Depends(get_current_user)):
    return db.query(WLC).filter(WLC.project_id == project_id).all()


@router.post("/{project_id}/wlc", response_model=WLCOut, status_code=201)
def create_wlc(project_id: int, data: WLCCreate,
               db: Session = Depends(get_db),
               user: User = Depends(require_role("admin", "engineer"))):
    if not db.query(Project).get(project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    w = WLC(project_id=project_id, **data.dict())
    db.add(w)
    db.commit()
    db.refresh(w)
    db.add(AuditLog(user_id=user.id, action="create_wlc",
                    entity="wlc", entity_id=w.id))
    db.commit()
    return w


@router.put("/wlc/{wlc_id}", response_model=WLCOut)
def update_wlc(wlc_id: int, data: WLCCreate,
               db: Session = Depends(get_db),
               _: User = Depends(require_role("admin", "engineer"))):
    w = db.query(WLC).get(wlc_id)
    if not w:
        raise HTTPException(status_code=404, detail="WLC не найден")
    for k, v in data.dict().items():
        setattr(w, k, v)
    db.commit()
    db.refresh(w)
    return w


@router.delete("/wlc/{wlc_id}", status_code=204)
def delete_wlc(wlc_id: int, db: Session = Depends(get_db),
               _: User = Depends(require_role("admin", "engineer"))):
    w = db.query(WLC).get(wlc_id)
    if not w:
        raise HTTPException(status_code=404, detail="WLC не найден")
    db.delete(w)
    db.commit()


# ============================================================
# Коммутаторы
# ============================================================

@router.get("/{project_id}/switches", response_model=list[PoESwitchOut])
def list_switches(project_id: int, db: Session = Depends(get_db),
                  _: User = Depends(get_current_user)):
    return db.query(PoESwitch).filter(PoESwitch.project_id == project_id).all()


@router.post("/{project_id}/switches", response_model=PoESwitchOut, status_code=201)
def create_switch(project_id: int, data: PoESwitchCreate,
                  db: Session = Depends(get_db),
                  user: User = Depends(require_role("admin", "engineer"))):
    if not db.query(Project).get(project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    s = PoESwitch(project_id=project_id, **data.dict())
    db.add(s)
    db.commit()
    db.refresh(s)
    db.add(AuditLog(user_id=user.id, action="create_switch",
                    entity="poe_switch", entity_id=s.id))
    db.commit()
    return s


@router.put("/switches/{sw_id}", response_model=PoESwitchOut)
def update_switch(sw_id: int, data: PoESwitchCreate,
                  db: Session = Depends(get_db),
                  _: User = Depends(require_role("admin", "engineer"))):
    s = db.query(PoESwitch).get(sw_id)
    if not s:
        raise HTTPException(status_code=404, detail="Коммутатор не найден")
    for k, v in data.dict().items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/switches/{sw_id}", status_code=204)
def delete_switch(sw_id: int, db: Session = Depends(get_db),
                  _: User = Depends(require_role("admin", "engineer"))):
    s = db.query(PoESwitch).get(sw_id)
    if not s:
        raise HTTPException(status_code=404, detail="Коммутатор не найден")
    db.delete(s)
    db.commit()


# ============================================================
# PoE-бюджет
# ============================================================

@router.get("/{project_id}/poe-budget")
def poe_budget(project_id: int, db: Session = Depends(get_db),
               _: User = Depends(get_current_user)):
    if not db.query(Project).get(project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    switches = db.query(PoESwitch).filter(PoESwitch.project_id == project_id).all()
    aps = db.query(AccessPoint).filter(AccessPoint.project_id == project_id).all()
    total_budget = sum(s.total_power_budget_w for s in switches)
    total_poe_ports = sum(s.poe_ports for s in switches)
    ap_loads = []
    total_consumption = 0.0
    for ap in aps:
        watts = AP_POWER_CONSUMPTION.get(ap.band, 15.5)
        total_consumption += watts
        ap_loads.append({"ap_id": ap.id, "ap_name": ap.name,
                         "band": ap.band, "watts": watts})
    warnings = []
    if not switches:
        warnings.append({"type": "error",
                         "text": "Коммутаторы не добавлены."})
    else:
        if total_consumption > total_budget:
            warnings.append({"type": "error",
                "text": f"Превышен PoE-бюджет: нужно {total_consumption:.1f} Вт, "
                        f"доступно {total_budget:.1f} Вт."})
        elif total_consumption > total_budget * 0.8:
            warnings.append({"type": "warning",
                "text": f"PoE-бюджет загружен на "
                        f"{total_consumption/total_budget*100:.0f}%."})
        else:
            warnings.append({"type": "ok",
                "text": f"PoE-бюджет: {total_consumption:.1f} Вт "
                        f"из {total_budget:.1f} Вт."})
        if len(aps) > total_poe_ports:
            warnings.append({"type": "error",
                "text": f"Недостаточно PoE-портов: {len(aps)} AP, "
                        f"доступно {total_poe_ports}."})
    return {"switches_count": len(switches), "aps_count": len(aps),
            "total_budget_w": total_budget,
            "total_consumption_w": round(total_consumption, 1),
            "utilization_percent": round(total_consumption / total_budget * 100, 1)
                                    if total_budget else 0,
            "total_poe_ports": total_poe_ports,
            "ap_loads": ap_loads, "warnings": warnings}


# ============================================================
# СКС
# ============================================================

def _cable_analysis_impl(db, project_id):
    switches = db.query(PoESwitch).filter(PoESwitch.project_id == project_id).all()
    aps = db.query(AccessPoint).filter(AccessPoint.project_id == project_id).all()
    if not switches:
        return {"cables": [], "total_length_m": 0, "cables_count": 0,
                "warnings": [{"type": "error",
                              "text": "Нет коммутаторов для расчёта СКС."}]}
    cables = []
    total_length = 0.0
    warnings = []
    for ap in aps:
        best = None
        for sw in switches:
            if sw.x is None or sw.y is None:
                continue
            dx = ap.x - sw.x
            dy = ap.y - sw.y
            d_real = math.sqrt(dx * dx + dy * dy) * 1.1
            if best is None or d_real < best["length"]:
                best = {"switch": sw, "length": d_real}
        if not best:
            continue
        length = round(best["length"], 1)
        limit = CABLE_LIMIT_M.get("Cat5e", 100)
        cables.append({"ap_id": ap.id, "ap_name": ap.name,
                       "switch_id": best["switch"].id,
                       "switch_name": best["switch"].name,
                       "length_m": length, "limit_m": limit,
                       "ok": length <= limit})
        total_length += length
        if length > limit:
            warnings.append({"type": "error",
                "text": f"Линия до {ap.name} — {length} м "
                        f"(превышает лимит {limit} м)."})
    if not warnings and cables:
        warnings.append({"type": "ok",
            "text": f"Все {len(cables)} кабельных линий в пределах нормы."})
    return {"cables": cables, "total_length_m": round(total_length, 1),
            "cables_count": len(cables), "warnings": warnings}


@router.get("/{project_id}/cable-analysis")
def cable_analysis(project_id: int, db: Session = Depends(get_db),
                   _: User = Depends(get_current_user)):
    if not db.query(Project).get(project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    return _cable_analysis_impl(db, project_id)


# ============================================================
# Спецификация
# ============================================================

@router.get("/{project_id}/specification")
def equipment_specification(project_id: int, db: Session = Depends(get_db),
                            _: User = Depends(get_current_user)):
    p = db.query(Project).get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Проект не найден")
    aps = db.query(AccessPoint).filter(AccessPoint.project_id == project_id).all()
    switches = db.query(PoESwitch).filter(PoESwitch.project_id == project_id).all()
    wlcs = db.query(WLC).filter(WLC.project_id == project_id).all()
    items = []
    for w in wlcs:
        items.append({"category": "Контроллер беспроводной сети",
                      "name": w.name, "model": w.model or "—",
                      "qty": 1, "unit": "шт",
                      "note": f"IP: {w.ip_address or '—'}"})
    ap_models = {}
    for ap in aps:
        key = ap.model or "Generic AP"
        if key not in ap_models:
            ap_models[key] = {"category": "Точка доступа",
                              "name": "Точка доступа Wi-Fi",
                              "model": key, "qty": 0, "unit": "шт",
                              "_bands": set()}
        ap_models[key]["qty"] += 1
        ap_models[key]["_bands"].add(ap.band)
    for m in ap_models.values():
        m["note"] = "Диапазоны: " + ", ".join(sorted(m["_bands"])) + " ГГц"
        del m["_bands"]
        items.append(m)
    for s in switches:
        items.append({"category": "Коммутационное оборудование",
                      "name": s.name, "model": s.model or "—",
                      "qty": 1, "unit": "шт",
                      "note": f"PoE-бюджет {s.total_power_budget_w} Вт, "
                              f"{s.poe_ports}/{s.total_ports} PoE-портов"})
    cables = _cable_analysis_impl(db, project_id)
    if cables.get("total_length_m"):
        total = round(cables["total_length_m"] * 1.1, 1)
        items.append({"category": "Кабельная инфраструктура",
                      "name": "Кабель витая пара", "model": "Cat5e UTP",
                      "qty": total, "unit": "м",
                      "note": f"Для подключения {cables['cables_count']} AP"})
    if switches:
        items.append({"category": "Электропитание",
                      "name": "ИБП для коммутаторов и WLC", "model": "—",
                      "qty": 1, "unit": "шт",
                      "note": "Рекомендуется для отказоустойчивости"})
    return {"project_name": p.name,
            "project_area_m2": round(p.width_m * p.height_m, 1),
            "items": items, "total_positions": len(items)}
    # ============================================================
# Подключение устройств к коммутаторам
# ============================================================

@router.get("/{project_id}/device-connections")
def device_connections(project_id: int, db: Session = Depends(get_db),
                       _: User = Depends(get_current_user)):
    """Связи «устройство → ближайший коммутатор»."""
    if not db.query(Project).get(project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")

    switches = db.query(PoESwitch).filter(
        PoESwitch.project_id == project_id
    ).all()
    devices = db.query(ClientDevice).filter(
        ClientDevice.project_id == project_id
    ).all()
    aps = db.query(AccessPoint).filter(
        AccessPoint.project_id == project_id
    ).all()

    if not switches:
        return {"links": [], "warnings": [
            {"type": "error", "text": "Нет коммутаторов — устройства подключить некуда."}
        ]}

    # Каждое устройство цепляется к ближайшему коммутатору с доступными портами
    sw_load = {}
    for sw in switches:
        sw_load[sw.id] = {
            "switch": sw,
            "used_ports": 0,
            "total_ports": sw.poe_ports or sw.total_ports,
        }

    links = []
    warnings = []

    # AP тоже подключаются к коммутаторам
    all_endpoints = []
    for ap in aps:
        all_endpoints.append({"kind": "ap", "id": ap.id, "name": ap.name,
                              "x": ap.x, "y": ap.y})
    for d in devices:
        all_endpoints.append({"kind": "device", "id": d.id, "name": d.name,
                              "x": d.x, "y": d.y, "type": d.type})

    for ep in all_endpoints:
        # Ищем ближайший коммутатор с местом
        best = None
        for sw in switches:
            if sw.x is None or sw.y is None:
                continue
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
            "from_kind": "switch",
            "from_id": best["sw"].id,
            "from_name": best["sw"].name,
            "from_x": best["sw"].x,
            "from_y": best["sw"].y,
            "to_kind": ep["kind"],
            "to_id": ep["id"],
            "to_name": ep["name"],
            "length_m": round(best["dist"], 1),
            "exceeds_limit": best["dist"] > 100,
        })

    # Предупреждения по перегрузке портов
    for sw_id, info in sw_load.items():
        if info["used_ports"] >= info["total_ports"]:
            warnings.append({
                "type": "error",
                "text": f"Коммутатор {info['switch'].name} загружен полностью "
                        f"({info['used_ports']}/{info['total_ports']})",
            })
        elif info["used_ports"] >= info["total_ports"] * 0.8:
            warnings.append({
                "type": "warning",
                "text": f"Коммутатор {info['switch'].name} загружен на "
                        f"{round(info['used_ports']/info['total_ports']*100)}%",
            })

    # Если проблем нет
    if not warnings:
        warnings.append({"type": "ok",
                         "text": f"Все {len(links)} устройств подключены к коммутаторам."})

    return {
        "links": links,
        "switches_count": len(switches),
        "devices_count": len(devices),
        "aps_count": len(aps),
        "warnings": warnings,
    }