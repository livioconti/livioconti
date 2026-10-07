/**
 * Script del Google Sheet "RiconoscimentoCFU_..._VGD" (menu "CFU").
 *
 * Uso: menu "CFU" > ....
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CFU')
    .addItem('Colora bande (selezione)', 'coloraBande')
    .addItem('Colora intestazioni dei target', 'coloraIntestazioni')
    .addSeparator()
    .addItem('Salva pratica con nome', 'salvaPraticaConNome')
    .addItem('Salva pratica con nome + PDF', 'salvaPraticaConNomePdf')
    .addItem('Esporta pratica in PDF', 'esportaPraticaPdf')
    .addItem('Invia email riconoscimento', 'rispondiConPdf')
    .addSeparator()
    .addItem('Affidabilità riconoscimento (mostra/nascondi)', 'toggleAffidabilita')
    .addItem('Importa riconoscimento (Express)', 'importaRiconoscimento')
    .addSeparator()
    .addItem('Svuota pratica (nuovo studente)', 'svuotaPratica')
    .addToUi();
  // Apre il file sul foglio Trash
  const trash = SpreadsheetApp.getActive().getSheetByName('Trash');
  if (trash) trash.activate();
}


/* ---------- Macro ColoraBande (versione Google Sheets) ---------- */
// Google Sheets non supporta riempimenti a gradiente/bande: per numeri a una cifra
// colore pieno; per più cifre colore della prima cifra colorata + nota con tutte le bande.

var COLORI_CIFRE = { '1': '#FFFF00', '2': '#00B0F0', '3': '#FFCCFF', '5': '#92D050',
                     '6': '#FFC000', '7': '#00FFFF', '8': '#00FF00', '9': '#FF0000' };
var NOMI_COLORI = { '1': 'giallo', '2': 'azzurro', '3': 'rosa', '5': 'verde chiaro',
                    '6': 'arancio', '7': 'ciano', '8': 'verde', '9': 'rosso', '0': 'bianco', '4': 'bianco' };

function coloraBande() {
  var range = SpreadsheetApp.getActiveRange();
  if (!range) return;
  var vals = range.getValues(), bgs = range.getBackgrounds(), notes = range.getNotes();
  for (var i = 0; i < vals.length; i++) {
    for (var j = 0; j < vals[i].length; j++) {
      var v = vals[i][j];
      if (v === '' || v === null || isNaN(Number(v))) continue;
      var s = String(Math.trunc(Number(v)));
      if (s.length <= 1) {
        bgs[i][j] = COLORI_CIFRE[s] || null;
      } else {
        var primo = null;
        for (var k = 0; k < s.length && !primo; k++) primo = COLORI_CIFRE[s[k]] || null;
        bgs[i][j] = primo || '#FFFFFF';
        notes[i][j] = 'Bande: ' + s.split('').map(function (d) { return d + '=' + NOMI_COLORI[d]; }).join(', ');
      }
    }
  }
  range.setBackgrounds(bgs);
  range.setNotes(notes);
}




/* ---------- Colori intestazioni (INPUT_TARGET_NOMI) ---------- */
// Legge il codice indirizzi (INPUT_TARGET_CODICI, es. 123, 1238) e, per i codici con più colori,
// mette come sfondo il colore della prima cifra colorata e una nota con tutte le bande.
// I codici a colore unico (1, 2, 999, ...) e quelli senza colore (0, 4) non vengono toccati.
function coloraIntestazioni() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Input');
  var r4 = SpreadsheetApp.getActiveSpreadsheet().getRangeByName('INPUT_TARGET_NOMI'),
      codici = SpreadsheetApp.getActiveSpreadsheet().getRangeByName('INPUT_TARGET_CODICI').getValues()[0];
  var bgs = r4.getBackgrounds(), note = r4.getNotes(), n = 0;
  for (var j = 0; j < codici.length; j++) {
    var v = codici[j];
    if (v === '' || v === null || isNaN(Number(v))) continue;
    var s = String(Math.trunc(Number(v)));
    var colorate = s.split('').filter(function (d) { return COLORI_CIFRE[d]; });
    var distinte = colorate.filter(function (d, i) { return colorate.indexOf(d) === i; });
    if (distinte.length < 2) continue;                     // colore unico o nessun colore
    bgs[0][j] = COLORI_CIFRE[colorate[0]];
    var testo = 'Bande: ' + s.split('').map(function (d) { return d + '=' + NOMI_COLORI[d]; }).join(', ');
    var vecchia = note[0][j] || '';
    note[0][j] = (!vecchia || vecchia.indexOf('Bande:') === 0) ? testo
               : vecchia.replace(/\n?Bande:.*$/, '') + '\n' + testo;
    n++;
  }
  r4.setBackgrounds(bgs);
  r4.setNotes(note);
  return n;
}




/* ===================== PRATICA: copia con nome + PDF =====================
 * COVER_NOMEFILE = nome del file della pratica (calcolato da formula nella Cover): nome della copia e del PDF
 * COVER_RIGHE    = caselle di controllo della Cover: una riga va nel PDF se la sua casella è spuntata
 *                  e il testo accanto non è vuoto; il foglio da stampare si
 *                  ricava da quel testo.
 *                  (le caselle "tutte triennali" / "tutte magistrali" spuntano in un colpo il proprio gruppo, vedi onEdit.)
 */
var PRATICA = {
  cover: 'Cover',
  cellaNome: 'COVER_NOMEFILE',      // intervallo denominato con il nome della pratica
  righe: 'COVER_RIGHE',             // intervallo denominato: caselle + testo delle righe stampabili
  mappa: [                       // testo dell'indirizzo (minuscolo) -> foglio
    ['iscriversi', 'EsamiDaFare'],   // Esami necessari per iscriversi alla Magistrale
    ['consigliati', 'Cons'],         // Corsi consigliati per affrontare la Magistrale
    ['meccatronica', 'Tri.Mecca'],
    ['logistic', 'Tri.LogEco'],
    ['edili', 'Tri.Edil'],
    ['aeronautic', 'Tri.Aero'],
    ['produzione', 'Mag.Prod'],
    ['energetic', 'Mag.Energ'],
    ['4.0', 'Mag.Ind4.0']
  ]
};

/* Menu CFU: le tre voci di salvataggio aprono lo stesso pop-up (dialogPratica_)
 * con il controllo del cognome, il nome modificabile e la scelta della cartella in Drive. */
function salvaPraticaConNome()    { dialogPratica_('copia'); }
function salvaPraticaConNomePdf() { dialogPratica_('copiaPdf'); }
function esportaPraticaPdf()      { dialogPratica_('pdf'); }

var PRATICA_TITOLI = {
  copia: 'Salva pratica con nome',
  copiaPdf: 'Salva pratica con nome + PDF',
  pdf: 'Esporta pratica in PDF'
};

/** Pop-up unico per salvare la pratica:
 *  - avvisa se il cognome dello studente (COVER_COGNOME) è vuoto;
 *  - propone il nome della pratica (COVER_NOMEFILE) e lascia modificarlo;
 *  - fa scegliere la cartella navigando in Drive (di default quella del file aperto);
 *  - per i PDF mostra i fogli che verranno stampati (righe spuntate in COVER_RIGHE). */
function dialogPratica_(modo) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cog = ss.getRangeByName('COVER_COGNOME');
  var cognome = cog ? String(cog.getDisplayValue()).trim() : '';
  var nomeR = ss.getRangeByName(PRATICA.cellaNome);
  var nome = nomeR ? String(nomeR.getDisplayValue()).replace(/[\\/:*?"<>|]/g, '').trim() : '';
  var fogli = modo === 'copia' ? null : fogliDaStampare_(ss);
  var cart = cartella_(DriveApp.getFileById(ss.getId()));
  var dati = {
    modo: modo,
    cognome: cognome,
    nome: nome,
    nomeFile: ss.getName(),
    cartella: { id: cart.getId(), name: cart.getName() },
    cartellaInfo: praticaCartella(cart.getId()),
    fogli: fogli && !fogli.errore ? fogli.nomi : null,
    erroreFogli: fogli && fogli.errore ? fogli.errore : ''
  };
  var t = HtmlService.createTemplateFromFile('DialogPratica');
  t.dati = JSON.stringify(dati).replace(/</g, '\\u003c');
  SpreadsheetApp.getUi().showModalDialog(t.evaluate().setWidth(560).setHeight(470), PRATICA_TITOLI[modo]);
}

/** Chiamata dal pop-up: contenuto di una cartella di Drive (id vuoto o 'root' = Il mio Drive). */
function praticaCartella(id) {
  var f = (!id || id === 'root') ? DriveApp.getRootFolder() : DriveApp.getFolderById(id);
  var p = f.getParents();
  var sub = [], it = f.getFolders();
  while (it.hasNext() && sub.length < 300) { var x = it.next(); sub.push({ id: x.getId(), name: x.getName() }); }
  sub.sort(function (a, b) { return a.name.localeCompare(b.name, 'it'); });
  return { id: f.getId(), name: f.getName(), parent: p.hasNext() ? p.next().getId() : null, sub: sub };
}

/** Chiamata dal pop-up: esegue il salvataggio scelto con il nome e la cartella indicati.
 *  Se nella cartella esiste già un file con lo stesso nome chiede conferma (forza = true per procedere).
 *  Se il nome coincide con il file aperto non crea un'altra copia (con il PDF esporta solo il PDF). */
function praticaEsegui(modo, nome, cartellaId, forza) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  nome = String(nome || '').replace(/[\\/:*?"<>|]/g, '').trim();
  if (!nome) throw new Error('Il nome non può essere vuoto.');
  var cartella = DriveApp.getFolderById(cartellaId);
  var file = DriveApp.getFileById(ss.getId());
  var stesso = ss.getName() === nome;
  if (modo === 'copia' && stesso) {
    return { html: 'Sei già nella pratica "' + esc_(nome) + '".<br>Le modifiche sono salvate automaticamente: non serve creare un\'altra copia.' };
  }
  var fogli = null;
  if (modo !== 'copia') {
    fogli = fogliDaStampare_(ss);
    if (fogli.errore) throw new Error(fogli.errore);
  }
  var copia = modo !== 'pdf' && !stesso;
  if (copia && !forza && cartella.getFilesByName(nome).hasNext()) {
    return { conferma: 'Nella cartella "' + cartella.getName() + '" esiste già un file "' + nome + '". Creo comunque una nuova copia con lo stesso nome?' };
  }
  SpreadsheetApp.flush();
  var righe = [], target = ss;
  if (copia) {
    var c = file.makeCopy(nome, cartella);                         // copia anche gli script del file
    target = SpreadsheetApp.openById(c.getId());
    righe.push('Copia creata: <a href="' + c.getUrl() + '" target="_blank">' + esc_(nome) + '</a>');
  } else if (modo === 'copiaPdf') {
    righe.push('Sei già nella pratica: nessuna nuova copia.');
  }
  if (modo !== 'copia') {
    var blob = esportaPdf_(target, fogli.nomi, !copia);
    var nomePdf = nome + '.pdf';
    var vecchi = cartella.getFilesByName(nomePdf);
    while (vecchi.hasNext()) vecchi.next().setTrashed(true);       // il PDF precedente va nel cestino
    var pdf = cartella.createFile(blob.setName(nomePdf));
    righe.push('PDF salvato: <a href="' + pdf.getUrl() + '" target="_blank">' + esc_(nomePdf) + '</a>');
    righe.push('Fogli nel PDF: ' + esc_(fogli.nomi.join(', ')));
  }
  righe.push('Cartella: ' + esc_(cartella.getName()));
  if (copia) righe.push('<br><i>Da ora lavora nella copia. Il primo uso del menu CFU nella copia chiede di nuovo l\'autorizzazione.</i>');
  return { html: righe.join('<br>') };
}

/** Nome della pratica = valore di COVER_NOMEFILE, usato così com'è (tolti solo i caratteri non ammessi nei nomi file). */
function leggiNomePratica_(ss) {
  var n = String(ss.getRangeByName(PRATICA.cellaNome).getDisplayValue()).trim();
  n = n.replace(/[\\/:*?"<>|]/g, '').trim();
  if (!n) { SpreadsheetApp.getUi().alert('La cella ' + PRATICA.cover + '!' + PRATICA.cellaNome + ' (nome del file) è vuota.'); return ''; }
  return n;
}

function cartella_(file) {
  var p = file.getParents();
  return p.hasNext() ? p.next() : DriveApp.getRootFolder();
}

/** Cover + i fogli delle righe con la casella spuntata in COVER_RIGHE, nell'ordine delle schede. */
function fogliDaStampare_(ss) {
  var righe = ss.getRangeByName(PRATICA.righe).getValues();
  var nomi = [], nonRiconosciute = [];
  righe.forEach(function (r) {
    var spuntata = r[0] === true || r[0] === '✔',   // la riga degli esami magistrale (COVER_STATO_MAG) è un menu a tendina (✔ / ∅ / ✗)
         testo = String(r[1]).toLowerCase();
    if (!spuntata || !testo.trim()) return;
    var m = PRATICA.mappa.filter(function (x) { return testo.indexOf(x[0]) >= 0; })[0];
    if (!m || !ss.getSheetByName(m[1])) nonRiconosciute.push(r[1]);
    else if (nomi.indexOf(m[1]) < 0) nomi.push(m[1]);
  });
  if (nonRiconosciute.length) return { errore: 'Non trovo il foglio corrispondente a:\n- ' + nonRiconosciute.join('\n- ') };
  if (!nomi.length) return { errore: 'Nessuna casella spuntata in ' + PRATICA.cover + '!' + ss.getRangeByName(PRATICA.righe).getA1Notation() + ': non so quali fogli stampare.' };
  var ordine = ss.getSheets().map(function (s) { return s.getName(); });
  nomi.sort(function (a, b) { return ordine.indexOf(a) - ordine.indexOf(b); });
  return { nomi: [PRATICA.cover].concat(nomi) };
}

/** Esporta in un unico PDF solo i fogli indicati (A4 orizzontale, adattato alla larghezza). */
function esportaPdf_(ss, nomi, eAperto) {
  var sheets = ss.getSheets();
  var eraNascosto = sheets.map(function (s) { return s.isSheetHidden(); });
  var attivo = eAperto ? ss.getActiveSheet() : null;
  try {
    sheets.forEach(function (s) { if (nomi.indexOf(s.getName()) >= 0) s.showSheet(); });
    if (eAperto) ss.setActiveSheet(ss.getSheetByName(nomi[0]));
    sheets.forEach(function (s) { if (nomi.indexOf(s.getName()) < 0) s.hideSheet(); });
    SpreadsheetApp.flush();
    var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export' +
      '?format=pdf&size=A4&portrait=false&fitw=true' +
      '&top_margin=0.75&bottom_margin=0.75&left_margin=0.7&right_margin=0.7' +
      '&gridlines=false&sheetnames=false&printtitle=false&pagenum=UNDEFINED&fzr=false';
    var resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) throw new Error('Esportazione PDF fallita (HTTP ' + resp.getResponseCode() + ')');
    return resp.getBlob();
  } finally {
    sheets.forEach(function (s, i) { if (!eraNascosto[i]) s.showSheet(); });
    if (attivo) ss.setActiveSheet(attivo);
    sheets.forEach(function (s, i) { if (eraNascosto[i] && (!attivo || s.getSheetId() !== attivo.getSheetId())) s.hideSheet(); });
    SpreadsheetApp.flush();
  }
}

function esc_(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}

/* ===================== SVUOTA PRATICA (nuovo studente) =====================
 * Input : bonus per target (INPUT_T_BONUS, Q32:CB32) · esclusioni manuali da EsamiDaFare (Q25:AY25: tolta la spunta;
 *         AZ25:BC25 restano spuntate) · esami dichiarati (INPUT_ESAMI) · matrice e riga CV fino in fondo al foglio
 *         · CFU precedenti e da CV accanto a INPUT_NOTA_LAVORO (le intestazioni non si toccano)
 * Cover : dati dello studente (COVER_DATI) · tutte le caselle di controllo (tolta la spunta) · stato esami magistrale (COVER_STATO_MAG)
 * Trash e Trash_tabella_azzurra : TUTTO il foglio (valori, formule, formattazione, unioni, convalide, note)
 * Regola per Input e Cover: NESSUNA formula viene mai cancellata. Si svuotano solo le celle
 * con un valore scritto; le celle con formula restano intatte. A fine operazione lo script
 * riconta le formule di Input e Cover e avvisa se il numero è cambiato.
 */
var ESCLUSIONI_DA_AZZERARE = 'Q25:AY25';   // AZ25:BC25 (a scelta, Tirocinio, Ulteriori Conoscenze, Prova Finale) restano spuntate

function svuotaPratica() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert('Svuota pratica',
    'Cancello i dati dello studente:\n' +
    '• Input: bonus (Q32:CB32), spunte di esclusione ' + ESCLUSIONI_DA_AZZERARE + ' (AZ25:BC25 restano), esami (INPUT_ESAMI), matrice e riga CV fino in fondo al foglio, H39:I41 (intestazioni escluse)\n' +
    '• Cover: G18:G20 e tutte le caselle di controllo in B:C\n' +
    '• Trash e Trash_tabella_azzurra: tutto il foglio\n' +
    '• colori di affidabilità spenti (sfondi originali dell\'Input ripristinati)\n' +
    '• fogli CFU_per_CV e Affidabilita_CFU svuotati (restano intestazione e formattazione)\n\n' +
    'Su Input e Cover le formule non vengono toccate. Procedo?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  resetAffidabilita_(ss);                                            // spegne i colori di affidabilità, svuota CFU_per_CV e Affidabilita_CFU (restano l'intestazione e i formati)

  var input = ss.getSheetByName('Input');
  var cover = ss.getSheetByName('Cover');
  var trash = ss.getSheetByName('Trash');
  var fogli = [input, cover];                                         // il Trash si svuota del tutto
  var prima = fogli.map(contaFormule_);

  var nR = input.getMaxRows(), nC = input.getMaxColumns();
  var N = function (n) { var g = ss.getRangeByName(n); if (!g) throw new Error('Manca l\'intervallo denominato ' + n + ': esegui creaIntervalliInput()'); return g; };
  var bon = N('INPUT_T_BONUS'), esa = N('INPUT_ESAMI'), mat = N('INPUT_MATRICE'), nota = N('INPUT_NOTA_LAVORO'), cvh = N('INPUT_CV_CFU');
  svuotaValori_(input.getRange(bon.getRow(), bon.getColumn(), 1, nC - bon.getColumn() + 1));   // bonus per target, fino all'ultima colonna
  togliSpunte_(input.getRange(ESCLUSIONI_DA_AZZERARE));            // esclusioni manuali da EsamiDaFare (solo caselle, formule intatte)
  svuotaValori_(input.getRange(esa.getRow(), esa.getColumn(), nR - esa.getRow() + 1, esa.getNumColumns()));   // esami dichiarati
  svuotaValori_(input.getRange(nota.getRow(), mat.getColumn(), nR - nota.getRow() + 1, nC - mat.getColumn() + 1));   // matrice + righe CV, fino all'ultima colonna/riga
  svuotaValori_(input.getRange(nota.getRow(), cvh.getColumn(), cvh.getRow() - nota.getRow() + 1, 2));   // CFU/SSD delle righe nota, precedenti, CV

  svuotaValori_(ss.getRangeByName('COVER_DATI'));
  togliSpunte_(cover.getRange('B1:C' + cover.getMaxRows()));
  var stato = ss.getRangeByName('COVER_STATO_MAG'); if (stato) stato.clearContent();   // menu a tendina a tre stati, non una casella

  ['Trash', 'Trash_tabella_azzurra'].forEach(function (nome) {   // tutto: valori, formule, formattazione
    var t = ss.getSheetByName(nome);
    if (!t) return;
    var tutto = t.getRange(1, 1, t.getMaxRows(), t.getMaxColumns());
    tutto.breakApart();
    tutto.clearDataValidations();
    tutto.clearNote();
    t.clearConditionalFormatRules();
    t.clear();
  });
  SpreadsheetApp.flush();

  var dopo = fogli.map(contaFormule_);
  var diff = fogli.filter(function (s, i) { return prima[i] !== dopo[i]; })
                  .map(function (s) { return s.getName(); });
  if (diff.length) {
    ui.alert('ATTENZIONE: il numero di formule è cambiato in: ' + diff.join(', ') +
             '.\nControlla la cronologia versioni (File > Cronologia versioni) per ripristinare.');
  } else {
    ss.toast('Pratica svuotata (formule intatte: ' + dopo.reduce(function (a, b) { return a + b; }, 0) + ').', 'CFU', 5);
  }

  // Al termine: apri la Cover con il cognome dello studente (COVER_COGNOME) selezionato
  cover.activate();
  var cog = ss.getRangeByName('COVER_COGNOME'); if (cog) cover.setActiveRange(cog);
}

/** Numero di celle con formula nel foglio. */
function contaFormule_(sh) {
  var f = sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).getFormulas(), n = 0;
  for (var i = 0; i < f.length; i++) for (var j = 0; j < f[i].length; j++) if (f[i][j]) n++;
  return n;
}

/** Cancella il contenuto delle sole celle con un valore scritto a mano (non le formule). */
function svuotaValori_(range) {
  var sh = range.getSheet();
  var f = range.getFormulas(), v = range.getValues();
  var r0 = range.getRow(), c0 = range.getColumn();
  var elenco = [];
  for (var i = 0; i < v.length; i++) {
    var inizio = -1;
    for (var j = 0; j <= v[i].length; j++) {
      var daCancellare = j < v[i].length && !f[i][j] && v[i][j] !== '';
      if (daCancellare && inizio < 0) inizio = j;
      if (!daCancellare && inizio >= 0) {
        elenco.push(sh.getRange(r0 + i, c0 + inizio, 1, j - inizio).getA1Notation());
        inizio = -1;
      }
    }
  }
  for (var k = 0; k < elenco.length; k += 500) sh.getRangeList(elenco.slice(k, k + 500)).clearContent();
}

/** Toglie la spunta alle caselle di controllo del range (salta le celle con formula). */
function togliSpunte_(range) {
  var sh = range.getSheet();
  var dv = range.getDataValidations(), f = range.getFormulas();
  var r0 = range.getRow(), c0 = range.getColumn();
  var elenco = [];
  for (var i = 0; i < dv.length; i++)
    for (var j = 0; j < dv[i].length; j++)
      if (dv[i][j] && dv[i][j].getCriteriaType() === SpreadsheetApp.DataValidationCriteria.CHECKBOX && !f[i][j])
        elenco.push(sh.getRange(r0 + i, c0 + j).getA1Notation());
  if (elenco.length) sh.getRangeList(elenco).uncheck();
}

/** Interruttori del Quadro riassuntivo (Cover):
 *  "Tutte triennali" (COVER_TUTTE_TRI) attiva/disattiva in un colpo COVER_IND_TRI; "tutte magistrali" (COVER_TUTTE_MAG) fa lo stesso con COVER_IND_MAG
 *  (qualunque sia lo stato corrente delle singole caselle). Le caselle in C restano modificabili una per una. */
function onEdit(e) {
  const r = e.range, ss = e.source;
  const coppie = [['COVER_TUTTE_TRI', 'COVER_IND_TRI'], ['COVER_TUTTE_MAG', 'COVER_IND_MAG']];
  for (const [interr, gruppo] of coppie) {
    const c = ss.getRangeByName(interr);
    if (!c) continue;
    if (r.getSheet().getSheetId() === c.getSheet().getSheetId() &&
        r.getRow() === c.getRow() && r.getColumn() === c.getColumn()) {
      const v = c.getValue() === true, g = ss.getRangeByName(gruppo);
      g.setValues(g.getValues().map(() => [v]));
      break;
    }
  }
  statoEsamiMagistrale_(r, ss);
}

/** COVER_STATO_MAG (menu a tendina a tre stati: ✔ esami da fare / ∅ visibile senza esami / ✗ nascosta).
 *  Quando si spunta il riconoscimento magistrale (COVER_TUTTE_MAG o COVER_IND_MAG) e lo stato è vuoto o ✗, lo imposta su ∅;
 *  quando non resta nessuna magistrale spuntata e lo stato è ∅, lo riporta a ✗. Un ✔ messo a mano non viene mai toccato. */
function statoEsamiMagistrale_(r, ss) {
  const tutte = ss.getRangeByName('COVER_TUTTE_MAG'), ind = ss.getRangeByName('COVER_IND_MAG');
  if (!tutte || !ind) return;
  const sh = ind.getSheet();
  if (r.getSheet().getSheetId() !== sh.getSheetId()) return;
  const tocca = (x) => r.getRow() <= x.getLastRow() && r.getLastRow() >= x.getRow() &&
                       r.getColumn() <= x.getLastColumn() && r.getLastColumn() >= x.getColumn();
  if (!tocca(tutte) && !tocca(ind)) return;
  const mag = ind.getValues().some(x => x[0] === true);
  const c29 = ss.getRangeByName('COVER_STATO_MAG'); if (!c29) return;
  const s = String(c29.getValue());
  if (mag && (s === '' || s === '✗' || s === 'false')) c29.setValue('∅');
  else if (!mag && s === '∅') c29.setValue('✗');
}


/** Crea (o ricrea) gli intervalli denominati della Cover. Da eseguire UNA volta dall'editor,
 *  poi i nomi seguono da soli le celle se si inseriscono/eliminano righe o colonne. */
function creaIntervalliCover() {
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName('Cover');
  const def = {
    COVER_NOMEFILE: 'G16', COVER_DATI: 'G18:G20', COVER_COGNOME: 'G19',
    COVER_TUTTE_TRI: 'B25', COVER_TUTTE_MAG: 'B31',
    COVER_IND_TRI: 'C25:C28', COVER_IND_MAG: 'C31:C33', COVER_RIGHE: 'C25:D33',
    COVER_NOTA_MAG: 'C40', COVER_AVVISO_DOTT: 'C43',
    COVER_STATO_MAG: 'C29'            // menu a tre stati esami magistrale (✔ / ∅ / ✗)
  };
  Object.keys(def).forEach(n => ss.setNamedRange(n, sh.getRange(def[n])));
  Logger.log(ss.getNamedRanges().map(x => x.getName() + ' = ' + x.getRange().getA1Notation()).join('\n'));
}

/** Crea (o ricrea) gli intervalli denominati del foglio Input. Da eseguire UNA volta dall'editor;
 *  poi i nomi seguono da soli le celle se si inseriscono/eliminano righe o colonne. */
function creaIntervalliInput() {
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName('Input');
  const def = {
    INPUT_INDIRIZZI: 'A9:D15',          // ID, denominazione, limite CFU da CV, livello
    INPUT_TARGET_NOMI: 'Q4:CB4',        // nome esame target
    INPUT_TARGET_CODICI: 'Q8:CB8',      // codice indirizzo del target
    INPUT_RIEP_CODICI: 'J8:P8',         // codici indirizzo delle colonne di riepilogo
    INPUT_TOT_CFU_SOSTENUTI: 'J28',
    INPUT_RIEPILOGO: 'J29:P34',         // previsti, CV, esami, bonus, riconosciuti, rimanenti
    INPUT_RIEP_CV: 'J30:P30',
    INPUT_RIEP_RIMANENTI: 'J34:P34',
    INPUT_T_PREVISTI: 'Q29:CB29',
    INPUT_T_DA_CV: 'Q30:CB30',
    INPUT_T_DA_ESAMI: 'Q31:CB31',
    INPUT_T_BONUS: 'Q32:CB32',
    INPUT_T_RICONOSCIUTI: 'Q33:CB33',
    INPUT_T_RIMANENTI: 'Q34:CB34',
    INPUT_T_VOTO: 'Q35:CB35',
    INPUT_ESAMI_INTEST: 'A38:I38',
    INPUT_NOTA_LAVORO: 'A39:I39',
    INPUT_CFU_PRECEDENTI: 'H40',
    INPUT_CV_CFU: 'H41',
    INPUT_CV_MATRICE: 'Q41:CB41',
    INPUT_CV_CONTROLLI: 'J41:P41',
    INPUT_ESAMI: 'A42:I1003',
    INPUT_MATRICE: 'Q42:CB1003',
    INPUT_CONTROLLI: 'J42:P1003'
  };
  Object.keys(def).forEach(n => ss.setNamedRange(n, sh.getRange(def[n])));
  ss.getNamedRanges().filter(x => /^INPUT_/.test(x.getName()))
    .forEach(x => Logger.log(x.getName() + ' ~ ' + x.getRange().getA1Notation()));
}




// ======================================================================
// RISPONDI ALLA MAIL CON IL PDF DEL RICONOSCIMENTO
// ======================================================================
// Il componente aggiuntivo Gmail "Riconoscimento CFU", quando salva gli allegati, scrive nella
// cartella degli allegati il file mail_riconoscimento.json con l'identificativo univoco della
// mail: gmailMessageId (id Gmail del singolo messaggio) e rfcMessageId (header Message-ID).
// Qui si recupera esattamente quella mail con GmailApp.getMessageById (nessuna ricerca per
// oggetto o mittente), si verifica il Message-ID e si risponde a tutti allegando il PDF.

var FILE_ID_MAIL = 'mail_riconoscimento.json';

function rispondiConPdf() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var nome = leggiNomePratica_(ss);
  if (!nome) return;
  var cartella = cartella_(DriveApp.getFileById(ss.getId()));

  // 1) Identificativo della mail (il più recente tra cartella della pratica e sottocartelle)
  var rif = trovaIdMail_(cartella);
  if (!rif) {
    ui.alert('Non trovo il file ' + FILE_ID_MAIL + ' nella cartella "' + cartella.getName() +
      '" né nelle sue sottocartelle.\nSalva prima gli allegati della mail con il componente aggiuntivo Gmail.');
    return;
  }

  // 2) La mail, recuperata per ID, con verifica del Message-ID
  var msg = null;
  try { msg = GmailApp.getMessageById(rif.dati.gmailMessageId); } catch (e) { msg = null; }
  if (!msg) {
    ui.alert('La mail registrata in ' + rif.percorso + ' (ID ' + rif.dati.gmailMessageId + ') non è più disponibile.');
    return;
  }
  if (rif.dati.rfcMessageId && msg.getHeader('Message-ID') !== rif.dati.rfcMessageId) {
    ui.alert('Il Message-ID della mail trovata non coincide con quello registrato in ' + rif.percorso + '. Invio annullato.');
    return;
  }

  // 3) PDF del riconoscimento: <nome pratica>.pdf nella cartella della pratica.
  //    Se manca si propone di crearlo; con "No" si prosegue comunque, senza allegato.
  var nomePdf = nome + '.pdf';
  var itPdf = cartella.getFilesByName(nomePdf);
  var pdf = itPdf.hasNext() ? itPdf.next() : null;
  if (!pdf) {
    var crea = ui.alert('PDF non trovato', 'Nella cartella "' + cartella.getName() + '" non c\'è ' + nomePdf +
      '.\nLo creo ora dai fogli della pratica?\n\n(Con "No" puoi comunque scrivere e inviare la mail, senza allegato.)',
      ui.ButtonSet.YES_NO);
    if (crea === ui.Button.YES) {
      var fogli = fogliDaStampare_(ss);
      if (fogli.errore) {
        ui.alert(fogli.errore + '\n\nProseguo senza allegato.');
      } else {
        pdf = cartella.createFile(esportaPdf_(ss, fogli.nomi, true)).setName(nomePdf);
      }
    }
  }

  // 4) Bozza di risposta a tutti in Gmail (con il PDF) e apertura della conversazione in Gmail.
  //    Per tornare all'editor interno sostituire con: apriEditorRisposta_(msg, rif, pdf, nomePdf);
  apriInGmail_(msg, rif, pdf, nomePdf);
}

/**
 * Cerca FILE_ID_MAIL nella cartella della pratica e nelle sue sottocartelle (es. Revisione_NN)
 * e restituisce quello salvato più di recente: { dati, file, percorso }, oppure null.
 */
function trovaIdMail_(cartella) {
  var migliore = null;
  function esamina(f, percorso) {
    var it = f.getFilesByName(FILE_ID_MAIL);
    while (it.hasNext()) {
      var file = it.next();
      try {
        var d = JSON.parse(file.getBlob().getDataAsString());
        if (!d || !d.gmailMessageId) continue;
        if (!migliore || String(d.salvatoIl) > String(migliore.dati.salvatoIl)) {
          migliore = { dati: d, file: file, percorso: percorso };
        }
      } catch (e) {}
    }
  }
  esamina(cartella, cartella.getName());
  var sub = cartella.getFolders();
  while (sub.hasNext()) {
    var s = sub.next();
    esamina(s, cartella.getName() + ' / ' + s.getName());
  }
  return migliore;
}



/**
 * Prepara (o ritrova) la bozza di "rispondi a tutti" nel thread della mail, con il PDF allegato,
 * e apre Gmail direttamente su quella conversazione: la risposta si completa e si invia in Gmail.
 */
function apriInGmail_(msg, rif, pdf, nomePdf) {
  var draft = null, ritrovata = false;
  if (rif.dati.bozzaGmailId) {
    try { draft = GmailApp.getDraft(rif.dati.bozzaGmailId); draft.getMessage().getId(); ritrovata = true; }
    catch (e) { draft = null; }
  }
  if (!draft) {
    var testo = pdf ? 'In allegato il riconoscimento CFU.' : '';
    var opt = { htmlBody: '<div>' + (testo || '<br>') + '</div>' };
    if (pdf) opt.attachments = [pdf.getBlob().setName(nomePdf)];
    draft = msg.createDraftReplyAll(testo, opt);
    try {
      rif.dati.bozzaGmailId = draft.getId();
      rif.dati.bozzaCreataIl = new Date().toISOString();
      rif.file.setContent(JSON.stringify(rif.dati, null, 2));
    } catch (e) {}
  }
  var me = Session.getActiveUser().getEmail();
  var url = 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(me) + '#all/' + msg.getThread().getId();
  var nota = ritrovata
    ? 'Ho ritrovato la bozza di risposta già preparata per questa pratica.'
    : 'Ho preparato la bozza di risposta a tutti' + (pdf ? ' con allegato <b>' + esc_(nomePdf) + '</b>.' : ', senza allegato.');
  var out = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">' +
    '<p>' + nota + '</p>' +
    '<p>La trovi in Gmail dentro la conversazione con lo studente: completa il testo, aggiungi destinatari o allegati e premi <b>Invia</b>.</p>' +
    '<p style="text-align:center;margin-top:18px"><a href="' + url + '" target="_blank" ' +
    'onclick="setTimeout(function(){google.script.host.close();},400)" ' +
    'style="background:#1a73e8;color:#fff;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:bold">Apri la mail in Gmail</a></p>' +
    '<script>var w = window.open(' + JSON.stringify(url) + ', "_blank"); if (w) setTimeout(function(){ google.script.host.close(); }, 600);</script>' +
    '</div>').setWidth(480).setHeight(230);
  SpreadsheetApp.getUi().showModalDialog(out, 'Risposta in Gmail');
}

// ============================================================================
// Editor Comunicazioni — finestra per scrivere la risposta alla mail della pratica
// (destinatari/oggetto modificabili, allegati, dettatura, formattazione,
//  bozza in Gmail ricaricabile, invio nel thread originale).
// Richiede il servizio avanzato "Gmail API" (Servizi → Gmail, identificatore Gmail).
// La bozza resta in Gmail (cartella Bozze, nel thread della mail) e il suo id è
// annotato in mail_riconoscimento.json: riaprendo l'editor dal menu viene ricaricata.
// ============================================================================

var MAX_ALLEGATI_MB_ = 24;

/** Apre la finestra dell'editor. pdf può essere null. */
function apriEditorRisposta_(msg, rif, pdf, nomePdf) {
  var tz = Session.getScriptTimeZone();
  var praticaFolder = cartella_(DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId()));
  var def = destinatariPredefiniti_(msg);
  var ogg = String(msg.getSubject() || '');
  var ctx = {
    msgId: rif.dati.gmailMessageId,
    rfc: rif.dati.rfcMessageId || '',
    jsonId: rif.file.getId(),
    cartellaId: praticaFolder.getId(),
    cartellaNome: praticaFolder.getName(),
    originale: 'Da: ' + msg.getFrom() + ' – ' + Utilities.formatDate(msg.getDate(), tz, 'dd/MM/yyyy HH:mm') + ' · Oggetto: ' + ogg,
    to: def.to, cc: def.cc, bcc: '',
    oggetto: /^re:/i.test(ogg) ? ogg : 'Re: ' + ogg,
    testo: pdf ? '<div>In allegato il riconoscimento CFU.</div>' : '',
    allegati: elencoFileCartella_(praticaFolder),
    scelti: pdf ? [pdf.getId()] : [],
    draftId: '',
    nota: pdf ? '' : 'PDF del riconoscimento non presente (' + nomePdf + ').'
  };
  // Bozza già salvata? La ricarico da Gmail.
  var b = caricaBozza_(rif.dati.bozzaId);
  if (b) {
    ctx.draftId = rif.dati.bozzaId;
    ctx.to = b.to; ctx.cc = b.cc; ctx.bcc = b.bcc; ctx.oggetto = b.oggetto || ctx.oggetto;
    ctx.testo = b.html;
    if (rif.dati.allegatiBozza) ctx.scelti = rif.dati.allegatiBozza;
    ctx.nota = 'Bozza ricaricata da Gmail (salvata il ' + (rif.dati.bozzaSalvataIl || '?') + ').';
  }
  ctx.info = ctx.scelti.map(infoFile_).filter(Boolean);
  ctx.scelti = ctx.info.map(function (f) { return f.id; });
  var json = JSON.stringify(ctx).replace(/</g, '\\u003c');
  var out = HtmlService.createHtmlOutput(htmlEditorRisposta_().replace('__CTX__', function () { return json; }))
    .setWidth(1000).setHeight(780);
  SpreadsheetApp.getUi().showModalDialog(out, 'Editor Comunicazioni');
}

/** Rispondi a = mittente (o Reply-To); Cc = gli altri destinatari di A e Cc, escluso me. */
function destinatariPredefiniti_(msg) {
  var me = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  var mitt = msg.getReplyTo() || msg.getFrom();
  var visti = {};
  function pulisci(lista) {
    return lista.map(function (s) { return String(s).trim(); }).filter(function (s) {
      var k = s.toLowerCase();
      var mail = (k.match(/<([^>]+)>/) || [null, k])[1].trim();
      if (!s || (me && mail === me) || visti[mail]) return false;
      visti[mail] = true;
      return true;
    });
  }
  var to = pulisci([mitt]);
  var cc = pulisci(String(msg.getTo() || '').split(',').concat(String(msg.getCc() || '').split(',')));
  return { to: to.join(', '), cc: cc.join(', ') };
}

/** File della cartella della pratica e delle sottocartelle, allegabili. */
function elencoFileCartella_(cartella) {
  var out = [];
  function scan(f, pref) {
    var it = f.getFiles();
    while (it.hasNext()) {
      var x = it.next();
      var mt = x.getMimeType();
      if (x.getName() === FILE_ID_MAIL || mt === MimeType.GOOGLE_SHEETS || mt === MimeType.FOLDER) continue;
      out.push({ id: x.getId(), nome: pref + x.getName(), kb: Math.max(1, Math.round(x.getSize() / 1024)) });
    }
    var sub = f.getFolders();
    while (sub.hasNext()) { var s = sub.next(); scan(s, pref + s.getName() + ' / '); }
  }
  scan(cartella, '');
  out.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
  return out;
}

/** Carica nella cartella della pratica un file scelto dal computer (chiamata dall'editor). */
function caricaAllegatoEditor(p) {
  var blob = Utilities.newBlob(Utilities.base64Decode(p.data), p.mime || 'application/octet-stream', p.nome);
  var f = DriveApp.getFolderById(p.cartellaId).createFile(blob);
  return { id: f.getId(), nome: f.getName(), kb: Math.max(1, Math.round(f.getSize() / 1024)) };
}

/** Salva (crea o aggiorna) la bozza in Gmail, nel thread della mail originale. */
function salvaBozzaRisposta(p) {
  var msg = mailRisposta_(p);
  var risorsa = { message: { raw: mimeRisposta_(p, msg), threadId: msg.getThread().getId() } };
  var id = p.draftId;
  if (id) {
    try { Gmail.Users.Drafts.update(risorsa, 'me', id); } catch (e) { id = ''; }
  }
  if (!id) id = Gmail.Users.Drafts.create(risorsa, 'me').id;
  var ora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  aggiornaJson_(p.jsonId, function (d) { d.bozzaId = id; d.allegatiBozza = p.allegati; d.bozzaSalvataIl = ora; });
  return { draftId: id, ora: ora };
}

/** Invia la risposta (dalla bozza, se c'è) e annota l'invio nel file json. */
function inviaRispostaEditor(p) {
  var msg = mailRisposta_(p);
  var risorsa = { message: { raw: mimeRisposta_(p, msg), threadId: msg.getThread().getId() } };
  var inviato = false;
  if (p.draftId) {
    try {
      Gmail.Users.Drafts.update(risorsa, 'me', p.draftId);
      Gmail.Users.Drafts.send({ id: p.draftId }, 'me');
      inviato = true;
    } catch (e) { inviato = false; }
  }
  if (!inviato) Gmail.Users.Messages.send(risorsa.message, 'me');
  var nomi = (p.allegati || []).map(function (id) { return DriveApp.getFileById(id).getName(); });
  aggiornaJson_(p.jsonId, function (d) {
    d.rispostaInviataIl = new Date().toISOString();
    d.pdfInviato = nomi.join(', ');
    delete d.bozzaId; delete d.allegatiBozza; delete d.bozzaSalvataIl;
  });
  return { allegati: nomi };
}

function mailRisposta_(p) {
  if (!String(p.to || '').trim()) throw new Error('Il campo "Rispondi a" è vuoto.');
  var msg = null;
  try { msg = GmailApp.getMessageById(p.msgId); } catch (e) { msg = null; }
  if (!msg) throw new Error('La mail originale non è più disponibile.');
  if (p.rfc && msg.getHeader('Message-ID') !== p.rfc) throw new Error('Il Message-ID della mail non coincide con quello registrato.');
  return msg;
}

function aggiornaJson_(jsonId, fn) {
  try {
    var f = DriveApp.getFileById(jsonId);
    var d = JSON.parse(f.getBlob().getDataAsString());
    fn(d);
    f.setContent(JSON.stringify(d, null, 2));
  } catch (e) {}
}

/** Legge una bozza da Gmail: destinatari, oggetto, corpo HTML. null se non esiste più. */
function caricaBozza_(id) {
  if (!id) return null;
  try {
    var m = Gmail.Users.Drafts.get('me', id, { format: 'full' }).message;
    var h = {};
    (m.payload.headers || []).forEach(function (x) { h[x.name.toLowerCase()] = x.value; });
    var html = '', txt = '';
    (function cerca(part) {
      if (!part) return;
      if (part.mimeType === 'text/html' && part.body && part.body.data && !html) html = decodifica_(part.body.data);
      if (part.mimeType === 'text/plain' && part.body && part.body.data && !txt) txt = decodifica_(part.body.data);
      (part.parts || []).forEach(cerca);
    })(m.payload);
    if (!html && txt) html = '<div>' + esc_(txt).replace(/\n/g, '<br>') + '</div>';
    return { to: h['to'] || '', cc: h['cc'] || '', bcc: h['bcc'] || '', oggetto: h['subject'] || '', html: html };
  } catch (e) { return null; }
}

function decodifica_(data) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(data)).getDataAsString('UTF-8');
}

/** Messaggio MIME (testo + HTML + allegati da Drive) in risposta a msg, codificato base64url. */
function mimeRisposta_(p, msg) {
  var CRLF = '\r\n';
  var b1 = 'mix_' + Utilities.getUuid().replace(/-/g, '');
  var b2 = 'alt_' + Utilities.getUuid().replace(/-/g, '');
  var mid = msg.getHeader('Message-ID');
  var refs = msg.getHeader('References');
  var totale = 0;
  var r = [];
  r.push('MIME-Version: 1.0');
  r.push('To: ' + intestazioneIndirizzi_(p.to));
  if (String(p.cc || '').trim()) r.push('Cc: ' + intestazioneIndirizzi_(p.cc));
  if (String(p.bcc || '').trim()) r.push('Bcc: ' + intestazioneIndirizzi_(p.bcc));
  r.push('Subject: ' + codificaIntestazione_(p.oggetto || ''));
  if (mid) {
    r.push('In-Reply-To: ' + mid);
    r.push('References: ' + (refs ? refs + ' ' : '') + mid);
  }
  r.push('Content-Type: multipart/mixed; boundary="' + b1 + '"');
  r.push('');
  r.push('--' + b1);
  r.push('Content-Type: multipart/alternative; boundary="' + b2 + '"');
  r.push('');
  r.push('--' + b2);
  r.push('Content-Type: text/plain; charset=UTF-8');
  r.push('Content-Transfer-Encoding: base64');
  r.push('');
  r.push(righe76_(Utilities.base64Encode(testoSemplice_(p.html), Utilities.Charset.UTF_8)));
  r.push('--' + b2);
  r.push('Content-Type: text/html; charset=UTF-8');
  r.push('Content-Transfer-Encoding: base64');
  r.push('');
  r.push(righe76_(Utilities.base64Encode('<div style="font-family:Arial,sans-serif;font-size:14px">' + (p.html || '') + '</div>', Utilities.Charset.UTF_8)));
  r.push('--' + b2 + '--');
  (p.allegati || []).forEach(function (id) {
    var f = DriveApp.getFileById(id);
    var blob = f.getBlob();
    var nome = blob.getName() || f.getName();
    var byte = blob.getBytes();
    totale += byte.length;
    r.push('--' + b1);
    r.push('Content-Type: ' + (blob.getContentType() || 'application/octet-stream') + '; name="' + codificaIntestazione_(nome) + '"');
    r.push('Content-Disposition: attachment; filename="' + codificaIntestazione_(nome) + '"');
    r.push('Content-Transfer-Encoding: base64');
    r.push('');
    r.push(righe76_(Utilities.base64Encode(byte)));
  });
  if (totale > MAX_ALLEGATI_MB_ * 1024 * 1024) throw new Error('Gli allegati superano ' + MAX_ALLEGATI_MB_ + ' MB: togline qualcuno.');
  r.push('--' + b1 + '--');
  return Utilities.base64EncodeWebSafe(r.join(CRLF));
}

function righe76_(s) { return s.replace(/(.{76})/g, '$1\r\n'); }

function codificaIntestazione_(s) {
  s = String(s);
  return /^[\x20-\x7e]*$/.test(s) ? s.replace(/"/g, "'") : '=?UTF-8?B?' + Utilities.base64Encode(s, Utilities.Charset.UTF_8) + '?=';
}

/** "Nome Cognome <a@b.it>, c@d.it" → nomi non ASCII codificati, separatori normalizzati. */
function intestazioneIndirizzi_(s) {
  return String(s).split(/[,;]/).map(function (x) { return x.trim(); }).filter(String).map(function (x) {
    var m = x.match(/^(.*)<([^>]+)>$/);
    if (!m) return x;
    var nome = m[1].trim().replace(/^"|"$/g, '');
    return nome ? (/^[\x20-\x7e]*$/.test(nome) ? '"' + nome.replace(/"/g, "'") + '"' : codificaIntestazione_(nome)) + ' <' + m[2].trim() + '>' : m[2].trim();
  }).join(', ');
}

/** Versione testuale del corpo HTML. */
function testoSemplice_(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function infoFile_(id) {
  try {
    var f = DriveApp.getFileById(id);
    return { id: id, nome: f.getName(), kb: Math.max(1, Math.round(f.getSize() / 1024)) };
  } catch (e) { return null; }
}

/** Selettore Drive dell'editor: contenuto di una cartella (id | 'root' | 'condivisi') o ricerca per nome. */
function sfogliaDrive(p) {
  var MAX = 150, r = { percorso: [], titolo: '', cartelle: [], file: [], troncato: false };
  var itC, itF, noFolder = " and mimeType != 'application/vnd.google-apps.folder'";
  if (p.cerca) {
    var q = String(p.cerca).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    itC = DriveApp.searchFolders("title contains '" + q + "' and trashed = false");
    itF = DriveApp.searchFiles("title contains '" + q + "' and trashed = false" + noFolder);
    r.titolo = 'Risultati per "' + p.cerca + '"';
  } else if (p.folderId === 'condivisi') {
    itC = DriveApp.searchFolders('sharedWithMe = true and trashed = false');
    itF = DriveApp.searchFiles('sharedWithMe = true and trashed = false' + noFolder);
    r.titolo = 'Condivisi con me';
  } else {
    var f = (!p.folderId || p.folderId === 'root') ? DriveApp.getRootFolder() : DriveApp.getFolderById(p.folderId);
    var x = f;
    for (var i = 0; i < 12 && x; i++) {
      r.percorso.unshift({ id: x.getId(), nome: x.getName() });
      try { var par = x.getParents(); x = par.hasNext() ? par.next() : null; } catch (e) { x = null; }
    }
    itC = f.getFolders(); itF = f.getFiles();
  }
  while (itC.hasNext() && r.cartelle.length < MAX) { var c = itC.next(); r.cartelle.push({ id: c.getId(), nome: c.getName() }); }
  if (itC.hasNext()) r.troncato = true;
  while (itF.hasNext() && r.file.length < MAX) {
    var y = itF.next(), mt = y.getMimeType();
    if (mt === MimeType.FOLDER || mt === MimeType.SHORTCUT || y.getName() === FILE_ID_MAIL) continue;
    r.file.push({ id: y.getId(), nome: y.getName(), kb: Math.max(1, Math.round(y.getSize() / 1024)) });
  }
  if (itF.hasNext()) r.troncato = true;
  var perNome = function (a, b) { return a.nome.localeCompare(b.nome); };
  r.cartelle.sort(perNome); r.file.sort(perNome);
  return r;
}

function htmlEditorRisposta_() {
  return `<!DOCTYPE html>
<html><head><base target="_top"><meta charset="utf-8">
<style>
  *{box-sizing:border-box}
  html,body{height:100%}
  body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:8px 14px 10px;color:#202124;font-size:13px;display:flex;flex-direction:column}
  .top{display:flex;justify-content:space-between;align-items:center;color:#5f6368;font-size:12px;margin-bottom:6px;gap:10px}
  .top .dim button{border:1px solid #dadce0;background:#fff;border-radius:4px;height:26px;padding:0 8px;cursor:pointer;font-size:12px}
  .campi{background:#f8f9fa;border-radius:8px;padding:8px 12px;margin-bottom:8px}
  .riga{display:flex;align-items:center;margin:3px 0}
  .riga label{width:92px;color:#5f6368;font-weight:600;flex:none}
  .riga input[type=text]{flex:1;height:28px;border:1px solid #dadce0;border-radius:4px;padding:0 8px;font-size:13px}
  .riga input[type=text]:focus{outline:none;border-color:#1a73e8}
  .all{background:#f8f9fa;border-radius:8px;padding:6px 12px;margin-bottom:8px}
  .all .testa{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .chip{display:inline-flex;align-items:center;gap:4px;background:#e8f0fe;border-radius:12px;padding:3px 10px;margin:3px 4px 0 0;font-size:12px}
  .chip b{cursor:pointer;color:#5f6368;margin-left:4px}
  #lista{border:1px solid #dadce0;border-radius:4px;background:#fff;margin-top:6px;padding:6px 8px;display:none}
  #lista .nav{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
  #lista .nav input{flex:1;min-width:140px;height:28px;border:1px solid #dadce0;border-radius:4px;padding:0 8px}
  #percorso{color:#5f6368;font-size:12px;margin:6px 0 4px}
  #percorso a{color:#1a73e8;cursor:pointer}
  #voci{max-height:190px;overflow-y:auto}
  .cart{cursor:pointer;padding:2px 0;color:#1a73e8}
  .cart:hover{text-decoration:underline}
  #lista label{display:block;padding:2px 0;cursor:pointer}
  .btn{height:28px;border:1px solid #dadce0;background:#fff;border-radius:4px;padding:0 10px;font-size:12px;cursor:pointer}
  .btn:hover,.bar button:hover{background:#eef3fd}
  .bar{background:#f8f9fa;border-radius:8px;padding:6px 8px;margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .bar button,.bar select{height:30px;border:1px solid #dadce0;background:#fff;border-radius:4px;padding:0 9px;font-size:13px;cursor:pointer}
  .bar button.on{background:#fde7e7;border-color:#d93025}
  .sep{width:1px;height:24px;background:#dadce0;margin:0 3px}
  #stato{color:#5f6368}
  #ed{flex:1;min-height:120px;border:2px solid #1a73e8;border-radius:6px;overflow-y:auto;padding:12px;font-family:Arial;font-size:14px;outline:none;line-height:1.45}
  #ed:empty:before{content:'Scrivi qui il testo della risposta…';color:#9aa0a6}
  .azioni{display:flex;justify-content:center;gap:24px;margin-top:10px}
  .azioni button{border:0;border-radius:4px;color:#fff;font-size:15px;font-weight:bold;padding:9px 26px;cursor:pointer}
  .azioni button:disabled{opacity:.55;cursor:default}
  #bBozza{background:#4caf50}#bInvia{background:#e53935}#bAnnulla{background:#9e9e9e}
  #msg{text-align:center;margin-top:6px;min-height:16px;font-weight:bold}
  .ok{color:#188038}.err{color:#d93025}
  #maniglia{position:fixed;right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize;touch-action:none;
    background:linear-gradient(135deg,transparent 50%,#9aa0a6 50%,#9aa0a6 60%,transparent 60%,transparent 70%,#9aa0a6 70%,#9aa0a6 80%,transparent 80%)}
</style></head><body>

<div class="top">
  <span id="orig"></span>
  <span class="dim">Finestra:
    <button data-d="s" title="Più piccola">－</button>
    <button data-d="l" title="Più grande">＋</button>
    <button data-d="max" title="Adatta allo schermo">⛶</button>
  </span>
</div>

<div class="campi">
  <div class="riga"><label for="fTo">Rispondi a</label><input type="text" id="fTo"></div>
  <div class="riga"><label for="fCc">Cc</label><input type="text" id="fCc"></div>
  <div class="riga"><label for="fBcc">Ccn</label><input type="text" id="fBcc"></div>
  <div class="riga"><label for="fOgg">Oggetto</label><input type="text" id="fOgg"></div>
</div>

<div class="all">
  <div class="testa">
    <b style="color:#5f6368">📎 Allegati</b>
    <button class="btn" id="bScegli">Sfoglia Google Drive ▾</button>
    <button class="btn" id="bCarica">Carica dal computer…</button>
    <input type="file" id="fFile" multiple style="display:none">
    <span id="tot" style="color:#5f6368"></span>
  </div>
  <div id="chips"></div>
  <div id="lista">
    <div class="nav">
      <button class="btn" data-v="pratica">📁 Cartella pratica</button>
      <button class="btn" data-v="root">🏠 Il mio Drive</button>
      <button class="btn" data-v="condivisi">👥 Condivisi con me</button>
      <input type="text" id="fCerca" placeholder="Cerca un file in Drive per nome…">
      <button class="btn" id="bCerca">🔍 Cerca</button>
    </div>
    <div id="percorso"></div>
    <div id="voci"></div>
  </div>
</div>

<div class="bar">
  <button id="bMic" title="Dettatura vocale (it-IT)">🎤</button><span id="stato">Pronto</span>
</div>

<div class="bar" id="tb">
  <button data-c="bold" title="Grassetto"><b>B</b></button>
  <button data-c="italic" title="Corsivo"><i>I</i></button>
  <button data-c="underline" title="Sottolineato"><u>U</u></button>
  <button data-c="strikeThrough" title="Barrato"><s>S</s></button>
  <span class="sep"></span>
  <select data-s="fontName" title="Font"><option value="">Font</option>
    <option>Arial</option><option>Calibri</option><option>Georgia</option><option>Tahoma</option>
    <option>Times New Roman</option><option>Trebuchet MS</option><option>Verdana</option><option>Courier New</option></select>
  <select data-s="fontSize" title="Dimensione"><option value="">Dim</option>
    <option value="2">Piccolo</option><option value="3">Normale</option><option value="4">Grande</option>
    <option value="5">Molto grande</option><option value="6">Titolo</option></select>
  <select data-s="foreColor" title="Colore del testo"><option value="">🎨 Colore Testo</option>
    <option value="#000000">Nero</option><option value="#d93025">Rosso</option><option value="#1a73e8">Blu</option>
    <option value="#188038">Verde</option><option value="#e37400">Arancione</option><option value="#9334e6">Viola</option>
    <option value="#5f6368">Grigio</option></select>
  <select data-s="hiliteColor" title="Evidenziatore / sfondo"><option value="">🎨 Sfondo</option>
    <option value="#ffff00">Giallo</option><option value="#b7e1cd">Verde</option><option value="#c9daf8">Azzurro</option>
    <option value="#f4cccc">Rosa</option><option value="#fce5cd">Arancio</option><option value="transparent">Nessuno</option></select>
  <span class="sep"></span>
  <button data-c="justifyLeft" title="Allinea a sinistra">⬅️</button>
  <button data-c="justifyCenter" title="Centra">↔️</button>
  <button data-c="justifyRight" title="Allinea a destra">➡️</button>
  <button data-c="justifyFull" title="Giustifica">☰</button>
  <span class="sep"></span>
  <button data-c="insertUnorderedList" title="Elenco puntato">• Lista</button>
  <button data-c="insertOrderedList" title="Elenco numerato">1. Lista</button>
  <button data-c="outdent" title="Riduci rientro">⇤</button>
  <button data-c="indent" title="Aumenta rientro">⇥</button>
  <span class="sep"></span>
  <button data-c="removeFormat" title="Cancella formattazione">🧹</button>
</div>

<div id="ed" contenteditable="true"></div>

<div class="azioni">
  <button id="bBozza">💾 Salva Bozza</button>
  <button id="bInvia">✉️ Invia Email</button>
  <button id="bAnnulla">❌ Annulla</button>
</div>
<div id="msg"></div>
<div id="maniglia" title="Trascina per ridimensionare"></div>

<script>
var CTX = __CTX__;
var draftId = CTX.draftId || '', modificato = false, occupato = false, range = null;
var FILES = {}; CTX.allegati.concat(CTX.info || []).forEach(function(f){ FILES[f.id] = f; });
var scelti = CTX.scelti.filter(function(id){ return FILES[id]; });
var ed = document.getElementById('ed');
function $(id){ return document.getElementById(id); }

$('orig').textContent = 'Risposta a · ' + CTX.originale;
$('fTo').value = CTX.to; $('fCc').value = CTX.cc; $('fBcc').value = CTX.bcc; $('fOgg').value = CTX.oggetto;
ed.innerHTML = CTX.testo || '';
['fTo','fCc','fBcc','fOgg'].forEach(function(id){ $(id).addEventListener('input', function(){ modificato = true; }); });
try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
if (CTX.nota) messaggio(CTX.nota, true);

// ---------- allegati
function mostraAllegati(){
  var c = $('chips'); c.innerHTML = ''; var kb = 0;
  if (!scelti.length) { var n = document.createElement('span'); n.style.color = '#9aa0a6'; n.textContent = 'Nessun allegato'; c.appendChild(n); }
  scelti.forEach(function(id){
    var f = FILES[id]; kb += f.kb;
    var s = document.createElement('span'); s.className = 'chip';
    s.appendChild(document.createTextNode('📄 ' + f.nome + ' (' + dim(f.kb) + ')'));
    var x = document.createElement('b'); x.textContent = '✕'; x.title = 'Togli';
    x.onclick = function(){ scelti = scelti.filter(function(i){ return i !== id; }); modificato = true; mostraAllegati(); };
    s.appendChild(x); c.appendChild(s);
  });
  $('tot').textContent = scelti.length ? 'Totale ' + dim(kb) + (kb > 24 * 1024 ? ' — oltre il limite di Gmail (25 MB)!' : '') : '';
  $('tot').style.color = kb > 24 * 1024 ? '#d93025' : '#5f6368';
  aggiornaSpunte();
}
function dim(kb){ return kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB'; }
$('bScegli').onclick = function(){
  var l = $('lista'), apri = l.style.display !== 'block';
  l.style.display = apri ? 'block' : 'none';
  if (apri && !vistaCorrente) carica({ folderId: CTX.cartellaId });
};
var vistaCorrente = null;
function carica(p){
  $('voci').textContent = 'Caricamento…';
  google.script.run
    .withSuccessHandler(disegna)
    .withFailureHandler(function(e){ $('voci').textContent = 'Errore: ' + e.message; })
    .sfogliaDrive(p);
}
function disegna(r){
  vistaCorrente = r;
  var pc = $('percorso'); pc.innerHTML = '';
  r.percorso.forEach(function(c, i){
    if (i) pc.appendChild(document.createTextNode(' › '));
    var a = document.createElement('a'); a.textContent = c.nome;
    a.onclick = function(){ carica({ folderId: c.id }); };
    pc.appendChild(a);
  });
  if (r.titolo) pc.appendChild(document.createTextNode(r.titolo));
  var v = $('voci'); v.innerHTML = '';
  r.cartelle.forEach(function(c){
    var d = document.createElement('div'); d.className = 'cart'; d.textContent = '📁 ' + c.nome;
    d.onclick = function(){ carica({ folderId: c.id }); };
    v.appendChild(d);
  });
  r.file.forEach(function(f){
    if (!FILES[f.id]) FILES[f.id] = f;
    var lab = document.createElement('label'), cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = f.id; cb.checked = scelti.indexOf(f.id) >= 0;
    cb.onchange = function(){
      if (cb.checked) { if (scelti.indexOf(f.id) < 0) scelti.push(f.id); }
      else scelti = scelti.filter(function(i){ return i !== f.id; });
      modificato = true; mostraAllegati();
    };
    lab.appendChild(cb); lab.appendChild(document.createTextNode(' 📄 ' + f.nome + ' (' + dim(f.kb) + ')'));
    v.appendChild(lab);
  });
  if (!r.cartelle.length && !r.file.length) v.textContent = 'Nessun elemento.';
  if (r.troncato) { var n = document.createElement('div'); n.style.color = '#9aa0a6'; n.textContent = 'Mostrati solo i primi 150 elementi: usa la ricerca.'; v.appendChild(n); }
}
function aggiornaSpunte(){
  Array.prototype.forEach.call(document.querySelectorAll('#voci input[type=checkbox]'), function(cb){ cb.checked = scelti.indexOf(cb.value) >= 0; });
}
Array.prototype.forEach.call(document.querySelectorAll('#lista .nav button[data-v]'), function(b){
  b.onclick = function(){ var v = b.getAttribute('data-v'); carica({ folderId: v === 'pratica' ? CTX.cartellaId : v }); };
});
$('bCerca').onclick = function(){ var s = $('fCerca').value.trim(); if (s) carica({ cerca: s }); };
$('fCerca').addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); $('bCerca').onclick(); } });
$('bCarica').onclick = function(){ $('fFile').click(); };
$('fFile').onchange = function(){
  var files = Array.prototype.slice.call($('fFile').files); $('fFile').value = '';
  (function prossimo(){
    if (!files.length) { blocca(false); return; }
    var f = files.shift();
    if (f.size > 20 * 1024 * 1024) { messaggio(f.name + ': file troppo grande (max 20 MB).', false); prossimo(); return; }
    blocca(true); messaggio('Caricamento di ' + f.name + ' nella cartella ' + CTX.cartellaNome + '…', true);
    var rd = new FileReader();
    rd.onload = function(){
      google.script.run
        .withSuccessHandler(function(r){ FILES[r.id] = r; CTX.allegati.push(r); scelti.push(r.id); modificato = true; mostraAllegati(); messaggio(r.nome + ' caricato e allegato.', true); prossimo(); })
        .withFailureHandler(function(e){ messaggio('Caricamento non riuscito: ' + e.message, false); prossimo(); })
        .caricaAllegatoEditor({ nome: f.name, mime: f.type, data: String(rd.result).split(',')[1], cartellaId: CTX.cartellaId });
    };
    rd.readAsDataURL(f);
  })();
};
mostraAllegati();

// ---------- selezione e barra di formattazione
function salvaSel(){ var s = window.getSelection(); if (s.rangeCount && ed.contains(s.anchorNode)) range = s.getRangeAt(0).cloneRange(); }
function ripristinaSel(){ ed.focus(); if (range) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(range); } }
document.addEventListener('selectionchange', salvaSel);
ed.addEventListener('input', function(){ modificato = true; });
Array.prototype.forEach.call(document.querySelectorAll('#tb button'), function(b){
  b.addEventListener('mousedown', function(e){ e.preventDefault(); });
  b.addEventListener('click', function(){ ripristinaSel(); document.execCommand(b.getAttribute('data-c'), false, null); modificato = true; });
});
Array.prototype.forEach.call(document.querySelectorAll('#tb select'), function(s){
  s.addEventListener('change', function(){
    if (!s.value) return;
    ripristinaSel();
    var cmd = s.getAttribute('data-s');
    if (!document.execCommand(cmd, false, s.value) && cmd === 'hiliteColor') document.execCommand('backColor', false, s.value);
    s.selectedIndex = 0; modificato = true;
  });
});

// ---------- dettatura vocale
var Rec = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, ascolto = false;
function stato(s){ $('stato').textContent = s; }
$('bMic').addEventListener('mousedown', function(e){ e.preventDefault(); });
$('bMic').addEventListener('click', function(){
  if (!Rec) { stato('Dettatura non supportata da questo browser (usa Chrome)'); return; }
  if (ascolto) { rec.stop(); return; }
  rec = new Rec(); rec.lang = 'it-IT'; rec.continuous = true; rec.interimResults = true;
  rec.onstart = function(){ ascolto = true; $('bMic').classList.add('on'); stato('In ascolto…'); };
  rec.onend = function(){ ascolto = false; $('bMic').classList.remove('on'); stato('Pronto'); };
  rec.onerror = function(e){
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
      stato('Microfono non consentito in questa finestra: usa la dettatura di sistema (Windows: Win+H · Mac: tasto Fn due volte)');
    else if (e.error !== 'no-speech' && e.error !== 'aborted') stato('Errore dettatura: ' + e.error);
  };
  rec.onresult = function(e){
    var provv = '';
    for (var i = e.resultIndex; i < e.results.length; i++) {
      var r = e.results[i];
      if (r.isFinal) {
        var s = r[0].transcript.trim();
        if (s) { ripristinaSel(); document.execCommand('insertText', false, (ed.textContent && !/\\s$/.test(ed.textContent) ? ' ' : '') + s); salvaSel(); modificato = true; }
      } else provv += r[0].transcript;
    }
    stato(provv ? '… ' + provv : 'In ascolto…');
  };
  ripristinaSel(); rec.start();
});

// ---------- ridimensionamento della finestra
var W = window.innerWidth, H = window.innerHeight;
function imposta(w, h){
  W = Math.max(620, Math.min(w, screen.availWidth - 40)); H = Math.max(480, Math.min(h, screen.availHeight - 120));
  google.script.host.setWidth(Math.round(W)); google.script.host.setHeight(Math.round(H));
}
Array.prototype.forEach.call(document.querySelectorAll('.dim button'), function(b){
  b.onclick = function(){
    var d = b.getAttribute('data-d');
    if (d === 's') imposta(W * 0.85, H * 0.85);
    else if (d === 'l') imposta(W * 1.15, H * 1.15);
    else imposta(screen.availWidth, screen.availHeight);
  };
});
(function(){
  var m = $('maniglia'), x0, y0, w0, h0, raf = 0, nw, nh;
  m.addEventListener('pointerdown', function(e){ m.setPointerCapture(e.pointerId); x0 = e.screenX; y0 = e.screenY; w0 = W; h0 = H; e.preventDefault(); });
  m.addEventListener('pointermove', function(e){
    if (!m.hasPointerCapture(e.pointerId)) return;
    // la finestra è centrata: il bordo si sposta di metà della variazione
    nw = w0 + 2 * (e.screenX - x0); nh = h0 + 2 * (e.screenY - y0);
    if (!raf) raf = requestAnimationFrame(function(){ raf = 0; imposta(nw, nh); });
  });
  m.addEventListener('pointerup', function(e){ m.releasePointerCapture(e.pointerId); });
})();

// ---------- azioni
function dati(){ return { msgId: CTX.msgId, rfc: CTX.rfc, jsonId: CTX.jsonId, draftId: draftId,
  to: $('fTo').value, cc: $('fCc').value, bcc: $('fBcc').value, oggetto: $('fOgg').value,
  html: ed.innerHTML, allegati: scelti.slice() }; }
function messaggio(s, ok){ var m = $('msg'); m.textContent = s; m.className = ok ? 'ok' : 'err'; }
function blocca(b){ occupato = b; ['bBozza','bInvia','bAnnulla','bCarica'].forEach(function(id){ $(id).disabled = b; }); }
function controlla(){
  if (!$('fTo').value.trim()) { messaggio('Indica almeno un destinatario in "Rispondi a".', false); return false; }
  var tutti = ($('fTo').value + ',' + $('fCc').value + ',' + $('fBcc').value).split(/[,;]/).map(function(s){ return s.trim(); }).filter(String);
  var errati = tutti.filter(function(s){ return !/[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+/.test(s); });
  if (errati.length) { messaggio('Indirizzo non valido: ' + errati.join(', '), false); return false; }
  if (!ed.textContent.trim()) { messaggio('Il testo è vuoto.', false); return false; }
  return true;
}

$('bBozza').addEventListener('click', function(){
  if (occupato || !controlla()) return;
  blocca(true); messaggio('Salvataggio della bozza in Gmail…', true);
  google.script.run
    .withSuccessHandler(function(r){ draftId = r.draftId; modificato = false; blocca(false); messaggio('Bozza salvata in Gmail il ' + r.ora + '. La ritrovi in Gmail › Bozze o riaprendo questo editor dal menu CFU.', true); })
    .withFailureHandler(function(e){ blocca(false); messaggio('Bozza non salvata: ' + e.message, false); })
    .salvaBozzaRisposta(dati());
});

$('bInvia').addEventListener('click', function(){
  if (occupato || !controlla()) return;
  var all = scelti.length ? scelti.map(function(id){ return FILES[id].nome; }).join(', ') : 'nessuno';
  var dest = [$('fTo').value, $('fCc').value, $('fBcc').value ? 'Ccn: ' + $('fBcc').value : ''].filter(String).join(', ');
  if (!confirm('Inviare la mail?\\n\\nA/Cc: ' + dest + '\\nAllegati: ' + all)) return;
  blocca(true); messaggio('Invio in corso…', true);
  google.script.run
    .withSuccessHandler(function(){ modificato = false; messaggio('Mail inviata.', true); setTimeout(function(){ google.script.host.close(); }, 1800); })
    .withFailureHandler(function(e){ blocca(false); messaggio('Invio non riuscito: ' + e.message, false); })
    .inviaRispostaEditor(dati());
});

$('bAnnulla').addEventListener('click', function(){
  if (occupato) return;
  if (modificato && !confirm('Chiudere senza salvare le ultime modifiche?' + (draftId ? '\\n(L\\'ultima bozza salvata resta in Gmail.)' : ''))) return;
  google.script.host.close();
});
</script>
</body></html>
`;
}
