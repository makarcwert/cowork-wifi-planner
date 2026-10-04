"""Pydantic-схемы."""
from datetime import datetime
from typing import Optional
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
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


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


# ---------- Измерения ----------
class MeasurementCreate(BaseModel):
    name: Optional[str] = None
    x: float
    y: float
    rssi: float = -65.0
    snr: Optional[float] = None
    interference: Optional[float] = None
    mode: str = "manual"


class MeasurementOut(MeasurementCreate):
    id: int
    project_id: int
    measured_at: datetime

    class Config:
        from_attributes = True


# ---------- SSID-профили ----------
class SSIDProfileCreate(BaseModel):
    name: str
    type: str = "corporate"
    auth_method: str = "RADIUS"
    encryption: str = "WPA2-Enterprise"
    vlan_id: Optional[int] = None
    client_isolation: bool = False
    access_to_internal: bool = False
    access_to_internet: bool = True
    captive_portal: bool = False
    bandwidth_limit_mbps: Optional[float] = None
    description: Optional[str] = None


class SSIDProfileOut(SSIDProfileCreate):
    id: int
    project_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- WLC ----------
class WLCCreate(BaseModel):
    name: str = "WLC-01"
    model: Optional[str] = None
    ip_address: Optional[str] = None
    location: Optional[str] = None
    load_balancing: bool = True
    band_steering: bool = True
    fast_roaming_802_11r: bool = True
    roaming_802_11k: bool = True
    roaming_802_11v: bool = True
    auto_channel: bool = True
    auto_power: bool = True
    nms_enabled: bool = True
    nms_poll_interval_sec: int = 60
    firmware_auto_update: bool = False
    description: Optional[str] = None


class WLCOut(WLCCreate):
    id: int
    project_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- PoE-коммутаторы ----------
class PoESwitchCreate(BaseModel):
    name: str
    model: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    total_power_budget_w: float = 370.0
    total_ports: int = 24
    poe_ports: int = 24
    location: Optional[str] = None


class PoESwitchOut(PoESwitchCreate):
    id: int
    project_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Запрос тепловой карты ----------
class HeatmapRequest(BaseModel):
    grid_size_m: float = 0.5