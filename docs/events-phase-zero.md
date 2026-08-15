# Eventos del Club: Principios y Fase 0

Este documento fija las protecciones previas a cualquier cambio de audiencia.
La capa protegida de eventos ya está implementada y el contrato aditivo de
audiencia de la Fase 1 está preparado, sin migrar documentos existentes.

## Principios bloqueados

- `events/{eventId}` permanece como fuente de verdad.
- Los documentos legacy siguen siendo válidos.
- `published === false` significa no publicado.
- Si `published` no existe, el evento legacy se trata como publicado.
- `category === "Todas"` significa audiencia general durante la transición.
- Los eventos nuevos derivan una audiencia explícita: `all` para `Todas` y
  `categories` para la categoría seleccionada.
- Los eventos legacy conservan su fallback por `category` y no requieren
  migración para seguir siendo visibles.
- Los módulos no relacionados quedan fuera del alcance.
- Los IDs existentes no se migran ni se eliminan en esta fase.
- No se escriben datos de producción como parte de la preparación.
- Las lecturas públicas pasan por `/api/events`.
- Las operaciones administrativas pasan por `/api/admin/events`.
- Los RSVP pasan por `/api/events/rsvp` y se validan contra la sesión del Padre.
- El navegador no abre listeners directos sobre la colección `events`.

El contrato común está en `src/lib/eventModel.js`. Las lecturas existentes
usan `isEventPublished()` para evitar que cada módulo implemente una variante
distinta de la regla de publicación.

## Estado de protección

El repositorio no contiene `firestore.rules` ni `firebase.json`. Por tanto, las
reglas efectivas de Firebase no pueden validarse ni modificarse de forma segura
desde este proyecto. Antes de retirar permisos legacy o desplegar una nueva
audiencia se debe obtener la versión real de esas reglas y comprobarla fuera de
este cambio.

No se debe agregar un archivo de reglas incompleto: podría afectar pagos,
asistencia, evaluaciones o autenticación al desplegarlo.

## Puertas de entrada antes de la siguiente fase

1. Confirmar que Admin puede leer y administrar eventos.
2. Confirmar que `/api/events` sólo entrega eventos publicados permitidos.
3. Confirmar que Entrenador no puede crear, editar, eliminar ni publicar.
4. Confirmar que `/api/events/rsvp` sólo puede modificar el registro permitido
   del alumno.
5. Capturar una copia lógica de los eventos existentes antes de cualquier
   migración de modelo.
6. Probar un evento legacy general, uno legacy por categoría, uno publicado y
   uno explícitamente no publicado, además de un evento nuevo general y uno
   nuevo por categoría.
7. Verificar en producción que `category`, `categoryId` y la audiencia real del alumno usan
   exactamente la misma representación.

## Criterio de salida

La Fase 0 se considera aprobada cuando las reglas reales estén disponibles,
los casos legacy estén verificados y exista un mecanismo de reversión para la
lectura nueva. La Fase 1 no realiza migración: sólo escribe el contrato
aditivo en eventos que se creen o editen desde el endpoint administrativo.
