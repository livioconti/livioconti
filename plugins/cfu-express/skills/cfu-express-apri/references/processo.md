# Processo pratica CFU (Express) — regole comuni

## Principi

1. **Strumenti separati.** Gmail e Drive tramite connettori; foglio di riconoscimento e Registro tramite il connettore Google Sheets (solo celle della whitelist, `scripts/whitelist.json`). **Browser ridotto al minimo** (rallenta la pratica): solo due momenti, perché i connettori non li coprono — (a) in apertura **un clic** su "Aggiungi tutti a Drive" (il connettore Gmail elenca gli allegati ma non li scarica); (b) in chiusura la bozza "Rispondi a tutti" con il PDF caricato (`file_upload`), perché il connettore Gmail accetta allegati solo come base64 nel messaggio e un PDF di ~200 KB non si può passare così in modo affidabile. Mai il browser per leggere o scrivere celle, cercare file, leggere mail o allegati. **Il browser è facoltativo**: se gli allegati sono già nella cartella della pratica (scaricamento automatico, sotto) l'apertura non lo usa affatto, e senza browser la chiusura ripiega sulla bozza senza allegato (cfu-express-chiudi §2). Script Google solo dentro i fogli (onEdit, colori, esportazione PDF, PDF dal Registro). **Il plugin non chiama nessuno script che usa Gmail.**

   **Scaricamento automatico (componente aggiuntivo Gmail "Riconoscimento CFU", facoltativo).** Se l'operatore l'ha attivato, ogni ora salva gli allegati delle mail con etichetta `CFU`/`CFUpresidenza` in `CFU_GDrive/CFU_COGNOME_NOME` (le successive in `Revisione_NN`), crea il file di riconoscimento, scrive `mail_riconoscimento.json` e la riga del Registro (stato `da fare`, Aperta il vuoto, Operatore vuoto; se la pratica era `inviata` o `in attesa segreteria`, `da rivedere`). Il plugin non lo comanda: ne **usa i risultati** come se li avesse prodotti cfu-express-apri, senza duplicarli.
2. **Lo stato si ricava dai fatti.** Identità della pratica in `pratica.json` (immutabile); stato nel **Registro pratiche CFU**, ma **calcolato** da Gmail e Drive (sezione *Stato*), non ricordato. Chi manda la mail (Claude o l'operatore) non conta: conta che la mail esista.
3. **Passi ripetibili.** Ogni azione controlla prima cosa esiste già e non duplica cartelle, file o righe.
4. **Autorizzazioni dell'operatore:** il "sì" sul riepilogo del riconoscimento, la decisione sui CFU da CV, l'invio di ogni mail. Se l'operatore dice di saltare un controllo (es. l'affidabilità), si salta e basta: non c'è nulla da aggiornare.

## Individuare la pratica (tutte le skill)

Ogni skill parte da **una sola** di queste indicazioni; non serve che sia aperta una mail né che ci sia il browser:

| L'operatore indica | Come si risolve |
|---|---|
| mail aperta nella scheda Gmail (Claude in Chrome) | oggetto `… CFU NOME_COGNOME` → studente `COGNOME_NOME` |
| nome e/o cognome, in qualsiasi ordine, anche solo il cognome ("express Fantozzi", "Lapo Fantozzi") | ricerca nel Registro (colonna Studente) |
| ID pratica (`CFU-2026-010`) | colonna ID pratica del Registro |
| link (o ID) della cartella `CFU_…`, di una `Revisione_NN` o del file di riconoscimento | `get_file_metadata`: cartella della pratica = la `CFU_…` (se il link è una `Revisione_NN`, la pratica è la cartella madre e la revisione corrente è quella) |

Ordine di ricerca, fermandosi al primo risultato univoco:
1. **Registro** (la lettura del riallineamento basta): Studente confrontato **per parole**, senza maiuscole, accenti e ordine (`fantozzi` trova `FANTOZZI_LAPO`; `lapo fantozzi` anche); righe `annullata` escluse salvo richiesta esplicita.
2. **CFU_GDrive**: `search_files` con `parentId` = CFU_GDrive e `title contains '<cognome>'` tra le cartelle; ignora `_old`, `_oldnew`, `Backup_…` salvo richiesta.
3. **Gmail**: `subject:CFU <cognome> (from:cfu@uninettunouniversity.net OR from:presidenza.ingegneria@uninettunouniversity.net)`.

Più candidati (omonimi, `CFU_GATTA_MARIO` e `CFU_GATTA_MARIO_old`, due righe) → **una** `AskUserQuestion` con ID, studente, stato e data; mai sceglierne uno a caso. Nessun candidato → dillo e chiedi il link della cartella.

Trovata la pratica, scrivi in chat una riga: `CFU-2026-010 FANTOZZI_LAPO · inviata · Rev 0 · cartella CFU_FANTOZZI_LAPO`. **Cartella corrente** = link della colonna Cartella del Registro; se manca, la `Revisione_NN` più alta, altrimenti la cartella principale. I documenti si leggono **solo da Drive** (cartella corrente + cartella principale per i documenti non ripetuti), mai dalla mail.

## Fasi di una pratica (per orientarsi, non si scrivono nel Registro)

Apertura (cfu-express-apri) → dati, esami, CV, Cover (cfu-express-riconoscimento) → PDF, bozza, invio (cfu-express-chiudi). Per riprendere una pratica interrotta si guarda il file: Input vuoto = dati da fare; matrice vuota = esami da fare; colonna A di `CFU_per_CV` vuota con proposte = CV in attesa; PDF nella cartella = pronta per la mail.

## Registro pratiche CFU

Spreadsheet **Registro pratiche CFU** in CFU_GDrive (ID `1NjLVayRZDbbunQt5hXrvOstM0Z6IYGpRm9s_BsHn1So`), foglio **Registro**, intestazioni in riga 1 (colonne trovate **per intestazione**, mai per lettera). **Una riga per studente**: le revisioni riaprono la stessa riga.

| Colonna | Chi la scrive | Contenuto |
|---|---|---|
| Provenienza | Claude, all'apertura | `cfu@` / `presidenza.ingegneria@` (mittente della prima richiesta); non cambia più |
| ID pratica | Claude, all'apertura | `CFU-AAAA-NNN` (anno + progressivo annuale); resta uguale nelle revisioni |
| Studente | Claude | `COGNOME_NOME` |
| Operatore | operatore (o Claude all'apertura) | testo libero |
| **Stato** | **calcolato** (menu) | vedi sotto |
| Revisione | calcolato | 0 alla prima apertura, +1 a ogni riapertura |
| Inviata il | calcolato | data dell'ultima mail con PDF alla segreteria |
| Cartella (link), File riconoscimento (link) | Claude | della revisione corrente |
| Mail (messageId) | Claude | ID del thread più recente dello studente |
| Mail (link) | **formula, mai scrivere** | |
| Aperta il | Claude, all'apertura | `gg/mm/aaaa hh:mm` |
| Ultimo aggiornamento | Claude | data dell'ultimo riallineamento che ha cambiato la riga |
| Storia | Claude, **solo in aggiunta** | eventi separati da ` · `, es. `Rev 0 inviata 06/10 13:36 · Rev 1 nuova mail con allegati 12/10` |
| Note | operatore | mai sovrascritte da Claude (può solo aggiungere in coda, su richiesta) |
| PDF | Claude scrive `richiesto`; lo script del Registro scrive l'esito | vedi cfu-express-chiudi |

## Stato (calcolato)

| Stato | Regola |
|---|---|
| `da fare` | c'è una richiesta (thread "… CFU NOME_COGNOME" da cfu@ o presidenza.ingegneria@) ma la pratica non è stata aperta: nessuna cartella, **oppure** cartella creata dallo scaricamento automatico con **Aperta il vuoto** |
| `in lavorazione` | la pratica è stata aperta (Aperta il compilato) e, dopo l'ultima apertura/riapertura, l'operatore non ha mandato mail alla segreteria; oppure la segreteria ha risposto a una richiesta di chiarimenti |
| `in attesa segreteria` | l'ultimo messaggio rilevante è dell'operatore, verso la segreteria, **senza PDF** (chiarimenti) |
| `inviata` | l'ultimo messaggio rilevante è dell'operatore, verso cfu@ o presidenza.ingegneria@ (destinatario o Cc), **con un PDF allegato** |
| `da rivedere` | dopo un invio è arrivato, per lo stesso studente, un messaggio della segreteria **con allegati** (stesso thread o thread nuovo) |
| `annullata` | **solo manuale** (o su indicazione esplicita dell'operatore); il riallineamento non la tocca mai |

- Messaggi della segreteria **senza allegati** dopo un invio (ringraziamenti, domande): lo stato resta `inviata`; il messaggio si segnala in chat e in Storia.
- Messaggi dell'operatore solo a sé stesso o ad altri (non alla segreteria): ignorati (es. invio di prova).
- **Nuovo thread per uno studente già nel Registro** (stesso `COGNOME_NOME` nell'oggetto, anche con `sollecito`, `Re:`, `Fwd:` o prefissi diversi): **non** è una pratica nuova; si aggiorna la stessa riga (Mail (messageId) = thread nuovo, Storia + evento). Nome ambiguo (omonimi, grafie diverse) → chiedi.
- **Riapertura** (stato `da rivedere`, oppure l'operatore chiede "rivedi la pratica di X"): Revisione +1, sottocartella `Revisione_NN` con nuova copia del template e nuovi allegati, link aggiornati, stato `in lavorazione`, Storia + evento. L'ID non cambia.
- **Numerazione delle sottocartelle** (la stessa dello scaricamento automatico e delle cartelle già esistenti): la cartella principale è la Revisione 0, `Revisione_02` è la Revisione 1, `Revisione_03` la Revisione 2… (NN = Revisione + 1, due cifre). Se lo scaricamento automatico ha già creato la `Revisione_NN` con i nuovi allegati, la riapertura usa quella (aggiunge solo la copia del template), non ne crea un'altra.

## Riallineamento (all'avvio di ogni skill CFU e su "aggiorna il registro")

1. Una lettura del Registro (`get_values` su `Registro!A1:P<ultima riga>`).
2. Una ricerca Gmail: `subject:CFU (from:cfu@uninettunouniversity.net OR from:presidenza.ingegneria@uninettunouniversity.net OR to:cfu@uninettunouniversity.net OR to:presidenza.ingegneria@uninettunouniversity.net) newer_than:60d`; per i thread il cui ultimo messaggio è più recente di "Ultimo aggiornamento" della riga, `get_thread` (formato `MINIMAL` o `METADATA_ONLY`; allegati: `sizeEstimate` > 100 KB o, se dubbio, `PLAIN_TEXT` per i nomi degli allegati).
3. Calcola lo stato di ogni riga con le regole sopra; richieste nuove senza riga → riga `da fare` (ID nuovo).
4. **Una** scrittura (`update_values` riga per riga o un solo intervallo) delle sole righe cambiate: Stato, Revisione, Inviata il, Mail (messageId), Ultimo aggiornamento, Storia (in coda). Mai Note, Operatore, Mail (link), né righe `annullata`.
5. In chat, una riga per pratica cambiata (`CFU-2026-007 ROSSI_MARIO: in lavorazione → inviata`).

## Provenienza ed etichette Gmail

Due segreterie: `cfu@uninettunouniversity.net` (`cfu@`) e `presidenza.ingegneria@uninettunouniversity.net` (`presidenza.ingegneria@`). In Gmail ci sono solo le **etichette principali** `CFU` e `CFUpresidenza`, applicate dai filtri all'arrivo: servono all'operatore per vedere le richieste, **Claude non le gestisce** e non crea sottoetichette.

**Oggetto delle richieste.** Forma `ZZZZ CFU NOME_COGNOME` (`ZZZZ` variabile: `Fwd:`, `Re:`, `URGENTE | Fwd:`, `sollecito`, `Ingegneria Gestionale_Fwd:`…). Lo studente è il testo dopo la prima occorrenza di `CFU ` (parola intera); la cartella usa l'ordine inverso `CFU_COGNOME_NOME`.

**Thread misti.** Una segreteria può scrivere nel thread aperto dall'altra: la Provenienza della pratica non cambia; il messaggio conta per lo stato come quelli della segreteria di provenienza.
