# Sincronizacion con Google Sheets

## 1. Pegar el Apps Script

1. Abre tu Google Sheet.
2. Ve a `Extensiones > Apps Script`.
3. Borra el contenido inicial de `Code.gs`.
4. Pega el contenido de `google_apps_script.gs`.

No pegues credenciales reales en el codigo ni en GitHub. El script lee la configuracion desde `PropertiesService`.

## 2. Configurar propiedades de Apps Script

En Apps Script, ve a `Configuracion del proyecto > Propiedades de secuencia de comandos` y crea estas propiedades:

- `SPREADSHEET_ID`: el ID largo del libro de Google Sheets que ves en la URL.
- `ADMIN_USERNAME`: el usuario que usaras para entrar a modo admin.
- `ADMIN_PASSWORD`: la contrasena de admin.
- `SESSION_SECRET`: una cadena larga y aleatoria para firmar sesiones temporales.

Ejemplo para `SESSION_SECRET`: usa una frase larga sin espacios o un valor aleatorio de 32+ caracteres mezclando letras, numeros y simbolos.

## 3. Crear las hojas base

En Apps Script, selecciona la funcion `setup` y ejecutala una vez.

Google te pedira permisos. Aceptalos con tu cuenta, porque el script necesita escribir en ese libro.

Se crearan estas hojas:

- `reforms`
- `history`
- `meta`
- `events`

La hoja `events` guarda la agenda de cada reforma. Usa estas columnas exactas:

- `id`
- `reform_id`
- `date`
- `title`
- `description`
- `type`
- `status`
- `created_at`
- `created_by`
- `visible`

La hoja `minutas` (se crea sola al primer `Sincronizar` despues de capturar una minuta) guarda los datos de minuta de cada evento. Columnas: `event_id`, `reform_id`, `minuta` (texto JSON). No la edites a mano.

## 4. Publicar como Web App

1. En Apps Script, ve a `Implementar > Nueva implementacion`.
2. Tipo: `Aplicacion web`.
3. Ejecutar como: `Yo`.
4. Quien tiene acceso: `Cualquier persona`.
5. Implementa y copia la URL que termina en `/exec`.

Los visitantes pueden leer los datos publicados por la Web App. Las escrituras requieren iniciar sesion como admin; el navegador solo guarda un token temporal de sesion con expiracion.

El script trabaja con estas pestanas exactas: `reforms`, `history`, `meta` y `events`. Si en tu libro ya existen con otro nombre, renombralas o ajusta la constante `SHEETS` en `google_apps_script.gs` antes de volver a desplegar.

## 5. Endpoint de la PWA

La PWA ya trae configurada por defecto esta Web App:

```text
https://script.google.com/macros/s/AKfycbxIU9hv4-VLLwkmDlYNCCC-2a775UndI7pbwJfvS4TOpdV1qr90GJ81bdsej3C90xsyxA/exec
```

No necesitas configurarla en cada navegador. Si en el futuro publicas otro despliegue de Apps Script, puedes sobrescribir temporalmente el endpoint desde la consola:

```js
localStorage.setItem("reformas-cloud-endpoint", "PEGA_AQUI_LA_NUEVA_URL_EXEC");
location.reload();
```

Ya no configures tokens de escritura permanentes en el navegador.

## 6. Primera carga de datos

1. Entra a `Modo Admin`.
2. Inicia sesion con `ADMIN_USERNAME` y `ADMIN_PASSWORD`.
3. Si ya tienes datos locales en la app, presiona `Guardar local` para confirmar el borrador.
4. Cuando quieras publicar esos cambios en Google Sheets, presiona `Sincronizar`.
5. Abre el Google Sheet y confirma que se llenaron las hojas, incluida `events` si ya capturaste eventos de agenda.
6. En otro navegador o equipo, abre la PWA y presiona `Actualizar`.

## Admin login desde otro dispositivo

1. Abre la PWA en el nuevo dispositivo.
2. Configura `reformas-cloud-endpoint` con la URL `/exec` de la Web App.
3. Presiona `Admin` e inicia sesion con el usuario y contrasena configurados en Apps Script.
4. La app guardara solo `sessionToken` y `expiresAt` en el navegador. Cuando expire la sesion, vuelve a iniciar sesion.

## Notas

- La app guarda cache local para abrir rapido y resistir fallas temporales.
- El admin puede editar libremente sin publicar cambios a la nube.
- `Guardar local` conserva el progreso solo en el navegador del admin.
- `Sincronizar` publica el estado local completo en Google Sheets. Si falta la sesion o el spreadsheet correcto, la app te avisara.
- Los visitantes refrescan desde Google Sheets al abrir y al presionar `Actualizar`.
- Si actualizas `google_apps_script.gs`, vuelve a publicar la Web App en Apps Script con una nueva version para que Google ejecute el codigo corregido.
- Las lecturas publicas no deben borrar ni reconstruir hojas. El script solo publica cambios cuando recibe un `POST` valido con una sesion admin activa.
- Si una lectura responde `Faltan hojas base`, ejecuta `setup()` una vez desde Apps Script antes de volver a abrir la PWA.
- `reformas-cloud-endpoint` queda solo como override opcional por origen; la URL principal ya esta en el codigo.
- Si el panel de diagnostico muestra un spreadsheet distinto al que ves en pantalla, la escritura va a otro libro.

## Agenda y eventos

La PWA ahora incluye una pantalla `Agenda` disponible para todos los usuarios. Los visitantes solo pueden ver, buscar y filtrar eventos visibles; el modo administrador puede crear, editar, eliminar, marcar como completado y cambiar la visibilidad de los eventos desde la agenda de cada reforma.

Cada reforma puede tener cero o muchos eventos. En el navegador los eventos viajan dentro de cada reforma para mantener compatible la exportacion JSON, mientras que Apps Script los sincroniza en Google Sheets como filas planas en la hoja `events` usando `reform_id` para relacionarlos con `reforms.id`.

Cuando el admin presiona `Sincronizar`, la escritura publica el estado local completo de:

- `reforms`
- `history`
- `meta`
- `events`

Despues de escribir, la app vuelve a leer la nube y verifica que coincidan los conteos de reformas y eventos antes de marcar la sincronizacion como confirmada.

## Sincronizacion con Google Calendar (una via)

Cada vez que el admin presiona `Sincronizar`, los eventos de la Agenda se reflejan en un calendario de Google. Es de una sola via: la app escribe en Calendar, y los cambios hechos directamente en Calendar no regresan a la app (y se sobrescriben en la siguiente sincronizacion).

Configuracion (una sola vez):

1. Pega la version nueva de `google_apps_script.gs`.
2. En Apps Script ejecuta la funcion `setupCalendar` y acepta los permisos de Calendar. Crea el calendario `Reformas - Agenda` y guarda su id en la propiedad `CALENDAR_ID`. (Si prefieres usar un calendario existente, crea tu mismo la propiedad `CALENDAR_ID` con su id.)
3. Vuelve a publicar la Web App con una nueva version.
4. Comparte el calendario con quien deba verlo desde Google Calendar (`Configuracion y uso compartido`).

Comportamiento:

- Se crean eventos de dia completo con titulo `[Cliente] titulo`; la descripcion incluye tipo, estado y descripcion. Los completados llevan el prefijo `[OK]`.
- Solo se sincronizan eventos con `visible` activo. Si un evento se elimina o se oculta, se borra del calendario.
- La hoja `calendar_map` (se crea sola) relaciona cada evento con su evento de Calendar. No la borres ni la edites: si se pierde, se crearian eventos duplicados.
- Si `CALENDAR_ID` no esta configurado, no se hace nada. Un error de Calendar no impide guardar en Sheets; se reporta en el campo `calendar` de la respuesta.

## Minutas por evento (solo admin)

En `Agenda`, cada evento muestra el boton `Minuta` solo en Modo Admin. Abre una ventana para capturar lo que pide la minuta (tipo A o B, etiqueta de la contraparte, lugar o plataforma, asistentes con cargo y organizacion, firmante, y el contenido segun la variante) y `Extraer y copiar` deja en el portapapeles un texto estructurado para generar la minuta con la skill `minuta-reunion`. Lo que falte sale como `[pendiente: ...]`.

- `Guardar` conserva los datos en el evento (localStorage) y se publican con `Sincronizar`.
- Las minutas **no** van en la hoja `events` ni en la lectura publica: se guardan en la hoja privada `minutas` y solo se leen con la sesion de admin (accion `readMinutas`). Los visitantes nunca las reciben.
- Para activarlo hay que pegar el `google_apps_script.gs` actualizado y publicar una **nueva version** de la Web App (`Implementar > Administrar implementaciones > Editar > Nueva version`). Mientras la Web App no se actualice, las minutas se quedan solo en el navegador del admin y el resto de la sincronizacion funciona igual.
- Tras iniciar sesion o actualizar, la app une las minutas de la nube con las locales; si un evento ya tiene minuta local, esa manda. Las minutas solo se reescriben en la nube cuando esa union se completo, para no borrar minutas que el navegador no habia cargado.

## Pruebas recomendadas de Agenda

1. Crear eventos: entra a `Modo Admin`, abre `Agenda` en una reforma desde la lista de registros, captura fecha, titulo, descripcion, tipo y estado, y presiona `Crear evento`.
2. Editar eventos: en la misma ventana de Agenda, presiona `Editar`, cambia algun campo y guarda. Confirma que el cambio aparezca en la tarjeta del evento.
3. Sincronizar: presiona `Sincronizar`, abre Google Sheets y confirma que `events` tenga una fila por evento con el `reform_id` correcto.
4. Leer desde otro navegador: abre la PWA en otro navegador o equipo, presiona `Actualizar` y revisa que la pantalla `Agenda` muestre los eventos visibles sin permitir edicion.
5. Filtrar: en `Agenda`, prueba filtros por fecha, reforma, estado, tipo y texto. Confirma que los grupos sigan ordenados por fecha ascendente.
6. Multiples eventos por reforma: crea dos o mas eventos para la misma reforma y verifica que aparezcan juntos al filtrar por esa reforma y tambien en `Próximos eventos` dentro del detalle de la reforma.
7. Minuta: en `Agenda`, abre `Minuta` en un evento, captura los datos, presiona `Guardar` y `Extraer y copiar`, y pega el resultado para confirmar que salga completo. Sincroniza y confirma que la hoja `minutas` tenga una fila por evento con minuta.
