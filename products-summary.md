# Resumen de Productos Bluestone PIM

## Información General

- **Total de productos accesibles**: 30 productos
- **Total indicado por la API**: 832 productos (pero solo 30 están disponibles con tu API key)
- **Archivo generado**: `all-products-complete.json` (563 KB)

## Estructura de Datos de Cada Producto

Cada producto incluye:

### Datos Básicos
- `id`: Identificador único del producto
- `type`: Tipo de producto (GROUP, VARIANT, etc.)
- `name`: Nombre del producto
- `number`: Código/número del producto
- `description`: Descripción del producto
- `lastUpdate`: Fecha de última actualización (timestamp)
- `createDate`: Fecha de creación (timestamp)

### Atributos (attributes)
Cada producto contiene múltiples atributos organizados por grupos:

**Grupos de atributos disponibles:**
- **Datos ERP**: Código EAN, etc.
- **Técnico**:
  - Dimensiones (Alto, Ancho, Fondo en mm)
  - Acabado Cuerpo
  - Acabado Puerta
  - Apertura de la puerta
  - Certificaciones
  - Protecciones
  - Peso bruto
  - Dimensiones de packaging
  - Y más...
- **Marketing**:
  - Canales de salida (B2B, B2C)
  - Descripción Ecommerce
  - Name Ecommerce
  - Color Ecommerce (con metadata de color hexadecimal)
  - Principal (Sí/No)
- **Calidad**:
  - Peso de cartón, plástico, electrónica
  - Consumo del circuito
  - Protecciones
  - Grupo Ecoembes
- **Compras**:
  - Tipo de packaging
  - Componentes packaging

### Media
- `media`: Array de imágenes y documentos
  - `id`: ID del archivo
  - `downloadUri`: URL de descarga
  - `previewUri`: URL de vista previa (optimizada, 400px ancho)
  - `fileName`: Nombre del archivo
  - `contentType`: Tipo MIME
  - `createdAt`, `updatedAt`: Fechas
  - `attributes`: Atributos adicionales del media

### Otros Datos
- `labels`: Etiquetas del producto
- `categories`: IDs de categorías
- `relations`: Relaciones con otros productos
- `bundles`: Paquetes
- `variants`: Variantes del producto
- `metadata`: Metadata adicional
- `publishInfoRef`: Referencia de información de publicación
- `contextId`: Contexto (ej: "en" para inglés)

## Estadísticas

- **Productos con imágenes**: 26 de 30
- **Productos con atributos**: 30 de 30
- **Promedio de atributos por producto**: ~40 atributos

## Ejemplo de Producto

### Producto: BANDEJA PUBLICIDAD PORTAL VERTICAL BLANCA
- **Código**: 00153
- **EAN**: 8421461001535
- **Dimensiones**: 320mm (alto) x 240mm (ancho) x 100mm (fondo)
- **Acabado Cuerpo**: Acero y Acero inoxidable
- **Acabado Puerta**: Blanco
- **Canales**: B2B, B2C
- **Color**: Blanco (#ffffff)
- **Imagen**: Disponible en alta resolución

## Próximos Pasos

La función de Edge `bluestone-products` ya está actualizada para traer todos estos productos con el máximo de detalles posibles. Los productos se muestran en la aplicación web con sus imágenes, atributos y toda la información disponible.
