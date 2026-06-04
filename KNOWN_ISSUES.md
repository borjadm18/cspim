# Known Issues

## 1. Producción puede seguir en un deploy anterior

Síntoma:

- producción responde con catálogo antiguo
- `/api/catalog` devuelve array plano sin `meta`
- aparecen productos de test o métricas inconsistentes

Impacto:

- la experiencia de producción no refleja el estado del código local

Qué hacer:

- verificar URL de producción
- inspeccionar `/api/catalog`
- comprobar bundle servido antes de decir que algo está arreglado

## 2. La primera carga puede fallar si hay cold start o timeout agresivo

Síntoma:

- `No se pudo cargar el catálogo`
- `signal is aborted without reason`

Causa probable:

- cold start de la función
- consulta inicial de Bluestone más lenta que el timeout del cliente o del backend

Estado:

- mejorado en local con caché, retry y arquitectura paginada
- pendiente de verificar a fondo en producción tras deploy

## 3. Riesgo de procesos locales viejos en el proxy

Síntoma:

- el frontend parece “no enterarse” del contrato nuevo
- `/api/catalog` local responde en formato antiguo

Causa:

- listener viejo en `3001`

Estado:

- `scripts/dev-remote.ps1` ya limpia listeners viejos antes de arrancar

## 4. Mojibake / encoding roto

Síntoma:

- textos como `Grifería`, `Catálogo`, `Contraseña` pueden reaparecer corruptos si entra contenido mal decodificado

Causa:

- cadenas mal decodificadas o textos corruptos en origen

Estado:

- reparado en las superficies principales del catálogo
- sigue siendo una zona sensible y hay que revisarla cada vez que aparezca

## 5. Artefactos de desarrollo en raíz

Síntoma:

- logs y ficheros temporales ensucian la raíz

Impacto:

- peor legibilidad del repo
- más difícil entender qué es código y qué es ruido operativo

Estado:

- mejorado parcialmente
- aún conviene seguir limpiando
