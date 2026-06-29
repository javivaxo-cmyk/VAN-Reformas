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

## 4. Publicar como Web App

1. En Apps Script, ve a `Implementar > Nueva implementacion`.
2. Tipo: `Aplicacion web`.
3. Ejecutar como: `Yo`.
4. Quien tiene acceso: `Cualquier persona`.
5. Implementa y copia la URL que termina en `/exec`.

Los visitantes pueden leer los datos publicados por la Web App. Las escrituras requieren iniciar sesion como admin; el navegador solo guarda un token temporal de sesion con expiracion.

El script trabaja con estas pestanas exactas: `reforms`, `history` y `meta`. Si en tu libro ya existen con otro nombre, renombralas o ajusta la constante `SHEETS` en `google_apps_script.gs` antes de volver a desplegar.

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
5. Abre el Google Sheet y confirma que se llenaron las hojas.
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
