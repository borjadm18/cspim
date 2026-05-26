# Current State

## Fecha de referencia

Última actualización documental: 2026-05-23

## Estado local del código

- El catálogo ya está migrado a respuesta paginada con contrato:
  - `data`
  - `meta`
- Filtros, ordenación y paginación están preparados para trabajar server-side
- `api/catalog.ts` ya usa:
  - caché en memoria
  - caché persistente en Supabase
  - timeouts y reintentos
  - refresh/prewarm protegido por secreto para cron
  - índice más ligero para grid, con `thumbnailUrl` y flags en vez de depender de arrays completos
- `api/asset.ts` ya cachea URLs resueltas por `assetId`
- `vercel.json` ya programa prewarm diario compatible con plan Hobby
- La policy recursiva de `profiles` en Supabase ya fue corregida con la migración `006_fix_profile_rls_recursion.sql`

## Estado de verificación local

Verificado en local:

- login: OK
- carga inicial del catálogo: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `/api/catalog` local devuelve `data + meta`: OK
- el build actual compila con el refresh del catálogo y cron configurado en `vercel.json`: OK

Medición orientativa observada en local con el proxy nuevo:

- primera carga del catálogo: ~903 ms
- segunda carga: ~549 ms

## Estado de producción verificado por última vez

Última verificación conocida:

- producción ya sirve el contrato nuevo del catálogo:
  - `data`
  - `meta`
- el endpoint de refresh protegido funciona:
  - `/api/catalog?refresh=1&tenant=tres-griferia`
- el índice de TRES se pudo recalentar correctamente en producción
- medición autenticada de una llamada real al catálogo desde navegador:
  - `~608 ms`
- el flujo visible del catálogo ya carga sin el error inicial de `No se pudo cargar el catálogo`

Conclusión:

- el deploy de producción ya está alineado con la nueva arquitectura del catálogo
- la mejora de tiempo de respuesta del API ya está en producción
- el objetivo de experiencia < 5–6 s queda mucho más cerca cuando el índice está precalentado

## Estado de Supabase

Migraciones presentes:

- `001_init.sql`
- `002_superadmin_policies.sql`
- `003_catalog_rls.sql`
- `004_catalog_cache.sql`
- `005_catalog_cache_meta.sql`
- `006_fix_profile_rls_recursion.sql`

## Qué falta por verificar antes del próximo deploy

1. reducir aún más el peso de `attributeText`, que sigue siendo muy grande en la respuesta del grid
2. revisar por qué siguen aflorando estados `PLAYGROUND_ONLY` en productos visibles del índice
3. decidir si merece la pena persistir thumbnails ya resueltos dentro del índice para acelerar todavía más la percepción visual
4. si se quiere un prewarm más frecuente que diario, haría falta pasar Vercel a plan Pro o mover el refresh a otro scheduler

## Regla de este documento

Este archivo debe reflejar el estado real más reciente del proyecto. Si cambia el comportamiento del catálogo, auth, caché o deploy, este documento debe actualizarse.
