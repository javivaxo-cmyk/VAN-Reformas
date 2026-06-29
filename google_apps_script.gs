const SESSION_TTL_SECONDS = 18 * 60 * 60;
const SESSION_PROPERTY_PREFIX = 'ADMIN_SESSION_';

const SHEETS = {
  reforms: 'reforms',
  history: 'history',
  meta: 'meta',
};

const REFORM_HEADERS = [
  'id',
  'cliente',
  'tipo',
  'fase',
  'prioridad',
  'intervencion',
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
}

function readData_() {
  const ss = getSpreadsheet_();
  if (!ss) {
    return { ok: false, error: 'No hay spreadsheet configurado. Crea la propiedad SPREADSHEET_ID en Apps Script y vuelve a desplegar.' };
  }
  const reformsSh = ss.getSheetByName(SHEETS.reforms);
  const historySh = ss.getSheetByName(SHEETS.history);
  const metaSh = ss.getSheetByName(SHEETS.meta);
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

function writeData_(data) {
  const ss = getSpreadsheet_();
  if (!ss) throw new Error('No hay spreadsheet configurado. Crea la propiedad SPREADSHEET_ID en Apps Script y vuelve a desplegar.');
  ensureSheet_(ss, SHEETS.reforms, REFORM_HEADERS);
  ensureSheet_(ss, SHEETS.history, HISTORY_HEADERS);
  ensureSheet_(ss, SHEETS.meta, META_HEADERS);
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

  const metaRows = [
    ['savedAt', savedAt],
    ['elaboro', meta.elaboro || ''],
    ['reviso', meta.reviso || ''],
    ['fechaCorte', meta.fechaCorte || ''],
    ['takeaway', meta.takeaway || ''],
  ];
  replaceRows_(ss.getSheetByName(SHEETS.meta), META_HEADERS, metaRows);
  return {
    savedAt,
    spreadsheetId: ss.getId(),
    sheets: {
      reforms: ss.getSheetByName(SHEETS.reforms).getName(),
      history: ss.getSheetByName(SHEETS.history).getName(),
      meta: ss.getSheetByName(SHEETS.meta).getName(),
    },
    reformCount: reforms.length,
    historyCount: historyRows.length,
  };
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
