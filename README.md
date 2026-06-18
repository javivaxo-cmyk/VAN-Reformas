# VAN Reformas Status Hub

PWA estatica para dar seguimiento a reformas actuariales, con tablero ejecutivo, reporte imprimible, panel admin e historico de cambios por entidad.

## Archivos principales

- `Reformas Status Hub.dc.html`: aplicacion principal.
- `support.js`: runtime necesario para renderizar la PWA.
- `google_apps_script.gs`: API para conectar Google Sheets como persistencia gratuita.
- `GOOGLE_SHEETS_SYNC_SETUP.md`: guia de configuracion de la sincronizacion.
- `uploads/creador_reportes_reformas.html`: archivo de referencia/origen conservado en el proyecto.

## Persistencia y sincronizacion

La app usa un flujo hibrido:

- `Guardar local`: conserva el avance en `localStorage` del navegador del admin.
- `Sincronizar`: publica el estado completo en Google Sheets mediante Apps Script.
- Visitantes: solo leen la informacion desde Google Sheets y no escriben datos.

Para configurar Google Sheets, sigue los pasos de `GOOGLE_SHEETS_SYNC_SETUP.md`.

## Configuracion local

Abre la PWA directamente en el navegador:

```text
Reformas Status Hub.dc.html
```

Para conectar la nube en el navegador admin:

```js
localStorage.setItem("reformas-cloud-endpoint", "PEGA_AQUI_LA_URL_EXEC");
localStorage.setItem("reformas-cloud-token", "PEGA_AQUI_TU_TOKEN");
location.reload();
```

Para visitantes:

```js
localStorage.setItem("reformas-cloud-endpoint", "PEGA_AQUI_LA_URL_EXEC");
location.reload();
```

## Seguridad

No guardes tokens reales en el repositorio. El archivo `google_apps_script.gs` incluye un marcador `CAMBIA_ESTE_TOKEN_LARGO` que debe reemplazarse solo dentro de Apps Script.
