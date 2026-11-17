# CertiBatchQR — Generador Masivo de Constancias con QR

> **Enlaces del proyecto**

**Link:** `https://hunabbohorquez.github.io/CertiBatchQR/`

**Repositorio en GitHub:** `https://github.com/HunabBohorquez/CertiBatchQR`

> 📝 **Nota:** este proyecto tiene los **mismos archivos** que el repositorio de GitLab
> (`index.html`, `styles.css`, `app.js`, `README.md`). Solo cambia la plataforma de alojamiento.

---

## Descripción

CertiBatchQR genera constancias y gafetes personalizados de forma masiva, con folio único y código QR real, directamente en el navegador (sin servidor). Está hecho con HTML5, CSS3 y JavaScript ES6+ vanilla, y solo usa dos librerías por CDN: **jsPDF** y **qrcode-generator**.

Funciones: editor de plantilla (con logotipo local), gestor de participantes con importación CSV, vista previa en `<canvas>` (Carta horizontal 1122×794 px), exportación de un PDF multipágina y bitácora de folios en CSV.

## Marcadores de plantilla

El texto del cuerpo admite estos marcadores, que se reemplazan por participante:

| Marcador | Valor |
|---|---|
| `{{NOMBRE}}` | Nombre del participante |
| `{{ROL}}` | Ponente, Organizador, Asistente, etc. |
| `{{EVENTO}}` | Nombre del evento de la plantilla |
| `{{FECHA}}` | Fecha del evento |
| `{{FOLIO}}` | Folio único del participante |

## Generación de folios y QR

- **Folio:** `CERT-AAAA-NNN-XXXX`, donde `AAAA` es el año, `NNN` el consecutivo (001, 002, …) y `XXXX` un hash corto (FNV-1a en base 36) calculado con `nombre|evento`.
- **QR:** contiene la cadena de verificación `FOLIO:…|NOMBRE:…|ROL:…|EVENTO:…` (sin acentos, para compatibilidad con todos los lectores).
- **Bitácora CSV:** columnas `folio, nombre, rol, correo, verificacion`.

## Ejecución

1. Guarda los 4 archivos en una misma carpeta.
2. Abre `index.html` en un navegador moderno (requiere internet para cargar las librerías CDN).
3. Edita la plantilla, importa participantes y exporta.

Formato CSV esperado: `nombre,rol,correo` (el encabezado es opcional).

## Pruebas Verificables

1. Abre `index.html` y pulsa **Cargar Taller Demo**: la tabla debe mostrar 12 participantes (3 Ponentes, 3 Organizadores, 6 Asistentes).
2. Navega con **< Anterior** / **Siguiente >**: el contador debe ir de `1 / 12` a `12 / 12` y el nombre, rol y folio deben cambiar en la vista previa.
3. Pulsa **Generar PDF Masivo**: la barra de progreso debe llegar al 100 % y descargarse `constancias_lote.pdf` con 12 páginas.
4. Pulsa **Descargar Bitácora de Folios (CSV)** y abre `bitacora_folios.csv`: debe tener 12 filas con folios únicos (`CERT-2026-001-XXXX` … `CERT-2026-012-XXXX`).
5. Escanea el QR de cualquier constancia con tu celular: el texto debe coincidir con la columna `verificacion` de la bitácora para ese folio.
6. Cambia el nombre del evento y confirma que el hash final del folio cambia.
7. Sube un logotipo local y verifica que aparece en la vista previa y en el PDF.
