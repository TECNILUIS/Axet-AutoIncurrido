# Axet-AutoIncurrido

![Versión](https://img.shields.io/badge/version-1.0-blue)
![Chrome Web Store](https://img.shields.io/badge/Chrome-Extensión-brightgreen)

Una extensión para Google Chrome diseñada para automatizar la imputación de horas en el portal **Axet de NTT Data**. Olvídate de rellenar manualmente tus tareas diarias; con un solo clic, la extensión lo hará por ti según tu jornada.

---

## 🚀 Características Principales

* **Imputación Automática**: Rellena y envía las tareas con sus horas y minutos correspondientes con un solo clic desde el popup de la extensión.
* **Jornadas Configurables**: Permite definir una lista de tareas para la **Jornada Normal** (Lunes a Jueves) y otra para la **Jornada Reducida** (Viernes y periodo de verano).
* **Gestión de Tareas Personalizada**: A través de una página de opciones intuitiva, puedes añadir, eliminar y configurar todas tus tareas recurrentes con su nombre y código de proyecto.
* **Corrección de Fecha Inteligente**: Si estás en una fecha pasada en Axet, la extensión lo detecta y navega automáticamente al día actual antes de imputar las horas.
* **Notificaciones en Tiempo Real**: Muestra notificaciones (toasts) en pantalla para informar sobre el progreso y el resultado del proceso (éxito, errores, etc.).

---

## 🛠️ Cómo Funciona

La extensión utiliza un **Content Script** (`content.js`) que se inyecta en la página de Axet. Este script lee la configuración de tareas guardada por el usuario y manipula el DOM de la página para:

1.  Seleccionar cada tarea en el desplegable.
2.  Rellenar los campos de horas y minutos.
3.  Hacer clic en el botón de "incurrir".
4.  Esperar a que la página se actualice y repetir el proceso con la siguiente tarea.

Para la corrección de fecha, utiliza un script inyector (`injector.js`) que interactúa con las instancias de `Formio` de la página para cambiar la fecha de forma programática.

---

## 📦 Instalación (para Usuarios)

Como esta extensión no está publicada en la Chrome Web Store, se debe instalar manualmente siguiendo estos pasos:

1.  Descarga este repositorio haciendo clic en `Code` > `Download ZIP`.
2.  Descomprime el archivo `.zip` en una carpeta en tu ordenador.
3.  Abre Google Chrome y ve a la página de extensiones: `chrome://extensions/`.
4.  Activa el **Modo de desarrollador** (Developer mode) en la esquina superior derecha.
5.  Haz clic en el botón **Cargar descomprimida** (Load unpacked).
6.  Selecciona la carpeta que descomprimiste en el paso 2.
7.  ¡Listo! La extensión aparecerá en tu barra de herramientas.

---

## ⚙️ Uso y Configuración

Antes de usarla, necesitas configurar tus tareas:

1.  Haz clic derecho sobre el icono de la extensión y selecciona **Opciones**.
2.  En la página de configuración:
    * **Añade tus tareas**: Define el nombre y el código de proyecto para cada una.
    * **Asigna los tiempos**: Rellena las horas y minutos para cada tarea en la sección de "Jornada Normal" y "Jornada Reducida".
    * **Activa la Jornada Reducida**: Marca la casilla si quieres que la extensión distinga entre jornadas. La lógica es:
        * **Jornada Normal**: Lunes a Jueves.
        * **Jornada Reducida**: Viernes y periodo de verano (1 de Julio al 15 de Septiembre).
3.  Haz clic en **Guardar Cambios**.
4.  Ve a tu página de Axet para imputar horas.
5.  Haz clic en el icono de la extensión y pulsa el botón **Incurrir Tareas**. La magia comenzará.
