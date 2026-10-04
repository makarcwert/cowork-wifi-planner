"""API каталога моделей AP."""
from fastapi import APIRouter, Depends
from ..deps import get_current_user
from ..models import User
from ..ap_catalog import AP_CATALOG

router = APIRouter()


@router.get("/")
def get_catalog(_: User = Depends(get_current_user)):
    return AP_CATALOG


@router.get("/vendors")
def get_vendors(_: User = Depends(get_current_user)):
    return sorted(set(item["vendor"] for item in AP_CATALOG))


@router.get("/by-vendor/{vendor}")
def get_by_vendor(vendor: str, _: User = Depends(get_current_user)):
    return [item for item in AP_CATALOG if item["vendor"].lower() == vendor.lower()]