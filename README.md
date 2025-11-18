# ![Icon](https://github.com/TECNILUIS/Axet-AutoIncurrido/blob/main/icons/icon128.png) Axet-AutoIncurrido

![Versión](https://img.shields.io/badge/version-1.0-blue)
![Plataforma](https://img.shields.io/badge/Plataforma-Google_Chrome-brightgreen)

Una extensión para Google Chrome diseñada para automatizar la imputación de horas en el portal **Axet de NTT Data**. Olvídate de rellenar manualmente tus tareas diarias; con un solo clic, la extensión lo hará por ti según tu jornada.

---

## 🚀 Características Principales

* **Imputación en un Clic**: Rellena y envía todas tus tareas del día con sus horas y minutos correspondientes con un solo clic desde el popup de la extensión.
* **Detección Automática de Jornada**: Distingue automáticamente entre la jornada normal y la reducida.
    * **Jornada Normal (9h)**: Lunes a Jueves (fuera del periodo de verano).
    * **Jornada Reducida (7h)**: Viernes y el periodo de verano (del 1 de Julio al 15 de Septiembre).
* **Gestión de Tareas Centralizada**: A través de una página de opciones intuitiva, puedes añadir y eliminar todas tus tareas recurrentes, definiendo su nombre y código de proyecto una sola vez.
* **Corrección de Fecha Inteligente**: Si estás en una fecha pasada en Axet, la extensión lo detecta y navega automáticamente al día actual antes de imputar las horas.
* **Notificaciones No Intrusivas**: Muestra notificaciones (toasts) en pantalla para informar sobre el progreso y el resultado del proceso (éxito, errores, etc.), sin `alerts` molestos.

---

## 🛠️ Cómo Funciona

La extensión utiliza un **Content Script** (`content.js`) que se inyecta en la página de Axet. Este script lee la configuración de tareas guardada por el usuario y manipula el DOM de la página para:

1.  Seleccionar cada tarea en el desplegable usando su nombre y código.
2.  Rellenar los campos de horas y minutos.
3.  Hacer clic en el botón de "incurrir".
4.  Esperar a que la página se actualice y repetir el proceso con la siguiente tarea.

Para la corrección de fecha, utiliza un script inyector (`injector.js`) que interactúa de forma segura con las instancias de `Formio` de la página para cambiar la fecha de forma programática, respetando la Política de Seguridad de Contenido (CSP) del sitio.

---

## 📦 Instalación

La extensión se instala manualmente desde el código fuente siguiendo estos pasos:

1.  Ve a la página principal de este repositorio de GitHub.
2.  Haz clic en el botón verde `Code` > `Download ZIP`.
3.  Descomprime el archivo `.zip` en una carpeta en tu ordenador (por ejemplo, en `Mis Documentos/Axet-Extension`).
4.  Abre Google Chrome y ve a la página de extensiones: `chrome://extensions/`.
5.  Activa el **Modo de desarrollador** (Developer mode) en la esquina superior derecha.
6.  Haz clic en el botón **Cargar descomprimida** (Load unpacked).
7.  Selecciona la carpeta que descomprimiste en el paso 3 (la que contiene el archivo `manifest.json`).
8.  ¡Listo! La extensión aparecerá en tu barra de herramientas.

---
## ⚙️ Uso y Configuración

Antes de usarla por primera vez, necesitas configurar tus tareas:

1.  Haz clic derecho sobre el icono de la extensión (en la barra de herramientas de Chrome) y selecciona **Opciones**.
2.  En la página de configuración:
    * **1. Define tus Tareas**: Añade una o más tareas usando el botón "➕ Añadir Tarea". Rellena el **Nombre** y el **Código de Proyecto** exactos que aparecen en Axet.
    * **2. Asigna el Tiempo por Jornada**: Rellena las horas y minutos que quieres imputar para cada tarea, tanto en la sección de "Jornada 7 horas" como en la de "Jornada 9 horas".
3.  Haz clic en **Guardar Cambios**.
4.  Ve a tu página de Axet para imputar horas.
5.  Haz clic en el icono de la extensión y pulsa el botón **Incurrir Tareas**. La magia comenzará.

---

## 🔄 Actualizar la Extensión y Conservar tu Configuración

Cuando descargas una nueva versión de la extensión y reemplazas la carpeta antigua, Chrome la trata como una nueva instalación y **pierde tu configuración**.

Para evitar esto, puedes usar las funciones de **Exportar** e **Importar**:

1.  **Antes de actualizar (en la versión antigua):**
    * Ve a la página de **Opciones** de la extensión.
    * Haz clic en el botón **"Exportar Configuración"**.
    * Guarda el archivo `axet-config-*.json` en un lugar seguro.

2.  **Instala la nueva versión:**
    * Elimina la extensión antigua de `chrome://extensions`.
    * Instala la nueva versión siguiendo los pasos de la sección "Instalación".

3.  **Después de actualizar (en la versión nueva):**
    * Ve a la página de **Opciones** de la nueva extensión.
    * Haz clic en el botón **"Importar Configuración"**.
    * Selecciona el archivo `.json` que guardaste en el paso 1.
    * ¡Tu configuración se cargará y guardará automáticamente!

---

## 📊 Generación de CSV desde Google Sheets (Apps Script)

Si prefieres mantener tu planificación mensual en Google Sheets, puedes usar el script `descarga_csv.gs` para generar automáticamente el CSV de importación.

### 🔧 Configuración del Script

1. **Abre tu hoja de cálculo en Google Sheets** donde tienes tu planificación mensual.
2. Ve a **Extensiones** > **Apps Script**.
3. Borra cualquier código existente y pega el contenido del archivo `descarga_csv.gs`.
4. **Modifica tu código de usuario**: En la línea 6, cambia `"T000000"` por tu propio código de usuario:
   ```javascript
   var codigoUsuario = "T000000"; // Reemplaza con tu código de empleado
   ```
5. Haz clic en **Guardar** (icono del disquete) y dale un nombre al proyecto (ej. "Generador CSV Axet").

### 📋 Formato Esperado de la Hoja

El script espera que tu hoja de cálculo tenga la siguiente estructura:

- **Fila de Meses**: Primera fila con los nombres de los meses.
- **Fila de Encabezados**: Debe contener la palabra "Usuario" en la columna A, seguida de las columnas de días del mes.
- **Fila de Usuario**: Debe comenzar con tu código de usuario (ej. "T000000") en la columna A.
- **Columnas de Calendario**: A partir de cierta columna, deben aparecer los días del mes (1, 2, 3... 31).
- **Colores de Fondo**: Cada celda del calendario debe tener un color que identifique la fase del proyecto:
  - 🟨 **Amarillo** (`#ffff00`): Diseño (A)
  - 🟦 **Azul claro** (`#a4c2f4`): Construcción (B)
  - 🟪 **Morado** (`#8e7cc3`): Pruebas (C)
  - 🟩 **Verde** (`#6aa84f`): Despliegue (D)

Las celdas pueden contener números (ej. "4,5" o "8") que representan horas. El script añadirá automáticamente la letra de fase correspondiente.

### ▶️ Generar el CSV

1. En tu hoja de Google Sheets, ve a **Extensiones** > **Apps Script**.
2. Haz clic en el botón **▶️ Ejecutar** (o presiona Ctrl/Cmd + R).
3. La primera vez, Google te pedirá autorización:
   - Haz clic en **Revisar permisos**.
   - Selecciona tu cuenta de Google.
   - Haz clic en **Avanzado** > **Ir a [nombre del proyecto] (no seguro)**.
   - Haz clic en **Permitir**.
4. Aparecerá una ventana modal con el mensaje **"✅ CSV Generado con Éxito"**.
5. La descarga comenzará automáticamente después de 1.5 segundos. Si no, haz clic en el botón **📥 DESCARGAR CSV**.
6. El archivo se guardará como `Importacion_TU_CODIGO_Final.csv`.

### 📥 Importar el CSV en la Extensión

1. Abre la extensión y ve a la página de **Opciones**.
2. En la parte superior, verás el botón **"Importar Configuración"** (o similar).
3. Haz clic y selecciona el archivo CSV que acabas de descargar.
4. La extensión cargará automáticamente todas tus tareas y horarios según la planificación del mes.
5. ¡Listo! Ahora puedes usar la extensión para incurrir tus horas diarias.

### 💡 Ventajas de este Método

- ✅ **Planificación Visual**: Mantén tu calendario mensual con colores en Google Sheets.
- ✅ **Actualización Rápida**: Genera un nuevo CSV cada vez que cambies tu planificación.
- ✅ **Sincronización**: Importa el CSV en la extensión y tus datos estarán siempre actualizados.
- ✅ **Respaldo**: Tu planificación está guardada en la nube de Google.

---

## ✍️ Autor

Desarrollado por José Luis Guidú Navas.

[Repositorio en GitHub](https://github.com/TECNILUIS/Axet-AutoIncurrido)