# Content Store

Este es el único repo canónico del proyecto.

- Tipo de proyecto: app Vite + React + TypeScript
- Dominio: catálogo y ficha de producto sobre Bluestone PIM
- Producción: [https://content-store-omega.vercel.app](https://content-store-omega.vercel.app)
- Repo deprecado que no debe usarse: `C:\Users\novic\OneDrive\Escritorio\projects\Pimly`

## Documentos fuente de verdad

Si una persona o una IA necesita entender rápido el proyecto, debe empezar aquí:

1. [README.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\README.md)
2. [ARCHITECTURE.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\ARCHITECTURE.md)
3. [CURRENT_STATE.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\CURRENT_STATE.md)
4. [DATA_SOURCES.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\DATA_SOURCES.md)
5. [KNOWN_ISSUES.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\KNOWN_ISSUES.md)
6. [DECISIONS.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\DECISIONS.md)
7. [AGENTS.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\AGENTS.md)
8. [DEPLOY_CHECKLIST.md](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\DEPLOY_CHECKLIST.md)

## Qué hay aquí

- `src/app/App.tsx`: ensamblado principal de la app y routing
- `src/features/catalog/`: grid, ficha, filtros, selectores y estado de catálogo
- `api/`: endpoints serverless para catálogo, organizaciones, settings y assets
- `supabase/`: migraciones, funciones y caché persistente
- `scripts/`: arranque local, proxy remoto y utilidades de trabajo
- `public/`: assets públicos

## Arranque rápido

### Modo recomendado de desarrollo

```bash
npm run dev
```

Esto levanta frontend + proxy/API local preparados para trabajar con datos remotos.

### Solo frontend

```bash
npm run dev:frontend
```

### Solo proxy/API local

```bash
npm run dev:api
```

### Verificación mínima antes de decir que algo está bien

```bash
npm run typecheck
npm run build
```

## Variables importantes

- `VITE_CATALOG_ACCESS_MODE=admin|client`
- `VITE_CATALOG_SOURCE_MODE=local|remote`
- `VITE_CATALOG_TENANTS_JSON`
- `BLUESTONE_TENANTS_JSON`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Referencia:
- [`.env.example`](C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main\.env.example)

## Regla operativa más importante

No tocar producción sin verificar antes:

- la URL de producción
- `/api/catalog`
- el tenant correcto
- y el bundle servido

Si el cambio toca tenant, fallback o fuente de datos, hay que parar y confirmar antes de desplegar.
