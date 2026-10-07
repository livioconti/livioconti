/* =====================================================================
 * PDF DAL REGISTRO — plugin "cfu-express" (v1.3)
 *
 * Produce il PDF di una pratica a file CHIUSO, con la stessa logica del menu
 * "CFU → Esporta pratica in PDF" del template (Cover + fogli delle righe spuntate,
 * A4 orizzontale adattato alla larghezza, PDF nella cartella della pratica,
 * PDF precedente con lo stesso nome nel cestino).
 *
 * Come funziona: nella colonna "PDF" del Registro Claude scrive "richiesto"
 * (connettore Google Sheets). Ogni minuto questo script cerca le righe con
 * "richiesto", esporta il PDF e scrive "fatto <data> <link>" oppure "errore: …".
 *
 * Installazione (una volta, nel file "Registro pratiche CFU"):
 *   Estensioni → Apps Script → incolla questo file → esegui installaPdfRegistro()
 *   e concedi le autorizzazioni. Crea la colonna "PDF" se manca e l'attivatore
 *   a tempo (ogni minuto). Per toglierlo: disinstallaPdfRegistro().
 * ===================================================================== */

var PDFREG = {
  foglio: 'Registro',
  colPdf: 'PDF',
  colFile: 'File riconoscimento (link)',
  colId: 'ID pratica',
  cover: 'Cover',
  cellaNome: 'COVER_NOMEFILE',
  righe: 'COVER_RIGHE',
  mappa: [['iscriversi', 'EsamiDaFare'], ['consigliati', 'Cons'], ['meccatronica', 'Tri.Mecca'],
          ['logistic', 'Tri.LogEco'], ['edili', 'Tri.Edil'], ['aeronautic', 'Tri.Aero'],
          ['produzione', 'Mag.Prod'], ['energetic', 'Mag.Energ'], ['4.0', 'Mag.Ind4.0']]
};

function installaPdfRegistro() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PDFREG.foglio);
  var intest = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  if (intest.indexOf(PDFREG.colPdf) < 0) sh.getRange(1, sh.getLastColumn() + 1).setValue(PDFREG.colPdf);
  disinstallaPdfRegistro();
  ScriptApp.newTrigger('pdfDalRegistro').timeBased().everyMinutes(1).create();
  SpreadsheetApp.getUi().alert('PDF dal Registro attivo: colonna "' + PDFREG.colPdf + '" e controllo ogni minuto.');
}

function disinstallaPdfRegistro() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pdfDalRegistro') ScriptApp.deleteTrigger(t);
  });
}

function pdfDalRegistro() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PDFREG.foglio);
    var dati = sh.getDataRange().getValues(), intest = dati[0];
    var cPdf = intest.indexOf(PDFREG.colPdf), cFile = intest.indexOf(PDFREG.colFile);
    if (cPdf < 0 || cFile < 0) return;
    for (var r = 1; r < dati.length; r++) {
      if (String(dati[r][cPdf]).trim().toLowerCase() !== 'richiesto') continue;
      var cella = sh.getRange(r + 1, cPdf + 1);
      cella.setValue('in corso…'); SpreadsheetApp.flush();
      try {
        var m = String(dati[r][cFile]).match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (!m) throw new Error('link al file di riconoscimento mancante');
        var esito = esportaPratica_(m[1]);
        cella.setValue('fatto ' + Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy HH:mm') +
                       ' · ' + esito.fogli.join(', ') + ' · ' + esito.url);
      } catch (e) {
        cella.setValue('errore: ' + e.message);
      }
    }
  } finally { lock.releaseLock(); }
}

function esportaPratica_(fileId) {
  var ss = SpreadsheetApp.openById(fileId);
  var nome = String(ss.getRangeByName(PDFREG.cellaNome).getDisplayValue()).replace(/[\\/:*?"<>|]/g, '').trim();
  if (!nome) throw new Error('nome pratica (COVER_NOMEFILE) vuoto');
  var nomi = fogli_(ss);
  var file = DriveApp.getFileById(fileId), par = file.getParents();
  var cartella = par.hasNext() ? par.next() : DriveApp.getRootFolder();
  var blob = esporta_(ss, nomi).setName(nome + '.pdf');
  var vecchi = cartella.getFilesByName(nome + '.pdf');
  while (vecchi.hasNext()) vecchi.next().setTrashed(true);
  var pdf = cartella.createFile(blob);
  return { url: pdf.getUrl(), fogli: nomi };
}

function fogli_(ss) {
  var righe = ss.getRangeByName(PDFREG.righe).getValues(), nomi = [];
  righe.forEach(function (r) {
    var sp = r[0] === true || r[0] === '✔', t = String(r[1]).toLowerCase();
    if (!sp || !t.trim()) return;
    var x = PDFREG.mappa.filter(function (m) { return t.indexOf(m[0]) >= 0; })[0];
    if (!x || !ss.getSheetByName(x[1])) throw new Error('foglio non trovato per: ' + r[1]);
    if (nomi.indexOf(x[1]) < 0) nomi.push(x[1]);
  });
  if (!nomi.length) throw new Error('nessuna riga spuntata in Cover');
  var ordine = ss.getSheets().map(function (s) { return s.getName(); });
  nomi.sort(function (a, b) { return ordine.indexOf(a) - ordine.indexOf(b); });
  return [PDFREG.cover].concat(nomi);
}

function esporta_(ss, nomi) {
  var sheets = ss.getSheets(), eraNascosto = sheets.map(function (s) { return s.isSheetHidden(); });
  try {
    sheets.forEach(function (s) { if (nomi.indexOf(s.getName()) >= 0) s.showSheet(); });
    sheets.forEach(function (s) { if (nomi.indexOf(s.getName()) < 0) s.hideSheet(); });
    SpreadsheetApp.flush();
    var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export' +
      '?format=pdf&size=A4&portrait=false&fitw=true' +
      '&top_margin=0.75&bottom_margin=0.75&left_margin=0.7&right_margin=0.7' +
      '&gridlines=false&sheetnames=false&printtitle=false&pagenum=UNDEFINED&fzr=false';
    var resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) throw new Error('esportazione PDF fallita (HTTP ' + resp.getResponseCode() + ')');
    return resp.getBlob();
  } finally {
    sheets.forEach(function (s, i) { if (!eraNascosto[i]) s.showSheet(); });
    sheets.forEach(function (s, i) { if (eraNascosto[i]) s.hideSheet(); });
    SpreadsheetApp.flush();
  }
}
