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

## ✍️ Autor

Desarrollado por José Luis Guidú Navas.

[Repositorio en GitHub](https://github.com/TECNILUIS/Axet-AutoIncurrido)