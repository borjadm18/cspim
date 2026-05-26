# AGENTS

## Propósito

Este archivo define cómo deben trabajar agentes e integrantes técnicos dentro del único repo válido de Content Store.

## Identidad del proyecto

- Repo canónico:
  - `C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main`
- Repo deprecado que no debe usarse como fuente de verdad:
  - `C:\Users\novic\OneDrive\Escritorio\projects\Pimly`

## Qué es este proyecto

Aplicación Vite + React + TypeScript para:

- explorar catálogo de productos
- abrir ficha de producto
- navegar variantes y acabados
- visualizar archivos y adjuntos
- aplicar branding por tenant
- autenticarse con Supabase
- consumir datos de Bluestone PIM

## Qué no es este proyecto

- no es un repo de research
- no es un playground de datos locales
- no es un prototipo aislado

## Fuente de verdad documental

Antes de trabajar en cambios importantes, revisar:

1. [README.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\README.md)
2. [ARCHITECTURE.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\ARCHITECTURE.md)
3. [CURRENT_STATE.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\CURRENT_STATE.md)
4. [DATA_SOURCES.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\DATA_SOURCES.md)
5. [KNOWN_ISSUES.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\KNOWN_ISSUES.md)
6. [DECISIONS.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\DECISIONS.md)
7. [DEPLOY_CHECKLIST.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\DEPLOY_CHECKLIST.md)

## Reglas de coordinación

### 1. Un solo repo válido

No usar ningún otro repo para tomar decisiones sobre producto, bugs, despliegue o arquitectura.

### 2. Un solo origen de verdad por cambio

Si un cambio afecta:

- tenant
- fallback
- fuente de datos
- deploy

hay que verificar primero el flujo real antes de afirmar que está resuelto.

### 3. No editar el mismo archivo en paralelo sin coordinación explícita

Si hay varios agentes o personas trabajando:

- dividir por zonas
- dejar claro qué archivos toca cada uno
- evitar editar simultáneamente el mismo archivo

### 4. Todo handoff debe dejar contexto útil

Al terminar un bloque de trabajo, documentar:

- archivos tocados
- validación realizada
- riesgos pendientes
- siguiente paso recomendado

## Reglas obligatorias de producción

### No tocar producción sin verificar primero el flujo real

Antes de desplegar o dar por arreglado un problema sensible, comprobar:

- la URL de producción
- `/api/catalog`
- el tenant correcto
- el bundle servido

### Si el cambio toca tenant, fallback o fuente de datos, parar y confirmar

Estas zonas se consideran de riesgo alto. No asumir.

### No introducir fallback silencioso a datos incorrectos

Si Bluestone falla:

- mostrar error controlado
- o aplicar retry explícito

Pero no mezclar tenants ni enseñar datos incorrectos como si fueran reales.

## Reglas de datos

- no mezclar tenants
- no usar datos locales como verdad en producción
- no exponer credenciales ni URLs sensibles en documentación
- si hay duda sobre el tenant activo, verificar antes de desplegar

## Comandos base

```bash
npm run dev
npm run dev:frontend
npm run dev:api
npm run typecheck
npm run build
```

## Flujo recomendado de trabajo

1. Confirmar que estás en este repo
2. Identificar si el cambio toca UI, API, tenanting, auth o deploy
3. Implementar con el menor alcance posible
4. Verificar con `npm run typecheck` y `npm run build`
5. Validar visualmente si afecta a experiencia de usuario
6. Si afecta a producción, seguir [DEPLOY_CHECKLIST.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\DEPLOY_CHECKLIST.md)
