"""Регистрация, вход, текущий пользователь."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, AuditLog
from ..schemas import UserCreate, UserOut, TokenOut
from ..security import hash_password, verify_password, create_access_token
from ..deps import get_current_user

router = APIRouter()


@router.post("/register", response_model=UserOut, status_code=201)
def register(data: UserCreate, db: Session = Depends(get_db)):
    """Регистрация. Первый пользователь автоматически становится admin."""
    # Проверка email
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email уже занят")

    # Первый пользователь — админ
    is_first = db.query(User).count() == 0
    role = "admin" if is_first else data.role
    if role not in ("admin", "engineer", "analyst"):
        role = "analyst"

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Аудит
    db.add(AuditLog(user_id=user.id, action="register",
                    entity="user", entity_id=user.id))
    db.commit()
    return user


@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(),
          db: Session = Depends(get_db)):
    """Вход. OAuth2PasswordRequestForm ожидает поля username/password."""
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Пользователь заблокирован")

    user.last_login = datetime.utcnow()
    db.add(AuditLog(user_id=user.id, action="login",
                    entity="user", entity_id=user.id))
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id, "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """Текущий авторизованный пользователь."""
    return current_user