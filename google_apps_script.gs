const SESSION_TTL_SECONDS = 18 * 60 * 60;
const SESSION_PROPERTY_PREFIX = 'ADMIN_SESSION_';

const SHEETS = {
  reforms: 'reforms',
  history: 'history',
  meta: 'meta',
  events: 'events',
  calendarMap: 'calendar_map',
  minutas: 'minutas',
};

const CALENDAR_MAP_HEADERS = ['event_id', 'gcal_id', 'signature'];

// Datos de minuta por evento (asistentes, contenido). Hoja privada: la lectura publica (doGet) nunca la devuelve.
const MINUTA_HEADERS = ['event_id', 'reform_id', 'minuta'];

const REFORM_HEADERS = [
  'id',
  'cliente',
  'tipo',
  'fase',
  'prioridad',
  'intervencion',
  'sep',
  'contexto',
  'resolver',
  'sigue',
  'contextoChanged',
  'resolverChanged',
  'sigueChanged',
  'visible',
  'last_updated',
  'updated_by',
];

const HISTORY_HEADERS = [
  'id',
  'reform_id',
  'date',
  'by',
  'contexto',
  'resolver',
  'sigue',
];

const META_HEADERS = ['key', 'value'];

const EVENT_HEADERS = [
  'id',
  'reform_id',
  'date',
  'title',
  'description',
  'type',
  'status',
  'created_at',
  'created_by',
  'visible',
];

function doGet(e) {
  const action = String((e.parameter && e.parameter.action) || 'read');
  const callback = String((e.parameter && e.parameter.callback) || '');
  const payload = action === 'read'
    ? readData_()
    : { ok: false, error: 'Accion no permitida' };
  if (callback) return js_(callback + '(' + JSON.stringify(payload) + ');');
  return json_(payload);
}

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    const action = String((e.parameter && e.parameter.action) || payload.action || 'write');

    if (action === 'login') {
      return json_(login_(payload));
    }

    if (action === 'readMinutas') {
      if (!validateSession_(payload.sessionToken)) return json_({ ok: false, error: 'Sesion invalida o expirada' });
      return json_(readMinutas_());
    }

    if (action !== 'write') return json_({ ok: false, error: 'Accion no permitida' });
    if (!validateSession_(payload.sessionToken)) return json_({ ok: false, error: 'Sesion invalida o expirada' });

    const data = payload.data || {};
    const result = writeData_(data);
    return json_(Object.assign({ ok: true }, result));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function setup() {
  const ss = getSpreadsheet_();
  if (!ss) throw new Error('No hay spreadsheet configurado. Crea la propiedad SPREADSHEET_ID en Apps Script y vuelve a desplegar.');
  ensureSheet_(ss, SHEETS.reforms, REFORM_HEADERS);
  ensureSheet_(ss, SHEETS.history, HISTORY_HEADERS);
  ensureSheet_(ss, SHEETS.meta, META_HEADERS);
  ensureSheet_(ss, SHEETS.events, EVENT_HEADERS);
}

function readData_() {
  const ss = getSpreadsheet_();
  if (!ss) {
    return { ok: false, error: 'No hay spreadsheet configurado. Crea la propiedad SPREADSHEET_ID en Apps Script y vuelve a desplegar.' };
  }
  const reformsSh = ss.getSheetByName(SHEETS.reforms);
  const historySh = ss.getSheetByName(SHEETS.history);
  const metaSh = ss.getSheetByName(SHEETS.meta);
  const eventsSh = ss.getSheetByName(SHEETS.events);
  if (!reformsSh || !historySh || !metaSh) {
    return { ok: false, error: 'Faltan hojas base. Ejecuta setup() una vez en Apps Script.' };
  }
  const reforms = rowsToObjects_(reformsSh.getDataRange().getValues())
    .map(r => ({
      id: r.id,
      cliente: r.cliente,
      tipo: r.tipo,
      fase: r.fase,
      prioridad: r.prioridad,
      intervencion: String(r.intervencion || '0'),
      sep: bool_(r.sep),
      contexto: r.contexto,
      resolver: r.resolver,
      sigue: r.sigue,
      contextoChanged: bool_(r.contextoChanged),
      resolverChanged: bool_(r.resolverChanged),
      sigueChanged: bool_(r.sigueChanged),
      visible: !isFalse_(r.visible),
      last_updated: r.last_updated,
      updated_by: r.updated_by,
      history: [],
      events: [],
    }));

  const byId = {};
  reforms.forEach(r => byId[r.id] = r);
  rowsToObjects_(historySh.getDataRange().getValues()).forEach(h => {
    if (!byId[h.reform_id]) return;
    byId[h.reform_id].history.push({
      id: h.id,
      date: h.date,
      by: h.by,
      contexto: h.contexto,
      resolver: h.resolver,
      sigue: h.sigue,
    });
  });

  if (eventsSh) {
    rowsToObjects_(eventsSh.getDataRange().getValues()).forEach(ev => {
      if (!byId[ev.reform_id]) return;
      byId[ev.reform_id].events.push({
        id: ev.id,
        reform_id: ev.reform_id,
        date: ev.date,
        title: ev.title,
        description: ev.description,
        type: ev.type,
        status: ev.status,
        created_at: ev.created_at,
        created_by: ev.created_by,
        visible: !isFalse_(ev.visible),
      });
    });
  }

  const meta = {};
  rowsToObjects_(metaSh.getDataRange().getValues()).forEach(row => {
    if (row.key) meta[row.key] = row.value;
  });

  return {
    ok: true,
    savedAt: meta.savedAt || new Date().toISOString(),
    spreadsheetId: ss.getId(),
    sheets: {
      reforms: reformsSh.getName(),
      history: historySh.getName(),
      meta: metaSh.getName(),
      events: eventsSh ? eventsSh.getName() : SHEETS.events,
    },
    reforms,
    meta: {
      elaboro: meta.elaboro || '',
      reviso: meta.reviso || '',
      fechaCorte: meta.fechaCorte || '',
      takeaway: meta.takeaway || '',
    },
  };
}

// Solo admin (doPost valida la sesion). Devuelve { event_id: texto JSON de la minuta }.
function readMinutas_() {
  const ss = getSpreadsheet_();
  if (!ss) return { ok: false, error: 'No hay spreadsheet configurado.' };
  const sh = ss.getSheetByName(SHEETS.minutas);
  const minutas = {};
  if (sh) {
    rowsToObjects_(sh.getDataRange().getValues()).forEach(m => {
      if (m.event_id && m.minuta) minutas[m.event_id] = String(m.minuta);
    });
  }
  return { ok: true, minutas };
}

function writeData_(data) {
  const ss = getSpreadsheet_();
  if (!ss) throw new Error('No hay spreadsheet configurado. Crea la propiedad SPREADSHEET_ID en Apps Script y vuelve a desplegar.');
  ensureSheet_(ss, SHEETS.reforms, REFORM_HEADERS);
  ensureSheet_(ss, SHEETS.history, HISTORY_HEADERS);
  ensureSheet_(ss, SHEETS.meta, META_HEADERS);
  ensureSheet_(ss, SHEETS.events, EVENT_HEADERS);
  const savedAt = new Date().toISOString();
  const reforms = Array.isArray(data.reforms) ? data.reforms : [];
  const meta = data.meta || {};
  if (!reforms.length && data.allowEmpty !== true) {
    throw new Error('Se rechazo publicar una cartera vacia. Usa allowEmpty=true solo para un borrado intencional.');
  }

  const reformRows = reforms.map(r => REFORM_HEADERS.map(h => valueFor_(r, h)));
  replaceRows_(ss.getSheetByName(SHEETS.reforms), REFORM_HEADERS, reformRows);

  const historyRows = [];
  reforms.forEach(r => {
    (Array.isArray(r.history) ? r.history : []).forEach(h => {
      historyRows.push(HISTORY_HEADERS.map(col => col === 'reform_id' ? r.id : valueFor_(h, col)));
    });
  });
  replaceRows_(ss.getSheetByName(SHEETS.history), HISTORY_HEADERS, historyRows);

  const eventRows = [];
  reforms.forEach(r => {
    (Array.isArray(r.events) ? r.events : []).forEach(ev => {
      eventRows.push(EVENT_HEADERS.map(col => col === 'reform_id' ? r.id : valueFor_(ev, col)));
    });
  });
  replaceRows_(ss.getSheetByName(SHEETS.events), EVENT_HEADERS, eventRows);

  // Las minutas solo se reescriben si el cliente confirma que las cargo (minutasIncluded);
  // si no, la hoja queda intacta para no borrar minutas que este navegador nunca vio.
  let minutaCount = -1;
  if (data.minutasIncluded === true) {
    const minutaRows = [];
    reforms.forEach(r => {
      (Array.isArray(r.events) ? r.events : []).forEach(ev => {
        if (!ev || !ev.id || !ev.minuta) return;
        minutaRows.push([ev.id, r.id, typeof ev.minuta === 'string' ? ev.minuta : JSON.stringify(ev.minuta)]);
      });
    });
    replaceRows_(ensureSheet_(ss, SHEETS.minutas, MINUTA_HEADERS), MINUTA_HEADERS, minutaRows);
    minutaCount = minutaRows.length;
  }

  const metaRows = [
    ['savedAt', savedAt],
    ['elaboro', meta.elaboro || ''],
    ['reviso', meta.reviso || ''],
    ['fechaCorte', meta.fechaCorte || ''],
    ['takeaway', meta.takeaway || ''],
  ];
  replaceRows_(ss.getSheetByName(SHEETS.meta), META_HEADERS, metaRows);

  const calendar = syncCalendar_(ss, reforms);
  return {
    calendar,
    savedAt,
    spreadsheetId: ss.getId(),
    sheets: {
      reforms: ss.getSheetByName(SHEETS.reforms).getName(),
      history: ss.getSheetByName(SHEETS.history).getName(),
      meta: ss.getSheetByName(SHEETS.meta).getName(),
      events: ss.getSheetByName(SHEETS.events).getName(),
    },
    reformCount: reforms.length,
    historyCount: historyRows.length,
    eventCount: eventRows.length,
    minutaCount,
  };
}

// Crea el calendario "Reformas - Agenda" y guarda su id en CALENDAR_ID.
// Ejecutar una sola vez desde el editor de Apps Script.
function setupCalendar() {
  const existing = getScriptProperty_('CALENDAR_ID');
  if (existing && CalendarApp.getCalendarById(existing)) return existing;
  const cal = CalendarApp.createCalendar('Reformas - Agenda');
  PropertiesService.getScriptProperties().setProperty('CALENDAR_ID', cal.getId());
  return cal.getId();
}

// Sincronizacion de una sola via: app -> Google Calendar (eventos de dia completo).
// Nunca debe romper la escritura a Sheets: los errores se devuelven en el resultado.
function syncCalendar_(ss, reforms) {
  const calendarId = getScriptProperty_('CALENDAR_ID');
  if (!calendarId) return { enabled: false };
  try {
    const cal = CalendarApp.getCalendarById(calendarId);
    if (!cal) return { enabled: true, ok: false, error: 'CALENDAR_ID no corresponde a un calendario accesible' };

    const mapSh = ensureSheet_(ss, SHEETS.calendarMap, CALENDAR_MAP_HEADERS);
    const mapped = {};
    rowsToObjects_(mapSh.getDataRange().getValues()).forEach(m => { mapped[m.event_id] = m; });

    const desired = {};
    reforms.forEach(r => {
      (Array.isArray(r.events) ? r.events : []).forEach(ev => {
        if (!ev || !ev.id || isFalse_(ev.visible)) return;
        const date = parseDate_(ev.date);
        if (!date) return;
        const done = String(ev.status || '').toLowerCase() === 'completado';
        const title = (done ? '[OK] ' : '') + '[' + (r.cliente || r.id) + '] ' + (ev.title || ev.type || 'Evento');
        const description = [ev.type ? 'Tipo: ' + ev.type : '', ev.status ? 'Estado: ' + ev.status : '', ev.description || '']
          .filter(Boolean).join('\n');
        desired[ev.id] = { date, title, description, signature: JSON.stringify([ev.date, title, description]) };
      });
    });

    const next = [];
    let created = 0, updated = 0, deleted = 0, failed = 0;

    Object.keys(desired).forEach(id => {
      const d = desired[id];
      const prev = mapped[id];
      try {
        const existing = prev && prev.gcal_id ? cal.getEventById(String(prev.gcal_id)) : null;
        if (existing) {
          if (prev.signature !== d.signature) {
            existing.setTitle(d.title);
            existing.setDescription(d.description);
            existing.setAllDayDate(d.date);
            updated++;
          }
          next.push([id, prev.gcal_id, d.signature]);
        } else {
          const created_ = cal.createAllDayEvent(d.title, d.date, { description: d.description });
          next.push([id, created_.getId(), d.signature]);
          created++;
        }
      } catch (err) {
        failed++;
        if (prev) next.push([id, prev.gcal_id, prev.signature]);
      }
    });

    Object.keys(mapped).forEach(id => {
      if (desired[id]) return;
      try {
        const existing = cal.getEventById(String(mapped[id].gcal_id));
        if (existing) existing.deleteEvent();
        deleted++;
      } catch (err) {
        failed++;
        next.push([id, mapped[id].gcal_id, mapped[id].signature]);
      }
    });

    replaceRows_(mapSh, CALENDAR_MAP_HEADERS, next);
    return { enabled: true, ok: failed === 0, created, updated, deleted, failed };
  } catch (err) {
    return { enabled: true, ok: false, error: String(err && err.message ? err.message : err) };
  }
}

function parseDate_(value) {
  if (value instanceof Date) return value;
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function login_(payload) {
  const username = String((payload && payload.username) || '').trim();
  const password = String((payload && payload.password) || '');
  const expectedUser = getScriptProperty_('ADMIN_USERNAME');
  const expectedPassword = getScriptProperty_('ADMIN_PASSWORD');
  const secret = getScriptProperty_('SESSION_SECRET');

  if (!expectedUser || !expectedPassword || !secret) {
    return { ok: false, error: 'Credenciales de administrador no configuradas en PropertiesService' };
  }
  if (username !== expectedUser || password !== expectedPassword) {
    return { ok: false, error: 'Usuario o contrasena incorrectos' };
  }

  cleanupExpiredSessions_();
  const expiresAtMs = Date.now() + SESSION_TTL_SECONDS * 1000;
  const random = Utilities.getUuid() + ':' + Utilities.getUuid() + ':' + Date.now();
  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(random + ':' + expiresAtMs, secret)
  );
  const sessionToken = Utilities.base64EncodeWebSafe(random) + '.' + signature;
  const tokenHash = hashToken_(sessionToken);

  PropertiesService.getScriptProperties().setProperty(
    SESSION_PROPERTY_PREFIX + tokenHash,
    JSON.stringify({ username: username, expiresAt: expiresAtMs })
  );

  return {
    ok: true,
    sessionToken: sessionToken,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

function validateSession_(sessionToken) {
  const token = String(sessionToken || '').trim();
  if (!token) return false;
  const props = PropertiesService.getScriptProperties();
  const key = SESSION_PROPERTY_PREFIX + hashToken_(token);
  const raw = props.getProperty(key);
  if (!raw) return false;
  try {
    const session = JSON.parse(raw);
    if (!session || Number(session.expiresAt) <= Date.now()) {
      props.deleteProperty(key);
      return false;
    }
    return true;
  } catch (e) {
    props.deleteProperty(key);
    return false;
  }
}

function cleanupExpiredSessions_() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  Object.keys(all).forEach(key => {
    if (key.indexOf(SESSION_PROPERTY_PREFIX) !== 0) return;
    try {
      const session = JSON.parse(all[key]);
      if (!session || Number(session.expiresAt) <= Date.now()) props.deleteProperty(key);
    } catch (e) {
      props.deleteProperty(key);
    }
  });
}

function hashToken_(token) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)
  ).replace(/=+$/g, '');
}

function getScriptProperty_(key) {
  return String(PropertiesService.getScriptProperties().getProperty(key) || '').trim();
}

function valueFor_(obj, key) {
  const value = obj && obj[key];
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return value == null ? '' : value;
}

function rowsToObjects_(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(v => v !== '')).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] == null ? '' : row[i]);
    return obj;
  });
}

function replaceRows_(sh, headers, rows) {
  sh.clearContents();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sh.setFrozenRows(1);
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const first = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeaderContent = first.some(v => v !== '');
  if (!hasHeaderContent) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return sh;
  }
  const current = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), headers.length)).getValues()[0].map(String);
  const missing = headers.filter(h => !current.includes(h));
  if (missing.length) {
    sh.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function getSpreadsheet_() {
  const configured = getScriptProperty_('SPREADSHEET_ID');
  if (!configured) return null;
  return SpreadsheetApp.openById(configured);
}

function bool_(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

function isFalse_(value) {
  return value === false || String(value).toLowerCase() === 'false';
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function js_(code) {
  return ContentService
    .createTextOutput(code)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
