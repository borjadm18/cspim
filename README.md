# BTV-CS

Content Store para exploración visual de catálogo.

## Enfoque

Este proyecto sigue un enfoque Feature-Driven Development (FDD): cada mejora se entrega como una funcionalidad independiente, verificable y componible.

## Modos de uso

- `admin`: permite cambiar entre organizaciones y editar configuración visual
- `client`: muestra una sola organización fija, sin selector

Control de modo:
- `VITE_CATALOG_ACCESS_MODE=admin`
- `VITE_CATALOG_ACCESS_MODE=client`

## Estructura

- `src/main.tsx`: punto de entrada de la app
- `src/app/`: ensamblado de la pantalla principal
- `src/features/catalog/api/`: acceso a datos del catálogo
- `src/features/catalog/model/`: tipos y contratos del catálogo
- `src/features/catalog/state/`: estado y orquestación de la feature
- `src/features/catalog/selectors/`: filtros, normalización y reglas de catálogo
- `src/features/catalog/ui/`: componentes visuales de la feature
- `src/shared/ui/`: componentes compartidos entre features

## Dossier

- [FDD.md](C:/Users/novic/OneDrive/Escritorio/conector/ContentStore/BTV-CS-main/BTV-CS-main/FDD.md)
- [FDD-backlog.md](C:/Users/novic/OneDrive/Escritorio/conector/ContentStore/BTV-CS-main/BTV-CS-main/FDD-backlog.md)

## Configuración multi-organización

- `VITE_CATALOG_TENANTS_JSON`: lista pública de organizaciones visibles en el selector del frontend
- `VITE_CATALOG_SOURCE_MODE`: `local` o `remote`
  - en desarrollo local conviene `local`
  - en Vercel o `vercel dev` puedes usar `remote`
- `VITE_CATALOG_ALLOW_REMOTE_DEV`: solo para forzar `remote` en desarrollo local
- `BLUESTONE_TENANTS_JSON`: mapa server-side con credenciales por organización
- `BLUESTONE_CLIENT_ID`, `BLUESTONE_CLIENT_SECRET`, `BLUESTONE_ORG_ID`, `BLUESTONE_ENV`, `BLUESTONE_CONTEXT`: modo simple para una sola organización

En producción, el frontend llama a `/api/catalog` y el backend resuelve la organización configurada con las credenciales de Bluestone.
En desarrollo local, el proyecto usa el sample local para evitar errores de JSON y solo depende de `/api/catalog` si activas `VITE_CATALOG_ALLOW_REMOTE_DEV=true`.
La selección de organización en la UI cambia la configuración activa; en modo `client` el selector se oculta.

### Modo remoto en local

Si quieres validar organizaciones reales desde tu máquina:

1. Arranca el proxy Bluestone en `3001`:
   - `npm run dev:api`
2. Arranca el frontend en `4173` o `4174`:
   - `npm run dev`
   - o `npm run dev:frontend`
3. Abre el frontend y cambia a la organización deseada.

En este modo, Vite proxya `/api` al proxy local de Bluestone en `http://127.0.0.1:3001`.

### Ejemplo de `BLUESTONE_TENANTS_JSON`

```json
{
  "default": { "clientId": "", "clientSecret": "", "orgId": "", "env": "test", "context": "en" },
  "tres-griferia": {
    "clientId": "ac14e1d8-742f-49ff-a4c5-6d054c3d6c4a",
    "clientSecret": "",
    "orgId": "8f2f3e2f-8b16-4195-b1ae-e8b2bcc91f57",
    "env": "prod",
    "context": "es"
  },
  "customer-b": { "clientId": "", "clientSecret": "", "orgId": "", "env": "prod", "context": "en" }
}
```

### Variables en Vercel

Configura estas variables en el proyecto:

- `VITE_CATALOG_ACCESS_MODE=client` para la versión final orientada a cliente
- `VITE_CATALOG_TENANTS_JSON`: lista pública de organizaciones visibles en el selector
- `VITE_CATALOG_SOURCE_MODE=remote`
- `BLUESTONE_TENANTS_JSON`: mapa server-side con las credenciales reales

Ejemplo mínimo para una sola organización:

```json
{
  "default": {
    "clientId": "TU_CLIENT_ID",
    "clientSecret": "TU_CLIENT_SECRET",
    "orgId": "TU_ORG_ID",
    "env": "test",
    "context": "en"
  }
}
```

### Cómo validar una organización

1. Abre el selector de organización en la cabecera.
2. Cambia a la organización deseada.
3. Comprueba que el contador de productos cambia.
4. Abre una ficha de producto y verifica imágenes, adjuntos y descarga.
5. Si `/api/catalog?tenant=...` falla, revisa `clientId`, `clientSecret`, `orgId`, `env` y `context`.
