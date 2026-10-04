"""Точка входа FastAPI (без авторизации)."""
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from . import models  # noqa: F401
from .routes import (auth, users, projects, admin, measurements,
                     reports, ssid, infrastructure, ap_catalog)

Base.metadata.create_all(bind=engine)
os.makedirs("uploads", exist_ok=True)

app = FastAPI(title="CoworkWiFi Planner API", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,           prefix="/api/auth",         tags=["auth"])
app.include_router(users.router,          prefix="/api/users",        tags=["users"])
app.include_router(projects.router,       prefix="/api/projects",     tags=["projects"])
app.include_router(measurements.router,   prefix="/api/measurements", tags=["measurements"])
app.include_router(reports.router,        prefix="/api/reports",      tags=["reports"])
app.include_router(ssid.router,           prefix="/api/ssid",         tags=["ssid"])
app.include_router(infrastructure.router, prefix="/api/infra",        tags=["infra"])
app.include_router(admin.router,          prefix="/api/admin",        tags=["admin"])
app.include_router(ap_catalog.router,     prefix="/api/ap-models",    tags=["ap-models"])

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}