"""Проекты и всё, что внутри них."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    User, Project, PlanElement, ClientDevice, AccessPoint, AuditLog,
)
from ..schemas import (
    ProjectCreate, ProjectOut,
    PlanElementCreate, PlanElementOut,
    ClientDeviceCreate, ClientDeviceOut,
    AccessPointCreate, AccessPointOut,
)
from ..deps import get_current_user, require_role

router = APIRouter()


# ============================================================
# Проекты
# ============================================================

@router.get("/", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db),
                  _: User = Depends(get_current_user)):
    return db.query(Project).order_by(Project.id.desc()).all()


@router.post("/", response_model=ProjectOut, status_code=201)
def create_project(data: ProjectCreate, db: Session = Depends(get_db),
                   user: User = Depends(require_role("admin", "engineer"))):
    p = Project(name=data.name, width_m=data.width_m,
                height_m=data.height_m, owner_id=user.id)
    db.add(p)
    db.commit()
    db.refresh(p)
    db.add(AuditLog(user_id=user.id, action="create_project",
                    entity="project", entity_id=p.id))
    db.commit()
    return p


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db),
                _: User = Depends(get_current_user)):
    p = db.query(Project).get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return p


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, data: ProjectCreate,
                   db: Session = Depends(get_db),
                   _: User = Depends(require_role("admin", "engineer"))):
    p = db.query(Project).get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Проект не найден")
    p.name = data.name
    p.width_m = data.width_m
    p.height_m = data.height_m
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db),
                   user: User = Depends(require_role("admin", "engineer"))):
    p = db.query(Project).get(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Проект не найден")
    db.delete(p)
    db.add(AuditLog(user_id=user.id, action="delete_project",
                    entity="project", entity_id=project_id))
    db.commit()


# ============================================================
# Элементы
# ============================================================

@router.get("/{project_id}/elements", response_model=list[PlanElementOut])
def list_elements(project_id: int, db: Session = Depends(get_db),
                  _: User = Depends(get_current_user)):
    return db.query(PlanElement).filter(PlanElement.project_id == project_id).all()


@router.post("/{project_id}/elements", response_model=PlanElementOut, status_code=201)
def create_element(project_id: int, data: PlanElementCreate,
                   db: Session = Depends(get_db),
                   _: User = Depends(require_role("admin", "engineer"))):
    if not db.query(Project).get(project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    el = PlanElement(project_id=project_id, **data.dict())
    db.add(el)
    db.commit()
    db.refresh(el)
    return el


@router.put("/elements/{el_id}", response_model=PlanElementOut)
def update_element(el_id: int, data: PlanElementCreate,
                   db: Session = Depends(get_db),
                   _: User = Depends(require_role("admin", "engineer"))):
    el = db.query(PlanElement).get(el_id)
    if not el:
        raise HTTPException(status_code=404, detail="Элемент не найден")
    for k, v in data.dict().items():
        setattr(el, k, v)
    db.commit()
    db.refresh(el)
    return el


@router.delete("/elements/{el_id}", status_code=204)
def delete_element(el_id: int, db: Session = Depends(get_db),
                   _: User = Depends(require_role("admin", "engineer"))):
    el = db.query(PlanElement).get(el_id)
    if not el:
        raise HTTPException(status_code=404, detail="Элемент не найден")
    db.delete(el)
    db.commit()


# ============================================================
# Устройства
# ============================================================

@router.get("/{project_id}/devices", response_model=list[ClientDeviceOut])
def list_devices(project_id: int, db: Session = Depends(get_db),
                 _: User = Depends(get_current_user)):
    return db.query(ClientDevice).filter(ClientDevice.project_id == project_id).all()


@router.post("/{project_id}/devices", response_model=ClientDeviceOut, status_code=201)
def create_device(project_id: int, data: ClientDeviceCreate,
                  db: Session = Depends(get_db),
                  _: User = Depends(require_role("admin", "engineer"))):
    if not db.query(Project).get(project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    d = ClientDevice(project_id=project_id, **data.dict())
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@router.put("/devices/{dev_id}", response_model=ClientDeviceOut)
def update_device(dev_id: int, data: ClientDeviceCreate,
                  db: Session = Depends(get_db),
                  _: User = Depends(require_role("admin", "engineer"))):
    d = db.query(ClientDevice).get(dev_id)
    if not d:
        raise HTTPException(status_code=404, detail="Устройство не найдено")
    for k, v in data.dict().items():
        setattr(d, k, v)
    db.commit()
    db.refresh(d)
    return d


@router.delete("/devices/{dev_id}", status_code=204)
def delete_device(dev_id: int, db: Session = Depends(get_db),
                  _: User = Depends(require_role("admin", "engineer"))):
    d = db.query(ClientDevice).get(dev_id)
    if not d:
        raise HTTPException(status_code=404, detail="Устройство не найдено")
    db.delete(d)
    db.commit()


# ============================================================
# Точки доступа
# ============================================================

@router.get("/{project_id}/aps", response_model=list[AccessPointOut])
def list_aps(project_id: int, db: Session = Depends(get_db),
             _: User = Depends(get_current_user)):
    return db.query(AccessPoint).filter(AccessPoint.project_id == project_id).all()


@router.post("/{project_id}/aps", response_model=AccessPointOut, status_code=201)
def create_ap(project_id: int, data: AccessPointCreate,
              db: Session = Depends(get_db),
              _: User = Depends(require_role("admin", "engineer"))):
    if not db.query(Project).get(project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    ap = AccessPoint(project_id=project_id, **data.dict())
    db.add(ap)
    db.commit()
    db.refresh(ap)
    return ap


@router.put("/aps/{ap_id}", response_model=AccessPointOut)
def update_ap(ap_id: int, data: AccessPointCreate,
              db: Session = Depends(get_db),
              _: User = Depends(require_role("admin", "engineer"))):
    ap = db.query(AccessPoint).get(ap_id)
    if not ap:
        raise HTTPException(status_code=404, detail="Точка не найдена")
    for k, v in data.dict().items():
        setattr(ap, k, v)
    db.commit()
    db.refresh(ap)
    return ap


@router.delete("/aps/{ap_id}", status_code=204)
def delete_ap(ap_id: int, db: Session = Depends(get_db),
              _: User = Depends(require_role("admin", "engineer"))):
    ap = db.query(AccessPoint).get(ap_id)
    if not ap:
        raise HTTPException(status_code=404, detail="Точка не найдена")
    db.delete(ap)
    db.commit()