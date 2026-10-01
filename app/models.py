"""SQLAlchemy-модели."""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text
)
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(120), nullable=False)
    role = Column(String(20), nullable=False, default="analyst")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)


class Project(Base):
    """Проект помещения. Пользователь задаёт название и размеры."""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    width_m = Column(Float, nullable=False, default=30.0)
    height_m = Column(Float, nullable=False, default=20.0)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    elements = relationship("PlanElement", back_populates="project",
                            cascade="all, delete-orphan")
    devices = relationship("ClientDevice", back_populates="project",
                           cascade="all, delete-orphan")
    aps = relationship("AccessPoint", back_populates="project",
                       cascade="all, delete-orphan")


class PlanElement(Base):
    """Стены, двери, окна, мебель, текст, комнаты.

    type: wall | door | window | furniture | text | room
    material: concrete | brick | drywall | wood | glass
    subtype: sofa | table | chair | plant (для мебели)
    """
    __tablename__ = "plan_elements"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    type = Column(String(20), nullable=False)
    material = Column(String(20), nullable=True)
    subtype = Column(String(30), nullable=True)
    # Линия / точка
    x1 = Column(Float, nullable=True)
    y1 = Column(Float, nullable=True)
    x2 = Column(Float, nullable=True)
    y2 = Column(Float, nullable=True)
    x = Column(Float, nullable=True)
    y = Column(Float, nullable=True)
    # Текст
    name = Column(String(200), nullable=True)
    # Комната: список точек в JSON
    points_json = Column(Text, nullable=True)
    width = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    rotation = Column(Float, default=0)
    meta = Column(Text, nullable=True)

    project = relationship("Project", back_populates="elements")


class ClientDevice(Base):
    """Клиентские устройства."""
    __tablename__ = "client_devices"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(80), nullable=False)
    type = Column(String(20), nullable=False)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    band = Column(String(10), default="5")
    required_rssi = Column(Float, default=-65.0)
    required_speed = Column(Float, default=10.0)
    ssid_type = Column(String(20), default="corporate")
    meta = Column(Text, nullable=True)

    project = relationship("Project", back_populates="devices")


class AccessPoint(Base):
    """Точка доступа."""
    __tablename__ = "access_points"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(50), nullable=False)
    model = Column(String(120), nullable=True)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    tx_power_dbm = Column(Float, default=20.0)
    antenna_gain = Column(Float, default=6.0)
    band = Column(String(10), default="5")
    channel = Column(Integer, default=44)
    ssid_type = Column(String(20), default="corporate")

    project = relationship("Project", back_populates="aps")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(50), nullable=False)
    entity = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)