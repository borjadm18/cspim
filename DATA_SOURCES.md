# Data Sources

## Fuente principal de catálogo

La fuente principal del catálogo es Bluestone PIM.

La app no debe considerar los datos locales como fuente de verdad en producción.

## Tenanting

Los tenants se resuelven desde configuración y sesión. Hay dos piezas relevantes:

- organizaciones visibles en la app
- credenciales Bluestone por tenant

Variables importantes:

- `BLUESTONE_TENANTS_JSON`
- `VITE_CATALOG_TENANTS_JSON`
- `VITE_CATALOG_SOURCE_MODE`
- `VITE_CATALOG_ACCESS_MODE`

## Supabase

Supabase se usa para:

- autenticación
- perfiles de usuario
- tenants
- branding
- caché persistente del catálogo

Variables importantes:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Endpoints internos clave

- `/api/catalog`
  - listado de catálogo paginado
  - filtros
  - ordenación
  - metadata de grid
- `/api/organizations`
  - tenants disponibles
- `/api/organization-settings`
  - branding y configuración visual
- `/api/asset`
  - resolución de assets individuales

## Datos locales

Existen artefactos y muestras locales útiles para desarrollo, pero no son fuente de verdad del producto:

- `all-products-cursor.json`
- `.content-store-data/`
- cachés y logs locales

Regla:

- nunca usar un fallback silencioso a estos datos en producción
- si Bluestone falla, debe verse error controlado o retry explícito

## Qué no documentar aquí

No guardar en este documento:

- contraseñas
- tokens
- credenciales reales
- URLs firmadas temporales
