---
name: cfu-express-chiudi
description: Versione Express - chiude una pratica di riconoscimento CFU - verifica Cover, produce il PDF nella cartella dello studente, prepara la bozza "rispondi a tutti" alla mail originale con il PDF allegato e, solo dopo l'ok esplicito dell'utente, la invia e aggiorna il Registro (stato `inviata`, calcolato dal messaggio inviato). Usala per "chiudi pratica CFU express", "manda il riconoscimento", "rispondi con il PDF" quando si lavora con il plugin Express.
---

# cfu-express-chiudi — PDF, bozza, invio

Regole comuni, Registro e stati: `references/processo.md` della skill **cfu-express-apri** (stesso plugin). **Nessuno script che usa Gmail** (in particolare non usare `rispondiConPdf` del template).

## 0. Prerequisiti

- **Individua la pratica** come in `references/processo.md` § *Individuare la pratica*: va bene la mail aperta, il nome/cognome, l'ID o il link della cartella. Senza mail aperta il thread a cui rispondere è quello di `pratica.json` / colonna `Mail (messageId)`.
- Leggi `pratica.json` (o `mail_riconoscimento.json` per le pratiche vecchie) nella cartella: `idPratica`, `provenienza`, `gmailMessageId`, `gmailThreadId`, studente, ID del file di riconoscimento. Se `provenienza` manca, leggila dalla colonna Provenienza del Registro (o dal mittente del messaggio di richiesta).
- **Riallineamento** (processo.md) e lettura della riga dello studente. Se lo stato è `inviata` o `annullata`, dillo e chiedi se procedere comunque (es. reinvio). Nessun altro blocco: se l'operatore chiede di chiudere, si chiude.

## 1. Cover e PDF

1. Controlla la Cover (intervalli `COVER_*`): `COVER_COGNOME` compilato, checkbox coerenti con il livello (triennale/magistrale), `COVER_NOTA_MAG` (`Cover!C40`) = `TRUE` se la pratica è di una triennale che chiede la magistrale con debiti ed è stata riconosciuta Triennale + Magistrale su autorizzazione dell'operatore (se manca, spuntala o segnalalo prima del PDF), e con la magistrale `COVER_STATO_MAG` (`Cover!C29`) evidenziata, mai `✗`: `✔` con debiti (CFU da sostenere, scheda EsamiDaFare nell'elenco fogli dell'esportazione e nel PDF) oppure `∅` senza debiti (0 CFU, niente scheda) — verificalo nell'elenco "Fogli nel PDF" della finestra di esportazione, nome file (`COVER_NOMEFILE`, formula) leggibile.
2. PDF **a file chiuso**: scrivi `richiesto` nella colonna **PDF** del Registro (una `update_values` sulla cella PDF della riga). Lo script *PDF dal Registro* (`scripts/PdfRegistro.gs`, installato una volta nel Registro) entro un minuto esporta il PDF con la stessa logica del menu (Cover + fogli delle righe spuntate, A4 orizzontale, nella cartella della pratica) e scrive nella cella `fatto <data> · <fogli> · <link>` o `errore: …`. Dopo ~60 s leggi **solo quella cella** (`get_values`); se non è ancora `fatto`, riprova una volta dopo 30 s. Controlla che l'elenco dei fogli sia quello atteso dalla Cover (es. con la magistrale e debiti: EsamiDaFare presente).
   Ripiego (script non installato o `errore`): **CFU → Esporta pratica in PDF** nel foglio, dall'operatore o dal browser.
3. Nessun download del PDF per controllarlo: l'elenco dei fogli nella cella del Registro basta.

## 2. Bozza di risposta (autorizzazione: invio)

1. Destinatari = "rispondi a tutti" al **messaggio di richiesta della segreteria** (mai a un messaggio dell'operatore, es. un inoltro a sé stesso): mittente + destinatari + CC, escluso l'utente stesso. Controlla che tra i destinatari ci sia la segreteria di provenienza. Leggili con `get_thread`. Se nel thread c'è un messaggio più recente dell'altra segreteria (thread misto, vedi `references/processo.md`), segnalalo e chiedi a quale messaggio rispondere.
2. Testo proposto (modificabile dall'utente):
   > Gentili colleghi,
   > in allegato la pratica di riconoscimento CFU di XXX (nome e cognome dello studente).
   > Cordiali saluti,
   > <nome e cognome dell'operatore>

   **Nota del riconoscimento incrociato (quando serve):** rileggi da Drive `INPUT_ESAMI` (colonna D, livello del corso) e la matrice, oppure l'ultimo `cfu_express_report_*.md` della cartella. Se ci sono esami triennali su target magistrali, oppure esami di una magistrale/specialistica su target triennali, **proponi** di aggiungere al testo, prima dei saluti, la nota standard (`references/riconoscimento-incrociato.md` §6 della skill cfu-express-riconoscimento, con classi e frasi adattate). Inseriscila solo se l'utente accetta. Mai nella Cover o nel PDF.
3. Crea la bozza con il PDF allegato, in quest'ordine di preferenza:
   - **Interfaccia Gmail** (scheda Gmail; unico uso del browser in chiusura): scarica il PDF da Drive con `download_file_content` e salvalo nel workspace decodificando il base64 dal file del risultato (mai ricopiarlo a mano); poi apri il thread, "Rispondi a tutti", scrivi il testo, carica il PDF con `file_upload` sull'input file degli allegati, **non premere Invia**; la bozza si salva da sola. Raggruppa i passi in un solo `browser_batch` quando possibile. Se la bozza esiste già e il PDF è stato rigenerato: rimuovi il vecchio allegato e carica il nuovo, **senza toccare il testo** (l'operatore può averlo modificato).
   - **Connettore Gmail** (`create_draft` con `replyToMessageId`, destinatari espliciti e `attachments` base64) solo se il PDF è piccolo e il browser non è disponibile.
   - In ultima istanza (anche quando si lavora senza Claude in Chrome): bozza senza allegato con il link al PDF in Drive nel messaggio in chat (non nella mail) + chiedi all'utente di allegare il PDF dalla cartella prima di inviare.
4. Mostra in chat: destinatari, oggetto, testo, nome e dimensione dell'allegato.
5. **Fermati.** Si invia solo dopo un ok esplicito dell'utente in chat riferito a questa bozza (oppure lo invia lui da Gmail).

## 3. Invio e Registro

1. All'ok: invia la bozza (pulsante Invia nella bozza aperta). Verifica con `get_thread` che il messaggio inviato sia nel thread.
2. Registro: stato `inviata`, Inviata il, Ultimo aggiornamento, Storia + `Rev N inviata <gg/mm hh:mm> (<destinatari>)` (una `update_values`). Se l'invio lo fa l'operatore da Gmail, lo stesso aggiornamento arriva dal riallineamento: non serve fare nulla.
3. Etichette Gmail: nessuna azione.

## Divieti

- Inviare senza ok esplicito; inviare a destinatari diversi da quelli del thread senza dirlo.
- Usare `rispondiConPdf` o altri script che chiamano Gmail.
- Rigenerare il PDF se quello esistente è aggiornato.
