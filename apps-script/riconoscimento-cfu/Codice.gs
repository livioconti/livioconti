/**
 * Riconoscimento CFU — componente aggiuntivo di Gmail e Google Drive
 *
 * GMAIL — con un'email "Fwd: CFU XXXX_YYYY" aperta, il pannello permette di:
 *   - scegliere la cartella di destinazione navigando in Drive (si parte da
 *     CFU_GDrive; Su / CFU_GDrive / Il mio Drive; sottocartelle; nuova cartella);
 *   - salvare gli allegati in una sottocartella proposta come CFU_YYYY_XXXX
 *     (modificabile; campo vuoto = direttamente nella cartella corrente).
 *     Se la sottocartella esiste già compare un avviso che propone di salvare
 *     in CFU_YYYY_XXXX/Revisione_NN (NN progressivo a due cifre: 02, 03, …);
 *     Nella cartella degli allegati scrive mail_riconoscimento.json con l'ID univoco della mail.
 *   - creare il file di riconoscimento come copia del template, con nome
 *     Riconoscimento_CFU_Ingegneria Gestionale_YYYY_XXXX (modificabile), e scrivere YYYY_XXXX nella
 *     Cover (intervallo COVER_COGNOME, modificabile).
 * DRIVE — selezionando la cartella dello studente, il pannello permette di
 *   creare il file di riconoscimento o aggiornare il nome nella Cover.
 *
 * AUTOMATICO (facoltativo, si attiva dal pannello) — ogni ora cerca le nuove
 *   mail con etichetta CFU o CFUpresidenza e ne salva gli allegati:
 *   - prima mail della pratica → CFU_GDrive/CFU_YYYY_XXXX (+ file di riconoscimento);
 *   - mail successive (stesso thread o nuovo thread per lo stesso studente)
 *     → CFU_YYYY_XXXX/Revisione_NN;
 *   - mail con allegati già tutti presenti → nessuna cartella, solo una nota.
 *   Le mail inviate da te e quelle arrivate prima dell'attivazione sono ignorate.
 * REGISTRO — dopo ogni salvataggio (automatico o a mano) aggiorna "Registro pratiche CFU":
 *   - pratica nuova → riga con stato "da fare", Revisione 0;
 *   - pratica esistente → Revisione aggiornata, voce in Storia e, se era
 *     "inviata" o "in attesa segreteria", stato "da rivedere".
 *   Non tocca altre colonne né le altre righe.
 *
 * Le immagini inline non vengono salvate; i file con lo stesso nome già
 * presenti nella cartella di destinazione vengono saltati.
 */

const NOME_APP = 'Riconoscimento CFU';
// Cartella di partenza: CFU_GDrive
const PARENT_FOLDER_ID = '1LxW532oEanyt9gj9_uKMoYTzppxa_q09';
const MAX_SOTTOCARTELLE = 60;
// Template del riconoscimento (in CFU_GDrive)
const TEMPLATE_ID = '1vEJQauP3J_CPiK4FfMVDzxrG3k-wcgeiP5baTb8UmyE';
const RANGE_NOME_COVER = 'COVER_COGNOME';
const PREFISSO_REVISIONE = 'Revisione_';
const PREFISSO_FILE = 'Riconoscimento_CFU_Ingegneria Gestionale_';
// File ausiliario con l'identificativo univoco della mail (letto dallo script del file di riconoscimento)
const FILE_ID_MAIL = 'mail_riconoscimento.json';

// Registro pratiche (in CFU_GDrive); le colonne sono cercate per intestazione
const AGGIORNA_REGISTRO = true;
const REGISTRO_ID = '1NjLVayRZDbbunQt5hXrvOstM0Z6IYGpRm9s_BsHn1So';
const REGISTRO_FOGLIO = 'Registro';
const COL = {
  provenienza: 'Provenienza', id: 'ID pratica', studente: 'Studente', operatore: 'Operatore',
  stato: 'Stato', revisione: 'Revisione', cartella: 'Cartella (link)',
  file: 'File riconoscimento (link)', mailId: 'Mail (messageId)',
  aggiornato: 'Ultimo aggiornamento', storia: 'Storia'
};
// "Mail (link)" è una ARRAYFORMULA in riga 1: lo script non la scrive mai
// (un valore in quella colonna la rompe con #REF!).
const STATO_NUOVA = 'da fare';
const STATO_RIAPERTA = 'da rivedere';
// Solo da questi stati una nuova mail riporta la pratica a "da rivedere"
const STATI_DA_RIAPRIRE = ['inviata', 'in attesa segreteria'];
// Nome mostrato nella colonna Operatore (altrimenti l'indirizzo email)
const OPERATORI = { 'livio.conti@uninettunouniversity.net': 'Livio Conti' };

// Scaricamento automatico
const ETICHETTE_AUTO = ['CFU', 'CFUpresidenza'];
const FUNZIONE_AUTO = 'scaricaAutomatico';
const AUTO_OGNI_ORE = 1;            // gli add-on non possono andare sotto l'ora
const AUTO_MAX_MAIL = 10;           // per esecuzione; le altre al giro successivo
const AUTO_CREA_FOGLIO = true;      // crea il file di riconoscimento per le pratiche nuove
const PROP_INIZIO = 'cfu_auto_inizio';
const PROP_FATTO = 'cfu_fatto_';    // + id del messaggio: allegati già salvati
// Per ogni modulo Word salvato (.doc con HTML interno o .docx) si scrive accanto
// <nome>_testo.txt con il testo e le tabelle (colore di sfondo incluso): il plugin
// cfu-express lo legge al posto del Word, che il connettore Drive spesso non legge.
const SUFFISSO_TESTO = '_testo.txt';

// ======================================================================
// GMAIL
// ======================================================================

/** Trigger contestuale: si attiva all'apertura di un'email. */
function onGmailMessageOpen(e) {
  const message = getCurrentMessage_(e);
  const st = estraiStudente_(message.getSubject() || '');
  return buildCard_(message, PARENT_FOLDER_ID, {
    nomeCartella: st ? st.cartella : '',
    nomeCover: st ? st.cover : '',
    nomeFile: st ? nomeFileDefault_(st.cover) : ''
  });
}

/** Legge dal form i tre campi, per conservarli durante la navigazione. */
function campi_(e) {
  return {
    nomeCartella: leggiCampo_(e, 'nomeCartella'),
    nomeCover: leggiCampo_(e, 'nomeCover'),
    nomeFile: leggiCampo_(e, 'nomeFile')
  };
}

function buildCard_(message, folderId, v) {
  const folder = DriveApp.getFolderById(folderId);
  const subject = message.getSubject() || '';
  const allegati = message.getAttachments({ includeInlineImages: false });
  const base = { messageId: message.getId(), folderId: folderId };

  // --- Email
  const secEmail = CardService.newCardSection()
    .addWidget(CardService.newDecoratedText()
      .setTopLabel('Oggetto').setText(subject || '(senza oggetto)').setWrapText(true))
    .addWidget(CardService.newDecoratedText()
      .setTopLabel('Allegati da salvare').setText(String(allegati.length)));
  if (!estraiStudente_(subject)) {
    secEmail.addWidget(CardService.newTextParagraph().setText(
      '⚠️ L\'oggetto non è del tipo "Fwd: CFU XXXX_YYYY": compila a mano i campi qui sotto.'));
  }
  if (giaFatta_(message)) {
    secEmail.addWidget(CardService.newTextParagraph().setText(
      'ℹ️ Gli allegati di questa mail sono già stati salvati (a mano o in automatico).'));
  }

  // --- Salvataggio
  const secSalva = CardService.newCardSection()
    .setHeader('Salva')
    .addWidget(CardService.newTextInput()
      .setFieldName('nomeCartella')
      .setTitle('Sottocartella da creare qui (vuoto = salva direttamente qui)')
      .setValue(v.nomeCartella || ''));
  const nomeSotto = pulisciNome_(v.nomeCartella);
  if (nomeSotto && folder.getFoldersByName(nomeSotto).hasNext()) {
    secSalva.addWidget(CardService.newTextParagraph().setText(
      '⚠️ La cartella <b>' + nomeSotto + '</b> esiste già: al salvataggio ti verrà proposta ' +
      'una sottocartella <b>' + PREFISSO_REVISIONE + 'NN</b>.'));
  }
  secSalva
    .addWidget(CardService.newDecoratedText()
      .setText('Crea anche il file di riconoscimento dal template')
      .setWrapText(true)
      .setSwitchControl(CardService.newSwitch()
        .setFieldName('creaFoglio').setValue('si').setSelected(true)))
    .addWidget(CardService.newTextInput()
      .setFieldName('nomeFile')
      .setTitle('Nome del file di riconoscimento')
      .setValue(v.nomeFile || ''))
    .addWidget(CardService.newTextInput()
      .setFieldName('nomeCover')
      .setTitle('Nome e/o cognome nella Cover del file')
      .setValue(v.nomeCover || ''))
    .addWidget(CardService.newDecoratedText()
      .setText('Aggiorna il registro delle pratiche')
      .setWrapText(true)
      .setSwitchControl(CardService.newSwitch()
        .setFieldName('aggiornaRegistro').setValue('si').setSelected(AGGIORNA_REGISTRO)))
    .addWidget(CardService.newTextButton()
      .setText('Salva allegati qui')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setDisabled(allegati.length === 0)
      .setOnClickAction(azione_('salvaAllegati', base)));

  // --- Navigazione
  const secNav = CardService.newCardSection()
    .setHeader('Destinazione')
    .addWidget(CardService.newDecoratedText()
      .setTopLabel('Cartella corrente')
      .setText('<b>' + percorso_(folder) + '</b>')
      .setWrapText(true)
      .setOpenLink(CardService.newOpenLink().setUrl(folder.getUrl())));

  const bottoni = CardService.newButtonSet();
  const parents = folder.getParents();
  if (parents.hasNext()) {
    bottoni.addButton(CardService.newTextButton().setText('⬆ Su')
      .setOnClickAction(azione_('vaiA', Object.assign({}, base, { target: parents.next().getId() }))));
  }
  bottoni.addButton(CardService.newTextButton().setText('CFU_GDrive')
    .setOnClickAction(azione_('vaiA', Object.assign({}, base, { target: PARENT_FOLDER_ID }))));
  bottoni.addButton(CardService.newTextButton().setText('Il mio Drive')
    .setOnClickAction(azione_('vaiA', Object.assign({}, base, { target: DriveApp.getRootFolder().getId() }))));
  secNav.addWidget(bottoni);

  // Sottocartelle
  const sotto = [];
  const it = folder.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    sotto.push({ id: f.getId(), nome: f.getName() });
  }
  sotto.sort(function (a, b) { return a.nome.localeCompare(b.nome, 'it'); });

  const secSotto = CardService.newCardSection()
    .setHeader('Sottocartelle (' + sotto.length + ')')
    .setCollapsible(sotto.length > 8)
    .setNumUncollapsibleWidgets(8);
  if (sotto.length === 0) {
    secSotto.addWidget(CardService.newTextParagraph().setText('<i>Nessuna sottocartella</i>'));
  }
  sotto.slice(0, MAX_SOTTOCARTELLE).forEach(function (f) {
    secSotto.addWidget(CardService.newDecoratedText()
      .setText('📁 ' + f.nome)
      .setWrapText(true)
      .setOnClickAction(azione_('vaiA', Object.assign({}, base, { target: f.id }))));
  });
  if (sotto.length > MAX_SOTTOCARTELLE) {
    secSotto.addWidget(CardService.newTextParagraph().setText(
      '… e altre ' + (sotto.length - MAX_SOTTOCARTELLE) + ' (mostrate solo le prime ' + MAX_SOTTOCARTELLE + ')'));
  }

  // --- Nuova cartella
  const secNuova = CardService.newCardSection()
    .setHeader('Nuova cartella qui')
    .addWidget(CardService.newTextInput().setFieldName('nuovaCartella').setTitle('Nome'))
    .addWidget(CardService.newTextButton().setText('Crea e apri')
      .setOnClickAction(azione_('creaCartella', base)));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(NOME_APP))
    .addSection(secEmail)
    .addSection(secSalva)
    .addSection(secNav)
    .addSection(secSotto)
    .addSection(secNuova)
    .addSection(sezioneAutomatico_(base))
    .build();
}

/** Stato e interruttore dello scaricamento automatico (vale solo per chi lo attiva). */
function sezioneAutomatico_(base) {
  const attivo = automaticoAttivo_();
  return CardService.newCardSection()
    .setHeader('Scaricamento automatico')
    .setCollapsible(true)
    .setNumUncollapsibleWidgets(1)
    .addWidget(CardService.newTextParagraph().setText(attivo
      ? '🟢 <b>Attivo</b>: ogni ora salva gli allegati delle nuove mail con etichetta ' +
        ETICHETTE_AUTO.join(' o ') + ' e aggiorna il registro.'
      : '⚪ <b>Non attivo</b>: gli allegati si salvano solo con il pulsante "Salva allegati qui".'))
    .addWidget(CardService.newTextButton()
      .setText(attivo ? 'Disattiva' : 'Attiva')
      .setOnClickAction(azione_(attivo ? 'disattivaDaCard' : 'attivaDaCard', base)));
}

function attivaDaCard(e) {
  attivaAutomatico();
  return aggiorna_(buildCard_(messageDaEvento_(e), e.parameters.folderId, campi_(e)),
    'Scaricamento automatico attivato');
}

function disattivaDaCard(e) {
  disattivaAutomatico();
  return aggiorna_(buildCard_(messageDaEvento_(e), e.parameters.folderId, campi_(e)),
    'Scaricamento automatico disattivato');
}

/** Naviga in un'altra cartella mantenendo i campi digitati. */
function vaiA(e) {
  const message = messageDaEvento_(e);
  return aggiorna_(buildCard_(message, e.parameters.target, campi_(e)));
}

/** Crea una cartella nella cartella corrente ed entra. */
function creaCartella(e) {
  const nome = pulisciNome_(leggiCampo_(e, 'nuovaCartella'));
  if (!nome) return notifica_('Scrivi il nome della nuova cartella.');
  const corrente = DriveApp.getFolderById(e.parameters.folderId);
  const nuova = trovaOCreaCartella_(corrente, nome);
  const message = messageDaEvento_(e);
  return aggiorna_(buildCard_(message, nuova.getId(), campi_(e)), 'Cartella "' + nome + '" pronta');
}

/**
 * Pulsante "Salva allegati qui".
 * Se la sottocartella esiste già, mostra l'avviso con la proposta Revisione_NN.
 */
function salvaAllegati(e) {
  const corrente = DriveApp.getFolderById(e.parameters.folderId);
  const v = campi_(e);
  const nomeSotto = pulisciNome_(v.nomeCartella);
  const creaFoglio = leggiCampo_(e, 'creaFoglio') === 'si';
  const registro = leggiCampo_(e, 'aggiornaRegistro') === 'si';

  if (nomeSotto) {
    const it = corrente.getFoldersByName(nomeSotto);
    if (it.hasNext()) {
      const esistente = it.next();
      return aggiorna_(cardRevisione_(e, corrente, esistente, v, creaFoglio, registro),
        'La cartella ' + nomeSotto + ' esiste già');
    }
  }
  const dest = nomeSotto ? corrente.createFolder(nomeSotto) : corrente;
  // cartella nuova = prima consegna (Revisione 0); senza sottocartella la revisione non cambia
  return eseguiSalvataggio_(e, corrente, dest, dest, v, creaFoglio,
    { registro: registro, revisione: nomeSotto ? 0 : null });
}

/** Avviso: cartella già esistente → proposta di sottocartella Revisione_NN. */
function cardRevisione_(e, corrente, esistente, v, creaFoglio, registro) {
  const proposta = prossimaRevisione_(esistente);
  const params = {
    messageId: e.parameters.messageId,
    folderId: corrente.getId(),
    esistenteId: esistente.getId(),
    nomeCartella: v.nomeCartella || '',
    nomeCover: v.nomeCover || '',
    nomeFile: v.nomeFile || '',
    creaFoglio: creaFoglio ? 'si' : 'no',
    aggiornaRegistro: registro ? 'si' : 'no'
  };
  const sec = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(
      '⚠️ La cartella <b>' + percorso_(esistente) + '</b> esiste già.<br><br>' +
      'Propongo di salvare gli allegati in una nuova sottocartella di revisione:'))
    .addWidget(CardService.newTextInput()
      .setFieldName('nomeRevisione').setTitle('Sottocartella di revisione').setValue(proposta))
    .addWidget(CardService.newTextButton()
      .setText('Salva in ' + proposta)
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(azione_('salvaInRevisione', params)))
    .addWidget(CardService.newTextButton()
      .setText('Salva comunque nella cartella esistente')
      .setOnClickAction(azione_('salvaInEsistente', params)))
    .addWidget(CardService.newTextButton()
      .setText('Annulla')
      .setOnClickAction(azione_('tornaDaParametri', params)));
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Cartella già esistente'))
    .addSection(sec)
    .build();
}

function salvaInRevisione(e) {
  const p = e.parameters;
  const corrente = DriveApp.getFolderById(p.folderId);
  const esistente = DriveApp.getFolderById(p.esistenteId);
  let nomeRev = pulisciNome_(leggiCampo_(e, 'nomeRevisione')) || prossimaRevisione_(esistente);
  // se nel frattempo esiste già, passa al numero successivo
  if (esistente.getFoldersByName(nomeRev).hasNext()) nomeRev = prossimaRevisione_(esistente);
  const dest = esistente.createFolder(nomeRev);
  return eseguiSalvataggio_(e, corrente, dest, esistente, parametriCampi_(p), p.creaFoglio === 'si',
    { registro: p.aggiornaRegistro === 'si', revisione: numeroRevisione_(nomeRev) });
}

function salvaInEsistente(e) {
  const p = e.parameters;
  const corrente = DriveApp.getFolderById(p.folderId);
  const esistente = DriveApp.getFolderById(p.esistenteId);
  return eseguiSalvataggio_(e, corrente, esistente, esistente, parametriCampi_(p), p.creaFoglio === 'si',
    { registro: p.aggiornaRegistro === 'si', revisione: null });
}

function tornaDaParametri(e) {
  const p = e.parameters;
  return aggiorna_(buildCard_(messageDaEvento_(e), p.folderId, parametriCampi_(p)));
}

function parametriCampi_(p) {
  return { nomeCartella: p.nomeCartella, nomeCover: p.nomeCover, nomeFile: p.nomeFile };
}

/**
 * Salva gli allegati in dest; il file di riconoscimento va nella cartella
 * della pratica (cartellaPratica), non nella sottocartella di revisione.
 * opz.registro: aggiorna il registro; opz.revisione: numero di revisione
 * (0 = prima consegna, null = invariato).
 */
function eseguiSalvataggio_(e, corrente, dest, cartellaPratica, v, creaFoglio, opz) {
  const message = messageDaEvento_(e);
  const esito = salvaAllegatiIn_(dest, message.getAttachments({ includeInlineImages: false }));
  const salvati = esito.salvati, saltati = esito.saltati;
  const idMail = scriviIdMail_(dest, message);
  segnaFatta_(message);
  const r = creaFoglio ? creaFoglioRiconoscimento_(cartellaPratica, v.nomeFile, v.nomeCover) : null;
  const esitoRegistro = opz.registro ? registraArrivo_(message, {
    cartellaPratica: cartellaPratica, foglio: r && r.file, salvati: salvati,
    studente: pulisciNome_(v.nomeCover), revisione: opz.revisione
  }) : '';

  const sec = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(
      'Cartella: <b>' + percorso_(dest) + '</b><br>' +
      'Allegati salvati: <b>' + salvati + '</b>' +
      (saltati ? '<br>Già presenti (saltati): ' + saltati : '') +
      (idMail ? '<br>ID mail registrato in <b>' + FILE_ID_MAIL + '</b>' : '<br>⚠️ ID mail non registrato')))
    .addWidget(CardService.newTextButton().setText('Apri la cartella')
      .setOpenLink(CardService.newOpenLink().setUrl(dest.getUrl())));

  if (esitoRegistro) sec.addWidget(CardService.newTextParagraph().setText(esitoRegistro));

  if (r) {
    sec.addWidget(CardService.newTextParagraph().setText(
      (r.nuovo ? 'File di riconoscimento creato: ' : 'File di riconoscimento già presente (non modificato): ') +
      '<b>' + r.file.getName() + '</b>' + (r.nuovo ? '<br>' + r.esitoCover : '')))
      .addWidget(CardService.newTextButton().setText('Apri il file di riconoscimento')
        .setOpenLink(CardService.newOpenLink().setUrl(r.file.getUrl())));
  }

  sec.addWidget(CardService.newTextButton().setText('↩ Torna indietro')
    .setOnClickAction(azione_('tornaDaParametri', {
      messageId: message.getId(), folderId: corrente.getId(),
      nomeCartella: v.nomeCartella || '', nomeCover: v.nomeCover || '', nomeFile: v.nomeFile || ''
    })));

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Fatto'))
    .addSection(sec)
    .build();
  return aggiorna_(card, salvati + ' allegati salvati');
}

/**
 * Scrive nella cartella degli allegati il file FILE_ID_MAIL con l'identificativo univoco della mail.
 * - gmailMessageId: id Gmail del singolo messaggio; GmailApp.getMessageById(id) restituisce
 *   esattamente quel messaggio (non è una ricerca per oggetto o mittente).
 * - rfcMessageId: header Message-ID (RFC 5322), univoco a livello globale; serve come verifica.
 * Se il file esiste già viene sovrascritto (vale l'ultima mail salvata in quella cartella).
 */
function scriviIdMail_(cartella, message) {
  let rfc = '';
  try { rfc = message.getHeader('Message-ID') || ''; } catch (err) { rfc = ''; }
  const dati = {
    gmailMessageId: message.getId(),
    rfcMessageId: rfc,
    oggetto: message.getSubject() || '',
    mittente: message.getFrom() || '',
    dataMail: message.getDate().toISOString(),
    salvatoIl: new Date().toISOString()
  };
  const testo = JSON.stringify(dati, null, 2);
  try {
    const it = cartella.getFilesByName(FILE_ID_MAIL);
    if (it.hasNext()) it.next().setContent(testo);
    else cartella.createFile(FILE_ID_MAIL, testo, MimeType.PLAIN_TEXT);
    return dati;
  } catch (err) {
    return null;
  }
}

/** Revisione_02, Revisione_03, … : primo numero libero dopo il massimo esistente (si parte da 02). */
function prossimaRevisione_(cartella) {
  let max = 1; // la prima revisione è la 02
  const it = cartella.getFolders();
  const re = new RegExp('^' + PREFISSO_REVISIONE + '(\\d+)$', 'i');
  while (it.hasNext()) {
    const m = it.next().getName().match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return PREFISSO_REVISIONE + String(max + 1).padStart(2, '0');
}

// ======================================================================
// FILE DI RICONOSCIMENTO
// ======================================================================

/**
 * Copia il template nella cartella della pratica, se non c'è già un file con
 * quel nome, e scrive il nome dello studente in COVER_COGNOME.
 * Nome predefinito: Riconoscimento_CFU_Ingegneria Gestionale_YYYY_XXXX.
 * La copia porta con sé lo script del foglio (menu, Svuota pratica, onEdit).
 */
function creaFoglioRiconoscimento_(cartella, nomeFile, nomeCover) {
  const template = DriveApp.getFileById(TEMPLATE_ID);
  const nome = pulisciNome_(nomeFile) || nomeFileDefault_(nomeCover);
  const esistenti = cartella.getFilesByName(nome);
  if (esistenti.hasNext()) return { file: esistenti.next(), nuovo: false };
  const copia = template.makeCopy(nome, cartella);
  return { file: copia, nuovo: true, esitoCover: scriviCover_(copia.getId(), nomeCover) };
}

/** "Riconoscimento_CFU_Ingegneria Gestionale_YYYY_XXXX" */
function nomeFileDefault_(nomeCover) {
  const n = pulisciNome_(nomeCover);
  return n ? PREFISSO_FILE + n : PREFISSO_FILE.replace(/_$/, '');
}

/** Scrive il nome nell'intervallo COVER_COGNOME; restituisce un messaggio. */
function scriviCover_(fileId, nomeCover) {
  const val = pulisciNome_(nomeCover);
  if (!val) return 'Cover: nessun nome scritto (campo vuoto).';
  try {
    const range = SpreadsheetApp.openById(fileId).getRangeByName(RANGE_NOME_COVER);
    if (!range) return '⚠️ Intervallo ' + RANGE_NOME_COVER + ' non trovato: nome non scritto.';
    range.setValue(val);
    return 'Cover: <b>' + val + '</b> scritto in ' + RANGE_NOME_COVER + '.';
  } catch (err) {
    return '⚠️ Nome non scritto nella Cover: ' + err.message;
  }
}

/** Dal nome della cartella: "CFU_TORRINI_FLAVIO" -> "TORRINI_FLAVIO" (YYYY_XXXX). */
function nomeCoverDa_(nomeCartella) {
  return String(nomeCartella || '').replace(/^CFU_/i, '');
}

function trovaFoglio_(cartella, nome) {
  const it = cartella.getFilesByName(nome);
  return it.hasNext() ? it.next() : null;
}

// ======================================================================
// GOOGLE DRIVE
// ======================================================================

/** Pagina iniziale del componente in Drive. */
function onDriveHomepage(e) {
  return cardDrive_(null);
}

/** Quando selezioni una cartella in Drive. */
function onDriveItemsSelected(e) {
  const items = (e.drive && e.drive.selectedItems) || [];
  const cartella = items.filter(function (i) {
    return i.mimeType === 'application/vnd.google-apps.folder';
  })[0];
  return cardDrive_(cartella ? DriveApp.getFolderById(cartella.id) : null);
}

function cardDrive_(cartella) {
  const sec = CardService.newCardSection();
  if (!cartella) {
    sec.addWidget(CardService.newTextParagraph().setText(
      'Seleziona (un clic, senza aprirla) la cartella dello studente, ' +
      'es. <b>CFU_TORRINI_FLAVIO</b>, per creare lì il file di riconoscimento.'));
  } else {
    const nomeCover = nomeCoverDa_(cartella.getName());
    const nomeFile = nomeFileDefault_(nomeCover);
    const esistente = trovaFoglio_(cartella, nomeFile);
    const params = { folderId: cartella.getId() };
    sec.addWidget(CardService.newDecoratedText()
        .setTopLabel('Cartella').setText('<b>' + percorso_(cartella) + '</b>').setWrapText(true))
      .addWidget(CardService.newTextInput()
        .setFieldName('nomeCover').setTitle('Nome e/o cognome nella Cover').setValue(nomeCover))
      .addWidget(CardService.newTextInput()
        .setFieldName('nomeFile').setTitle('Nome del file').setValue(nomeFile));
    if (esistente) {
      sec.addWidget(CardService.newTextParagraph().setText('Il file di riconoscimento esiste già in questa cartella.'))
        .addWidget(CardService.newButtonSet()
          .addButton(CardService.newTextButton().setText('Apri il file')
            .setOpenLink(CardService.newOpenLink().setUrl(esistente.getUrl())))
          .addButton(CardService.newTextButton().setText('Aggiorna nome nella Cover')
            .setOnClickAction(azione_('aggiornaCoverDaDrive', params))));
    } else {
      sec.addWidget(CardService.newTextButton()
        .setText('Crea file di riconoscimento')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(azione_('creaDaDrive', params)));
    }
  }
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(NOME_APP))
    .addSection(sec)
    .build();
}

function creaDaDrive(e) {
  const cartella = DriveApp.getFolderById(e.parameters.folderId);
  const r = creaFoglioRiconoscimento_(cartella, leggiCampo_(e, 'nomeFile'), leggiCampo_(e, 'nomeCover'));
  return aggiorna_(cardEsitoDrive_(cartella, r.file,
    r.nuovo ? 'File creato' : 'File già presente', r.nuovo ? r.esitoCover : ''),
    r.nuovo ? 'File di riconoscimento creato' : 'Il file esisteva già');
}

function aggiornaCoverDaDrive(e) {
  const cartella = DriveApp.getFolderById(e.parameters.folderId);
  const nomeCover = leggiCampo_(e, 'nomeCover');
  const nomeFile = pulisciNome_(leggiCampo_(e, 'nomeFile')) || nomeFileDefault_(nomeCover);
  const file = trovaFoglio_(cartella, nomeFile);
  if (!file) return notifica_('File "' + nomeFile + '" non trovato nella cartella.');
  const esito = scriviCover_(file.getId(), nomeCover);
  return aggiorna_(cardEsitoDrive_(cartella, file, 'Cover aggiornata', esito), 'Cover aggiornata');
}

function cardEsitoDrive_(cartella, file, titolo, esito) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(titolo))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(
        '<b>' + file.getName() + '</b><br>in ' + percorso_(cartella) + (esito ? '<br>' + esito : '')))
      .addWidget(CardService.newTextButton().setText('Apri il file')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOpenLink(CardService.newOpenLink().setUrl(file.getUrl()))))
    .build();
}

// ======================================================================
// SCARICAMENTO AUTOMATICO
// ======================================================================

/** Attiva il controllo orario; considera solo le mail arrivate da adesso in poi. */
function attivaAutomatico() {
  disattivaAutomatico();
  PropertiesService.getUserProperties().setProperty(PROP_INIZIO, String(Date.now()));
  ScriptApp.newTrigger(FUNZIONE_AUTO).timeBased().everyHours(AUTO_OGNI_ORE).create();
}

function disattivaAutomatico() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === FUNZIONE_AUTO) ScriptApp.deleteTrigger(t);
  });
}

function automaticoAttivo_() {
  return ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === FUNZIONE_AUTO;
  });
}

/**
 * Eseguita dal trigger orario. Una mail che va in errore non viene segnata
 * come fatta e viene ritentata al giro successivo.
 */
function scaricaAutomatico() {
  const lock = LockService.getUserLock();
  if (!lock.tryLock(1000)) return; // un'altra esecuzione è ancora in corso
  try {
    const props = PropertiesService.getUserProperties();
    const inizio = Number(props.getProperty(PROP_INIZIO)) || Date.now();
    const io = emailUtente_();
    const query = '{' + ETICHETTE_AUTO.map(function (l) { return 'label:' + l; }).join(' ') + '}' +
      ' has:attachment after:' + Math.floor(inizio / 1000);
    const avvio = Date.now();
    let fatte = 0;
    const threads = GmailApp.search(query, 0, 50);
    for (let i = 0; i < threads.length; i++) {
      const messaggi = threads[i].getMessages();
      for (let j = 0; j < messaggi.length; j++) {
        if (fatte >= AUTO_MAX_MAIL || Date.now() - avvio > 4 * 60 * 1000) return;
        const m = messaggi[j];
        if (m.getDate().getTime() < inizio || m.isInTrash() || giaFatta_(m)) continue;
        if (io && m.getFrom().toLowerCase().indexOf(io) >= 0) continue; // le tue risposte
        const allegati = m.getAttachments({ includeInlineImages: false });
        if (!allegati.length) { segnaFatta_(m); continue; }
        try {
          console.log(m.getSubject() + ': ' + archiviaAutomatico_(m, allegati));
          segnaFatta_(m);
          fatte++;
        } catch (err) {
          console.error('Errore su "' + m.getSubject() + '": ' + err.message);
        }
      }
    }
  } finally {
    lock.releaseLock();
  }
}

/** Salva gli allegati di una mail nella cartella della pratica e aggiorna il registro. */
function archiviaAutomatico_(message, allegati) {
  const st = estraiStudente_(message.getSubject()) ||
    estraiStudente_(message.getThread().getFirstMessageSubject());
  const nomeCartella = st ? st.cartella
    : 'CFU_DA_SMISTARE_' + pulisciNome_(message.getSubject()).slice(0, 60);
  const radice = DriveApp.getFolderById(PARENT_FOLDER_ID);
  const it = radice.getFoldersByName(nomeCartella);
  let pratica = it.hasNext() ? it.next() : null;
  const studente = st ? st.cover : '';

  if (pratica && salvataNelDrive_(pratica, message)) return 'già salvata in ' + pratica.getName();

  let dest, revisione;
  if (!pratica) {
    pratica = radice.createFolder(nomeCartella);
    dest = pratica;
    revisione = 0;
  } else if (tuttiGiaPresenti_(pratica, allegati)) {
    registraArrivo_(message, { cartellaPratica: pratica, salvati: 0, studente: studente, duplicata: true });
    return 'allegati già presenti in ' + pratica.getName();
  } else {
    const nomeRev = prossimaRevisione_(pratica);
    dest = pratica.createFolder(nomeRev);
    revisione = numeroRevisione_(nomeRev);
  }

  const esito = salvaAllegatiIn_(dest, allegati);
  scriviIdMail_(dest, message);
  const foglio = revisione === 0 && AUTO_CREA_FOGLIO && st
    ? creaFoglioRiconoscimento_(pratica, '', studente).file : null;
  registraArrivo_(message, {
    cartellaPratica: pratica, foglio: foglio, salvati: esito.salvati,
    studente: studente, revisione: revisione
  });
  return esito.salvati + ' allegati in ' + percorso_(dest);
}

/** Salva i blob in dest saltando i nomi già presenti. */
function salvaAllegatiIn_(dest, allegati) {
  let salvati = 0, saltati = 0;
  allegati.forEach(function (a) {
    const nomeFile = a.getName();
    if (dest.getFilesByName(nomeFile).hasNext()) { saltati++; return; }
    dest.createFile(a.copyBlob()).setName(nomeFile);
    salvati++;
    scriviTestoModulo_(dest, a.copyBlob(), nomeFile);
  });
  return { salvati: salvati, saltati: saltati };
}

/**
 * Da eseguire una volta dall'editor: crea <nome>_testo.txt per i moduli Word già
 * salvati nelle cartelle CFU_* di CFU_GDrive (e nelle loro Revisione_NN).
 */
function creaTestiModuliEsistenti() {
  let creati = 0;
  const it = DriveApp.getFolderById(PARENT_FOLDER_ID).getFolders();
  while (it.hasNext()) {
    const pratica = it.next();
    if (!/^CFU_/i.test(pratica.getName())) continue;
    cartelleDellaPratica_(pratica).forEach(function (c) {
      const files = c.getFiles();
      while (files.hasNext()) {
        const f = files.next();
        if (scriviTestoModulo_(c, f.getBlob(), f.getName())) creati++;
      }
    });
  }
  console.log('Testi dei moduli creati: ' + creati);
}

/**
 * Se il file è un Word con dentro HTML (i .doc dei moduli di richiesta sono zip con
 * word/afchunk.htm) o un .docx, scrive <nome>_testo.txt nella stessa cartella.
 * Un .doc binario vecchio stile non si legge: in quel caso non scrive nulla.
 */
function scriviTestoModulo_(dest, blob, nome) {
  if (!/\.docx?$/i.test(nome)) return false;
  const nomeTxt = nome.replace(/\.docx?$/i, '') + SUFFISSO_TESTO;
  if (dest.getFilesByName(nomeTxt).hasNext()) return false;
  let testo = '';
  try {
    const parti = {};
    Utilities.unzip(blob.setContentType('application/zip')).forEach(function (p) { parti[p.getName()] = p; });
    if (parti['word/afchunk.htm']) {
      const grezzo = parti['word/afchunk.htm'];
      const prova = grezzo.getDataAsString('windows-1252');
      const utf8 = /charset\s*=\s*["']?utf-8/i.test(prova);
      testo = testoDaHtml_(utf8 ? grezzo.getDataAsString('UTF-8') : prova);
    } else if (parti['word/document.xml']) {
      testo = testoDaDocx_(parti['word/document.xml'].getDataAsString('UTF-8'));
    }
  } catch (err) {
    return false;
  }
  if (!testo) return false;
  dest.createFile(nomeTxt, testo, MimeType.PLAIN_TEXT);
  return true;
}

/** Testo dell'HTML di un modulo; le tabelle diventano righe "a | b | c" con il colore di sfondo. */
function testoDaHtml_(h) {
  h = h.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '');
  let n = 0;
  h = h.replace(/<table[\s\S]*?<\/table>/gi, function (t) {
    n++;
    const unite = [];
    const righe = (t.match(/<tr[\s\S]*?<\/tr>/gi) || []).map(function (r, k) {
      return (r.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(function (c) {
        const sp = c.match(/^<t[dh][^>]*\b(colspan|rowspan)\s*=\s*["']?(\d+)/i);
        if (sp && +sp[2] > 1) unite.push('esame ' + k + ' con celle unite (' + sp[1].toLowerCase() + '=' + sp[2] + ')');
        return pulisciTesto_(c.replace(/<[^>]+>/g, ' '));
      });
    });
    return tabellaTesto_(n, coloreSfondo_(t), righe, unite);
  });
  return righeTesto_(decodificaHtml_(h.replace(/<(br|\/p|\/div|\/h\d|\/li)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')));
}

/** Testo del document.xml di un .docx, con le tabelle come in testoDaHtml_. */
function testoDaDocx_(xml) {
  const testoP = function (frammento) {
    return (frammento.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(function (p) {
      return (p.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g) || []).map(function (t) {
        return t.replace(/<[^>]+>/g, '');
      }).join('');
    });
  };
  let n = 0;
  const corpo = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, function (t) {
    n++;
    const fill = (t.match(/<w:shd [^>]*w:fill="([0-9A-Fa-f]{6})"/) || [])[1];
    const unite = [];
    const righe = (t.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []).map(function (r, k) {
      return (r.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(function (c) {
        if (/<w:gridSpan w:val="([2-9]|\d\d)"|<w:vMerge/.test(c)) unite.push('esame ' + k + ' con celle unite');
        return pulisciTesto_(decodificaHtml_(testoP(c).join(' ')));
      });
    });
    return '<w:p><w:t>' + tabellaTesto_(n, fill ? '#' + fill : '', righe, unite).replace(/\n/g, '</w:t></w:p><w:p><w:t>') + '</w:t></w:p>';
  });
  return righeTesto_(decodificaHtml_(testoP(corpo).join('\n')));
}

function tabellaTesto_(n, colore, righe, unite) {
  // via le righe vuote e quelle dei moduli con il solo numero progressivo
  const piene = righe.filter(function (r) {
    const altre = r.slice(1).some(function (c) { return c; });
    return altre || (r[0] && !/^\d+$/.test(r[0]));
  });
  return '\n[TABELLA ' + n + (colore ? ' · sfondo ' + colore.toLowerCase() : '') + ']\n' +
    piene.map(function (r) { return r.join(' | '); }).join('\n') + '\n[FINE TABELLA ' + n + ']\n' +
    (unite || []).filter(function (u, i, a) { return a.indexOf(u) === i; })
      .map(function (u) { return '[ATTENZIONE TABELLA ' + n + ': ' + u + ']\n'; }).join('');
}

function coloreSfondo_(html) {
  const m = html.match(/(?:bgcolor|background(?:-color)?)\s*[:=]\s*["']?#?([0-9A-Fa-f]{6})/i);
  return m ? '#' + m[1] : '';
}

function pulisciTesto_(t) {
  return decodificaHtml_(t).replace(/[\s\u00a0]+/g, ' ').trim();
}

function righeTesto_(t) {
  return t.split('\n').map(function (r) { return r.replace(/[ \t\u00a0]+/g, ' ').trim(); })
    .filter(function (r) { return r; }).join('\n');
}

function decodificaHtml_(t) {
  const nomi = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘',
    rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', agrave: 'à', egrave: 'è', eacute: 'é', igrave: 'ì',
    ograve: 'ò', ugrave: 'ù', Agrave: 'À', Egrave: 'È', Eacute: 'É', Igrave: 'Ì', Ograve: 'Ò', Ugrave: 'Ù' };
  return String(t)
    .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(parseInt(d, 10)); })
    .replace(/&([a-zA-Z]+);/g, function (m, k) { return nomi.hasOwnProperty(k) ? nomi[k] : m; });
}

/** Cartella della pratica e sue sottocartelle Revisione_NN. */
function cartelleDellaPratica_(pratica) {
  const cartelle = [pratica];
  const re = new RegExp('^' + PREFISSO_REVISIONE + '\\d+$', 'i');
  const it = pratica.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    if (re.test(f.getName())) cartelle.push(f);
  }
  return cartelle;
}

/** true se un mail_riconoscimento.json della pratica riporta già questa mail. */
function salvataNelDrive_(pratica, message) {
  let rfc = '';
  try { rfc = message.getHeader('Message-ID') || ''; } catch (err) { rfc = ''; }
  return cartelleDellaPratica_(pratica).some(function (c) {
    const it = c.getFilesByName(FILE_ID_MAIL);
    if (!it.hasNext()) return false;
    try {
      const d = JSON.parse(it.next().getBlob().getDataAsString());
      return d.gmailMessageId === message.getId() || (rfc && d.rfcMessageId === rfc);
    } catch (err) {
      return false;
    }
  });
}

/** true se ogni allegato (stesso nome e dimensione) è già nella pratica. */
function tuttiGiaPresenti_(pratica, allegati) {
  const presenti = {};
  cartelleDellaPratica_(pratica).forEach(function (c) {
    const it = c.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      presenti[f.getName() + '|' + f.getSize()] = true;
    }
  });
  return allegati.every(function (a) { return presenti[a.getName() + '|' + a.getSize()]; });
}

function giaFatta_(message) {
  return !!PropertiesService.getUserProperties().getProperty(PROP_FATTO + message.getId());
}

function segnaFatta_(message) {
  PropertiesService.getUserProperties().setProperty(PROP_FATTO + message.getId(), String(Date.now()));
}

/** "Revisione_03" -> 2 (Revisione_02 è la prima revisione dopo la consegna 0). */
function numeroRevisione_(nome) {
  const m = String(nome).match(new RegExp('^' + PREFISSO_REVISIONE + '(\\d+)$', 'i'));
  return m ? parseInt(m[1], 10) - 1 : null;
}

// ======================================================================
// REGISTRO
// ======================================================================

/**
 * Aggiorna il registro dopo un salvataggio. Scrive solo: una riga nuova, oppure
 * Revisione, Stato (solo da inviata / in attesa segreteria), Storia, Ultimo
 * aggiornamento e i link mancanti della riga della pratica.
 * info: { cartellaPratica, foglio, salvati, studente, revisione (0 | n | null), duplicata }
 * Restituisce un messaggio per il pannello.
 */
function registraArrivo_(message, info) {
  if (!AGGIORNA_REGISTRO) return '';
  const reg = apriRegistro_();
  if (!reg) return '⚠️ Registro non raggiungibile: non aggiornato.';
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return '⚠️ Registro occupato: non aggiornato, riprova.';
  try {
    const c = reg.col, sh = reg.sh;
    const threadId = message.getThread().getId();
    const ora = new Date();
    const prov = provenienza_(message);
    const dett = '(mail ' + prov + ' del ' + data_(message.getDate(), 'dd/MM') +
      (info.duplicata ? ', allegati già presenti' : ', ' + info.salvati + ' allegati') + ')';
    const p = trovaPratica_(reg, threadId, info.studente);

    if (!p) {
      const rev = info.revisione || 0;
      const id = prossimoIdPratica_(reg, ora);
      // riga dopo l'ultima con Studente o ID: getLastRow() non serve, la
      // ARRAYFORMULA di "Mail (link)" fa sembrare piene tutte le righe
      const nuova = ultimaRigaDati_(reg) + 1;
      const metti = function (k, val) { if (c[k]) sh.getRange(nuova, c[k]).setValue(val); };
      metti('provenienza', prov);
      metti('id', id);
      metti('studente', info.studente || pulisciNome_(message.getSubject()));
      metti('operatore', OPERATORI[emailUtente_()] || emailUtente_());
      metti('stato', STATO_NUOVA);
      metti('revisione', rev);
      metti('cartella', info.cartellaPratica.getUrl());
      metti('file', info.foglio ? info.foglio.getUrl() : '');
      metti('mailId', threadId);
      metti('aggiornato', data_(ora));
      metti('storia', 'Rev ' + rev + ' arrivata ' + data_(ora, 'dd/MM HH:mm') + ' ' + dett);
      return 'Registro: nuova pratica <b>' + id + '</b>, stato "' + STATO_NUOVA + '".';
    }

    const val = function (k) { return c[k] ? p.valori[c[k] - 1] : ''; };
    const scrivi = function (k, v) { if (c[k]) sh.getRange(p.riga, c[k]).setValue(v); };
    const revAtt = Number(val('revisione')) || 0;
    const rev = info.revisione == null ? revAtt : Math.max(info.revisione, revAtt);
    const statoAtt = String(val('stato')).trim();
    const riapri = !info.duplicata && STATI_DA_RIAPRIRE.indexOf(statoAtt) >= 0;
    const voce = (info.duplicata ? 'Mail ripetuta '
      : info.revisione == null ? 'Rev ' + rev + ' allegati aggiunti '
      : 'Rev ' + rev + ' arrivata ') +
      data_(ora, 'dd/MM HH:mm') + ' ' + dett + (riapri ? ' → ' + STATO_RIAPERTA : '');
    const storia = String(val('storia') || '').trim();
    scrivi('storia', storia ? storia + ' · ' + voce : voce);
    if (rev !== revAtt) scrivi('revisione', rev);
    if (riapri) scrivi('stato', STATO_RIAPERTA);
    if (!val('cartella')) scrivi('cartella', info.cartellaPratica.getUrl());
    if (!val('file') && info.foglio) scrivi('file', info.foglio.getUrl());
    scrivi('aggiornato', data_(ora));
    return 'Registro: pratica <b>' + val('id') + '</b> aggiornata' +
      (riapri ? ', stato "' + STATO_RIAPERTA + '"' : ' (stato "' + statoAtt + '" invariato)') + '.';
  } catch (err) {
    return '⚠️ Registro non aggiornato: ' + err.message;
  } finally {
    lock.releaseLock();
  }
}

/** { sh, col: {chiave: n. colonna}, nCol } oppure null se il registro non è utilizzabile. */
function apriRegistro_() {
  try {
    const sh = SpreadsheetApp.openById(REGISTRO_ID).getSheetByName(REGISTRO_FOGLIO);
    if (!sh) return null;
    const nCol = sh.getLastColumn();
    const intest = sh.getRange(1, 1, 1, nCol).getValues()[0].map(function (h) { return String(h).trim(); });
    const col = {};
    Object.keys(COL).forEach(function (k) {
      const i = intest.indexOf(COL[k]);
      if (i >= 0) col[k] = i + 1;
    });
    if (!col.studente || !col.stato || !col.mailId) return null;
    return { sh: sh, col: col, nCol: nCol };
  } catch (err) {
    console.warn('Registro non raggiungibile: ' + err.message);
    return null;
  }
}

/**
 * Riga della pratica: prima per thread (colonna Mail), poi per studente
 * (ultima riga non annullata). null se non c'è.
 */
function trovaPratica_(reg, threadId, studente) {
  const ultima = ultimaRigaDati_(reg);
  if (ultima < 2) return null;
  const dati = reg.sh.getRange(2, 1, ultima - 1, reg.nCol).getValues();
  const c = reg.col;
  const stud = String(studente || '').trim().toUpperCase();
  let perStudente = null;
  for (let i = dati.length - 1; i >= 0; i--) {
    const r = dati[i];
    if (String(r[c.mailId - 1]).trim() === threadId) return { riga: i + 2, valori: r };
    if (!perStudente && stud &&
        String(r[c.studente - 1]).trim().toUpperCase() === stud &&
        String(r[c.stato - 1]).trim() !== 'annullata') {
      perStudente = { riga: i + 2, valori: r };
    }
  }
  return perStudente;
}

/** CFU-AAAA-NNN successivo al massimo dell'anno. */
function prossimoIdPratica_(reg, ora) {
  const anno = data_(ora, 'yyyy');
  let max = 0;
  const ultima = ultimaRigaDati_(reg);
  if (reg.col.id && ultima >= 2) {
    reg.sh.getRange(2, reg.col.id, ultima - 1, 1).getValues().forEach(function (r) {
      const m = String(r[0]).match(/^CFU-(\d{4})-(\d+)$/);
      if (m && m[1] === anno) max = Math.max(max, parseInt(m[2], 10));
    });
  }
  return 'CFU-' + anno + '-' + String(max + 1).padStart(3, '0');
}

function provenienza_(message) {
  const da = String(message.getFrom()).toLowerCase();
  if (da.indexOf('presidenza.ingegneria@') >= 0) return 'presidenza.ingegneria@';
  if (da.indexOf('cfu@') >= 0) return 'cfu@';
  return da.replace(/^.*</, '').replace(/>.*$/, '');
}

/** Ultima riga con Studente o ID pratica compilati (1 se il registro è vuoto). */
function ultimaRigaDati_(reg) {
  const n = reg.sh.getMaxRows();
  if (n < 2) return 1;
  const cols = [reg.col.studente, reg.col.id].filter(Boolean);
  let ultima = 1;
  cols.forEach(function (c) {
    const v = reg.sh.getRange(2, c, n - 1, 1).getValues();
    for (let i = v.length - 1; i >= 0; i--) {
      if (String(v[i][0]).trim() !== '') { ultima = Math.max(ultima, i + 2); break; }
    }
  });
  return ultima;
}

function emailUtente_() {
  try { return String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (err) { return ''; }
}

function data_(d, formato) {
  return Utilities.formatDate(d, 'Europe/Rome', formato || 'dd/MM/yyyy HH:mm');
}

// ======================================================================
// UTILITÀ
// ======================================================================

function getCurrentMessage_(e) {
  GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
  return GmailApp.getMessageById(e.gmail.messageId);
}

function messageDaEvento_(e) {
  GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
  return GmailApp.getMessageById(e.parameters.messageId);
}

function azione_(fn, params) {
  return CardService.newAction().setFunctionName(fn).setParameters(params);
}

function leggiCampo_(e, nome) {
  const f = (e.commonEventObject && e.commonEventObject.formInputs || {})[nome];
  return f && f.stringInputs ? (f.stringInputs.value[0] || '') : '';
}

function aggiorna_(card, testoNotifica) {
  const r = CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(card));
  if (testoNotifica) r.setNotification(CardService.newNotification().setText(testoNotifica));
  return r.build();
}

function notifica_(testo) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(testo))
    .build();
}

/** Percorso leggibile, es. "Il mio Drive / CFU_GDrive / CFU_Rossi_Mario". */
function percorso_(folder) {
  const nomi = [folder.getName()];
  let f = folder;
  for (let i = 0; i < 12; i++) {
    const p = f.getParents();
    if (!p.hasNext()) break;
    f = p.next();
    nomi.unshift(f.getName());
  }
  return nomi.join(' / ');
}

/**
 * "Fwd: CFU XXXX_YYYY" -> { cartella: "CFU_YYYY_XXXX", cover: "YYYY_XXXX" }
 * es. "Fwd: CFU FLAVIO_TORRINI" -> cartella "CFU_TORRINI_FLAVIO", cover "TORRINI_FLAVIO".
 * Spazi, accenti e apostrofi vengono mantenuti. Il separatore tra XXXX e YYYY
 * è il primo "_" dopo "CFU ". Qualsiasi testo prima di "CFU " è ignorato
 * (Fwd:, Re:, "Ingegneria Gestionale_Fwd: " delle mail della presidenza, …).
 * Restituisce null se l'oggetto non ha quel formato.
 */
function estraiStudente_(subject) {
  const s = String(subject).normalize('NFC');
  const m = s.match(/(?:^|[\s:_])CFU\s+([^_]+?)\s*_\s*(.+?)\s*$/i);
  if (!m) return null;
  const xxxx = pulisciNome_(m[1]);
  const yyyy = pulisciNome_(m[2]);
  if (!xxxx || !yyyy) return null;
  return { cartella: 'CFU_' + yyyy + '_' + xxxx, cover: yyyy + '_' + xxxx };
}

/** Toglie solo i caratteri problematici; conserva spazi, accenti e apostrofi. */
function pulisciNome_(nome) {
  return String(nome || '').normalize('NFC')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function trovaOCreaCartella_(parent, nome) {
  const it = parent.getFoldersByName(nome);
  return it.hasNext() ? it.next() : parent.createFolder(nome);
}
