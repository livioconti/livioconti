/* =====================================================================
 * AFFIDABILITÀ DEL RICONOSCIMENTO — colorazione on/off del foglio Input
 * Versione 3 (06/10/2026): funziona SENZA la colonna "Stato"; intestazioni del 06/10/2026.
 *
 * Legge il foglio "Affidabilita_CFU" (scritto dal controllo di affidabilità della skill
 * riconoscimento-cfu-v30 o dalla skill riconoscimento-affidabilita)
 * e colora lo SFONDO delle celle dell'Input nell'area del riconoscimento
 * (dalla riga di INPUT_NOTA_LAVORO all'ultima riga di INPUT_MATRICE, colonne di
 * INPUT_TARGET_NOMI):
 *   verde chiaro  = AFFIDABILE  (riconoscimento certo)
 *   grigio chiaro = INCERTO     (riconoscimento poco affidabile)
 *   rosso chiaro  = POSSIBILE   (match potenziale, riconoscimento non applicato)
 *
 * Da dove si legge lo stato di ogni riga (in quest'ordine):
 *   1. colonna "Stato", se esiste ancora (compatibilità con i file vecchi);
 *   2. prefisso della colonna "Motivazione": "AFFIDABILE: …", "INCERTO: …",
 *      "POSSIBILE: …" (anche "INCERTO: ERRORE: …", "POSSIBILE: ATTRIBUZIONE MANCATA: …");
 *   3. ripiego: se la Motivazione non ha prefisso e "CFU attribuiti" è vuoto → POSSIBILE.
 *
 * Intestazione attesa di Affidabilita_CFU (A1:I1); le colonne si trovano per nome, l'ordine non conta:
 *   Riga | Livello | Colonna | Esame svolto / CV | Target | Grado affidabilità riconoscimento |
 *   CFU attribuiti | CFU potenziali | Motivazione
 * (accetta anche i nomi vecchi: Col, Esame, Stato)
 *
 * Tocca SOLO lo sfondo statico delle celle elencate: nessuna formula, nessun
 * valore, nessuna regola di formattazione condizionale viene letta-e-riscritta
 * o modificata. Gli sfondi originali sono salvati nelle proprietà del documento
 * e ripristinati quando la colorazione si disattiva.
 *
 * Menu CFU:
 *   "Affidabilità riconoscimento (mostra/nascondi)" -> toggleAffidabilita
 * ===================================================================== */

var AFF_FOGLIO = 'Affidabilita_CFU';
var AFF_COLORI = { AFFIDABILE: '#d9ead3', INCERTO: '#d9d9d9', POSSIBILE: '#f4cccc' };
var AFF_PROP_ON = 'AFF_CFU_ON';
var AFF_PROP_BG = 'AFF_CFU_BG_';     // + indice del blocco
var AFF_PROP_N  = 'AFF_CFU_BG_N';
var AFF_BLOCCO  = 8000;              // caratteri per proprietà (limite 9 KB)

/** Voce di menu: attiva/disattiva la colorazione. */
function toggleAffidabilita() {
  var props = PropertiesService.getDocumentProperties();
  if (props.getProperty(AFF_PROP_ON) === '1') {
    var n = spegniAffidabilita_();
    SpreadsheetApp.getActive().toast('Colorazione affidabilità disattivata (' + n + ' celle ripristinate).', 'CFU', 5);
  } else {
    accendiAffidabilita_();
  }
}

/* ---------------------------------------------------------------- accensione */
function accendiAffidabilita_() {
  var ss = SpreadsheetApp.getActive();
  var ui = SpreadsheetApp.getUi();
  var input = ss.getSheetByName('Input');
  var src = ss.getSheetByName(AFF_FOGLIO);
  if (!input) { ui.alert('Foglio "Input" non trovato.'); return; }
  if (!src || src.getLastRow() < 2) {
    ui.alert('Affidabilità riconoscimento',
      'Il foglio "' + AFF_FOGLIO + '" manca o è vuoto: va compilato al termine del riconoscimento ' +
      '(skill riconoscimento-affidabilita).', ui.ButtonSet.OK);
    return;
  }

  // --- area ammessa, ricavata dagli intervalli denominati
  var area = areaAffidabilita_(ss);
  if (!area) return;

  // --- lettura del foglio sorgente, colonne trovate per intestazione
  var dati = src.getDataRange().getDisplayValues();
  var c = colonneAffidabilita_(dati[0]);
  if (c.riga < 0 || c.col < 0 || (c.stato < 0 && c.motiv < 0)) {
    ui.alert('Nel foglio "' + AFF_FOGLIO + '" servono almeno le colonne "Riga", "Colonna" e "Motivazione" ' +
             '(con il prefisso AFFIDABILE: / INCERTO: / POSSIBILE:) oppure "Stato". Per la colonna va bene "Colonna" o "Col".');
    return;
  }

  var nomiE = input.getRange(area.r0, ss.getRangeByName('INPUT_ESAMI').getColumn() + 4, area.r1 - area.r0 + 1, 1).getDisplayValues();   // nome dell'esame (5ª colonna di INPUT_ESAMI)
  var nomiT = ss.getRangeByName('INPUT_TARGET_NOMI').getDisplayValues()[0];
  var valori = input.getRange(area.r0, area.c0, area.r1 - area.r0 + 1, area.c1 - area.c0 + 1).getValues();
  var sfondi = input.getRange(area.r0, area.c0, area.r1 - area.r0 + 1, area.c1 - area.c0 + 1).getBackgrounds();

  var perColore = {}, originali = {}, avvisi = [], conta = { AFFIDABILE: 0, INCERTO: 0, POSSIBILE: 0 };
  var valutate = {};

  for (var i = 1; i < dati.length; i++) {
    var d = dati[i];
    if (d.join('').trim() === '') continue;
    var rr = 'riga ' + (i + 1) + ' di ' + AFF_FOGLIO + ': ';
    var stato = statoRiga_(d, c);
    if (!stato) { avvisi.push(rr + 'stato non riconosciuto (manca il prefisso AFFIDABILE: / INCERTO: / POSSIBILE: nella Motivazione)'); continue; }
    var riga = parseInt(d[c.riga], 10);
    var col = colDaLettera_(d[c.col]);
    if (!(riga >= area.r0 && riga <= area.r1) || !(col >= area.c0 && col <= area.c1)) {
      avvisi.push(rr + 'cella ' + d[c.col] + d[c.riga] + ' fuori dall\'area ' + lettera_(area.c0) + area.r0 + ':' + lettera_(area.c1) + area.r1);
      continue;
    }
    var a1 = lettera_(col) + riga;
    var v = valori[riga - area.r0][col - area.c0];
    var piena = !(v === '' || v === null || v === 0);

    // controlli di coerenza (solo avvisi: la cella viene colorata comunque)
    if (stato !== 'POSSIBILE' && !piena) avvisi.push(rr + a1 + ' è ' + stato + ' ma la cella è vuota');
    if (stato === 'POSSIBILE' && piena) avvisi.push(rr + a1 + ' è POSSIBILE ma contiene già ' + v);
    if (c.esame >= 0 && riga >= area.rEsami && !simile_(d[c.esame], nomiE[riga - area.r0][0]))
      avvisi.push(rr + 'esame "' + d[c.esame] + '" ≠ Input!E' + riga + ' "' + nomiE[riga - area.r0][0] + '"');
    if (c.target >= 0 && !simile_(d[c.target], nomiT[col - area.cT]))
      avvisi.push(rr + 'target "' + d[c.target] + '" ≠ intestazione di ' + lettera_(col) + ' "' + nomiT[col - area.cT] + '"');

    if (valutate[a1]) { avvisi.push(rr + a1 + ' già valutata in un\'altra riga: vale la prima'); continue; }
    valutate[a1] = stato;
    originali[a1] = sfondi[riga - area.r0][col - area.c0];
    (perColore[AFF_COLORI[stato]] = perColore[AFF_COLORI[stato]] || []).push(a1);
    conta[stato]++;
  }

  // celle con CFU senza valutazione (solo segnalazione)
  var nonValutate = [];
  for (var r = 0; r < valori.length; r++)
    for (var k = 0; k < valori[r].length; k++) {
      var x = valori[r][k];
      if (area.r0 + r >= area.rCv && typeof x === 'number' && x !== 0) {
        var a = lettera_(area.c0 + k) + (area.r0 + r);
        if (!valutate[a]) nonValutate.push(a);
      }
    }

  if (Object.keys(originali).length === 0) { ui.alert('Nessuna cella da colorare.' + elenco_(avvisi)); return; }

  salvaOriginali_(originali);                              // prima si salva, poi si colora
  Object.keys(perColore).forEach(function (col) {
    input.getRangeList(perColore[col]).setBackground(col);
  });
  PropertiesService.getDocumentProperties().setProperty(AFF_PROP_ON, '1');
  coloraFoglioAffidabilita_(src, dati, c, true);           // colora anche le righe di Affidabilita_CFU
  if (input.getTabColor()) src.setTabColor(input.getTabColor());   // stesso colore di tab dell'Input

  var msg = 'Verde (affidabile): ' + conta.AFFIDABILE + ' · Grigio (incerto): ' + conta.INCERTO +
            ' · Rosso (possibile): ' + conta.POSSIBILE;
  var extra = '';
  if (nonValutate.length) extra += '\n\nCelle con CFU senza valutazione (non colorate): ' + nonValutate.join(', ');
  var cf = cfSovrapposte_(input, area);
  if (cf) extra += '\n\n' + cf;
  if (avvisi.length || extra) ui.alert('Affidabilità riconoscimento', msg + extra + elenco_(avvisi), ui.ButtonSet.OK);
  else ss.toast(msg, 'Affidabilità riconoscimento', 8);
}

/* ---------------------------------------------------------------- spegnimento */
function spegniAffidabilita_() {
  var ss = SpreadsheetApp.getActive();
  var props = PropertiesService.getDocumentProperties();
  var originali = leggiOriginali_();
  var input = ss.getSheetByName('Input');
  var n = 0;
  if (input && originali) {
    var perColore = {};
    Object.keys(originali).forEach(function (a1) {
      var col = originali[a1];
      var key = (!col || col.toLowerCase() === '#ffffff') ? '__nessuno__' : col;
      (perColore[key] = perColore[key] || []).push(a1);
      n++;
    });
    Object.keys(perColore).forEach(function (key) {
      input.getRangeList(perColore[key]).setBackground(key === '__nessuno__' ? null : key);
    });
  }
  var shA = ss.getSheetByName(AFF_FOGLIO);
  if (shA) coloraFoglioAffidabilita_(shA, null, null, false);       // toglie i colori da Affidabilita_CFU
  cancellaOriginali_();
  props.deleteProperty(AFF_PROP_ON);
  return n;
}

/** Da chiamare in svuotaPratica(): spegne la colorazione (ripristina gli sfondi dell'Input)
 *  e SVUOTA i fogli CFU_per_CV e Affidabilita_CFU: restano i fogli, l'intestazione
 *  e tutta la formattazione; si cancellano solo i contenuti sotto l'intestazione. */
function resetAffidabilita_(ss) {
  ss = ss || SpreadsheetApp.getActive();
  spegniAffidabilita_();                                   // prima si spegne: servono gli sfondi salvati
  [AFF_FOGLIO, 'CFU_per_CV'].forEach(function (nome) {
    var sh = ss.getSheetByName(nome);
    if (!sh) return;                                       // i fogli sono fissi: se manca, non si crea qui
    var nr = sh.getMaxRows() - 1, nc = sh.getMaxColumns();
    if (nr > 0 && nc > 0) sh.getRange(2, 1, nr, nc).clearContent();   // solo valori: formati e intestazione restano
  });
}


/** Colora (on) o scolora (off) le righe dati del foglio Affidabilita_CFU secondo lo stato di ogni riga. */
function coloraFoglioAffidabilita_(sh, dati, c, on) {
  var nr = sh.getLastRow() - 1, nc = sh.getLastColumn();
  if (nr < 1 || nc < 1) return;
  var rng = sh.getRange(2, 1, nr, nc);
  if (!on) { rng.setBackground(null); return; }
  var bg = [];
  for (var i = 1; i <= nr; i++) {
    var s = (dati && dati[i] && c) ? statoRiga_(dati[i], c) : null;
    var colore = s ? AFF_COLORI[s] : null;
    var r = [];
    for (var k = 0; k < nc; k++) r.push(colore);
    bg.push(r);
  }
  rng.setBackgrounds(bg);
}

/* ---------------------------------------------------------------- stato di una riga */

/** Indici delle colonne di Affidabilita_CFU, trovate per intestazione. */
function colonneAffidabilita_(intestazione) {
  var h = intestazione.map(function (x) { return norm_(x); });
  return {
    riga:   trovaCol_(h, ['riga']),
    col:    trovaCol_(h, ['col', 'colonna']),
    esame:  trovaCol_(h, ['esame svolto / cv', 'esame svolto/cv', 'esame svolto', 'esame', 'esame / evidenza', 'esame/evidenza']),
    target: trovaCol_(h, ['target']),
    stato:  trovaCol_(h, ['stato']),                                       // solo file vecchi
    motiv:  trovaCol_(h, ['motivazione']),
    cfu:    trovaCol_(h, ['cfu attribuiti'])
  };
}

/** Stato della riga: colonna Stato (se c'è), poi prefisso della Motivazione, poi ripiego su CFU attribuiti vuoto. */
function statoRiga_(d, c) {
  if (c.stato >= 0) {
    var s = statoNorm_(d[c.stato]);
    if (s) return s;
  }
  if (c.motiv >= 0) {
    var m = norm_(d[c.motiv]).match(/^(affidabile|incerto|possibile)\s*[:\-–—]/);
    if (m) return m[1].toUpperCase();
    if (c.cfu >= 0 && String(d[c.cfu] || '').trim() === '' && norm_(d[c.motiv]) !== '') return 'POSSIBILE';
  }
  return null;
}

/* ---------------------------------------------------------------- supporto */
function areaAffidabilita_(ss) {
  var ui = SpreadsheetApp.getUi();
  var nomi = ['INPUT_MATRICE', 'INPUT_TARGET_NOMI', 'INPUT_NOTA_LAVORO', 'INPUT_CV_MATRICE'];
  var R = {};
  for (var i = 0; i < nomi.length; i++) {
    R[nomi[i]] = ss.getRangeByName(nomi[i]);
    if (!R[nomi[i]]) { ui.alert('Intervallo denominato ' + nomi[i] + ' mancante: esegui creaIntervalliInput().'); return null; }
  }
  var m = R.INPUT_MATRICE, t = R.INPUT_TARGET_NOMI;
  return {
    r0: R.INPUT_NOTA_LAVORO.getRow(),                       // prima riga dell'area (INPUT_NOTA_LAVORO)
    r1: m.getLastRow(),
    c0: t.getColumn(),                                      // prima colonna dei target (INPUT_TARGET_NOMI)
    c1: t.getLastColumn(),
    cT: t.getColumn(),
    rCv: R.INPUT_CV_MATRICE.getRow(),                       // riga dei CFU da CV (INPUT_CV_MATRICE)
    rEsami: m.getRow()                                      // prima riga degli esami (INPUT_MATRICE)
  };
}

/** Avvisa se regole condizionali con riempimento coprono l'area (il loro colore prevale). Solo lettura. */
function cfSovrapposte_(sh, a) {
  var hit = [];
  sh.getConditionalFormatRules().forEach(function (rule) {
    var b = rule.getBooleanCondition && rule.getBooleanCondition();
    var riempie = (b && b.getBackground && b.getBackground()) || rule.getGradientCondition();
    if (!riempie) return;
    rule.getRanges().forEach(function (rg) {
      if (rg.getLastRow() >= a.r0 && rg.getRow() <= a.r1 && rg.getLastColumn() >= a.c0 && rg.getColumn() <= a.c1)
        hit.push(rg.getA1Notation());
    });
  });
  return hit.length ? 'Attenzione: regole di formattazione condizionale esistenti coprono ' + hit.join(', ') +
    '. Dove sono attive il loro colore prevale su quello dell\'affidabilità (le regole non sono state toccate).' : '';
}

function salvaOriginali_(obj) {
  cancellaOriginali_();
  var s = JSON.stringify(obj), p = PropertiesService.getDocumentProperties(), n = 0, pack = {};
  for (var i = 0; i < s.length; i += AFF_BLOCCO) pack[AFF_PROP_BG + (n++)] = s.substr(i, AFF_BLOCCO);
  pack[AFF_PROP_N] = String(n);
  p.setProperties(pack);
}
function leggiOriginali_() {
  var p = PropertiesService.getDocumentProperties(), n = parseInt(p.getProperty(AFF_PROP_N) || '0', 10), s = '';
  for (var i = 0; i < n; i++) s += p.getProperty(AFF_PROP_BG + i) || '';
  try { return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function cancellaOriginali_() {
  var p = PropertiesService.getDocumentProperties(), n = parseInt(p.getProperty(AFF_PROP_N) || '0', 10);
  for (var i = 0; i < n; i++) p.deleteProperty(AFF_PROP_BG + i);
  p.deleteProperty(AFF_PROP_N);
}

function statoNorm_(s) {
  s = norm_(s);
  if (/^(affidabile|certo|verde)$/.test(s)) return 'AFFIDABILE';
  if (/^(incerto|poco affidabile|grigio)$/.test(s)) return 'INCERTO';
  if (/^(possibile|potenziale|non applicato|rosso)$/.test(s)) return 'POSSIBILE';
  return null;
}
function norm_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}
function simile_(a, b) {
  a = norm_(a).replace(/[^a-z0-9]/g, ''); b = norm_(b).replace(/[^a-z0-9]/g, '');
  if (!a || !b) return true;
  var n = Math.min(12, a.length, b.length);
  return a.indexOf(b.substr(0, n)) >= 0 || b.indexOf(a.substr(0, n)) >= 0;
}
function trovaCol_(h, nomi) {
  for (var i = 0; i < h.length; i++) if (nomi.indexOf(h[i]) >= 0) return i;
  return -1;
}
function colDaLettera_(s) {
  s = String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!s) return -1;
  var n = 0;
  for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n;
}
function lettera_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function elenco_(avvisi) {
  if (!avvisi.length) return '';
  var max = 25;
  return '\n\nAvvisi (' + avvisi.length + '):\n• ' + avvisi.slice(0, max).join('\n• ') +
    (avvisi.length > max ? '\n• … altri ' + (avvisi.length - max) : '');
}
