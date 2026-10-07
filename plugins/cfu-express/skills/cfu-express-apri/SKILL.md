---
name: cfu-express-apri
description: "Versione Express: apre una nuova pratica di riconoscimento CFU dalla mail di richiesta \"… CFU NOME_COGNOME\" di cfu@ o presidenza.ingegneria@ (mail aperta in Gmail oppure, senza mail né browser, indicando nome e/o cognome, ID pratica o link della cartella in CFU_GDrive; se lo scaricamento automatico ha già creato cartella e allegati, li riusa) SENZA script Google - cartella in CFU_GDrive, allegati, copia del template, pratica.json e riga nel Registro pratiche CFU (stato calcolato, revisioni sulla stessa riga) - poi passa a cfu-express-riconoscimento. Anche per \"aggiorna il registro\". Usala per \"apri pratica CFU express\", \"nuova pratica express\", \"prepara la pratica di NOME COGNOME\" quando si lavora con il plugin Express."
---

# cfu-express-apri (Express)

Il processo completo e le regole comuni (Registro, **stato calcolato dai fatti**, revisioni, riallineamento, provenienza) sono in `references/processo.md` di questa skill: leggilo all'inizio. **Prima di tutto esegui il riallineamento** (processo.md): è una lettura del Registro e una ricerca Gmail.

**Non usare script Google** (né il componente aggiuntivo Gmail "Riconoscimento CFU", né funzioni Apps Script che toccano Gmail): solo connettori Gmail/Drive e, per gli allegati, l'interfaccia web di Gmail. Così la quota Gmail degli script non può bloccare la pratica.

## Riferimenti fissi

- Cartella pratiche: **CFU_GDrive** (cercala per titolo; ID noto `1LxW532oEanyt9gj9_uKMoYTzppxa_q09`).
- Template: lo spreadsheet in CFU_GDrive con titolo che contiene `RiconoscimentoCFU_IngGestionale` e `VGD` (il "template VGD"). Se ce n'è più di uno, chiedi quale.
- Registro: spreadsheet **Registro pratiche CFU** in CFU_GDrive (vedi `references/processo.md`).

## 0bis. Censire le richieste senza aprirle

Se l'utente chiede di "registrare" o "censire" le pratiche in arrivo: è il riallineamento (processo.md). Ogni richiesta senza riga riceve una riga con Provenienza, nuovo ID, Studente, Mail (messageId), Aperta il vuoto e stato `da fare`. Non creare cartelle.

## 1. Trova la pratica e la mail

1. **Individua la pratica** come in `references/processo.md` § *Individuare la pratica*: mail aperta nella scheda Gmail, oppure nome/cognome, ID pratica o link della cartella. Non serve né la mail aperta né il browser.
2. **Mail di richiesta**: se la riga del Registro ha `Mail (messageId)`, usa quel thread; altrimenti, se c'è `mail_riconoscimento.json` nella cartella, il suo `gmailMessageId`; altrimenti cerca con il connettore Gmail (`subject:CFU <cognome> (from:cfu@uninettunouniversity.net OR from:presidenza.ingegneria@uninettunouniversity.net)`). Più risultati → `AskUserQuestion`.
3. Leggi il thread (`get_thread`, formato `MINIMAL`): `messageId`, `threadId`, data, mittente, oggetto, nomi degli allegati. Il **messaggio di richiesta** è il più recente della segreteria che contiene la pratica (di solito il primo del thread).
4. **Provenienza** = mittente del messaggio di richiesta: `cfu@uninettunouniversity.net` → `cfu@`; `presidenza.ingegneria@uninettunouniversity.net` → `presidenza.ingegneria@`. Altro mittente → chiedi. Dilla in chat insieme allo studente.
5. Dall'oggetto `ZZZZ CFU NOME_COGNOME` (`ZZZZ` variabile: `Fwd:`, `Re:`, `URGENTE | Fwd:`, `sollecito`…) prendi il testo dopo `CFU `: è `NOME_COGNOME`; poi ricava **COGNOME_NOME** (ordine invertito: è la convenzione delle cartelle, es. `NOMEXXX_COGNOMEXXX` → `CFU_COGNOMEXXX_NOMEXXX`). Se l'oggetto non ha questa forma, chiedi.

## 2. Controlli prima di creare (idempotenza)

- Cerca nel Registro (colonna `Studente`) e in CFU_GDrive una cartella `CFU_COGNOME_NOME`.
- Se nel Registro c'è già una riga dello studente in stato `da fare`: è questa pratica, **usa il suo ID** e aggiorna quella riga. Se la riga ha già cartella e file (scaricamento automatico), §3 **completa** la pratica riusando quello che c'è.
- Se esiste già (riga in stato diverso da `da fare`): **non creare nulla**. Se lo stato è `da rivedere` o l'operatore chiede una revisione → **riapertura** (processo.md: Revisione +1, sottocartella `Revisione_NN` con NN = Revisione + 1, quindi la prima è `Revisione_02`; se lo scaricamento automatico l'ha già creata, usa quella; stessa riga, stesso ID). Altrimenti chiedi con `AskUserQuestion`: `Nuova revisione` · `Riprendi la pratica esistente` · `Annulla`.

## 3. Crea la pratica (subito, PRIMA di qualunque analisi)

**Ordine obbligatorio:** cartella → foglio di riconoscimento → allegati in cartella → `pratica.json` → Cover + Registro. **Ogni passo riusa quello che esiste già** (scaricamento automatico, apertura interrotta): prima una `search_files` nella cartella, poi si crea solo ciò che manca. **Non leggere né analizzare il contenuto di nessun allegato** (modulo, tabelle, CV, certificati) finché questi passi non sono completati e verificati (§5). Vale anche quando l'operatore chiede direttamente "fai il riconoscimento" su una mail la cui pratica non esiste ancora: prima si apre la pratica, poi si analizza.

1. Cartella `CFU_COGNOME_NOME` in CFU_GDrive (o `Revisione_NN` dentro quella esistente) — `create_file` con `mimeType` cartella. Se esiste già, usala.
2. Copia del template nella cartella con titolo `Riconoscimento_CFU_Ingegneria Gestionale_COGNOME_NOME` (`copy_file`). Se un file con quel titolo è già nella cartella, usalo. Puoi lanciare `copy_file` e il passo 3 nello stesso turno.
3. Allegati.
   - **Già in cartella?** Confronta i nomi degli allegati della mail (connettore Gmail) con i file della cartella (esclusi foglio di riconoscimento, `*.json`, `*.md`, `*_testo.txt`, PDF del riconoscimento). Se ci sono tutti, **salta il browser**: è il caso normale con lo scaricamento automatico o con il pulsante "Salva allegati qui" del componente Gmail.
   - **Senza browser** (nessuna scheda Claude in Chrome) e allegati mancanti: dillo e chiedi all'operatore di premere **Salva allegati qui** nel pannello *Riconoscimento CFU* della mail (o di trascinarli nella cartella), poi ricontrolla. Non leggere allegati da altre parti.
   - **Con il browser** (unico uso in apertura): il connettore Gmail elenca gli allegati (`get_thread` in `PLAIN_TEXT`: nome, tipo, `attachmentId`) ma **non ha uno strumento per scaricarli**, quindi:
     - con il connettore Gmail leggi i **nomi** degli allegati (servono per la verifica);
     - nella scheda Gmail della mail premi **una volta** "Aggiungi tutti a Drive" (`find` + un clic, nient'altro nel browser; se la mail non è aperta nella scheda, aprila con `navigate` sul `viewUrl` del messaggio). Con un solo allegato il pulsante si chiama "Aggiungi a Drive";
     - i file finiscono nel "Il mio Drive" con la **data della mail** (non quella di oggi): trovali con **una** `search_files` per titolo (`title = '<nome1>' or title = '<nome2>' …`, senza filtri di data), scegli quelli fuori da CFU_GDrive e spostali nella cartella con `update_file` (`parentId`), tutte le chiamate nello stesso turno;
     - verifica che il numero di file spostati coincida con gli allegati della mail.
     Se il connettore Gmail un giorno espone il download degli allegati (es. `get_attachment`), usa quello e salva con `create_file` (`base64Content`, `disableConversionToGoogleType: true`) senza browser.
4. `pratica.json` nella cartella (`create_file`, `text/plain`, `disableConversionToGoogleType: true`), **immutabile** dopo la creazione (se c'è già, non riscriverlo; `mail_riconoscimento.json` dello scaricamento automatico resta accanto e non si tocca):
   ```json
   {"idPratica":"CFU-AAAA-NNN","provenienza":"cfu@ | presidenza.ingegneria@","studente":"COGNOME_NOME","operatore":"…","oggetto":"<oggetto originale>","gmailMessageId":"…","gmailThreadId":"…",
    "mittente":"…","dataMail":"…","cartellaId":"…","fileRiconoscimentoId":"…",
    "apertaIl":"<ISO>","versionePlugin":"<versione>"}
   ```
   (Le pratiche vecchie possono avere `mail_riconoscimento.json` o un `pratica.json` senza `provenienza`: ricavala dal mittente in `gmailMessageId` / Registro, senza riscrivere il file.)
5. Cover: scrivi `COGNOME_NOME` in `Cover!G19` (`COVER_COGNOME`) con il connettore Google Sheets, nella stessa sessione di scrittura della riga del Registro (niente browser). Senza connettore: casella del nome nel browser.

## 4. Registro

- **ID pratica**: assegnalo prima di creare `pratica.json` (`CFU-AAAA-NNN`, progressivo annuale letto dalla colonna `ID pratica`). In una riapertura l'ID resta quello della riga.
- Scrivi la riga del **Registro pratiche CFU** con **una** scrittura (colonne per intestazione, mai `Mail (link)`): Provenienza, ID, Studente, Operatore, Stato `in lavorazione`, Revisione `0`, Cartella, File riconoscimento, Mail (messageId) = thread, Aperta il, Ultimo aggiornamento, Storia `Rev 0 aperta <gg/mm hh:mm>`. Se la riga era `da fare` (anche creata dallo scaricamento automatico) aggiorna quella: Stato `in lavorazione`, Aperta il, Operatore se vuoto, link mancanti, Storia + `Rev N aperta …`; non toccare la Storia già scritta. In una riapertura: Revisione +1, link nuovi, Stato `in lavorazione`, Storia + `Rev N aperta …`.
- Comunica in chat l'ID e la provenienza.
- **Etichette Gmail: nessuna azione** (le principali `CFU` / `CFUpresidenza` le mettono i filtri).

## 5. Verifica e passaggio

- Verifica con `search_files` nella cartella: file di riconoscimento + allegati + `pratica.json`. Se manca qualcosa: dillo in chat e fermati (lo stato resta `in lavorazione`).
- Solo dopo questa verifica si leggono i documenti. Non serve aprire il file di riconoscimento: se l'operatore ha già chiesto il riconoscimento, passa direttamente a **cfu-express-riconoscimento**; altrimenti chiedi se avviarlo. La scrittura nel foglio avviene col connettore Google Sheets (whitelist in `scripts/whitelist.json`); il menu **CFU → Importa riconoscimento (Express)** serve solo come ripiego.
