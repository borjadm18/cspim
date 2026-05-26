# Scripts

Mapa rápido de los scripts vivos del proyecto.

## `dev-remote.ps1`

Arranca el frontend y la API local para trabajar contra el flujo remoto de Bluestone.

Uso:

```bash
npm run dev
```

Hace dos cosas:

- lanza `npm run dev:api`
- lanza `npm run dev:frontend`

## `local-api-server.mjs`

Servidor local auxiliar para desarrollo.

Responsabilidades principales:

- proxy y composición de datos de catálogo
- endpoints locales `/api/*`
- caché local de catálogo
- lectura y persistencia de settings en `.content-store-data/`
- soporte al sample local cuando el modo de trabajo lo requiere

Uso directo:

```bash
npm run dev:api
```

## Regla de uso

Si añades un script nuevo en esta carpeta:

1. documenta qué hace
2. indica cómo se ejecuta
3. aclara si es solo para desarrollo o si afecta despliegues
