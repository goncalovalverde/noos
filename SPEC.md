# Nóos — Especificación para Construcción desde Cero

> **Instrucciones para Copilot:** Este documento es la especificación completa para construir Nóos desde cero con una nueva arquitectura. Lee TODO el documento antes de empezar a codificar. La aplicación debe ser funcional al 100% siguiendo exactamente la lógica de negocio aquí documentada.

---

## 1. Visión General del Proyecto

**Nóos** es una aplicación clínica para neuropsicólogos que permite:
- Gestionar pacientes de forma anónima (RGPD/LOPD compliant)
- Administrar 19 tests neuropsicológicos estandarizados
- Calcular puntuaciones normativas NEURONORMA (escalar, percentil, clasificación)
- Organizar tests en protocolos reutilizables
- Ejecutar protocolos de forma guiada y secuencial
- Generar informes PDF clínicos
- Visualizar perfil cognitivo con gráficas (radar + barras)
- Registrar auditoría de todas las operaciones (compliance RGPD)
- Gestionar usuarios con control de acceso por roles

**Usuarios objetivo:** Neuropsicólogos. Uso cloud (tablet/desktop), modo clínico, sin distracciones.

---

## 2. Stack Tecnológico

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **ORM:** SQLAlchemy 2.0+
- **Base de datos:** SQLite (archivo `noos.db`)
- **Auth:** JWT (python-jose) + bcrypt (password hashing)
- **PDF:** ReportLab
- **Word (.docx):** python-docx
- **Cálculos:** NumPy, SciPy
- **Servidor:** Uvicorn
- **Variables de entorno:** python-dotenv

### Frontend
- **Framework:** React 18 + Vite
- **Lenguaje:** TypeScript
- **Routing:** React Router v6
- **Estado global:** Zustand (auth store)
- **HTTP Client:** Axios con interceptores JWT
- **Gráficas:** Recharts (radar chart + bar chart)
- **Formularios:** React Hook Form + Zod (validación)
- **UI Components:** shadcn/ui (basado en Radix UI + Tailwind CSS)
- **PDF Download:** fetch blob + `<a download>`
- **Notificaciones:** Sonner (toasts)
- **Idioma UI:** todo en español (ES)

### Estructura de carpetas

```
noos/                         # Carpeta nueva, vacía, sin código anterior
├── backend/
│   ├── main.py                    # FastAPI app + CORS + lifespan
│   ├── database.py                # SQLAlchemy engine, Base, get_db, init_db
│   ├── models/
│   │   ├── __init__.py
│   │   ├── patient.py
│   │   ├── test_session.py
│   │   ├── protocol.py
│   │   ├── execution_plan.py
│   │   ├── user.py
│   │   └── audit_log.py
│   ├── schemas/                   # Pydantic v2 schemas
│   │   ├── patient.py
│   │   ├── test_session.py
│   │   ├── protocol.py
│   │   ├── evaluation.py          # Evaluation session schemas
│   │   ├── user.py
│   │   └── auth.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── patients.py
│   │   ├── evaluations.py         # Evaluation sessions (ver §5 y §9 nuevo)
│   │   ├── tests.py
│   │   ├── protocols.py
│   │   ├── reports.py
│   │   ├── users.py
│   │   └── audit.py
│   ├── services/
│   │   ├── normatives.py          # NEURONORMA calculator (CRÍTICO - ver §6)
│   │   ├── tower_of_london.py
│   │   ├── clinical_interpreter.py
│   │   ├── pdf_generator.py
│   │   ├── docx_generator.py
│   │   ├── report_service.py       # orquesta pdf/docx con lógica compartida
│   │   └── audit_service.py
│   ├── auth/
│   │   ├── jwt.py
│   │   ├── dependencies.py
│   │   └── password.py
│   ├── data/
│   │   └── normative_tables/      # JSON tables (crear desde cero - ver §6 para estructura)
│   │       ├── tmt_a.json
│   │       ├── tavec.json
│   │       ├── fluidez_fas.json
│   │       ├── toulouse_pieron.json
│   │       └── torre_de_londres.json
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                # Router + PrivateRoute + layout
│   │   ├── api/
│   │   │   ├── client.ts          # Axios + JWT interceptor + 401 handler
│   │   │   ├── auth.ts
│   │   │   ├── patients.ts
│   │   │   ├── evaluations.ts
│   │   │   ├── tests.ts
│   │   │   ├── protocols.ts
│   │   │   └── reports.ts
│   │   ├── store/
│   │   │   ├── auth.ts            # Zustand: user, token, login, logout
│   │   │   └── evaluation.ts      # Zustand: active evaluation session state
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Overview.tsx       # /  — Estadísticas globales
│   │   │   ├── PatientList.tsx    # /patients
│   │   │   ├── PatientHub.tsx     # /patients/:id — centro de todo
│   │   │   ├── EvaluationSetup.tsx   # /patients/:id/evaluate
│   │   │   ├── EvaluationSession.tsx # /patients/:id/evaluate/:planId — test a test
│   │   │   ├── EvaluationSummary.tsx # /patients/:id/evaluate/:planId/summary
│   │   │   ├── ProtocolLibrary.tsx   # /protocols
│   │   │   └── Settings.tsx          # /settings
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx        # Sidebar + main content wrapper
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── ProtectedRoute.tsx
│   │   │   ├── patient/
│   │   │   │   ├── PatientCard.tsx
│   │   │   │   ├── CognitiveProfile.tsx   # Radar + Bar charts + tabla
│   │   │   │   ├── EvaluationHistory.tsx
│   │   │   │   └── PatientForm.tsx
│   │   │   ├── evaluation/
│   │   │   │   ├── TestForm.tsx           # Dispatcher dinámico de formularios
│   │   │   │   ├── TestProgressBar.tsx
│   │   │   │   ├── ScoreCard.tsx          # Muestra PE/percentil/clasificación
│   │   │   │   └── forms/                 # Un archivo por tipo de test
│   │   │   │       ├── TmtForm.tsx        # TMT-A y TMT-B
│   │   │   │       ├── TavecForm.tsx
│   │   │   │       ├── FluidezForm.tsx    # FAS y Semántica
│   │   │   │       ├── ReyForm.tsx        # Copia y Memoria
│   │   │   │       ├── ToulouseForm.tsx
│   │   │   │       ├── TorreForm.tsx      # Torre de Londres
│   │   │   │       └── GenericForm.tsx    # Resto de tests
│   │   │   └── charts/
│   │   │       ├── CognitiveRadarChart.tsx
│   │   │       └── PercentileBarChart.tsx
│   │   └── types/
│   │       ├── patient.ts
│   │       ├── test.ts
│   │       ├── evaluation.ts
│   │       └── protocol.ts
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── docker-compose.yml
```

---

## 3. Base de Datos — Esquema Completo

Usar SQLAlchemy con `Base = declarative_base()`. SQLite en `noos.db`.

### Tabla: `users`
```python
class User(Base):
    __tablename__ = "users"
    username: str                  # PK, unique, max 50 chars
    password_hash: str             # 255 chars, bcrypt
    full_name: str                 # nullable, 100 chars
    role: Enum                     # "Administrador" | "Neuropsicólogo" | "Observador" — default "Observador"
    is_active: bool                # default True
    can_manage_protocols: bool     # default False — crear/editar/eliminar protocolos BASE
                                   # Los Admin siempre tienen este permiso (ignorar flag)
                                   # Los Neuropsicólogos lo tienen solo si este flag == True
                                   # Los Viewer nunca lo tienen (ignorar flag)
    created_at: DateTime           # server_default=now
    updated_at: DateTime           # server_default=now, onupdate=now
```

### Tabla: `patients`
```python
class Patient(Base):
    __tablename__ = "patients"
    id: str                 # PK, UUID v4 auto-generado
    age: int                # NOT NULL
    education_years: int    # NOT NULL
    laterality: str         # NOT NULL — "diestro" | "zurdo" | "ambidextro"
    initials: str           # nullable — ej: "JMR"
    created_at: DateTime    # default=utcnow
    encrypted_metadata: str # nullable — reservado para uso futuro
```

**Método clave en Patient:**
```python
def get_display_id(self) -> str:
    # Retorna "INICIALES (XXXX)" si tiene initials, o "PKT-XXXX"
    # XXXX = primeros 4 chars del último segmento UUID
    masked = self.id.split('-')[-1][:4].upper()
    if self.initials:
        return f"{self.initials} ({masked})"
    return f"PKT-{masked}"
```

### Tabla: `test_sessions`
```python
class TestSession(Base):
    __tablename__ = "test_sessions"
    id: str           # PK, UUID v4
    patient_id: str   # FK → patients.id, NOT NULL
    protocol_id: str  # FK → protocols.id, nullable
    test_type: str    # NOT NULL — ej: "TMT-A", "TAVEC", etc.
    date: DateTime    # default=utcnow
    raw_data: Text    # JSON serializado
    calculated_scores: Text  # JSON serializado, nullable
    qualitative_data: Text   # JSON serializado, nullable
```

**Métodos JSON en TestSession (implementar en modelo y schema):**
```python
set_raw_data(data: dict)         → json.dumps(data)
get_raw_data() -> dict           → json.loads(raw_data) or {}
set_calculated_scores(s: dict)   → json.dumps(s)
get_calculated_scores() -> dict  → json.loads(calculated_scores) or {}
set_qualitative_data(d: dict)    → json.dumps(d)
get_qualitative_data() -> dict   → json.loads(qualitative_data) or {}
```

### Tabla: `protocols`
```python
class Protocol(Base):
    __tablename__ = "protocols"
    id: str           # PK, UUID v4
    name: str         # NOT NULL, unique
    description: str  # nullable
    category: str     # nullable — ej: "Rastreio", "Avaliação Completa"
    created_at: DateTime
    updated_at: DateTime  # onupdate=utcnow
```

### Tabla: `protocol_test_mapping`
```python
class ProtocolTest(Base):
    __tablename__ = "protocol_test_mapping"
    protocol_id: str  # PK, FK → protocols.id
    test_type: str    # PK
    order: int        # default=1
```

### Tabla: `patient_protocol_assignments`
```python
class PatientProtocol(Base):
    __tablename__ = "patient_protocol_assignments"
    patient_id: str    # PK, FK → patients.id
    protocol_id: str   # PK, FK → protocols.id
    assigned_date: DateTime  # default=utcnow
    assigned_by: str   # nullable — username
    status: str        # default="pending" — "pending"|"in_progress"|"completed"
    notes: Text        # nullable
```

### Tabla: `execution_plans`
```python
class ExecutionPlan(Base):
    __tablename__ = "execution_plans"
    id: str              # PK, UUID v4
    patient_id: str      # FK → patients.id, NOT NULL
    protocol_id: str     # FK → protocols.id, NOT NULL
    test_customizations: JSON   # lista de objetos (ver abajo)
    status: str          # "draft"|"active"|"completed"|"abandoned" — default "draft"
    is_saved_variant: bool  # default False
    variant_name: str    # nullable
    created_at: DateTime
    updated_at: DateTime
```

**Estructura JSON `test_customizations` (array):**
```json
[
  {
    "test_type": "TMT-A",
    "order": 1,
    "skip": false,           // true = excluido de esta sesión (soft-remove)
    "added": false,          // true = test añadido manualmente, no estaba en el protocolo base
    "repeat_later": false,
    "notes": "Paciente estaba cansado"
  },
  {
    "test_type": "Torre-de-Londres",
    "order": 7,
    "skip": false,
    "added": true,           // añadido específicamente para este paciente
    "repeat_later": false,
    "notes": ""
  }
]
```

> **Regla:** `skip:true` = excluido temporalmente (puede reactivarse). `added:true` = test extra fuera del protocolo base. Un test puede ser `added:true` y `skip:true` simultáneamente (añadido y luego descartado).

**Métodos en ExecutionPlan:**
```python
get_tests_to_execute()          → tests donde skip==False, ordenados por order
get_tests_to_repeat()           → tests donde repeat_later==True
get_added_tests()               → tests donde added==True (para diferenciar en UI)
add_test(test_type, order=None) → añade test_type con added=True; si order=None, va al final
remove_test(test_type)          → skip=True (no elimina del array, preserva historial)
update_test(test_type, **kwargs) → actualiza campos del test
reorder_test(test_type, new_order) → re-indexa todos los orders
```

### Tabla: `audit_logs`
```python
class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: int              # PK, autoincrement
    timestamp: DateTime  # NOT NULL
    user_identifier: str # nullable
    action: str          # NOT NULL
    resource_type: str   # NOT NULL
    resource_id: str     # nullable — truncado a 12 chars
    details: str         # nullable, JSON serializado
    ip_address: str      # nullable
```

---

## 4. Autenticación y Control de Acceso

### JWT Flow
1. `POST /api/auth/login` → verifica usuario+contraseña con bcrypt → devuelve `{access_token, token_type: "bearer", user: {...}}`
2. Token JWT expira en 8 horas. Incluir en header: `Authorization: Bearer <token>`
3. `POST /api/auth/logout` → registra audit log; frontend borra token de localStorage
4. `GET /api/auth/me` → devuelve usuario actual

### Configuración JWT
```python
SECRET_KEY = os.getenv("JWT_SECRET_KEY")  # OBLIGATORIO, mínimo 32 chars aleatorios
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8
```

### Dependencias FastAPI
```python
async def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)) -> User:
    # Decodifica JWT, busca usuario en DB, lanza HTTPException(401) si inválido/expirado

def require_role(*roles):
    # Factory que devuelve dependencia para verificar rol del usuario actual
    async def check(current_user = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(403, "Permisos insuficientes")
    return check
```

### Roles y Permisos

| Permiso                             | Administrador | Neuropsicólogo | Observador |
|-------------------------------------|-------|--------------|--------|
| ver pacientes                       | ✅    | ✅           | ✅     |
| crear paciente                      | ✅    | ✅           | ❌     |
| editar paciente                     | ✅    | ✅           | ❌     |
| eliminar paciente                   | ✅    | ❌           | ❌     |
| crear/editar test                   | ✅    | ✅           | ❌     |
| ver tests                           | ✅    | ✅           | ✅     |
| eliminar test                       | ✅    | ❌           | ❌     |
| customizar protocolo (por paciente) | ✅    | ✅           | ❌     |
| **gestionar protocolos base**       | ✅    | `can_manage_protocols` | ❌ |
| ver protocolo (solo lectura)        | ✅    | ✅           | ✅     |
| generar informes                    | ✅    | ✅           | ❌     |
| ver dashboard                       | ✅    | ✅           | ✅     |
| gestionar usuarios                  | ✅    | ❌           | ❌     |
| ver audit logs                      | ✅    | ❌           | ❌     |
| crear backups                       | ✅    | ❌           | ❌     |

> **`can_manage_protocols`** es un flag booleano por usuario (default `False`). Solo Administrador puede activarlo/desactivarlo desde el panel de usuarios. Un Neuropsicólogo con este flag puede crear, editar y eliminar protocolos base; sin él, los ve en modo lectura y solo puede customizarlos por paciente.

#### Verificación en backend

```python
def require_protocol_management():
    async def check(current_user: User = Depends(get_current_user)):
        if current_user.role == "Administrador":
            return current_user
        if current_user.role == "Neuropsicólogo" and current_user.can_manage_protocols:
            return current_user
        raise HTTPException(403, "No tienes permiso para gestionar protocolos base")
    return check
```

### Inicialización del Admin
Al arrancar la app por primera vez (sin usuarios Admin en DB), crear el admin usando `ADMIN_PASSWORD` del `.env`. Si no está definida, fallar con mensaje claro. La contraseña debe tener mínimo 12 caracteres, mayúsculas, minúsculas, números y símbolo especial.

---

## 5. API REST — Endpoints Completos

Todos los endpoints requieren `Authorization: Bearer <token>` salvo `/api/auth/login`.

### Auth — `/api/auth`
```
POST /login           → {access_token, token_type, user}
POST /logout          → registra audit log
GET  /me              → usuario actual
POST /change-password → body: {current_password, new_password}
```

### Pacientes — `/api/patients`
```
GET    /                    → lista paginada (?page=1&size=20)
POST   /                    → crear paciente [Neuropsicólogo+]
GET    /{id}                → obtener paciente [registra audit patient.view]
PUT    /{id}                → editar paciente [Neuropsicólogo+]
DELETE /{id}                → eliminar paciente (cascade sessions + assignments) [Administrador]
GET    /{id}/sessions       → historial de test sessions (ordenado por fecha desc)
GET    /{id}/protocols      → protocolos asignados
```

### Tests — `/api/tests`
```
POST   /                    → guardar test + calcular normativa [Neuropsicólogo+]
GET    /{id}                → obtener test session
PATCH  /{id}                → corregir raw_data de un test ya guardado; recalcula calculated_scores [Neuropsicólogo+]
DELETE /{id}                → eliminar test session [Administrador]
GET    /patient/{patient_id} → tests de un paciente
```

> **PATCH /{id}:** Permite corregir valores erróneos introducidos previamente. El body acepta los mismos campos que el POST original. El backend recalcula `calculated_scores` y `qualitative_data` con los datos corregidos. Se registra en el audit log el valor anterior y el nuevo.

**Body para `POST /api/tests`:**
```json
{
  "patient_id": "uuid",
  "test_type": "TMT-A",
  "protocol_id": null,
  "raw_data": { "tiempo_segundos": 45 },
  "qualitative_data": {
    "observaciones_proceso": "...",
    "checklist": {}
  }
}
```
El backend calcula `calculated_scores` automáticamente. Respuesta incluye el objeto completo con scores calculados e interpretación clínica.

### Protocolos — `/api/protocols`
```
GET    /                                    → listar (?category=X)
POST   /                                    → crear protocolo base [require_protocol_management]
GET    /                                    → listar (todos los roles)
GET    /{id}                                → obtener (todos los roles)
PUT    /{id}                                → actualizar protocolo base [require_protocol_management]
DELETE /{id}                                → eliminar [Administrador]
GET    /categories                          → categorías únicas
GET    /tests/available                     → lista de 19 tipos de test

POST   /{protocol_id}/assign/{patient_id}   → asignar protocolo
DELETE /{protocol_id}/assign/{patient_id}   → desasignar
PUT    /{protocol_id}/assign/{patient_id}/status → body: {status}
GET    /patient/{patient_id}                → protocolos de un paciente
```

### Planes de Ejecución — `/api/execution-plans`
```
POST   /                     → crear plan [Neuropsicólogo+]
                               body: {patient_id, protocol_id, mode, test_customizations?}
GET    /{id}                 → obtener plan (incluye progreso y tests completados)
PATCH  /{id}/customizations  → actualizar lista de tests del plan [Neuropsicólogo+]
                               body: {test_customizations: [...]}
                               Permite añadir, excluir o reordenar en cualquier momento,
                               incluso con status="active" (entre tests durante la sesión)
PATCH  /{id}/status          → cambiar status (active→completed, active→abandoned)
GET    /patient/{patient_id} → planes de un paciente (?status=active)
```

> **PATCH /customizations** es el endpoint central de la customización. El frontend lo llama en el setup inicial (Paso 2) y también puede llamarlo durante la sesión activa si el clínico decide añadir o excluir un test a mitad de evaluación.

### Dashboard — `/api/dashboard`
```
GET  /patient/{patient_id}/profile    → datos para charts + interpretación
GET  /patient/{patient_id}/comparison → body: {session_ids: [...]}
GET  /stats                           → estadísticas globales
GET  /protocols/stats                 → estadísticas de uso de protocolos
```

**Respuesta de `/profile`:**
```json
{
  "patient": { "age": 65, "education_years": 12, "laterality": "diestro" },
  "sessions": [...],
  "chart_data": {
    "test_names": ["TMT-A", "TAVEC"],
    "pe_scores": [12, 8],
    "percentiles": [75.0, 25.0],
    "clasificaciones": ["Normal", "Limítrofe"]
  },
  "interpretation": {
    "mean_pe": 10.0,
    "mean_percentil": 50.0,
    "best_test": "TMT-A",
    "worst_test": "TAVEC",
    "global_level": "Normal"
  }
}
```

### Informes — `/api/reports`
```
POST /generate/{patient_id}   → genera informe en el formato indicado [Neuropsicólogo+]
                                body: {
                                  format: "pdf" | "docx",
                                  session_ids?: string[],   // si vacío, todos los tests del paciente
                                  include_radar?: boolean   // default true
                                }
                                Respuesta:
                                  format=pdf  → Content-Type: application/pdf
                                  format=docx → Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
                                El nombre del fichero devuelto: informe_PKT-XXXX_YYYYMMDD.{pdf|docx}
```

### Usuarios — `/api/users` [Solo Administradoristrador]
```
GET    /                        → listar todos
POST   /                        → crear
PUT    /{username}              → editar (nombre, rol, can_manage_protocols, is_active)
DELETE /{username}              → eliminar
POST   /{username}/reset-password → body: {new_password}
```

### Auditoría — `/api/audit` [Solo Administradoristrador]
```
GET  /logs                          → logs filtrados (?action=X&resource_type=X&limit=50)
GET  /patient/{patient_id}/history  → historial de un paciente
```

### Sistema — `/api/system`
```
POST /backup   → copia noos.db a backups/ [Administrador]
GET  /health   → status check (no requiere auth)
```

---

## 6. Servicio de Cálculo Normativo NEURONORMA (CRÍTICO)

Este es el núcleo del sistema. Implementar con exactitud matemática.

### Archivos de tablas normativas
Ubicación: `backend/data/normative_tables/`

**Estructura JSON de cada tabla:**
```json
{
  "test_name": "TMT-A",
  "source": "NEURONORMA",
  "age_ranges": [
    {
      "age_min": 50,
      "age_max": 64,
      "education_ranges": [
        {
          "education_min": 0,
          "education_max": 7,
          "conversion_table": {
            "30": { "pe": 16, "percentil": 93.2 },
            "45": { "pe": 14, "percentil": 82.0 },
            "60": { "pe": 12, "percentil": 75.0 }
          }
        }
      ]
    }
  ]
}
```

**Tests con tablas reales:** TMT-A, TAVEC, Fluidez-FAS, Toulouse-Piéron, Torre de Londres  
**Tests sin tabla (usar cálculo simulado):** todos los demás

### Método `calculate(test_type, raw_score, age, education_years) -> dict`

```python
if test_type in self.normative_tables:
    return self._calculate_from_table(test_type, raw_score, age, education_years)
return self._calculate_simulated(test_type, raw_score, age, education_years)
```

### `_calculate_from_table()`

1. **Buscar rango de edad:** iterar `table['age_ranges']`, encontrar donde `age_min <= age <= age_max`. Si no hay match → usar el primero.
2. **Buscar rango de educación:** iterar `age_range['education_ranges']`, encontrar donde `education_min <= education_years <= education_max`. Si no hay match → usar el primero.
3. **Buscar en conversion_table** con clave `str(int(raw_score))`:
   - Si existe → usar `pe` y `percentil` directamente
   - Si no → llamar `_interpolate_scores(raw_score, conversion_table)`
4. Calcular `z_score = scipy.stats.norm.ppf(percentil / 100)` — clamp percentil a [0.01, 99.99]
5. Calcular `clasificacion = _classify(percentil)`
6. Retornar dict completo (ver estructura al final de esta sección).

### `_interpolate_scores(raw_score, conversion_table) -> (pe, percentil)`

```python
available_scores = sorted([int(k) for k in conversion_table.keys()])
lower_scores = [s for s in available_scores if s <= raw_score]
upper_scores = [s for s in available_scores if s >= raw_score]

if not lower_scores:  # Por debajo del mínimo de la tabla
    key = str(available_scores[0])
    return conversion_table[key]['pe'], conversion_table[key]['percentil']

if not upper_scores:  # Por encima del máximo de la tabla
    key = str(available_scores[-1])
    return conversion_table[key]['pe'], conversion_table[key]['percentil']

lower = lower_scores[-1]
upper = upper_scores[0]

if lower == upper:   # Coincidencia exacta
    key = str(lower)
    return conversion_table[key]['pe'], conversion_table[key]['percentil']

# Interpolación lineal
ratio = (raw_score - lower) / (upper - lower)
pe_lower   = conversion_table[str(lower)]['pe']
pe_upper   = conversion_table[str(upper)]['pe']
p_lower    = conversion_table[str(lower)]['percentil']
p_upper    = conversion_table[str(upper)]['percentil']

pe       = pe_lower    + ratio * (pe_upper - pe_lower)
percentil = p_lower    + ratio * (p_upper  - p_lower)
return round(pe), round(percentil, 1)
```

### `_calculate_simulated(test_type, raw_score, age, education_years)`

```python
mean = 50; std = 10
z_score   = (raw_score - mean) / std
percentil = scipy.stats.norm.cdf(z_score) * 100
pe        = max(1, min(19, int(10 + (z_score * 3))))
clasificacion = _classify(percentil)
```

### `_classify(percentil) -> str`

```python
if percentil >= 75: return "Superior"
elif percentil >= 25: return "Normal"
elif percentil >= 10: return "Limítrofe"
else: return "Deficitario"
```

### Estructura de respuesta `calculated_scores`

```json
{
  "puntuacion_escalar": 14,
  "percentil": 82.0,
  "z_score": 0.92,
  "clasificacion": "Superior",
  "norma_aplicada": {
    "fuente": "NEURONORMA",
    "test": "TMT-A",
    "rango_edad": "50-64",
    "rango_educacion": "8-12"
  }
}
```

---

## 7. Los 19 Tests — Datos de Entrada y Puntuación Bruta

Para cada test, el frontend envía `raw_data` en `POST /api/tests`. El backend extrae la `puntuacion_bruta` y la pasa al calculator.

### TMT-A
- **raw_data:** `{ "tiempo_segundos": number }` (rango 0–300)
- **puntuacion_bruta:** `tiempo_segundos` (menor = mejor)
- **qualitative checklist:** `{ "errores": number, "correcciones": number }`

### TMT-B
- **raw_data:** `{ "tiempo_segundos": number }` (rango 0–600)
- **puntuacion_bruta:** `tiempo_segundos`
- **qualitative checklist:** `{ "errores": number, "correcciones": number }`

### TAVEC
- **raw_data:**
```json
{
  "ensayo_1": 0,  "ensayo_2": 0,  "ensayo_3": 0,
  "ensayo_4": 0,  "ensayo_5": 0,
  "lista_b": 0,
  "recuerdo_inmediato": 0,
  "recuerdo_demorado": 0,
  "reconocimiento_aciertos": 0,
  "reconocimiento_errores": 0
}
```
- **puntuacion_bruta:** `ensayo_1 + ensayo_2 + ensayo_3 + ensayo_4 + ensayo_5`

### Fluidez Verbal Fonológica (F-A-S)
- **raw_data:** `{ "letra_f": number, "letra_a": number, "letra_s": number }`
- **puntuacion_bruta:** `letra_f + letra_a + letra_s`

### Fluidez Verbal Semántica
- **raw_data:** `{ "animales": number, "frutas": number, "categoria_libre": number }`
- **puntuacion_bruta:** `animales + frutas + categoria_libre`

### Figura de Rey — Copia
- **raw_data:** `{ "puntuacion_bruta": number }` (0–36)
- **puntuacion_bruta:** `puntuacion_bruta`

### Figura de Rey — Memoria
- **raw_data:** `{ "puntuacion_bruta": number, "tiempo_demora_minutos": number }`
- **puntuacion_bruta:** `puntuacion_bruta`

### Toulouse-Piéron
- **raw_data:**
```json
{
  "aciertos": 0, "errores": 0, "omisiones": 0,
  "productividad_bruta": 0, "productividad_neta": 0
}
```
- **puntuacion_bruta:** `productividad_neta` (= aciertos − errores)

### Torre de Londres
- **raw_data:**
```json
{
  "movement_counts": [4, 5, 6, 5, 7, 8, 6, 9, 7, 10],
  "time_seconds":    [30, 45, 60, 35, 50, 70, 40, 90, 55, 80]
}
```
- **puntuacion_bruta:** calculada por `TowerOfLondonCalculator.calculate()` → `composite_raw_score` (ver §8)

### DIVA-5
- **raw_data:**
```json
{
  "inatención_infancia": 0,     "hiperactividad_infancia": 0,
  "inatención_actual": 0,       "hiperactividad_actual": 0
}
```
- **puntuacion_bruta:** `inatención_actual + hiperactividad_actual`

### BRIEF-A
- **raw_data:**
```json
{
  "inhibicion": 0, "flexibilidad": 0, "control_emocional": 0,
  "automonitoreo": 0, "iniciativa": 0, "memoria_trabajo": 0,
  "planificacion": 0, "organizacion": 0, "automonitoreo_tarea": 0
}
```
- **puntuacion_bruta:** suma de todas las subescalas

### WAIS-IV
- **raw_data:**
```json
{
  "CI_total": 0, "comprension_verbal": 0, "razonamiento_perceptivo": 0,
  "memoria_trabajo": 0, "velocidad_procesamiento": 0
}
```
- **puntuacion_bruta:** `CI_total`

### Dígitos
- **raw_data:**
```json
{
  "digitos_directos": 0, "digitos_inversos": 0,
  "secuencia_letras_numeros": 0
}
```
- **puntuacion_bruta:** `digitos_directos + digitos_inversos + secuencia_letras_numeros`

### Test d2-R
- **raw_data:**
```json
{
  "total_respuestas": 0, "omisiones": 0, "comisiones": 0,
  "total_efectividad": 0, "indice_concentracion": 0
}
```
- **puntuacion_bruta:** `indice_concentracion`

### FDT (Five Digit Test)
- **raw_data:**
```json
{
  "contar_tiempo": 0, "leer_tiempo": 0,
  "elegir_tiempo": 0, "alternar_tiempo": 0
}
```
- **puntuacion_bruta:** `elegir_tiempo + alternar_tiempo`

### BADS — Zoo
- **raw_data:** `{ "puntuacion_perfil": number }` (0–8)
- **puntuacion_bruta:** `puntuacion_perfil`

### BADS — Llave
- **raw_data:** `{ "puntuacion_estrategia": number }` (0–16)
- **puntuacion_bruta:** `puntuacion_estrategia`

### FCSRT
- **raw_data:**
```json
{
  "libre_inmediato": 0, "total_inmediato": 0,
  "libre_demorado": 0,  "total_demorado": 0
}
```
- **puntuacion_bruta:** `total_inmediato`

### Perfil Sensorial
- **raw_data:**
```json
{
  "procesamiento_auditivo": 0, "procesamiento_visual": 0,
  "procesamiento_vestibular": 0, "procesamiento_tactil": 0,
  "procesamiento_multisensorial": 0, "procesamiento_oral": 0
}
```
- **puntuacion_bruta:** suma de todas las subescalas

---

## 8. Torre de Londres — Algoritmo Completo

```python
MINIMUM_MOVEMENTS = {1:4, 2:4, 3:5, 4:5, 5:5, 6:6, 7:6, 8:6, 9:7, 10:7}

def calculate(movement_counts: List[int], time_seconds: List[int] = None) -> dict:
    # Validar: exactamente 10 items en movement_counts
    # time_seconds default: [0] * 10

    item_results = []
    total_perfect_solutions = 0
    total_movement_rating = 0
    total_time_seconds = sum(time_seconds)

    for item_num in range(1, 11):
        minimum = MINIMUM_MOVEMENTS[item_num]
        count   = movement_counts[item_num - 1]
        time    = time_seconds[item_num - 1]

        # Validar: count >= minimum (si no → marcar como inválido)
        movement_rating = count - minimum
        is_perfect = (movement_rating == 0)

        item_results.append({
            'item': item_num, 'movements_count': count,
            'minimum_movements': minimum, 'movement_rating': movement_rating,
            'perfect': is_perfect, 'time_seconds': time
        })
        if is_perfect:
            total_perfect_solutions += 1
        total_movement_rating += movement_rating

    # Eficiencia de ejecución basada en tiempo medio por ítem
    avg_time = total_time_seconds / 10 if total_time_seconds > 0 else 0
    if avg_time < 20:
        execution_efficiency = 0.95   # Demasiado rápido
    elif avg_time > 120:
        execution_efficiency = 0.90   # Demasiado lento
    else:
        execution_efficiency = 0.95 + (0.05 * (1 - abs(avg_time - 50) / 70))

    # Puntuación compuesta para NEURONORMA
    base_score = total_movement_rating
    if total_time_seconds > 0:
        if total_time_seconds < 300:
            time_penalty = base_score * 0.20
        elif total_time_seconds > 1000:
            time_penalty = base_score * 0.40
        else:
            deviation = abs(total_time_seconds - 650) / 650
            time_penalty = base_score * min(0.05 * deviation, 0.05)
    else:
        time_penalty = 0

    composite_raw_score = base_score + time_penalty

    return {
        'item_results': item_results,
        'total_perfect_solutions': total_perfect_solutions,
        'total_movement_rating': total_movement_rating,
        'total_time_seconds': total_time_seconds,
        'execution_efficiency': execution_efficiency,
        'composite_raw_score': composite_raw_score,
        'valid': True,
        'errors': []
    }
```

---

## 9. Ejecución de Protocolos — Flujo Guiado

### Flujo de pantallas

```
[1] Seleccionar paciente + protocolo
        ↓
[2] Personalizar plan (opcional):
    - Checkbox "Omitir" por test
    - Checkbox "Repetir después" por test
    - Número de orden manual por test
    - Textarea "Notas pre-test" por test
        ↓
[3] Ejecución secuencial (test a test):
    - Barra de progreso: "Test N de Total"
    - Formulario del test actual (dinámico según tipo)
    - Botón "Guardar y Continuar" → POST /api/tests → avanza al siguiente
    - Botón "Omitir este test" → marca como skip, avanza
    - Botón "Marcar para repetir" → marca repeat_later, avanza
        ↓
[4] Resumen final:
    - Tabla de resultados completados
    - Tests omitidos
    - Tests pendientes de repetir
    - Botón "Guardar variante del protocolo" (con nombre)
    - Botón "Generar Informe PDF"
```

### Estado del ExecutionPlan en DB
- Crear al iniciar (status="active")
- Actualizar `test_customizations` según cambios del usuario
- Al completar todos → status="completed"
- Si se abandona → status="abandoned"

---

## 10. Generación de Informes — PDF y Word

### Servicio `ReportGenerator`

Clase única con dos métodos públicos que comparten la misma lógica de contenido:

```python
class ReportGenerator:
    def generate_pdf(patient_data, test_sessions, session_ids=None) -> bytes:
        """Genera el informe en PDF con ReportLab. Devuelve bytes."""

    def generate_docx(patient_data, test_sessions, session_ids=None) -> bytes:
        """Genera el informe en Word (.docx) con python-docx. Devuelve bytes."""

    def _build_report_data(patient_data, test_sessions, session_ids) -> dict:
        """Lógica compartida: filtra, ordena y prepara los datos para ambos formatos."""
```

El router `/api/reports` llama a uno u otro según `format` en el body. Ambos devuelven `bytes` directamente (sin guardar en disco).

### Parámetros comunes

- `patient_data`: `{id, display_id, age, education_years, laterality}`
- `test_sessions`: lista de `{test_type, date, raw_data, calculated_scores, qualitative_data}`
- `session_ids`: lista opcional de UUIDs para filtrar tests concretos (ej. los de una evaluación)

**Parámetros:**
- `patient_data`: `{id, age, education_years, laterality}`
- `test_sessions`: lista de `{test_type, date, raw_data, calculated_scores, qualitative_data}`

**Retorna:** ruta al archivo PDF en carpeta `reports/`

### Estructura del PDF

1. **Encabezado**
   - Título centrado: "INFORME NEUROPSICOLÓGICO" (18pt, color `#1e40af`)
   - Subtítulo: `Fecha de emisión: dd/mm/yyyy` (cursiva)

2. **Datos del Paciente** — tabla 2 columnas
   - Filas: ID Paciente (truncado 12 chars+"..."), Edad, Escolaridad, Lateralidad
   - Columna izquierda fondo `#e0e7ff`, negrita

3. **Resultados de Evaluación**
   - Tabla resumen: `Test | Fecha | PB | PE | Percentil | Clasificación`
   - Header: fondo `#2563eb`, texto blanco
   - Filas alternadas: blanco / `#f8fafc`
   - Celda `Clasificación` coloreada:
     - Superior → `#d1fae5`
     - Normal → `#dbeafe`
     - Limítrofe → `#fef3c7`
     - Deficitario → `#fee2e2`
   - Debajo de cada fila, si hay `observaciones_proceso` en qualitative_data → mostrar en cursiva

4. **Perfil Cognitivo** (texto narrativo)
   - "El paciente completó N pruebas. La puntuación escalar media es X (PE), correspondiente al percentil Y."
   - "Área de mayor rendimiento: TestX (PE=N)"
   - "Área de menor rendimiento: TestY (PE=N)"

5. **Pie de página** (8pt, gris, centrado)
   - "Este informe ha sido generado automáticamente. Los datos son confidenciales y están sujetos al RGPD."

> **Colores en PDF:** usar la paleta Triune (`#4B164F` como header principal, `#9839D1` para acentos, `#F6F5F2` para filas alternas).

---

### Estructura del Word (.docx) — `python-docx`

El Word debe ser **editable**: el neuropsicólogo lo descarga, añade su firma, escribe texto libre adicional y lo envía al médico derivante. Por eso el contenido es menos visual y más estructurado:

1. **Encabezado del documento** — estilo `Heading 1`
   - "INFORME NEUROPSICOLÓGICO — Nóos"
   - Fecha de emisión

2. **Datos del paciente** — tabla 2×4 con bordes
   - ID, Edad, Escolaridad, Lateralidad

3. **Tabla de resultados** — mismas columnas que el PDF
   - `Test | Fecha | Puntuación Bruta | PE | Percentil | Clasificación`
   - Celda Clasificación con fondo de color (compatible con Word)
   - Observaciones clínicas debajo de cada fila si existen

4. **Perfil cognitivo narrativo** — párrafo de texto plano editable
   - Misma narrativa que el PDF
   - Estilo `Normal` para que el clínico pueda sobrescribir

5. **Sección de firma** — al final, espacio para:
   - "Firma del profesional: _______________________"
   - "Nº colegiado: ______________"
   - "Fecha: ______________"
   - Este bloque es texto normal (editable por el clínico)

6. **Pie de página** — mismo texto RGPD

```python
# Ejemplo de uso con python-docx
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()
doc.core_properties.author = "Nóos"

# Fuente del documento
style = doc.styles["Normal"]
style.font.name = "Calibri"  # Work Sans no disponible en Word — usar Calibri como fallback
style.font.size = Pt(11)

# Título
h = doc.add_heading("INFORME NEUROPSICOLÓGICO", level=1)
h.runs[0].font.color.rgb = RGBColor(0x4B, 0x16, 0x4F)  # brand.primary

# Tabla de resultados
table = doc.add_table(rows=1, cols=6)
table.style = "Table Grid"
header_cells = table.rows[0].cells
for i, label in enumerate(["Test","Fecha","PB","PE","Percentil","Clasificación"]):
    cell = header_cells[i]
    cell.text = label
    cell.paragraphs[0].runs[0].font.bold = True
    cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    # Fondo de celda header: #4B164F (requiere manipular XML directamente en python-docx)

# Devolver como bytes
from io import BytesIO
buffer = BytesIO()
doc.save(buffer)
return buffer.getvalue()
```

### Extracción de puntuación bruta para la tabla del informe

```python
TMT-A / TMT-B → raw_data.get("tiempo_segundos", "N/A")
TAVEC         → sum([raw_data.get(f"ensayo_{i}", 0) for i in range(1, 6)])
Fluidez-FAS   → raw_data.get("letra_f", 0) + raw_data.get("letra_a", 0) + raw_data.get("letra_s", 0)
Rey-Copia / Rey-Memoria → raw_data.get("puntuacion_bruta", "N/A")
Toulouse-Pieron → raw_data.get("productividad_neta", "N/A")
Torre de Londres → f"{raw_data.get('total_movement_rating', 0)} pts"
otros → "N/A"
```

---

## 11. Servicio de Auditoría (RGPD)

Registrar todas las operaciones sensibles. `resource_id` siempre truncado a 12 chars.

### Acciones a registrar

```python
ACTIONS = {
    "patient.create", "patient.view", "patient.update", "patient.delete",
    "test.create", "test.view", "test.delete",
    "report.generate",
    "backup.create", "data.export",
    "auth.login", "auth.logout",
    "protocol.create", "protocol.update", "protocol.delete"
}
```

### Cuándo registrar (trigger)

| Acción | Detalles en log |
|--------|----------------|
| `auth.login` | username |
| `auth.logout` | username |
| `patient.create` | age, education_years, laterality |
| `patient.view` | — |
| `patient.update` | campos modificados |
| `patient.delete` | — |
| `test.create` | patient_id (12 chars), test_type, puntuacion_escalar, percentil |
| `report.generate` | patient_id, format ("pdf"\|"docx"), test_count |
| `backup.create` | filename |
| `protocol.create` | name, test_count |
| `protocol.delete` | name |

### IP del cliente
En deployment cloud, obtener IP real del header `X-Forwarded-For` (configurar nginx para pasarla). Fallback: `socket.gethostbyname(socket.gethostname())`.

---

## 12. Interpretador Clínico

Incluir resultado en la respuesta de `POST /api/tests`.

```python
TEMPLATES = {
    "TMT-A": {
        "Superior":    ("Atención sostenida superior",    "Velocidad de procesamiento excelente",       "Sin intervención",     "green"),
        "Normal":      ("Atención sostenida normal",      "Velocidad normal para su edad",              "Continuar monitoreo",  "blue"),
        "Limítrofe":   ("Atención sostenida limítrofe",   "Velocidad reducida",                         "Retest en 6 meses",    "yellow"),
        "Deficitario": ("Atención deficitaria",           "Déficit significativo en atención",          "Requiere intervención","red"),
    },
    "TMT-B": {
        "Superior":    ("Flexibilidad cognitiva superior","Función ejecutiva excelente",                "Sin intervención",     "green"),
        "Normal":      ("Flexibilidad cognitiva normal",  "Capacidad de cambio mental normal",          "Continuar",            "blue"),
        "Limítrofe":   ("Flexibilidad cognitiva limítrofe","Dificultad moderada en cambio mental",      "Retest en 6 meses",    "yellow"),
        "Deficitario": ("Flexibilidad deficitaria",       "Déficit ejecutivo significativo",            "Requiere intervención","red"),
    },
    "TAVEC": {
        "Superior":    ("Memoria verbal superior",        "Aprendizaje excelente",                      "Sin intervención",     "green"),
        "Normal":      ("Memoria verbal normal",          "Aprendizaje normal",                         "Continuar",            "blue"),
        "Limítrofe":   ("Memoria verbal limítrofe",       "Capacidad de aprendizaje reducida",          "Retest en 6 meses",    "yellow"),
        "Deficitario": ("Memoria verbal deficitaria",     "Déficit significativo en memoria",           "Intervención requerida","red"),
    },
    "Fluidez-FAS": {
        "Superior":    ("Fluidez verbal superior",        "Acceso léxico excelente",                    "Sin intervención",     "green"),
        "Normal":      ("Fluidez verbal normal",          "Acceso léxico normal",                       "Continuar",            "blue"),
        "Limítrofe":   ("Fluidez verbal limítrofe",       "Acceso léxico reducido",                     "Retest en 6 meses",    "yellow"),
        "Deficitario": ("Fluidez deficitaria",            "Déficit en generación de palabras",          "Intervención requerida","red"),
    },
    "Fluidez-Semántica": {
        "Superior":    ("Fluidez semántica superior",     "Acceso conceptual excelente",                "Sin intervención",     "green"),
        "Normal":      ("Fluidez semántica normal",       "Acceso conceptual normal",                   "Continuar",            "blue"),
        "Limítrofe":   ("Fluidez semántica limítrofe",    "Acceso conceptual reducido",                 "Retest en 6 meses",    "yellow"),
        "Deficitario": ("Fluidez semántica deficitaria",  "Déficit en conocimiento semántico",          "Intervención",         "red"),
    },
    "Rey-Copia": {
        "Superior":    ("Habilidad visuoconstructiva superior", "Análisis visual excelente",            "Sin intervención",     "green"),
        "Normal":      ("Habilidad visuoconstructiva normal",   "Capacidad normal",                     "Continuar",            "blue"),
        "Limítrofe":   ("Habilidad visuoconstructiva limítrofe","Dificultad moderada",                  "Retest en 6 meses",    "yellow"),
        "Deficitario": ("Habilidad visuoconstructiva deficitaria","Déficit visuoespacial",              "Intervención",         "red"),
    },
    "Rey-Memoria": {
        "Superior":    ("Memoria visuoespacial superior", "Retención excelente",                        "Sin intervención",     "green"),
        "Normal":      ("Memoria visuoespacial normal",   "Retención normal",                           "Continuar",            "blue"),
        "Limítrofe":   ("Memoria visuoespacial limítrofe","Retención reducida",                         "Retest en 6 meses",    "yellow"),
        "Deficitario": ("Memoria visuoespacial deficitaria","Déficit de retención",                     "Intervención",         "red"),
    },
    "Toulouse-Pieron": {
        "Superior":    ("Vigilancia superior",            "Atención sostenida excelente",               "Sin intervención",     "green"),
        "Normal":      ("Vigilancia normal",              "Atención sostenida normal",                  "Continuar",            "blue"),
        "Limítrofe":   ("Vigilancia limítrofe",           "Fatiga o falta de atención",                 "Retest en 6 meses",    "yellow"),
        "Deficitario": ("Vigilancia deficitaria",         "Déficit severo de atención",                 "Intervención",         "red"),
    },
    "Torre de Londres": {
        "Superior":    ("Planificación superior",         "Función ejecutiva excelente",                "Sin intervención",     "green"),
        "Normal":      ("Planificación normal",           "Capacidad de planificación normal",          "Continuar",            "blue"),
        "Limítrofe":   ("Planificación limítrofe",        "Dificultad en secuenciación",                "Retest en 6 meses",    "yellow"),
        "Deficitario": ("Planificación deficitaria",      "Déficit ejecutivo significativo",            "Intervención",         "red"),
    },
}

def get_summary(test_type: str, scores: dict, age: int) -> dict:
    classification = scores.get('clasificacion', 'Normal')
    percentile     = scores.get('percentil', 50)
    pe             = scores.get('puntuacion_escalar', 10)

    template = TEMPLATES.get(test_type, {}).get(classification)
    if not template:
        template = _get_generic(classification)

    brief, narrative, recommendation, color = template
    return {
        'brief_summary': brief,
        'clinical_narrative': narrative,
        'percentile_interpretation': f"{classification}: percentil {percentile:.0f}",
        'recommendation': recommendation,
        'color_code': color,
        'pe_score': pe,
    }
```

---

## 13. Dashboard — Lógica de Visualización

### Radar Chart (Puntuaciones Escalares)
- **Librería:** Recharts `RadarChart`
- **Ejes (theta):** nombres de tests
- **Serie 1:** pe_scores del paciente (escala 1–19), color azul `#2563eb`, relleno semitransparente
- **Serie 2:** línea de referencia fija = 10 en todos los ejes (media poblacional), verde `#10b981`, línea punteada
- **Rango del eje radial:** 0–19

### Bar Chart (Percentiles)
- **Librería:** Recharts `BarChart`
- **Barras:** percentil por test, coloreadas según clasificación:
  - ≥75 → `#10b981` (verde)
  - 25–74 → `#3b82f6` (azul)
  - 10–24 → `#f59e0b` (ámbar)
  - <10 → `#ef4444` (rojo)
- **Líneas de referencia horizontales (ReferenceLine):**
  - y=75: `#10b981` punteado, label "Superior (P75)"
  - y=25: `#3b82f6` punteado, label "Normal (P25)"
  - y=10: `#f59e0b` punteado, label "Limítrofe (P10)"

### Interpretación automática

```python
mean_pe       = sum(pe_scores) / len(pe_scores)
mean_percentil = sum(percentiles) / len(percentiles)

# Nivel global
if mean_pe >= 13:   global_level = "Superior"
elif mean_pe >= 7:  global_level = "Normal"
elif mean_pe >= 4:  global_level = "Limítrofe"
else:               global_level = "Deficitario"

best_test  = test_names[pe_scores.index(max(pe_scores))]
worst_test = test_names[pe_scores.index(min(pe_scores))]
```

---

## 14. UX Philosophy — Diseño Centrado en el Flujo Clínico

### Principio fundamental: El Paciente es el Contexto

El modelo mental del neuropsicólogo es **paciente-céntrico**, no navegación-céntrica. El profesional piensa "voy a trabajar con la Sra. García" — no "voy a la página de Tests". Toda la interfaz debe reflejar este modelo mental.

### Los 3 momentos de uso

**Momento 1 — Preparación (antes de ver al paciente):**
- Busca al paciente por iniciales o ID
- Revisa su historial rápido y protocolos asignados
- Ve en qué punto está una evaluación en curso

**Momento 2 — Sesión clínica (con el paciente delante, tablet):**
- Formularios simples, grandes, sin distracciones
- Un test a la vez, progresión clara
- Guardado automático (el paciente no puede esperar a que cargue)
- Posibilidad de anotar observaciones brevemente

**Momento 3 — Análisis post-sesión (sin el paciente):**
- Ve el perfil cognitivo resultante
- Compara con evaluaciones anteriores  
- Genera y descarga el informe PDF

### Problemas del diseño anterior que hay que resolver

| Problema (Streamlit) | Solución (nuevo diseño) |
|---------------------|------------------------|
| Tests y Pacientes son páginas separadas → pérdida de contexto | Todo ocurre dentro de la vista del paciente |
| Dashboard separado → hay que navegar para ver resultados | Perfil cognitivo embebido en la ficha del paciente |
| Protocol Execution era una pantalla enterrada | Es el flujo principal, accesible en 1 click desde el paciente |
| No hay concepto de "sesión de evaluación" | Evaluación = agrupación de tests del mismo día con estado persistido |
| Formularios de tests mezclados con selección de paciente | Modo de evaluación: pantalla completa, sin distracciones |

### Rutas del Frontend

```
/login                                    — Login
/                                         — Overview global (stats del sistema)
/patients                                 — Lista y búsqueda de pacientes
/patients/new                             — Crear nuevo paciente
/patients/:id                             — Patient Hub (centro de todo)
/patients/:id/evaluate                    — Iniciar nueva evaluación
/patients/:id/evaluate/:planId            — Sesión activa (test a test)
/patients/:id/evaluate/:planId/summary    — Resumen + informe PDF
/protocols                                — Biblioteca de protocolos
/settings                                 — Configuración y admin
```

---

## 15. Páginas del Frontend — Especificación Detallada

### Login `/login`

Pantalla de login minimalista:
- Card centrado en pantalla completa con logo/nombre
- Campos: username + password (con mostrar/ocultar)
- Botón "Entrar" — llama `POST /api/auth/login`
- Guardar token en localStorage + Zustand store
- Redirect automático a `/` si ya tiene token válido
- Toast de error si credenciales incorrectas (no revelar cuál campo)
- Rate limiting visible: si 5 intentos fallidos → mensaje "Demasiados intentos, espere 15 minutos"

---

### Overview `/`

Panel de estadísticas globales del sistema. Visible para todos los roles.

**Layout:** 4 métricas en tarjetas + actividad reciente

**Métricas:**
- Total de pacientes registrados
- Evaluaciones realizadas (total de evaluaciones completadas)
- Tests introducidos (total de TestSessions)
- Protocolos definidos

**Actividad reciente:** lista de las últimas 10 evaluaciones completadas (paciente display_id + protocolo + fecha)

**Acceso rápido:** botón prominente "Ver Pacientes" + botón "Nueva Evaluación" (→ redirige a selección de paciente)

---

### Patient List `/patients`

**Propósito:** Encontrar al paciente rápido. Diseño optimizado para búsqueda.

**Layout:**
- Barra de búsqueda grande y prominente (busca por display_id o iniciales, en tiempo real)
- Filtros opcionales: rango de edad, lateralidad
- Botón "Nuevo Paciente" (derecha, visible)
- Lista de pacientes como cards (no tabla) — más legible en tablet

**Patient Card** (en la lista):
```
[PKT-1A2B]  •  67 años  •  12 años escolaridad  •  Diestro
Último test: TMT-A — hace 3 días
Evaluaciones: 4 completadas  |  1 en progreso ← badge amarillo si hay activa
```
- Click en card → navega a `/patients/:id` (Patient Hub)

**Crear nuevo paciente** (`/patients/new`):
- Formulario sencillo:
  - Iniciales (opcional, max 5 chars, para identificación clínica)
  - Edad (18–120, número grande)
  - Años de escolaridad (0–30)
  - Lateralidad (3 botones grandes: Diestro / Zurdo / Ambidextro)
- Botón "Crear Paciente" → `POST /api/patients` → redirect automático al Patient Hub del nuevo paciente

---

### Patient Hub `/patients/:id`

**Esta es la página más importante de la aplicación.** Toda la interacción con un paciente ocurre aquí.

**Layout:** cabecera con datos del paciente + 3 secciones verticales

**Cabecera (sticky):**
```
← Volver     [PKT-1A2B]  •  67 años  •  12 años esc.  •  Diestro
                                          [Editar datos]  [Eliminar]
```

#### Sección 1: Evaluación Activa (solo si existe una evaluación en curso)

Banner destacado (fondo amarillo/ámbar) si hay una `ExecutionPlan` con status="active":
```
⚡ Evaluación en progreso: Protocolo "Rastreio Cognitivo"
   3 de 6 tests completados — iniciada hace 45 minutos
   [Continuar Evaluación →]
```
Click en "Continuar" → navega a `/patients/:id/evaluate/:planId`

#### Sección 2: Acciones Principales

Dos botones grandes y prominentes:
- **"🧪 Nueva Evaluación"** (primary, azul grande) → `/patients/:id/evaluate`
- **"⚡ Test Rápido"** (secondary) → abre selector de test individual + formulario inline

#### Sección 3: Perfil Cognitivo (la joya de la aplicación)

Visible directamente en la ficha del paciente, sin necesidad de navegar al Dashboard.

Si no hay tests: mensaje "Sin evaluaciones aún. Inicia una evaluación para ver el perfil cognitivo."

Si hay tests:
- **Selector de evaluación** (dropdown): mostrar todas las evaluaciones pasadas para comparar entre ellas o ver la más reciente
- **Radar Chart** (puntuaciones escalares) + **Bar Chart** (percentiles) side by side en desktop, apilados en tablet
- **Tabla de resultados**: Test | Fecha | PE | Percentil | Clasificación (badge coloreado)
- **Interpretación automática**: media PE, nivel global, punto fuerte, área de dificultad
- **Botón "Generar Informe PDF"** → `POST /api/reports/generate/:id` → descarga directa

#### Sección 4: Historial de Evaluaciones

Lista de evaluaciones (agrupadas por fecha/protocolo):
```
📋 Protocolo "Rastreio Cognitivo" — 15/03/2026 — COMPLETADO
   TMT-A (PE=12), TAVEC (PE=8), Fluidez-FAS (PE=10)...
   [Ver detalle]  [Descargar PDF]

📋 Test Individual: WAIS-IV — 10/01/2026 — COMPLETADO
   [Ver detalle]
```

---

### Evaluation Setup `/patients/:id/evaluate`

**Propósito:** Configurar la evaluación que se va a realizar. Flujo de 2 pasos.

**Paso 1: Elegir tipo de evaluación**

Dos opciones presentadas como tarjetas grandes:

**Opción A — Protocolo:**
- Grid de protocolos disponibles (tarjetas con nombre, categoría, número de tests)
- Filtro por categoría
- Al seleccionar un protocolo → ir a Paso 2

**Opción B — Test Individual:**
- Grid de los 19 tipos de test (tarjetas con icono, nombre, descripción breve)
- Al seleccionar → salta directamente al formulario del test (sin pasar por Paso 2)

**Paso 2: Personalizar protocolo (solo si eligió protocolo)**

Pantalla de customización del plan para *este paciente específico*. No modifica el protocolo base — crea o actualiza el `ExecutionPlan` del paciente.

**Sección A — Tests del protocolo base (reordenables):**
- Lista de tests con drag-handle para reordenar
- Toggle activo/excluido por test (= `skip:true` / `skip:false`)
- Tests excluidos se muestran tachados pero permanecen visibles (pueden reactivarse)
- Campo "Nota previa" opcional por test

**Sección B — Añadir tests adicionales:**
- Botón `+ Añadir test` despliega un picker con los tests de los 19 disponibles que NO están ya en el protocolo
- Tests añadidos aparecen con badge "Añadido" diferenciándolos de los del protocolo base
- También pueden ser reordenados, excluidos o eliminados (con `×`)

**Resumen previo:** Al pie de la página, lista final (solo tests activos, en orden) para confirmar antes de iniciar

Botón grande "▶ Iniciar Evaluación" → `POST /api/evaluations` → navega a `/patients/:id/evaluate/:planId`

> Si el paciente ya tiene un `ExecutionPlan` con `status="draft"` o `status="active"` para este protocolo, se carga el plan existente en lugar de crear uno nuevo — permitiendo retomar una sesión interrumpida.

---

### Evaluation Session `/patients/:id/evaluate/:planId`

**Modo de evaluación: pantalla completa, sin distracciones.** El sidebar desaparece. Solo el contenido del test actual.

**Header mínimo (sticky, pequeño):**
```
[PKT-1A2B]  •  Protocolo: Rastreio Cognitivo
████████░░░░  Test 3 de 6  —  TMT-A
```

**Área principal: Formulario del test actual**

El formulario ocupa toda la pantalla disponible. Campos grandes, legibles, táctiles.

Cada formulario tiene:
1. **Nombre del test + descripción breve** (al tope)
2. **Campos de datos** (específicos por test — ver §7)
3. **Sección de observaciones** (siempre presente, al final del formulario):
   - Textarea "Observaciones del proceso" (placeholder: "p.ej. el paciente mostró dificultades en...")
   - Checklist rápido (checkbox grande, táctil):
     - ☐ Dificultades de comprensión
     - ☐ Fatiga observada
     - ☐ Ansiedad elevada
     - ☐ Baja motivación
     - ☐ Interrupciones durante el test

**Footer de acciones:**
```
[Omitir este test]          [Guardar y Continuar →]
```
- "Guardar y Continuar" → `POST /api/tests` con raw_data + observaciones → muestra resultado brevemente (2s toast) → avanza al siguiente test

**Modos de entrada — selector al iniciar la sesión:**

| Modo | Cuándo usarlo | Cronómetro | Entrada |
|------|--------------|-----------|---------|
| `live` — Sesión en vivo | Paciente presente, se registra en tiempo real | ✅ Visible y activo | Inmediata |
| `deferred` — Entrada desde papel | El clínico anotó en papel y transcribe después | ❌ Oculto | Posterior |

El modo se selecciona en el primer paso de la sesión (`EvaluationSetup.tsx`) y se persiste en `ExecutionPlan.mode`. No cambia ningún formulario ni endpoint — solo controla la visibilidad del cronómetro y el texto de la UI (ej. "Guardar y continuar" vs "Guardar registro").
- "Omitir" → actualiza ExecutionPlan marcando skip=true → avanza al siguiente

**Resultado tras guardar (toast/mini-card que aparece 2 segundos):**
```
✅ TMT-A guardado — PE: 12  |  Percentil: 75%  |  Normal
```
Luego avanza automáticamente al siguiente test.

**Caso especial: último test → redirige a `/summary`**

---

### Evaluation Summary `/patients/:id/evaluate/:planId/summary`

Aparece al completar todos los tests de la evaluación.

**Layout:**

**1. Resumen de resultados de esta evaluación:**
Tabla: Test | PE | Percentil | Clasificación (badge) | Observaciones

**2. Perfil cognitivo inmediato:**
- Radar chart + bar chart de los tests de ESTA evaluación
- Interpretación automática: nivel global, punto fuerte, área de dificultad

**3. Comparación con evaluaciones anteriores (si existen):**
- Line chart mostrando evolución de PE por test a lo largo del tiempo
- Solo se muestra si el paciente tiene evaluaciones previas con tests en común

**4. Tests omitidos / marcados para repetir:**
- Si hay tests con repeat_later=true → sección "Tests pendientes de repetir" con botón para repetirlos ahora

**5. Acciones finales:**
```
[💾 Guardar variante del protocolo]    [📄 Descargar Informe PDF]    [← Volver al paciente]
```
- "Guardar variante" → modal para nombrar la variante → `PUT /api/evaluations/:planId` con is_saved_variant=true
- "Descargar PDF" → `POST /api/reports/generate/:patientId` con los IDs de los tests de esta evaluación → descarga automática
- "Volver al paciente" → `/patients/:id`

---

### Protocol Library `/protocols`

**Propósito:** Gestionar la biblioteca de protocolos de la clínica. Flujo secundario (se configura una vez, se reutiliza).

**Layout: 2 columnas en desktop, pestaña en móvil**

**Columna/pestaña izquierda — Biblioteca:**
- Filtro por categoría
- Lista de protocolos como cards:
  ```
  📋 Rastreio Cognitivo  [Rastreio]
  6 tests • TMT-A, TAVEC, Fluidez-FAS...
  [Editar]  [Eliminar]
  ```

**Columna/pestaña derecha — Crear / Editar Protocolo:**

Formulario visible permanentemente (no en modal):
- Nombre (único, requerido)
- Categoría (text input con sugerencias de categorías existentes)
- Descripción (textarea)
- **Selector de tests:** grid de los 19 tests disponibles con checkboxes. Al hacer check, el test aparece en la lista de "seleccionados"
- **Lista de tests seleccionados** con reordenamiento (drag-and-drop o botones ↑↓)
- Botón "Guardar Protocolo"

Al editar un protocolo existente: los campos se rellenan con los datos actuales.

> **Control de acceso en frontend:**
> - Si el usuario NO tiene `can_manage_protocols`: la página de protocolos es solo lectura — los campos están desactivados, los botones "Guardar", "Eliminar" y "Nuevo protocolo" están ocultos, y se muestra el banner *"Solo lectura — contacta con el administrador para obtener permisos de edición"*.
> - La customización por paciente (Pantalla 4) sigue disponible para todos los Neuropsicólogos independientemente de este flag.

---

### Settings `/settings`

Solo accesible para Admin. Organizadas en secciones verticales.

**Sección: Sistema**
- Botón "💾 Crear Backup" → `POST /api/system/backup` → toast con nombre del archivo generado

**Sección: Gestión de Usuarios**
- Tabla de usuarios: username, nombre completo, rol (badge), activo (badge), fecha creación
- Botón "Nuevo Usuario" → formulario inline expandible:
  - username, nombre completo, rol (select), contraseña, confirmar contraseña
- Por cada usuario en la tabla: botones "Editar" y "Eliminar" (con confirmación)
- Al editar: inline form para cambiar nombre/rol + cambiar contraseña

**Sección: Registro de Auditoría**
- Tabla de audit logs con filtro por tipo de acción
- Columnas: Fecha/Hora, Usuario, Acción, Recurso, IP
- Descarga de logs en JSON

---

### Navegación Global (AppShell)

**Sidebar colapsable:**

En desktop (>1024px): sidebar fijo de 240px de ancho
En tablet (768-1023px): sidebar colapsable con icono de hamburguesa
En móvil / modo evaluación: sidebar completamente oculto

Items del sidebar:
```
🧠 Nóos
──────────────
📊 Overview          /
👥 Pacientes         /patients
📋 Protocolos        /protocols
──────────────
⚙️  Configuración    /settings   [solo Admin]
──────────────
[Avatar] Nombre usuario
         Rol
         [Cerrar sesión]
```

**Breadcrumb en cabecera:**
```
Pacientes > PKT-1A2B > Evaluación: Rastreio Cognitivo > TMT-A
```

**Modo evaluación (durante `/evaluate/:planId`):**
- Sidebar se oculta completamente
- Solo se muestra el header mínimo con progreso
- `Esc` o botón "✕ Salir de la sesión" → modal de confirmación "¿Salir de la evaluación? El progreso hasta ahora se ha guardado."


## 16. Manejo de Errores

### Backend (FastAPI)
- **401** Unauthorized: token inválido/expirado → `{"detail": "No autenticado"}`
- **403** Forbidden: rol insuficiente → `{"detail": "Permisos insuficientes"}`
- **404** Not Found: recurso no existe → `{"detail": "No encontrado"}`
- **409** Conflict: nombre duplicado → `{"detail": "Ya existe"}`
- **422** Unprocessable Entity: validación Pydantic
- **500** Internal Server Error: loguear internamente, responder genérico

### Frontend
- Interceptor de Axios: si 401 → limpiar token + redirect a `/login`
- Si 403 → toast "Sin permisos para esta acción"
- Si 422 → mostrar errores de campo del formulario
- Toast de éxito en todas las operaciones completadas
- Modal de confirmación antes de cualquier eliminación

---

## 17. Seguridad (Cloud Deployment)

- **HTTPS:** configurar nginx como reverse proxy con certificado SSL (Let's Encrypt / certbot)
- **CORS:** restringir a dominio específico en producción
  ```python
  origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
  app.add_middleware(CORSMiddleware, allow_origins=origins,
                     allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
  ```
- **Rate limiting:** máximo 5 intentos de login por IP en 15 minutos (usar `slowapi`)
- **Variables de entorno obligatorias (`.env`):**
  ```env
  ADMIN_PASSWORD=<mínimo 12 chars, mayúsculas+minúsculas+números+símbolo>
  JWT_SECRET_KEY=<mínimo 32 chars aleatorios>
  ALLOWED_ORIGINS=https://tu-dominio.com
  DATABASE_URL=sqlite:///./noos.db
  ```
- **bcrypt work factor:** 12
- **Nunca loguear contraseñas** ni stack traces completos hacia el cliente
- **Datos RGPD:** nunca almacenar nombres, DNI, emails — solo age, education_years, laterality, initials opcionales
- **Cascade delete:** borrar paciente elimina todas sus sessions y assignments (right to be forgotten)

---

## 18. Docker para Cloud

### `docker-compose.yml`
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    env_file: .env
    volumes:
      - ./data:/app/data
      - ./backups:/app/backups
      - ./reports:/app/reports
    ports:
      - "8000:8000"

  frontend:
    build: ./frontend
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

### Backend `Dockerfile`
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend `Dockerfile`
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
```

### `nginx.conf` (fragmento clave)
```nginx
server {
    listen 443 ssl;
    server_name tu-dominio.com;
    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;

    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
    }

    location / {
        root /usr/share/nginx/html;
        try_files $uri /index.html;
    }
}
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

---

## 19. Orden de Implementación Recomendado

### Fase 1 — Backend completo
1. `database.py` + todos los modelos ORM + `init_db()` con admin por defecto
2. `auth/` completo + router `/api/auth`
3. `services/normatives.py` (algoritmo §6 — tests unitarios inmediatamente)
4. `services/tower_of_london.py` (algoritmo §8 — tests unitarios)
5. `services/clinical_interpreter.py`
6. `services/audit_service.py`
7. Routers: patients → tests → protocols → evaluations → reports → users → audit → system
8. `services/report_service.py` + `pdf_generator.py` + `docx_generator.py`

### Fase 2 — Frontend: infraestructura
1. `npm create vite@latest frontend -- --template react-ts`
2. Instalar dependencias:
   ```bash
   npm install axios react-router-dom zustand react-hook-form zod recharts sonner
   npx shadcn@latest init
   ```
3. Configurar `api/client.ts` con interceptores JWT (401 → logout)
4. Zustand stores: `auth.ts` + `evaluation.ts`
5. `AppShell.tsx` + `Sidebar.tsx` + `ProtectedRoute.tsx`
6. Configurar rutas en `App.tsx`

### Fase 3 — Frontend: flujo principal (patient hub)
7. `PatientList.tsx` + `PatientCard.tsx` + búsqueda en tiempo real
8. `PatientHub.tsx` con las 4 secciones
9. `CognitiveProfile.tsx` con `CognitiveRadarChart` + `PercentileBarChart`
10. `EvaluationHistory.tsx`

### Fase 4 — Frontend: flujo de evaluación (el más crítico)
11. `EvaluationSetup.tsx` (selección de protocolo / test individual)
12. Todos los formularios en `components/evaluation/forms/` (uno por tipo de test)
13. `TestForm.tsx` dispatcher dinámico
14. `EvaluationSession.tsx` con modo pantalla completa + progress bar
15. `EvaluationSummary.tsx` con comparación y descarga PDF

### Fase 5 — Frontend: resto de páginas
16. `Overview.tsx`
17. `ProtocolLibrary.tsx`
18. `Settings.tsx`
19. `Login.tsx`


## 20. Puntos Críticos — No Olvidar

- ✅ **Proyecto nuevo vacío** — no copiar ningún código ni JSON del proyecto anterior
- ✅ **Tablas JSON de normativas** — crearlas desde cero con la estructura del §6; los datos clínicos los debe introducir el equipo
- ✅ **El flujo principal es el Patient Hub** — todo ocurre en `/patients/:id`, no en páginas separadas
- ✅ **Modo evaluación = pantalla completa** — sidebar oculto durante `/evaluate/:planId`
- ✅ **Algoritmo de interpolación lineal exacto** — ver §6, es el núcleo del sistema
- ✅ **`display_id` del paciente** (PKT-XXXX) en toda la UI para privacidad
- ✅ **Tests editables desde el Patient Hub** — botón editar en cada resultado; abre modal con el mismo formulario del test prellenado; `PATCH /api/tests/:id` recalcula automáticamente; se registra en audit log
- ✅ **Protocolo customizable por paciente** — el `ExecutionPlan` permite añadir tests extras (`added:true`) y excluir tests del protocolo base (`skip:true`) sin modificar el protocolo original; customización posible también durante la sesión activa
- ✅ **Modo de sesión `deferred`** — sin cronómetro visible; mismo flujo, misma API, diferente contexto visual
- ✅ **Audit logging** en cada operación sensible (§11)
- ✅ **Roles verificados en el backend**, no solo en frontend
- ✅ **`can_manage_protocols` verificado en backend** con `require_protocol_management()` — el frontend lo refleja pero no es la única barrera
- ✅ **Solo Administrador puede cambiar `can_manage_protocols`** de otros usuarios — incluido el suyo propio si lo desea
- ✅ **`calculated_scores` siempre calculados en el backend** al guardar el test
- ✅ **Informes generados en backend** (PDF y Word), devueltos como stream binario — `application/pdf` o `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- ✅ **`ExecutionPlan` persistido en DB** — el progreso no se pierde si se cierra el navegador
- ✅ **Cascade delete en pacientes** — RGPD: borrar paciente elimina sessions + assignments
- ✅ **Variables de entorno validadas al arrancar** — fallar con mensaje claro si faltan
- ✅ **Tablet-first** — formularios con campos grandes, legibles con teclado táctil


## 21. Glosario

| Término | Significado |
|---------|-------------|
| PE (Puntuación Escalar) | Score estandarizado, escala 1–19, media=10, DE=3 |
| Percentil | Posición en distribución poblacional (0–100) |
| Z-Score | Desviaciones estándar respecto a la media |
| NEURONORMA | Batería normativa española para adultos mayores |
| TMT | Trail Making Test — atención y función ejecutiva |
| TAVEC | Test de Aprendizaje Verbal España-Complutense |
| Fluidez-FAS | Fluidez fonológica letras F, A, S |
| Superior | PE 13–19, Percentil ≥75 |
| Normal | PE 7–12, Percentil 25–74 |
| Limítrofe | PE 4–6, Percentil 10–24 |
| Deficitario | PE 1–3, Percentil <10 |
| display_id | ID de privacidad del paciente (PKT-XXXX) visible en UI |
| ExecutionPlan | Plan de ejecución personalizado de un protocolo para un paciente |


## 22. Sistema de Diseño — Identidad Visual Triune / Nóos

La app Nóos es un producto de **Triune Neuropsicología**. El diseño visual debe ser coherente con la marca existente en [triuneneuropsicologia.com](https://triuneneuropsicologia.com). Usa el sistema de diseño siguiente como única fuente de verdad para colores, tipografía y componentes.

---

### 22.1 Nombre y Logo

- **Nombre de la app:** Nóos *(del griego νόος — mente, intelecto)*
- **Logotipo:** usar el logo oficial de Triune. URL del PNG de alta resolución:  
  `https://triuneneuropsicologia.com/wp-content/uploads/2025/11/Recurso-14@4x.png`  
  Solicitar al equipo la versión SVG o versión blanca (para fondo oscuro en el sidebar).
- **Sidebar oscuro:** usar variante blanca/negativa del logo sobre fondo `#4B164F`.

---

### 22.2 Paleta de Colores

Extraída del CSS de Elementor de la web oficial (`post-22.css`).

#### Tokens semánticos

```css
/* Paleta Nóos — fuente: Elementor kit Triune */
--color-primary:      #4B164F;    /* Morado oscuro — sidebar, hero backgrounds */
--color-accent:       #B738F2;    /* Violeta vibrante — texto accent, highlights */
--color-secondary:    #9839D1;    /* Morado medio — botones primarios, estados activos */
--color-deep:         #270D38;    /* Casi-negro morado — texto sobre fondos claros */
--color-bg:           #F6F5F2;    /* Crema/off-white cálido — fondo de página */
--color-surface:      #FFFFFF;    /* Blanco — fondo de cards, modales */
--color-border:       #0000001A;  /* Sombra/borde sutil (10% negro) */
--color-text-muted:   #7E7E7E;    /* Gris — texto secundario, labels */
```

#### Tabla completa

| Token | Hex | Uso principal |
|-------|-----|---------------|
| `primary` | `#4B164F` | Sidebar bg, nav activo, hero sections |
| `accent` | `#B738F2` | Texto accent en headings, badges destacados |
| `secondary` | `#9839D1` | Botones CTA, links, progress bar |
| `deep` | `#270D38` | Texto oscuro, nav hover |
| `bg` | `#F6F5F2` | Fondo general (nunca blanco puro) |
| `surface` | `#FFFFFF` | Cards, inputs, modales |
| `border` | `#0000001A` | Bordes de cards, separadores |
| `text-muted` | `#7E7E7E` | Labels secundarios, timestamps |
| `success` | `#22c55e` | Clasificación "Superior" |
| `warning` | `#eab308` | Clasificación "Limítrofe" |
| `danger` | `#ef4444` | Clasificación "Deficitario" |
| `info` | `#3b82f6` | Clasificación "Normal" |

#### Configuración Tailwind (`tailwind.config.ts`)

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary:   "#4B164F",
          accent:    "#B738F2",
          secondary: "#9839D1",
          deep:      "#270D38",
        },
        bg:      "#F6F5F2",
        surface: "#FFFFFF",
        muted:   "#7E7E7E",
      },
      fontFamily: {
        sans: ['"Work Sans"', "sans-serif"],
      },
      borderRadius: {
        pill: "9999px",
        card: "12px",
        input: "9px",
      },
      boxShadow: {
        card:       "0 1px 4px 0 rgba(0,0,0,0.10)",
        "card-hover": "0 4px 16px 0 rgba(75,22,79,0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

---

### 22.3 Tipografía

**Fuente única: Work Sans** — cargada desde Google Fonts.

```html
<!-- En index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600&display=swap"
  rel="stylesheet"
/>
```

#### Escala tipográfica (del CSS de Triune)

| Elemento | Tamaño | Peso | Line-height | Notas |
|----------|--------|------|-------------|-------|
| Display H1 | 52px | 400 | 1.1em | Títulos hero |
| H2 | 48px | 400 | 1.2em | letter-spacing: -0.5px |
| H3 | 30px | 500 | — | Títulos de sección |
| H4 | 22px | 500 | — | Títulos de card |
| H5 | 20px | 500 | — | Subtítulos |
| H6 | 18px | 500 | — | Labels de sección |
| Body | 16px | 400 | 1.4em | Texto de párrafo |
| Small label | 11px | 500 | — | UPPERCASE, letter-spacing -0.2px |
| Dato clínico | 32–40px | 600 | 1.0em | PE, percentil |

#### Patrón de heading bicolor

```tsx
// Título con tramo en morado vibrante (patrón del sitio Triune)
<h2 className="text-brand-deep">
  Perfil <span className="text-brand-accent">cognitivo</span>
</h2>

<h1 className="text-brand-deep">
  Evaluación <span className="text-brand-accent">neuropsicológica</span> completa
</h1>
```

---

### 22.4 Componentes UI — Especificación Visual

#### Botones

```tsx
// Primario — CTA principal
<button className="bg-brand-secondary text-white rounded-pill px-6 py-3 font-medium text-base hover:bg-brand-primary transition-colors shadow-sm">
  Iniciar evaluación
</button>

// Secundario — acción secundaria
<button className="border border-brand-secondary text-brand-secondary rounded-pill px-6 py-3 font-medium text-base hover:bg-brand-secondary hover:text-white transition-colors">
  Ver historial
</button>

// Ghost — acción terciaria
<button className="text-brand-secondary rounded-pill px-4 py-2 hover:bg-brand-secondary/10 transition-colors">
  Cancelar
</button>
```

#### Cards

```tsx
<div className="bg-surface rounded-card shadow-card border border-black/10 p-6 hover:shadow-card-hover transition-shadow">
  {/* contenido */}
</div>
```

#### Inputs

```tsx
<input className="w-full bg-surface border border-gray-200 rounded-input px-4 py-3 text-base text-brand-deep placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-secondary/40 focus:border-brand-secondary transition-colors" />
```

#### Badges de clasificación clínica

```tsx
const classificationStyles: Record<string, string> = {
  Superior:    "bg-green-100 text-green-800 border border-green-200",
  Normal:      "bg-blue-100  text-blue-800  border border-blue-200",
  "Limítrofe": "bg-yellow-100 text-yellow-800 border border-yellow-200",
  Deficitario: "bg-red-100   text-red-800   border border-red-200",
};

<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classificationStyles[clasificacion]}`}>
  {clasificacion}
</span>
```

---

### 22.5 Sidebar / Navegación Principal

```tsx
<aside className="w-64 h-full bg-brand-primary text-white flex flex-col">
  {/* Logo */}
  <div className="p-6 border-b border-white/10">
    <img src="/logo-noos-white.png" alt="Nóos" className="h-8" />
  </div>

  {/* Nav */}
  <nav className="flex-1 p-4 space-y-1">
    {navItems.map(item => (
      <NavLink
        key={item.href}
        to={item.href}
        className={({ isActive }) =>
          `flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
            isActive ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`
        }
      >
        <item.icon className="w-5 h-5" />
        {item.label}
      </NavLink>
    ))}
  </nav>

  {/* Usuario al fondo */}
  <div className="p-4 border-t border-white/10 flex items-center gap-3">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-white truncate">{user.name}</p>
      <p className="text-xs text-white/60 truncate">{user.role}</p>
    </div>
    <button onClick={logout} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white">
      <LogOut className="w-4 h-4" />
    </button>
  </div>
</aside>
```

**Items del sidebar:**
```tsx
const navItems = [
  { href: "/dashboard",  label: "Inicio",      icon: LayoutDashboard },
  { href: "/patients",   label: "Pacientes",   icon: Users },
  { href: "/protocols",  label: "Protocolos",  icon: ClipboardList },
  { href: "/settings",   label: "Ajustes",     icon: Settings },
];
```

> En modo evaluación (`/patients/:id/evaluate/:planId`), el sidebar se oculta completamente para máxima concentración clínica.

---

### 22.6 Iconografía — Lucide React

**Librería oficial:** [lucide-react](https://lucide.dev)

```bash
npm install lucide-react
```

Lucide es geométrico, minimal y limpio — coherente con los iconos abstractos del sitio de Triune. **No usar** Phosphor, Font Awesome ni Heroicons.

#### Mapa de iconos por función

| Función | Ícono Lucide |
|---------|-------------|
| Pacientes | `Users` |
| Evaluación / Test | `ClipboardCheck` |
| Protocolo | `ClipboardList` |
| Dashboard | `LayoutDashboard` |
| Informe PDF | `FileText` |
| Nuevo paciente | `UserPlus` |
| Buscar | `Search` |
| Calendario | `Calendar` |
| Ajustes | `Settings` |
| Cerrar sesión | `LogOut` |
| Advertencia | `AlertTriangle` |
| Éxito | `CheckCircle2` |
| Error | `XCircle` |
| Info | `Info` |
| Expandir | `ChevronDown` |
| Volver | `ArrowLeft` |
| Editar | `Pencil` |
| Borrar | `Trash2` |
| Descargar | `Download` |
| Cognitivo / brain | `Brain` |
| Tiempo | `Timer` |

#### Tamaños estándar

```tsx
<Icon className="w-4 h-4" />   // 16px — inline con texto
<Icon className="w-5 h-5" />   // 20px — sidebar, botones
<Icon className="w-8 h-8" />   // 32px — feature cards
<Icon className="w-12 h-12" /> // 48px — empty states
```

---

### 22.7 Layout General

```
┌──────────────────────────────────────────────────────────┐
│  Sidebar w-64 (bg #4B164F) │  Contenido principal         │
│                             │  (bg #F6F5F2)                │
│  [Logo Nóos blanco]         │                              │
│                             │  ┌─────────┐  ┌─────────┐   │
│  ● Inicio                   │  │ Card    │  │ Card    │   │
│  ● Pacientes                │  │ #FFFFFF │  │ #FFFFFF │   │
│  ● Protocolos               │  └─────────┘  └─────────┘   │
│  ● Ajustes                  │                              │
│                             │                              │
│  ─────────────────          │                              │
│  [Avatar] Dr. García [→]    │                              │
└──────────────────────────────────────────────────────────┘
```

**Breakpoints:**
- Desktop (≥1024px): sidebar fijo, siempre visible
- Tablet portrait (768–1023px): sidebar colapsado a iconos (w-16), expandible
- Modo evaluación: sidebar oculto completamente

---

### 22.8 Visualizaciones Clínicas

#### Puntuación Escalar (PE) — display grande

```tsx
<div className="flex flex-col items-center gap-1">
  <span className="text-5xl font-semibold text-brand-deep">{pe}</span>
  <span className="text-xs font-medium uppercase tracking-wide text-muted">PE</span>
</div>
```

#### Barra de percentil con color dinámico

```tsx
const barColor =
  percentile >= 75 ? "bg-green-500" :
  percentile >= 25 ? "bg-blue-500" :
  percentile >= 10 ? "bg-yellow-500" : "bg-red-500";

<div className="space-y-1">
  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
    <div
      className={`h-full rounded-full transition-all duration-700 ${barColor}`}
      style={{ width: `${percentile}%` }}
    />
  </div>
  <div className="flex justify-between text-xs text-muted">
    <span>P{percentile.toFixed(1)}</span>
    <span>{clasificacion}</span>
  </div>
</div>
```

#### Gráfico radar — colores de marca (Plotly.js)

```typescript
const radarTrace = {
  type: "scatterpolar",
  fill: "toself",
  fillcolor: "rgba(152, 57, 209, 0.15)",  // brand.secondary 15% opacidad
  line: { color: "#9839D1", width: 2 },    // brand.secondary
  marker: { color: "#4B164F", size: 6 },   // brand.primary
};

const meanTrace = {
  type: "scatterpolar",
  line: { color: "#B738F2", dash: "dot", width: 1.5 },  // brand.accent
};

const radarLayout = {
  paper_bgcolor: "#FFFFFF",
  plot_bgcolor:  "#FFFFFF",
  font: { family: "Work Sans, sans-serif", color: "#270D38" },
  polar: {
    radialaxis: { range: [0, 19], tickfont: { size: 10 } },
    bgcolor: "#F6F5F2",
  },
};
```

---

## 23. Abordagem de Desenvolvimento — TDD Obrigatório

> **REGRA PERMANENTE:** Todo o código novo deve seguir Test-Driven Development.
> Escrever os testes **antes** da implementação. Nunca implementar sem testes a falhar primeiro.

### 23.1 Ciclo TDD

```
1. RED   → Escrever teste que falha (descreve o comportamento desejado)
2. GREEN → Implementar o mínimo para o teste passar
3. REFACTOR → Limpar o código sem quebrar os testes
```

### 23.2 Backend (pytest)

**Stack de testes:**
- `pytest` + `pytest-asyncio` — já em requirements.txt
- `httpx` — cliente async para testar FastAPI (já em requirements.txt)
- `pytest-cov` — cobertura de código (adicionar a requirements.txt)

**Estrutura:**
```
backend/tests/
├── conftest.py          # fixtures: app, client, db, admin_token, neuro_token
├── test_auth.py
├── test_patients.py
├── test_protocols.py
├── test_tests.py
├── test_execution_plans.py
└── test_normatives.py
```

**Padrão de teste:**
```python
# Sempre testar: sucesso, erro de validação, erro de permissão
def test_create_patient_success(client, neuro_token):
    res = client.post("/api/patients/", json={...}, headers=neuro_token)
    assert res.status_code == 201
    assert res.json()["display_id"].startswith("PKT-") or "(" in res.json()["display_id"]

def test_create_patient_forbidden_for_observador(client, observer_token):
    res = client.post("/api/patients/", json={...}, headers=observer_token)
    assert res.status_code == 403
```

**Fixtures obrigatórias em `conftest.py`:**
- `db` — sessão SQLite in-memory isolada por teste
- `client` — `TestClient` do FastAPI com a DB de teste
- `admin_token` — headers `{"Authorization": "Bearer <token>"}` com role Administrador
- `neuro_token` — headers com role Neuropsicólogo
- `observer_token` — headers com role Observador

### 23.3 Frontend (Vitest + React Testing Library)

**Stack de testes:**
```json
"vitest": "^1.6.0",
"@testing-library/react": "^15.0.0",
"@testing-library/user-event": "^14.5.2",
"@testing-library/jest-dom": "^6.4.0",
"jsdom": "^24.0.0",
"msw": "^2.3.0"
```

**Estrutura:**
```
frontend/src/
├── components/
│   ├── layout/
│   │   └── __tests__/
│   │       └── Sidebar.test.tsx
│   └── patient/
│       └── __tests__/
│           └── PatientCard.test.tsx
└── pages/
    └── __tests__/
        └── PatientList.test.tsx
```

**Padrão de teste:**
```typescript
// Testar: render correto, interações do utilizador, estados de erro/loading
it('mostra lista de pacientes após carregar', async () => {
  server.use(http.get('/api/patients/', () => HttpResponse.json([mockPatient])))
  render(<PatientList />)
  expect(await screen.findByText('PKT-1A2B')).toBeInTheDocument()
})
```

**MSW (Mock Service Worker):** usar para interceptar chamadas à API nos testes de frontend — nunca fazer chamadas reais à API nos testes.

### 23.4 Critérios de Aceitação por Feature

Cada feature deve ter testes que cobrem:
1. **Happy path** — fluxo normal funciona
2. **Validação** — dados inválidos rejeitados com mensagem correta
3. **Permissões** — roles sem acesso recebem 403/redirect
4. **Edge cases** — lista vazia, ID inexistente, etc.

### 23.5 Executar testes

```bash
# Backend
cd backend && source venv/bin/activate
pytest tests/ -v --cov=app --cov-report=term-missing

# Frontend
cd frontend && npm test
# ou para UI visual:
npm run test:ui
```
