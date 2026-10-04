"""SSID-профили (п. 7.2.4 ТЗ)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Project, SSIDProfile, AuditLog
from ..schemas import SSIDProfileCreate, SSIDProfileOut
from ..deps import get_current_user, require_role

router = APIRouter()


@router.get("/templates")
def get_templates(_: User = Depends(get_current_user)):
    return [
        {"name": "Corporate", "type": "corporate",
         "auth_method": "RADIUS", "encryption": "WPA3-Enterprise",
         "vlan_id": 10, "client_isolation": False,
         "access_to_internal": True, "access_to_internet": True,
         "captive_portal": False, "bandwidth_limit_mbps": None,
         "description": "Для сотрудников и резидентов. RADIUS, WPA3-Enterprise."},
        {"name": "Guest", "type": "guest",
         "auth_method": "Captive Portal", "encryption": "Open",
         "vlan_id": 20, "client_isolation": True,
         "access_to_internal": False, "access_to_internet": True,
         "captive_portal": True, "bandwidth_limit_mbps": 10,
         "description": "Для посетителей. Изоляция, только интернет."},
        {"name": "IoT", "type": "iot",
         "auth_method": "WPA2-PSK", "encryption": "WPA2-PSK",
         "vlan_id": 30, "client_isolation": False,
         "access_to_internal": False, "access_to_internet": True,
         "captive_portal": False, "bandwidth_limit_mbps": 5,
         "description": "Для принтеров, камер и датчиков."},
    ]


@router.get("/{project_id}", response_model=list[SSIDProfileOut])
def list_ssid(project_id: int, db: Session = Depends(get_db),
              _: User = Depends(get_current_user)):
    return db.query(SSIDProfile).filter(SSIDProfile.project_id == project_id).all()


@router.post("/{project_id}", response_model=SSIDProfileOut, status_code=201)
def create_ssid(project_id: int, data: SSIDProfileCreate,
                db: Session = Depends(get_db),
                user: User = Depends(require_role("admin", "engineer"))):
    if not db.query(Project).get(project_id):
        raise HTTPException(status_code=404, detail="Проект не найден")
    s = SSIDProfile(project_id=project_id, **data.dict())
    db.add(s)
    db.commit()
    db.refresh(s)
    db.add(AuditLog(user_id=user.id, action="create_ssid",
                    entity="ssid_profile", entity_id=s.id))
    db.commit()
    return s


@router.put("/item/{ssid_id}", response_model=SSIDProfileOut)
def update_ssid(ssid_id: int, data: SSIDProfileCreate,
                db: Session = Depends(get_db),
                _: User = Depends(require_role("admin", "engineer"))):
    s = db.query(SSIDProfile).get(ssid_id)
    if not s:
        raise HTTPException(status_code=404, detail="Профиль не найден")
    for k, v in data.dict().items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/item/{ssid_id}", status_code=204)
def delete_ssid(ssid_id: int, db: Session = Depends(get_db),
                _: User = Depends(require_role("admin", "engineer"))):
    s = db.query(SSIDProfile).get(ssid_id)
    if not s:
        raise HTTPException(status_code=404, detail="Профиль не найден")
    db.delete(s)
    db.commit()