# Deploy Checklist

## Propósito

Este checklist existe para evitar despliegues con contexto incompleto, tenants incorrectos o bundles que no corresponden al cambio que creemos haber hecho.

## Pre-check técnico

Antes de pensar en Vercel:

- [ ] Estoy en el repo canónico de Content Store
- [ ] El cambio está implementado en el archivo correcto
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` pasa

## Si el cambio toca tenant, fallback o fuente de datos

Comprobar explícitamente:

- [ ] Qué tenant debe verse
- [ ] Que no existe fallback silencioso a datos locales o de otro tenant
- [ ] La respuesta de `/api/catalog`
- [ ] La respuesta de `/api/organizations`

## Si el cambio afecta a producción

No asumir que preview y producción son iguales.

- [ ] He verificado el flujo real antes de tocar producción
- [ ] Sé exactamente qué URL de producción debe quedar afectada
- [ ] He comprobado que el despliegue que voy a validar es el correcto
- [ ] Si el catálogo usa refresh/prewarm, `CRON_SECRET` está configurado en Vercel
- [ ] Si el catálogo usa refresh/prewarm, la ruta `/api/catalog?refresh=1` queda protegida por secreto

## Validación mínima antes de decir “arreglado”

- [ ] Producción carga
- [ ] El tenant mostrado es el correcto
- [ ] `/api/catalog` responde con el origen esperado
- [ ] El bundle servido corresponde al deploy actual

## Validación funcional sugerida

Si el cambio lo justifica, revisar también:

- [ ] Login
- [ ] Logout
- [ ] Catálogo
- [ ] Filtros
- [ ] Apertura de ficha
- [ ] Variantes / acabados
- [ ] Archivos / adjuntos
- [ ] Configuración visual

## Handoff mínimo al terminar

Dejar por escrito:

- archivos tocados
- comprobaciones realizadas
- riesgos pendientes
- si se desplegó o no

## Regla final

Si hay dudas sobre tenant, datos, origen real del catálogo o versión desplegada, no cerrar el trabajo como resuelto todavía.
