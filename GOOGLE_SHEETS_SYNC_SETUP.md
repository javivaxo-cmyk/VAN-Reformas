# Sincronizacion con Google Sheets

## 1. Pegar el Apps Script

1. Abre tu Google Sheet.
2. Ve a `Extensiones > Apps Script`.
3. Borra el contenido inicial de `Code.gs`.
4. Pega el contenido de `google_apps_script.gs`.
5. Cambia esta linea por un token largo propio:

```js
const ADMIN_TOKEN = 'CAMBIA_ESTE_TOKEN_LARGO';
```

Ejemplo de token: una frase larga sin espacios, mezclando letras y numeros.

## 2. Crear las hojas base

En Apps Script, selecciona la funcion `setup` y ejecutala una vez.

Google te pedira permisos. Aceptalos con tu cuenta, porque el script necesita escribir en ese libro.

Se crearan estas hojas:

- `reforms`
- `history`
- `meta`

## 3. Publicar como Web App

1. En Apps Script, ve a `Implementar > Nueva implementacion`.
2. Tipo: `Aplicacion web`.
3. Ejecutar como: `Yo`.
4. Quien tiene acceso: `Cualquier persona`.
5. Implementa y copia la URL que termina en `/exec`.

Los visitantes podran leer los datos publicados por la Web App, pero solo quien tenga el token podra escribir.

## 4. Configurar la PWA en tu navegador admin

Abre la PWA, abre la consola del navegador y pega:

```js
localStorage.setItem("reformas-cloud-endpoint", "PEGA_AQUI_LA_URL_EXEC");
localStorage.setItem("reformas-cloud-token", "PEGA_AQUI_TU_TOKEN");
location.reload();
```

Para visitantes, solo hace falta configurar la URL:

```js
localStorage.setItem("reformas-cloud-endpoint", "PEGA_AQUI_LA_URL_EXEC");
location.reload();
```

## 5. Primera carga de datos

1. Entra a `Modo Admin`.
2. Si ya tienes datos locales en la app, presiona `Guardar local` para confirmar el borrador.
3. Cuando quieras publicar esos cambios en Google Sheets, presiona `Sincronizar`.
4. Abre el Google Sheet y confirma que se llenaron las hojas.
5. En otro navegador o equipo, configura solo `reformas-cloud-endpoint` y presiona `Actualizar`.

## Notas

- La app guarda cache local para abrir rapido y resistir fallas temporales.
- El admin puede editar libremente sin publicar cambios a la nube.
- `Guardar local` conserva el progreso solo en el navegador del admin.
- `Sincronizar` publica el estado local completo en Google Sheets.
- Los visitantes refrescan desde Google Sheets al abrir, al presionar `Actualizar` y automaticamente cada 60 segundos.
- Si actualizas `google_apps_script.gs`, vuelve a publicar la Web App en Apps Script con una nueva version para que Google ejecute el codigo corregido.
- Las lecturas publicas no deben borrar ni reconstruir hojas. El script solo publica cambios cuando recibe un `POST` valido con token de admin.
- Si una lectura responde `Faltan hojas base`, ejecuta `setup()` una vez desde Apps Script antes de volver a abrir la PWA.
