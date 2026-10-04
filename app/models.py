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
    measurements = relationship("Measurement", back_populates="project",
                                cascade="all, delete-orphan")
    ssid_profiles = relationship("SSIDProfile", back_populates="project",
                                 cascade="all, delete-orphan")
    wlc = relationship("WLC", back_populates="project",
                       cascade="all, delete-orphan", uselist=False)
    switches = relationship("PoESwitch", back_populates="project",
                            cascade="all, delete-orphan")
    cable_runs = relationship("CableRun", back_populates="project",
                              cascade="all, delete-orphan")


class PlanElement(Base):
    __tablename__ = "plan_elements"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    type = Column(String(20), nullable=False)
    material = Column(String(20), nullable=True)
    subtype = Column(String(30), nullable=True)
    x1 = Column(Float, nullable=True)
    y1 = Column(Float, nullable=True)
    x2 = Column(Float, nullable=True)
    y2 = Column(Float, nullable=True)
    x = Column(Float, nullable=True)
    y = Column(Float, nullable=True)
    name = Column(String(200), nullable=True)
    points_json = Column(Text, nullable=True)
    width = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    rotation = Column(Float, default=0)
    meta = Column(Text, nullable=True)

    project = relationship("Project", back_populates="elements")


class ClientDevice(Base):
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


class Measurement(Base):
    __tablename__ = "measurements"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String(80), nullable=True)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    rssi = Column(Float, nullable=False, default=-65.0)
    snr = Column(Float, nullable=True)
    interference = Column(Float, nullable=True)
    mode = Column(String(10), default="manual")
    measured_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="measurements")


class SSIDProfile(Base):
    __tablename__ = "ssid_profiles"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(60), nullable=False)
    type = Column(String(20), nullable=False, default="corporate")
    auth_method = Column(String(30), default="RADIUS")
    encryption = Column(String(30), default="WPA2-Enterprise")
    vlan_id = Column(Integer, nullable=True)
    client_isolation = Column(Boolean, default=False)
    access_to_internal = Column(Boolean, default=False)
    access_to_internet = Column(Boolean, default=True)
    captive_portal = Column(Boolean, default=False)
    bandwidth_limit_mbps = Column(Float, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="ssid_profiles")


class WLC(Base):
    __tablename__ = "wlc"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(80), nullable=False, default="WLC-01")
    model = Column(String(120), nullable=True)
    ip_address = Column(String(45), nullable=True)
    location = Column(String(120), nullable=True)
    load_balancing = Column(Boolean, default=True)
    band_steering = Column(Boolean, default=True)
    fast_roaming_802_11r = Column(Boolean, default=True)
    roaming_802_11k = Column(Boolean, default=True)
    roaming_802_11v = Column(Boolean, default=True)
    auto_channel = Column(Boolean, default=True)
    auto_power = Column(Boolean, default=True)
    nms_enabled = Column(Boolean, default=True)
    nms_poll_interval_sec = Column(Integer, default=60)
    firmware_auto_update = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="wlc")


class PoESwitch(Base):
    __tablename__ = "poe_switches"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(80), nullable=False)
    model = Column(String(120), nullable=True)
    x = Column(Float, nullable=True)
    y = Column(Float, nullable=True)
    total_power_budget_w = Column(Float, default=370.0)
    total_ports = Column(Integer, default=24)
    poe_ports = Column(Integer, default=24)
    location = Column(String(120), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="switches")


class CableRun(Base):
    __tablename__ = "cable_runs"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    from_type = Column(String(20), nullable=False)
    from_id = Column(Integer, nullable=True)
    from_x = Column(Float, nullable=True)
    from_y = Column(Float, nullable=True)
    to_type = Column(String(20), nullable=False)
    to_id = Column(Integer, nullable=True)
    to_x = Column(Float, nullable=True)
    to_y = Column(Float, nullable=True)
    cable_type = Column(String(20), default="Cat5e")
    length_m = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="cable_runs")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(50), nullable=False)
    entity = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)