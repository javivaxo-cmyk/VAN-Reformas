const ADMIN_TOKEN = 'CAMBIA_ESTE_TOKEN_LARGO';

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
    if (!payload || payload.token !== ADMIN_TOKEN) {
      return json_({ ok: false, error: 'Token invalido' });
    }
    const data = payload.data || {};
    writeData_(data);
    return json_({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function setup() {
  ensureSheet_(SHEETS.reforms, REFORM_HEADERS);
  ensureSheet_(SHEETS.history, HISTORY_HEADERS);
  ensureSheet_(SHEETS.meta, META_HEADERS);
}

function readData_() {
  const reformsSh = sheetExisting_(SHEETS.reforms);
  const historySh = sheetExisting_(SHEETS.history);
  const metaSh = sheetExisting_(SHEETS.meta);
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
  setup();
  const savedAt = new Date().toISOString();
  const reforms = Array.isArray(data.reforms) ? data.reforms : [];
  const meta = data.meta || {};
  if (!reforms.length && data.allowEmpty !== true) {
    throw new Error('Se rechazo publicar una cartera vacia. Usa allowEmpty=true solo para un borrado intencional.');
  }

  const reformRows = reforms.map(r => REFORM_HEADERS.map(h => valueFor_(r, h)));
  replaceRows_(sheet_(SHEETS.reforms), REFORM_HEADERS, reformRows);

  const historyRows = [];
  reforms.forEach(r => {
    (Array.isArray(r.history) ? r.history : []).forEach(h => {
      historyRows.push(HISTORY_HEADERS.map(col => col === 'reform_id' ? r.id : valueFor_(h, col)));
    });
  });
  replaceRows_(sheet_(SHEETS.history), HISTORY_HEADERS, historyRows);

  const metaRows = [
    ['savedAt', savedAt],
    ['elaboro', meta.elaboro || ''],
    ['reviso', meta.reviso || ''],
    ['fechaCorte', meta.fechaCorte || ''],
    ['takeaway', meta.takeaway || ''],
  ];
  replaceRows_(sheet_(SHEETS.meta), META_HEADERS, metaRows);
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

function ensureSheet_(name, headers) {
  const ss = SpreadsheetApp.getActive();
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

function sheet_(name) {
  return SpreadsheetApp.getActive().getSheetByName(name);
}

function sheetExisting_(name) {
  return SpreadsheetApp.getActive().getSheetByName(name);
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
