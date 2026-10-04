"""Панель администратора: метрики, проекты, аудит (без авторизации)."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    User, Project, PlanElement, ClientDevice, AccessPoint, AuditLog,
)

router = APIRouter()


@router.get("/metrics")
def get_metrics(db: Session = Depends(get_db)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    admins = db.query(User).filter(User.role == "admin").count()
    engineers = db.query(User).filter(User.role == "engineer").count()
    analysts = db.query(User).filter(User.role == "analyst").count()
    new_today = db.query(User).filter(User.created_at >= today).count()

    total_projects = db.query(Project).count()
    projects_today = db.query(Project).filter(Project.created_at >= today).count()

    total_elements = db.query(PlanElement).count()
    total_devices = db.query(ClientDevice).count()
    total_aps = db.query(AccessPoint).count()

    regs_7d, projects_7d = [], []
    for i in range(6, -1, -1):
        d0 = (datetime.utcnow() - timedelta(days=i)).replace(
            hour=0, minute=0, second=0, microsecond=0)
        d1 = d0 + timedelta(days=1)
        regs_7d.append({
            "label": d0.strftime("%d.%m"),
            "count": db.query(User).filter(
                User.created_at >= d0, User.created_at < d1).count(),
        })
        projects_7d.append({
            "label": d0.strftime("%d.%m"),
            "count": db.query(Project).filter(
                Project.created_at >= d0, Project.created_at < d1).count(),
        })

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "by_role": {"admin": admins, "engineer": engineers,
                        "analyst": analysts},
            "new_today": new_today,
        },
        "projects": {"total": total_projects, "today": projects_today},
        "elements": {"total": total_elements},
        "devices": {"total": total_devices},
        "aps": {"total": total_aps},
        "registrations_7d": regs_7d,
        "projects_7d": projects_7d,
    }


@router.get("/projects")
def list_all_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.id.desc()).all()
    result = []
    for p in projects:
        owner = db.query(User).get(p.owner_id) if p.owner_id else None
        result.append({
            "id": p.id, "name": p.name,
            "width_m": p.width_m, "height_m": p.height_m,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "owner_id": p.owner_id,
            "owner_email": owner.email if owner else None,
            "owner_name": owner.full_name if owner else None,
            "elements_count": db.query(PlanElement).filter(
                PlanElement.project_id == p.id).count(),
            "devices_count": db.query(ClientDevice).filter(
                ClientDevice.project_id == p.id).count(),
            "aps_count": db.query(AccessPoint).filter(
                AccessPoint.project_id == p.id).count(),
        })
    return result


@router.get("/audit-log")
def get_audit_log(limit: int = 100, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
    result = []
    for log in logs:
        u = db.query(User).get(log.user_id) if log.user_id else None
        result.append({
            "id": log.id, "user_id": log.user_id,
            "user_email": u.email if u else None,
            "user_name": u.full_name if u else None,
            "action": log.action, "entity": log.entity,
            "entity_id": log.entity_id,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    return result