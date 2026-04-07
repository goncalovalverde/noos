# Nóos

Plataforma de evaluación neuropsicológica para Triune Neuropsicología.

## Stack
- **Backend**: FastAPI + SQLAlchemy + SQLite
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS

## Arrancar en desarrollo

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Documentación
- [`SPEC.md`](./SPEC.md) — Especificación completa del proyecto
- [`design-references/`](./design-references/) — Mockups HTML de referencia visual

## Roles
| Rol | Descripción |
|-----|-------------|
| Administrador | Gestión completa del sistema |
| Neuropsicólogo | Evaluaciones y gestión de pacientes |
| Observador | Solo lectura |
