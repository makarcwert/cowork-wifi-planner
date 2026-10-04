"""API каталога моделей AP (без авторизации)."""
from fastapi import APIRouter
from ..ap_catalog import AP_CATALOG

router = APIRouter()


@router.get("/")
def get_catalog():
    return AP_CATALOG


@router.get("/vendors")
def get_vendors():
    return sorted(set(item["vendor"] for item in AP_CATALOG))


@router.get("/by-vendor/{vendor}")
def get_by_vendor(vendor: str):
    return [item for item in AP_CATALOG
            if item["vendor"].lower() == vendor.lower()]