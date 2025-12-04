# Changelog

# Changelog

## [1.1.0] - 2025-12-05
- Recalcula automáticamente el `planDiario` cuando se activan overrides de jornada reducida/normal, manteniendo alineadas las horas esperadas con los cambios realizados desde la UI de opciones.
- Permite editar cada día directamente desde el modal (incluyendo marcarlo como Vacaciones/Festivo, ajustar horas y restaurar valores del CSV) y añade indicadores visuales en la vista semanal para los días manuales.
- Añade la creación rápida de nuevas tareas/proyectos desde el modal y soporta la asignación de tecnologías específicas por proyecto, detectándolas automáticamente durante la importación del CSV y mostrándolas en la lista de proyectos.
- Mejora el flujo de borrado por rango: ya no necesita configuración cargada y detecta los días imputados directamente desde el calendario, evitando que se salten jornadas con horas.

## [1.0.0] - 2025-11-29
- Establece la nueva versión base `1.0.0` en el manifiesto de la extensión.
- Documenta las funcionalidades recientes de planificación diaria y automatización de incurridos.
- Mantiene referencia inicial para futuros registros de cambios.

### Funcionalidades incluidas
- Imputación automática de tareas diarias desde el popup, respetando horas y minutos planificados.
- Detección de jornada normal/reducida con ajustes de horas esperadas y planDiario.
- Gestión centralizada de tareas, plan semanal y overrides desde la página de opciones.
- Corrección automática de fecha en Axet y navegación asistida para evitar desfaces.
- Flujo de creación de tareas en caliente cuando no existen en Axet, con espera al contador actualizado.
- Sistema de importación/exportación y compatibilidad con planificaciones generadas desde Google Sheets/CSV.
