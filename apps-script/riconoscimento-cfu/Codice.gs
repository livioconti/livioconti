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
    .build();
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

  if (nomeSotto) {
    const it = corrente.getFoldersByName(nomeSotto);
    if (it.hasNext()) {
      const esistente = it.next();
      return aggiorna_(cardRevisione_(e, corrente, esistente, v, creaFoglio),
        'La cartella ' + nomeSotto + ' esiste già');
    }
  }
  const dest = nomeSotto ? corrente.createFolder(nomeSotto) : corrente;
  return eseguiSalvataggio_(e, corrente, dest, dest, v, creaFoglio);
}

/** Avviso: cartella già esistente → proposta di sottocartella Revisione_NN. */
function cardRevisione_(e, corrente, esistente, v, creaFoglio) {
  const proposta = prossimaRevisione_(esistente);
  const params = {
    messageId: e.parameters.messageId,
    folderId: corrente.getId(),
    esistenteId: esistente.getId(),
    nomeCartella: v.nomeCartella || '',
    nomeCover: v.nomeCover || '',
    nomeFile: v.nomeFile || '',
    creaFoglio: creaFoglio ? 'si' : 'no'
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
  return eseguiSalvataggio_(e, corrente, dest, esistente, parametriCampi_(p), p.creaFoglio === 'si');
}

function salvaInEsistente(e) {
  const p = e.parameters;
  const corrente = DriveApp.getFolderById(p.folderId);
  const esistente = DriveApp.getFolderById(p.esistenteId);
  return eseguiSalvataggio_(e, corrente, esistente, esistente, parametriCampi_(p), p.creaFoglio === 'si');
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
 */
function eseguiSalvataggio_(e, corrente, dest, cartellaPratica, v, creaFoglio) {
  const message = messageDaEvento_(e);
  let salvati = 0, saltati = 0;
  message.getAttachments({ includeInlineImages: false }).forEach(function (a) {
    const nomeFile = a.getName();
    if (dest.getFilesByName(nomeFile).hasNext()) { saltati++; return; }
    dest.createFile(a.copyBlob()).setName(nomeFile);
    salvati++;
  });
  const idMail = scriviIdMail_(dest, message);

  const sec = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(
      'Cartella: <b>' + percorso_(dest) + '</b><br>' +
      'Allegati salvati: <b>' + salvati + '</b>' +
      (saltati ? '<br>Già presenti (saltati): ' + saltati : '') +
      (idMail ? '<br>ID mail registrato in <b>' + FILE_ID_MAIL + '</b>' : '<br>⚠️ ID mail non registrato')))
    .addWidget(CardService.newTextButton().setText('Apri la cartella')
      .setOpenLink(CardService.newOpenLink().setUrl(dest.getUrl())));

  if (creaFoglio) {
    const r = creaFoglioRiconoscimento_(cartellaPratica, v.nomeFile, v.nomeCover);
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
 * è il primo "_" dopo "CFU ". Tollera prefissi Fwd:, Fw:, I:, R:, Re: ripetuti.
 * Restituisce null se l'oggetto non ha quel formato.
 */
function estraiStudente_(subject) {
  const s = String(subject).normalize('NFC')
    .replace(/^\s*((fwd?|i|r|re)\s*:\s*)+/i, '');
  const m = s.match(/^CFU\s+([^_]+?)\s*_\s*(.+?)\s*$/i);
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
