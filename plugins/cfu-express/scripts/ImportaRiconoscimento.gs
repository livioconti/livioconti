/* =====================================================================
 * IMPORTA RICONOSCIMENTO — plugin "cfu-express" (v1.2: Registro per intestazioni + Provenienza; cover.notaMag, cover.statoMag)
 *
 * Legge il file JSON più recente "cfu_express_*.json" nella cartella della pratica
 * (lo scrive Claude via Google Drive) e lo riporta nel foglio in pochi secondi:
 *   trash · trashAzzurra · esami (+ celle CFU V.O. in rosso) · matrice (+ riga CV)
 *   cfuPerCV · affidabilita · cover · registro
 * Ogni blocco è facoltativo: si scrive solo ciò che è presente nel JSON.
 * Alla fine scrive accanto il file "cfu_express_esito_*.json" con i controlli
 * (Errore, totali per indirizzo, formule), che Claude rilegge da Drive.
 *
 * Installazione: incolla questo file nel progetto Apps Script del template
 * e aggiungi in onOpen() la voce:
 *   .addItem('Importa riconoscimento (Express)', 'importaRiconoscimento')
 * Formato del JSON: skill cfu-express-riconoscimento, references/formato-json.md.
 * ===================================================================== */

var EXPRESS = {
  prefisso: 'cfu_express_',
  rossoVO: '#E06666',
  registroId: '1NjLVayRZDbbunQt5hXrvOstM0Z6IYGpRm9s_BsHn1So',
  registroFoglio: 'Registro',
  blocchi: ['trash', 'trashAzzurra', 'esami', 'matrice', 'cfuPerCV', 'affidabilita', 'cover', 'registro']
};

function importaRiconoscimento() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var file = ultimoJsonExpress_(ss);
  if (!file) {
    ui.alert('Importa riconoscimento', 'Nella cartella della pratica non c\'è nessun file ' + EXPRESS.prefisso + '*.json.', ui.ButtonSet.OK);
    return;
  }
  var d;
  try { d = JSON.parse(file.getBlob().getDataAsString('UTF-8')); }
  catch (e) { ui.alert('Il file ' + file.getName() + ' non è un JSON valido:\n' + e.message); return; }

  var presenti = EXPRESS.blocchi.filter(function (k) { return d[k] !== undefined && d[k] !== null; });
  var cog = ss.getRangeByName('COVER_COGNOME');
  var cognome = cog ? String(cog.getDisplayValue()).trim() : '';
  var avviso = (d.studente && cognome && String(d.studente).toUpperCase() !== cognome.toUpperCase())
    ? '\n\nATTENZIONE: il file è per "' + d.studente + '" ma la Cover riporta "' + cognome + '".' : '';
  var r = ui.alert('Importa riconoscimento',
    'File: ' + file.getName() + '\nStudente: ' + (d.studente || '?') + '\nBlocchi: ' + presenti.join(', ') + avviso + '\n\nScrivo nel foglio?',
    ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;

  var input = ss.getSheetByName('Input'), cover = ss.getSheetByName('Cover');
  var prima = [input, cover].map(contaFormuleX_);
  var log = [], errori = [];
  function passo(nome, fn) {
    try { var m = fn(); if (m) log.push(m); }
    catch (e) { errori.push(nome + ': ' + e.message); }
  }

  if (d.trash) passo('trash', function () { return scriviTrashX_(ss, 'Trash', d.trash); });
  if (d.trashAzzurra) passo('trashAzzurra', function () { return scriviTrashX_(ss, 'Trash_tabella_azzurra', d.trashAzzurra); });
  if (d.esami) passo('esami', function () { return scriviEsamiX_(ss, input, d.esami); });
  if (d.matrice) passo('matrice', function () { return scriviMatriceX_(ss, input, d.matrice); });
  if (d.cfuPerCV) passo('cfuPerCV', function () { return scriviTabellaX_(ss, 'CFU_per_CV', d.cfuPerCV, ui); });
  if (d.affidabilita) passo('affidabilita', function () {
    try { if (typeof spegniAffidabilita_ === 'function') spegniAffidabilita_(); } catch (e) {}
    return scriviTabellaX_(ss, 'Affidabilita_CFU', d.affidabilita, null);
  });
  if (d.cover) passo('cover', function () { return scriviCoverX_(ss, d.cover); });
  SpreadsheetApp.flush();
  if (d.registro) passo('registro', function () { return aggiornaRegistroX_(d.registro); });

  var esito = controlliX_(ss, input, cover, prima, d.attesi);
  esito.file = file.getName();
  esito.scritto = log;
  esito.errori = errori.concat(esito.errori);
  esito.data = new Date().toISOString();
  try {
    var cart = cartellaX_(ss);
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
    cart.createFile(EXPRESS.prefisso + 'esito_' + stamp + '.json', JSON.stringify(esito, null, 2), 'application/json');
  } catch (e) { esito.errori.push('esito non salvato: ' + e.message); }

  ui.alert(esito.errori.length ? 'Importazione con problemi' : 'Importazione completata',
    log.join('\n') + '\n\n' + esito.riassunto + (esito.errori.length ? '\n\nPROBLEMI:\n- ' + esito.errori.join('\n- ') : ''),
    ui.ButtonSet.OK);
}

/* ---------- lettura del JSON ---------- */
function cartellaX_(ss) {
  var p = DriveApp.getFileById(ss.getId()).getParents();
  return p.hasNext() ? p.next() : DriveApp.getRootFolder();
}
function ultimoJsonExpress_(ss) {
  var it = cartellaX_(ss).getFiles(), best = null;
  while (it.hasNext()) {
    var f = it.next(), n = f.getName();
    if (n.indexOf(EXPRESS.prefisso) !== 0 || !/\.json$/i.test(n) || n.indexOf('_esito_') >= 0) continue;
    if (!best || f.getLastUpdated() > best.getLastUpdated()) best = f;
  }
  return best;
}

/* ---------- blocchi ---------- */
function righe9X_(righe) {
  return (righe || []).map(function (r) {
    var x = (r || []).slice(0, 9);
    while (x.length < 9) x.push('');
    return x.map(function (v) { return v === null || v === undefined ? '' : v; });
  });
}

function scriviTrashX_(ss, nome, blk) {
  var sh = ss.getSheetByName(nome);
  if (!sh) {
    if (nome !== 'Trash_tabella_azzurra') throw new Error('foglio ' + nome + ' mancante');
    var t = ss.getSheetByName('Trash');
    sh = ss.insertSheet(nome, t ? t.getIndex() : ss.getNumSheets());
  }
  var last = Math.max(sh.getLastRow(), 1);
  sh.getRange(1, 1, last, 9).clear({ contentsOnly: true, formatOnly: true });
  var righe = righe9X_(blk.righe);
  if (righe.length) {
    var r = sh.getRange(1, 1, righe.length, 9);
    r.setValues(righe);
    if (blk.sfondo) r.setBackground(blk.sfondo);
  }
  // esami inclusi da altri allegati (es. certificato): subito sotto, senza sfondo né formati
  var extra = righe9X_(blk.righeExtra || []);
  if (extra.length) sh.getRange(righe.length + 1, 1, extra.length, 9).setValues(extra);
  return nome + ': ' + righe.length + ' righe' + (extra.length ? ' + ' + extra.length + ' da altri allegati (senza sfondo)' : '');
}

function scriviEsamiX_(ss, input, blk) {
  var esa = ss.getRangeByName('INPUT_ESAMI');
  if (!esa) throw new Error('manca INPUT_ESAMI');
  var r0 = esa.getRow(), c0 = esa.getColumn(), n = esa.getNumRows();
  var righe = righe9X_(blk.righe);
  if (righe.length > n) throw new Error('troppi esami (' + righe.length + ' > ' + n + ')');
  svuotaValoriX_(input.getRange(r0, c0, n, 9));
  if (righe.length) input.getRange(r0, c0, righe.length, 9).setValues(righe);
  // celle CFU (8ª colonna) dei V.O. con CFU assunti: rosso; tolto il rosso residuo da pratiche precedenti
  var colH = input.getRange(r0, c0 + 7, n, 1), bg = colH.getBackgrounds();
  var assunti = {};
  (blk.cfuAssunti || []).forEach(function (i) { assunti[i] = true; });
  var cambia = false;
  for (var i = 0; i < n; i++) {
    var rosso = String(bg[i][0]).toLowerCase() === EXPRESS.rossoVO.toLowerCase();
    if (assunti[i] && !rosso) { bg[i][0] = EXPRESS.rossoVO; cambia = true; }
    else if (!assunti[i] && rosso) { bg[i][0] = null; cambia = true; }
  }
  if (cambia) colH.setBackgrounds(bg);
  return 'Input: ' + righe.length + ' esami da riga ' + r0 + (Object.keys(assunti).length ? ', ' + Object.keys(assunti).length + ' CFU V.O. in rosso' : '');
}

function colNumX_(lettere) {
  var n = 0, s = String(lettere).toUpperCase();
  for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n;
}

function scriviMatriceX_(ss, input, blk) {
  var mat = ss.getRangeByName('INPUT_MATRICE'), cvm = ss.getRangeByName('INPUT_CV_MATRICE'), tn = ss.getRangeByName('INPUT_TARGET_NOMI');
  if (!mat || !cvm || !tn) throw new Error('mancano INPUT_MATRICE / INPUT_CV_MATRICE / INPUT_TARGET_NOMI');
  var cMin = tn.getColumn(), nC = tn.getNumColumns(), cMax = cMin + nC - 1;
  var rCv = cvm.getRow(), rMin = mat.getRow(), rMax = mat.getLastRow();
  var conCv = blk.cv !== undefined && blk.cv !== null;
  // svuota (solo valori scritti, mai formule): riga CV solo se il blocco cv è presente
  var rStart = conCv ? rCv : rMin;
  svuotaValoriX_(input.getRange(rStart, cMin, rMax - rStart + 1, nC));
  // allineamento uniforme (il template ha righe non centrate)
  input.getRange(rCv, cMin, rMax - rCv + 1, nC).setHorizontalAlignment('center');
  var celle = [];
  (blk.celle || []).forEach(function (x) { celle.push([Number(x[0]), colNumX_(x[1]), Number(x[2])]); });
  if (conCv) blk.cv.forEach(function (x) { celle.push([rCv, colNumX_(x[0]), Number(x[1])]); });
  var bad = celle.filter(function (c) {
    return !(c[1] >= cMin && c[1] <= cMax && ((c[0] >= rMin && c[0] <= rMax) || c[0] === rCv) && c[2] > 0);
  });
  if (bad.length) throw new Error(bad.length + ' celle fuori dalla matrice o con CFU non validi (es. riga ' + bad[0][0] + ', colonna ' + bad[0][1] + ')');
  if (!celle.length) return 'Matrice: svuotata';
  var rLo = Math.min.apply(null, celle.map(function (c) { return c[0]; }));
  var rHi = Math.max.apply(null, celle.map(function (c) { return c[0]; }));
  var blocco = input.getRange(rLo, cMin, rHi - rLo + 1, nC);
  var f = blocco.getFormulas(), v = blocco.getValues(), conFormule = false;
  celle.forEach(function (c) {
    var i = c[0] - rLo, j = c[1] - cMin;
    if (f[i][j]) conFormule = true; else v[i][j] = c[2];
  });
  if (!conFormule && !f.some(function (r) { return r.some(String); })) blocco.setValues(v);
  else celle.forEach(function (c) { if (!f[c[0] - rLo][c[1] - cMin]) input.getRange(c[0], c[1]).setValue(c[2]); });
  var tot = celle.reduce(function (a, c) { return a + c[2]; }, 0);
  return 'Matrice: ' + celle.length + ' celle, ' + tot + ' CFU' + (conCv ? ' (riga CV inclusa)' : '');
}

function scriviTabellaX_(ss, nome, blk, ui) {
  var sh = ss.getSheetByName(nome);
  if (!sh) throw new Error('foglio ' + nome + ' mancante (è fisso: non si crea)');
  var righe = righe9X_(blk.righe), last = sh.getLastRow();
  if (nome === 'CFU_per_CV' && ui && last >= 2 && !blk.sovrascriviDecisioni) {
    var a = sh.getRange(2, 1, last - 1, 1).getDisplayValues().filter(function (r) { return String(r[0]).trim() !== ''; });
    if (a.length) {
      var ok = ui.alert('CFU_per_CV', 'La colonna A contiene già ' + a.length + ' decisioni dell\'operatore. Le sovrascrivo con la nuova proposta?', ui.ButtonSet.YES_NO);
      if (ok !== ui.Button.YES) return 'CFU_per_CV: lasciato invariato (decisioni presenti)';
    }
  }
  if (last >= 2) sh.getRange(2, 1, last - 1, Math.max(9, sh.getLastColumn())).clearContent();
  if (righe.length) sh.getRange(2, 1, righe.length, 9).setValues(righe);
  return nome + ': ' + righe.length + ' righe da A2';
}

function scriviCoverX_(ss, c) {
  var fatto = [];
  function poni(nome, val) { var r = ss.getRangeByName(nome); if (r) { r.setValues(r.getValues().map(function (x, i) { return [Array.isArray(val) ? val[i] === true : val === true]; })); fatto.push(nome); } }
  if (c.tutteTri !== undefined) { poni('COVER_TUTTE_TRI', c.tutteTri); poni('COVER_IND_TRI', c.indTri || c.tutteTri); }
  else if (c.indTri) poni('COVER_IND_TRI', c.indTri);
  if (c.tutteMag !== undefined) { poni('COVER_TUTTE_MAG', c.tutteMag); poni('COVER_IND_MAG', c.indMag || c.tutteMag); }
  else if (c.indMag) poni('COVER_IND_MAG', c.indMag);
  // nota magistrale (Cover!C40): triennale che chiede la magistrale con debiti, riconoscimento Tri + Mag
  if (c.notaMag !== undefined) poni('COVER_NOTA_MAG', c.notaMag === true);
  // stato esami magistrale (stessa logica di statoEsamiMagistrale_): un ✔ messo a mano non si tocca
  var ind = ss.getRangeByName('COVER_IND_MAG'), st = ss.getRangeByName('COVER_STATO_MAG');
  if (st && c.statoMag !== undefined && ['✔', '∅', '✗'].indexOf(c.statoMag) >= 0) { st.setValue(c.statoMag); fatto.push('COVER_STATO_MAG=' + c.statoMag); }
  else if (ind && st) {
    var mag = ind.getValues().some(function (x) { return x[0] === true; }), s = String(st.getValue());
    if (mag && (s === '' || s === '✗' || s === 'false')) st.setValue('∅');
    else if (!mag && s === '∅') st.setValue('✗');
  }
  return 'Cover: ' + fatto.join(', ');
}

/* Registro: colonne trovate per INTESTAZIONE (riga 1), non per posizione,
 * così l'inserimento di colonne (es. "Provenienza" in A, "Mail (link)") non sposta le scritture. */
var REGISTRO_COL = {
  provenienza: 'Provenienza', id: 'ID pratica', stato: 'Stato', passo: 'Passo',
  fermata: 'Fermata in attesa', aggiornato: 'Ultimo aggiornamento', note: 'Note'
};
var PROVENIENZE = ['cfu@', 'presidenza.ingegneria@'];

function colonneRegistroX_(sh) {
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase(); });
  var c = {};
  Object.keys(REGISTRO_COL).forEach(function (k) {
    var j = head.indexOf(REGISTRO_COL[k].toLowerCase());
    c[k] = j >= 0 ? j + 1 : 0;
  });
  ['id', 'stato', 'passo', 'fermata', 'aggiornato'].forEach(function (k) {
    if (!c[k]) throw new Error('Registro: manca la colonna "' + REGISTRO_COL[k] + '" in riga 1');
  });
  return c;
}

function aggiornaRegistroX_(g) {
  if (!g.idPratica) throw new Error('registro senza idPratica');
  var sh = SpreadsheetApp.openById(EXPRESS.registroId).getSheetByName(EXPRESS.registroFoglio);
  var n = sh.getLastRow() - 1;
  if (n < 1) throw new Error('Registro vuoto');
  var c = colonneRegistroX_(sh);
  var ids = sh.getRange(2, c.id, n, 1).getDisplayValues();
  for (var i = 0; i < n; i++) {
    if (String(ids[i][0]).trim() === g.idPratica) {
      var riga = i + 2;
      sh.getRange(riga, c.stato).setValue(g.stato || '');
      sh.getRange(riga, c.passo).setValue(g.passo || '');
      sh.getRange(riga, c.fermata).setValue(g.fermata || '');
      sh.getRange(riga, c.aggiornato).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'));
      if (g.nota && c.note) sh.getRange(riga, c.note).setValue(g.nota);
      var prov = '';
      if (c.provenienza) {
        var cella = sh.getRange(riga, c.provenienza);
        prov = String(cella.getDisplayValue()).trim();
        if (!prov && g.provenienza) {          // si scrive solo se vuota: la provenienza non cambia mai
          if (PROVENIENZE.indexOf(g.provenienza) < 0) throw new Error('provenienza non ammessa: ' + g.provenienza);
          cella.setValue(g.provenienza); prov = g.provenienza;
        }
      }
      return 'Registro: ' + g.idPratica + (prov ? ' [' + prov + ']' : '') + ' → ' + (g.passo || '') + ' / ' + (g.stato || '');
    }
  }
  throw new Error('ID ' + g.idPratica + ' non trovato nel Registro');
}

/* ---------- controlli finali ---------- */
function controlliX_(ss, input, cover, prima, attesi) {
  var e = { errori: [] };
  var dopo = [input, cover].map(contaFormuleX_);
  if (dopo[0] !== prima[0] || dopo[1] !== prima[1]) e.errori.push('numero di formule cambiato (Input ' + prima[0] + '→' + dopo[0] + ', Cover ' + prima[1] + '→' + dopo[1] + '): controlla la cronologia versioni');
  var nErr = 0;
  ['INPUT_CONTROLLI', 'INPUT_CV_CONTROLLI'].forEach(function (nome) {
    var r = ss.getRangeByName(nome); if (!r) return;
    r.getDisplayValues().forEach(function (riga) { riga.forEach(function (x) { if (/errore/i.test(x)) nErr++; }); });
  });
  if (nErr) e.errori.push(nErr + ' celle "Errore" nei controlli di riga');
  var riep = ss.getRangeByName('INPUT_RIEPILOGO'), cod = ss.getRangeByName('INPUT_RIEP_CODICI');
  if (riep) {
    var v = riep.getValues();
    e.riepilogo = { codici: cod ? cod.getValues()[0] : [], previsti: v[0], daCV: v[1], daEsami: v[2], bonus: v[3], riconosciuti: v[4], rimanenti: v[5] };
    if (attesi && attesi.daEsami) {
      attesi.daEsami.forEach(function (x, i) { if (Number(x) !== Number(v[2][i])) e.errori.push('totale da esami, colonna ' + (i + 1) + ': atteso ' + x + ', nel foglio ' + v[2][i]); });
    }
    if (attesi && attesi.daCV) {
      attesi.daCV.forEach(function (x, i) { if (Number(x) !== Number(v[1][i])) e.errori.push('totale da CV, colonna ' + (i + 1) + ': atteso ' + x + ', nel foglio ' + v[1][i]); });
    }
    e.riassunto = 'Riconosciuti per indirizzo: ' + v[4].join(' · ');
  } else e.riassunto = '';
  e.formule = { input: dopo[0], cover: dopo[1] };
  return e;
}

/* ---------- utilità (autonome: non dipendono da Codice.gs) ---------- */
function contaFormuleX_(sh) {
  var f = sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).getFormulas(), n = 0;
  for (var i = 0; i < f.length; i++) for (var j = 0; j < f[i].length; j++) if (f[i][j]) n++;
  return n;
}
function svuotaValoriX_(range) {
  var sh = range.getSheet(), f = range.getFormulas(), v = range.getValues();
  var r0 = range.getRow(), c0 = range.getColumn(), elenco = [];
  for (var i = 0; i < v.length; i++) {
    var inizio = -1;
    for (var j = 0; j <= v[i].length; j++) {
      var da = j < v[i].length && !f[i][j] && v[i][j] !== '';
      if (da && inizio < 0) inizio = j;
      if (!da && inizio >= 0) { elenco.push(sh.getRange(r0 + i, c0 + inizio, 1, j - inizio).getA1Notation()); inizio = -1; }
    }
  }
  for (var k = 0; k < elenco.length; k += 500) sh.getRangeList(elenco.slice(k, k + 500)).clearContent();
}
