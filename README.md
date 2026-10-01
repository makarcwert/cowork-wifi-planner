# CoworkWiFi Planner

Программа проверки зоны покрытия Wi-Fi в коворкинге.
Курсовой проект по ПМ.06, специальность 09.02.07.

## Стек
- Python 3.11
- FastAPI + Uvicorn
- SQLAlchemy + SQLite
- Vanilla JS + SVG + Canvas
- JWT-авторизация, 3 роли

## Установка

    pip install -r requirements.txt

## Запуск

    uvicorn app.main:app --reload --port 8000

Открыть: http://localhost:8000

## Первый вход
При первом запуске БД пуста. Зарегистрируйтесь через `/static/login.html` —
первый пользователь автоматически получит роль **admin**.

## API-документация
Swagger UI: http://localhost:8000/docs
ReDoc: http://localhost:8000/redoc

## Роли (Таблица 1 ТЗ)
| Роль | Права |
|---|---|
| admin | Управление пользователями, загрузка планов, настройка, просмотр всех данных |
| engineer | Ввод измерений, построение тепловых карт, работа с планами |
| analyst | Просмотр измерений и карт, экспорт отчётов |

## Структура
- `app/` — backend (FastAPI)
- `static/` — frontend (HTML/CSS/JS)
- `uploads/` — загруженные планы помещений
- `app.db` — SQLite (создаётся автоматически)