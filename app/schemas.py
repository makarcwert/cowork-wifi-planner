"""Pydantic-схемы."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# ---------- Пользователи ----------
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    role: str = "analyst"


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Проекты ----------
class ProjectCreate(BaseModel):
    name: str
    width_m: float = 30.0
    height_m: float = 20.0


class ProjectOut(BaseModel):
    id: int
    name: str
    width_m: float
    height_m: float
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Элементы ----------
class PlanElementCreate(BaseModel):
    type: str
    material: Optional[str] = None
    subtype: Optional[str] = None
    x1: Optional[float] = None
    y1: Optional[float] = None
    x2: Optional[float] = None
    y2: Optional[float] = None
    x: Optional[float] = None
    y: Optional[float] = None
    name: Optional[str] = None
    points_json: Optional[str] = None
    width: Optional[float] = None
    height: Optional[float] = None
    rotation: float = 0


class PlanElementOut(PlanElementCreate):
    id: int
    project_id: int

    class Config:
        from_attributes = True


# ---------- Устройства ----------
class ClientDeviceCreate(BaseModel):
    name: str
    type: str
    x: float
    y: float
    band: str = "5"
    required_rssi: float = -65.0
    required_speed: float = 10.0
    ssid_type: str = "corporate"


class ClientDeviceOut(ClientDeviceCreate):
    id: int
    project_id: int

    class Config:
        from_attributes = True


# ---------- Точки доступа ----------
class AccessPointCreate(BaseModel):
    name: str
    model: Optional[str] = None
    x: float
    y: float
    tx_power_dbm: float = 20.0
    antenna_gain: float = 6.0
    band: str = "5"
    channel: int = 44
    ssid_type: str = "corporate"


class AccessPointOut(AccessPointCreate):
    id: int
    project_id: int

    class Config:
        from_attributes = True