# Decisions

## 2026-05 · Un solo repo canónico

Decisión:

- el único repo válido del proyecto es:
  - `C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main`

Motivo:

- evitar confusión entre research y producto
- eliminar decisiones basadas en el repo equivocado

## 2026-05 · No fallback silencioso a datos incorrectos

Decisión:

- si falla Bluestone o la fuente remota, la app no debe mostrar datos de otro tenant ni datos de ejemplo como si fueran reales

Motivo:

- evitar errores graves de confianza del usuario

## 2026-05 · El catálogo debe cargar con índice ligero

Decisión:

- el grid no debe depender de cargar todo el tenant en el navegador antes de pintar
- filtros, paginación y ordenación deben ir server-side cuando sea posible

Motivo:

- mejorar de forma significativa el tiempo percibido
- reducir payload inicial

## 2026-05 · Usar caché persistente en Supabase

Decisión:

- Supabase actúa como capa persistente de caché del catálogo e índices derivados

Motivo:

- reducir dependencia del coste de reconstrucción desde Bluestone
- mejorar el primer acceso y las recargas

## 2026-05 · Verificación obligatoria antes de tocar producción

Decisión:

- no desplegar cambios sensibles sin verificar:
  - URL de producción
  - `/api/catalog`
  - bundle servido
  - tenant correcto

Motivo:

- evitar afirmar “arreglado” cuando producción sigue sirviendo una versión antigua

## 2026-05 · La documentación operativa vive en el repo

Decisión:

- la fuente de verdad documental del proyecto vive en archivos de raíz del repo
- herramientas externas como NotebookLM son capa de consulta, no fuente de verdad

Motivo:

- reducir dependencia del contexto conversacional
- facilitar onboarding a humanos y a otras IA
