# Car Dealership Chatbot - Backend

Sistema de chatbot inteligente para concesionarios de autos con arquitectura de flujos visuales y procesamiento de lenguaje natural.

Link: https://car-dealership-se.up.railway.app/

## 🚀 Tecnologías

| Categoría    | Tecnología        | Versión |
| ------------- | ------------------ | -------- |
| Framework     | NestJS             | 11.x     |
| Base de datos | PostgreSQL         | 15+      |
| ORM           | TypeORM            | 0.3.x    |
| LLM           | OpenAI GPT-4o-mini | -        |
| Runtime       | Node.js            | 22.x     |

## 🏗️ Arquitectura

### Decisiones de Diseño

**¿Por qué NestJS?**

- Filosofía de **Feature Modules** que permite organización clara del código
- Inyección de dependencias nativa para desacoplamiento
- Decoradores que facilitan la documentación del código
- Excelente soporte para TypeScript

**¿Por qué PostgreSQL?**

- Escalabilidad probada en producción
- Estabilidad y madurez del ecosistema
- Soporte nativo para JSON (ideal para definiciones de flujos)
- Transacciones ACID

### Patrón Feature Module

```
src/
├── modules/                 # Feature Modules
│   ├── chat/               # Módulo de conversaciones
│   │   ├── chat.controller.ts
│   │   ├── chat.service.ts
│   │   └── chat.module.ts
│   ├── flow/               # Módulo de flujos
│   │   ├── flow.controller.ts
│   │   ├── flow.service.ts
│   │   └── flow.module.ts
│   └── engine/             # Módulo del motor de ejecución
│       └── engine.module.ts
├── engine/                  # Core del motor de flujos
│   ├── flow-runner.service.ts
│   ├── node-registry.ts
│   ├── nodes.ts
│   └── types.ts
├── entities/               # Entidades TypeORM
├── services/               # Servicios compartidos
├── dto/                    # Data Transfer Objects
└── config/                 # Configuraciones
```

## 🔧 Motor de Flujos (Flow Engine)

### Concepto

El sistema implementa un **motor de ejecución de flujos** que permite definir visualmente cómo el chatbot procesa mensajes. Cada flujo está compuesto por:

- **Nodos**: Unidades de procesamiento (orquestador, especialistas, validadores)
- **Aristas**: Conexiones condicionales entre nodos
- **Estado**: Contexto compartido durante la ejecución

### Tipos de Nodos

| Tipo                        | Descripción                                 |
| --------------------------- | -------------------------------------------- |
| `orchestrator.openai`     | Clasifica intención y rutea a especialistas |
| `faq.specialist.openai`   | Responde preguntas frecuentes                |
| `autos.specialist.openai` | Consultas de vehículos con filtros          |
| `dates.specialist.openai` | Gestión de citas                            |
| `validator.usecase`       | Valida campos requeridos por caso de uso     |
| `memory.load`             | Carga contexto de conversación              |
| `response.compose`        | Genera respuesta final                       |
| `generic.response.openai` | Respuestas genéricas                        |

### Flujo de Ejecución

```
Usuario envía mensaje
       ↓
┌─────────────────┐
│  Memory Load    │  ← Carga historial de conversación
└────────┬────────┘
         ↓
┌─────────────────┐
│  Orchestrator   │  ← Clasifica intención (FAQ/Autos/Citas)
└────────┬────────┘
         ↓
    [Routing]
    /   |   \
   ↓    ↓    ↓
┌────┐┌────┐┌────┐
│FAQ ││Auto││Date│  ← Especialistas
└──┬─┘└──┬─┘└──┬─┘
   └──┬──┴──┬──┘
      ↓     ↓
┌─────────────────┐
│ Response Compose│  ← Genera respuesta final
└─────────────────┘
```

## 📊 Modelo de Datos

### Entidades Principales

```
┌─────────────────┐     ┌─────────────────┐
│      Flow       │     │  Conversation   │
├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │
│ name            │     │ flowId          │
│ definition      │◄────│ createdAt       │
│ isActive        │     │ updatedAt       │
│ version         │     └────────┬────────┘
└─────────────────┘              │
                                 │ 1:N
                                 ↓
                    ┌─────────────────────┐
                    │        Turn         │
                    ├─────────────────────┤
                    │ id                  │
                    │ conversationId      │
                    │ role                │
                    │ content             │
                    │ createdAt           │
                    └─────────────────────┘
```

## 🔌 API REST

### Endpoints

```
GET    /api/flows              # Listar flujos
POST   /api/flows              # Crear flujo
GET    /api/flows/active       # Obtener flujo activo
GET    /api/flows/:id          # Obtener flujo por ID
PUT    /api/flows/:id          # Actualizar flujo
DELETE /api/flows/:id          # Eliminar flujo
POST   /api/flows/:id/activate # Activar flujo

GET    /api/chat/conversations           # Listar conversaciones
GET    /api/chat/:conversationId         # Obtener conversación
POST   /api/chat/:conversationId/message # Enviar mensaje

GET    /api/node-types         # Listar tipos de nodos disponibles
```

## 🛠️ Instalación

### Requisitos

- Node.js 22+
- PostgreSQL 15+
- OpenAI API Key

### Variables de Entorno

```bash
# .env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=tu_password
DATABASE_NAME=car_dealership

OPENAI_API_KEY=sk-...
```

### Comandos

```bash
# Instalar dependencias
npm install

# Inicializar base de datos
psql -U postgres -d car_dealership -f scripts/init-db.sql

# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# e2e tests
npm run test:e2e

# Coverage
npm run test:cov
```

## 📁 Estructura de Servicios

### OpenAI Service

Centraliza todas las interacciones con GPT-4o-mini:

- `orchestrate()`: Clasifica intención del usuario
- `generateFaqAnswer()`: Genera respuestas de FAQ
- `extractAutosFilters()`: Extrae filtros de búsqueda de vehículos
- `extractDatesEntities()`: Extrae datos para citas
- `extractConsultationEntities()`: Extrae datos de consultas

### Flow Runner Service

Ejecuta flujos de manera iterativa:

1. Carga definición del flujo activo
2. Inicia desde nodo de entrada
3. Ejecuta handler de cada nodo
4. Sigue aristas según condiciones
5. Retorna respuesta final

## 🔐 Buenas Prácticas Implementadas

- **Feature Modules**: Cada funcionalidad encapsulada en su módulo
- **DTOs con validación**: Class-validator para validación de entrada
- **Logging estructurado**: Logger de NestJS en cada servicio
- **Manejo de errores**: Excepciones HTTP apropiadas
- **Configuración centralizada**: ConfigModule con validación
- **Prefix global**: `/api` para todas las rutas

## 📄 Licencia

MIT
