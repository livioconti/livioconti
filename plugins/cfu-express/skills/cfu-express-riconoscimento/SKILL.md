---
name: cfu-express-riconoscimento
description: "Riconoscimento CFU Express per Ingegneria Gestionale UNINETTUNO (file RiconoscimentoCFU_IngGestionale): legge tutto da Drive, decide con le stesse regole del riconoscimento interattivo, scrive direttamente nel foglio con il connettore Google Sheets (una scrittura per fase, solo celle della whitelist, dopo il \"sì\" dell'operatore; ripiego: JSON + menu Importa). Due modalità: automatica (report iniziale e finale) o interattiva (fermate di revisione). Funziona anche senza mail aperta e senza browser: basta indicare la pratica con nome e/o cognome, ID (CFU-AAAA-NNN) o link della cartella in CFU_GDrive. Usala per \"riconoscimento CFU express\", \"riconoscimento express di COGNOME\", \"fai l'express della pratica CFU-2026-011\", \"riconoscimento automatico\", \"cfu express\", \"riconoscimento veloce\"."
---

# cfu-express-riconoscimento

Stesso **merito** del riconoscimento interattivo, metodo diverso: **niente browser, niente lettura del foglio.** Si leggono i documenti dello studente, si decide, si verifica il piano di scrittura in un colpo (`verifica_scrittura.py`) e si scrive **subito e direttamente** nel foglio con il connettore Google Sheets, **senza chiedere conferma**: una scrittura per fase, solo nelle celle della whitelist. Poi ci si ferma e si chiede all'operatore se procedere: lui può aprire il file e modificare matrice e CV prima di rispondere. Il file può restare chiuso.

- Regole di merito (obbligatorie, da leggere all'inizio): `references/regole.md` (R1–R11, casi frequenti). **Solo se la pratica li presenta**: `references/regole-casi.md` (esami V.O. senza CFU, riconoscimento incrociato fra due carriere, CV/certificazioni) e `references/riconoscimento-incrociato.md`. Non leggerli "per sicurezza": rallentano ogni pratica.
- **Scrittura (obbligatorio):** `references/scrittura.md` — whitelist delle celle, piano, verifica unica, scrittura. Mappa fissa del template e target in `${CLAUDE_PLUGIN_ROOT}/scripts/whitelist.json`.
- Ripiego senza connettore Sheets: JSON + **CFU → Importa riconoscimento (Express)** (`references/formato-json.md`).
- Fermata dopo la lettura (anomalie → mail alla segreteria): `references/fermata-chiarimenti.md`.
- Requisito: connettore **Google Sheets** attivo nella chat (scrittura diretta). Se manca, dillo una volta e usa il ripiego JSON + menu (serve `ImportaRiconoscimento.gs` nel template).

## 1. Avvio (al massimo una schermata)

0. **Individua la pratica** (`references/processo.md` della skill cfu-express-apri, § *Individuare la pratica*): mail aperta nella scheda Gmail **oppure** nome e/o cognome, ID pratica o link della cartella/del file, scritti in chat. Non servono né la mail aperta né il browser.
0bis. **Pratica non ancora aperta**: nessuna riga, oppure riga `da fare` (anche se lo scaricamento automatico ha già creato cartella e file), oppure manca `pratica.json` o il foglio di riconoscimento: esegui **prima** tutta **cfu-express-apri** (riusa quello che c'è, crea il resto) e solo dopo leggi i documenti. Non leggere allegati dalla mail o da "Il mio Drive" prima che siano nella cartella della pratica.
1. File di riconoscimento: dal link della colonna *File riconoscimento* del Registro, dall'URL del foglio aperto, dal link indicato o dal `pratica.json` della cartella corrente (se manca, chiedilo); cartella con `get_file_metadata`. In una revisione (`Revisione_NN`) i documenti nuovi sono nella sottocartella, quelli non ripetuti (es. modulo) nella cartella principale.
2. Se la richiesta non dice già la modalità, **una** `AskUserQuestion`:
   - **Modalità**: `Automatica (Consigliata)` — nessuna domanda, ipotesi dichiarate nei report · `Interattiva` — fermate F1 (matrice) e domande sui casi ambigui.
   - **Passi** (multiSelect, selezionati di default tutti tranne affidabilità): preparazione dati · esami · CV · Cover · **PDF subito** (solo automatica: il PDF si chiede nella stessa scrittura del Registro, così alla domanda "procedo?" è già pronto) · affidabilità.
3. In modalità automatica: niente altre domande, **con due sole eccezioni** (§3): laurea dichiarata nel modulo i cui esami non sono nella tabella gialla ma in un altro allegato; anomalie nei dati letti (fermata **F0**). Cartella = quella del file; file = tutti quelli utili ai passi scelti; V.O. senza CFU = 10 (R3bis); casi ambigui = scelta più prudente, dichiarata.

## 2. Lettura (solo Drive, una volta)

1. `search_files` nella cartella corrente (e nella principale, se è una revisione): classifica i file (modulo/tabelle esami, CV, certificazioni, `pratica.json`, JSON Express precedenti).
2. Modulo e tabelle: prima `<nome>_testo.txt` se c'è (poi subito `controlla_tabelle.py`, R2bis) (R2: già estratto dallo scaricamento, nessuna decodifica), altrimenti il Word con `read_file_content`; binario solo se il testo manca o gialla e azzurra non si distinguono (R2).
3. **Il foglio non si legge.** Target, codici, CFU previsti e celle scrivibili sono in `whitelist.json` (template fisso; copia nuova = vuota). Si legge dal foglio solo ciò che ha scritto l'operatore: la colonna A di `CFU_per_CV` (secondo giro CV, `get_values` su `CFU_per_CV!A2:A`). Per una revisione di una pratica già scritta si svuotano gli intervalli della whitelist nella stessa scrittura (`scrittura.md`).
4. `pratica.json`: `idPratica` e `provenienza` (`cfu@` / `presidenza.ingegneria@`) per il Registro e per l'eventuale mail F0 (va alla segreteria di provenienza, "rispondi a tutti").
5. Lavora sui dati con script Python nel workspace (pulizia R3, somme, controlli): meno testo a mano, meno errori.

## 3. Report iniziale (in chat, breve) e fermata F0

- **CFU della laurea di poco inferiori al totale atteso** (es. 173 su 180) quando mancano verosimilmente voci non curricolari (prova finale/tesi, tirocinio, altre attività, idoneità, a scelta): **non è F0**. Scrivi un **avviso** nel report iniziale ("Avviso: 173/180 CFU, mancano 7 CFU, probabilmente voci non curricolari non elencate") e prosegui; riportalo nel report finale e nella Storia del Registro. Diventa F0 solo con un'incongruenza **sostanziale** (`references/fermata-chiarimenti.md` §1bis).
- **Controllo di coerenza** dei dati letti (`references/fermata-chiarimenti.md` §1). Se qualcosa di sostanziale non torna: **fermata F0 anche in automatica**: tabella delle anomalie, domanda all'operatore (`Prepara la mail alla segreteria` / `Prosegui con ipotesi dichiarate` / `Correggo io i dati`), bozza "rispondi a tutti" con le domande, invio **solo con ok esplicito**, Registro `in attesa segreteria` (dopo l'invio della mail), nessuna scrittura nel foglio finché la fermata è aperta (solo la riga del Registro). Altrimenti: "Lettura: nessuna anomalia" e prosegui.

- Riassunto del modulo (R1): titolo dichiarato, livello e indirizzi richiesti, competenze dichiarate, incongruenze. Gli indirizzi richiesti non restringono il riconoscimento: si fanno sempre **tutti** gli indirizzi del livello richiesto (R1, R9).
- Dati: esami della gialla (numero, CFU totali), azzurra (solo riferimento), normalizzazioni, V.O. con CFU assunti.
- **Laurea dichiarata, esami fuori dalla gialla** (es. triennale nel certificato, specialistica nella gialla): **fermati anche in automatica** e chiedi in una `AskUserQuestion` (`header`: `Esami`): `Includi gli esami dal certificato` / `Solo tabella gialla`. Se inclusi: in `esami` dopo le righe della gialla e in `trash.righeExtra` (scritte in `Trash` subito sotto la gialla, senza sfondo né formati), fonte dichiarata nei report; poi valuta l'incrociato (R5).
- **Automatica:** elenco delle ipotesi che verranno applicate (es. "V.O. → 10 CFU", "livello dal modulo, tutti gli indirizzi del livello", "esame X considerato triennale"). Poi prosegui.
- **Interattiva:** casi ambigui + scelta CFU dei V.O. in **una** `AskUserQuestion`, poi prosegui.

## 4. Decisioni (merito invariato)

1. **Preparazione:** da `controlla_tabelle.py` (R2bis): righe **grezze** per `trash` (+ `righeExtra` per gli esami inclusi da altri allegati) e `trashAzzurra`, righe **pulite** per `esami` (+ `cfuAssunti`). Con anomalie STRUTTURA: prima la verifica approfondita e la conferma dell'operatore.
2. **Esami → target:** R5–R7 (base dati, livello, incrociato, ottimizzazione per target, gradi, tipi di target) e i controlli "prima di scrivere". Prepara la tabella `target | CFU | esami usati | grado | voto risultante | motivazione`.
   - **Interattiva:** fermata **F1** *dopo* la scrittura: la tabella è già nel foglio; l'operatore la corregge nel file o in chat (§6bis).
3. **Riconoscimento incrociato:** se applicato (`regole-casi.md`), verifica dell'invariante per indirizzo e nota standard (R5).
4. **CV (R8, in `regole-casi.md`):** proposte nel blocco `cfuPerCV` con la **colonna A già compilata** con i CFU proposti (numero = colonna F) e gli stessi CFU **applicati subito** nella riga CV `Input!Q41:CB41`, nella stessa scrittura. L'operatore può cambiare la colonna A (numero, `sì`, `no`/`0`) dopo la scrittura (§6bis).
5. **Cover (R9):** livello dal modulo o dall'operatore; **indirizzi sempre tutti quelli del livello richiesto**, anche se lo studente ne indica uno solo: triennale → `tutteTri: true` + `C25:C28` tutte `TRUE`; magistrale → `tutteMag: true` + `C31:C33` tutte `TRUE` (singoli indirizzi solo su indicazione esplicita dell'operatore). Se lo studente ha solo una triennale, chiede la magistrale con debiti formativi e l'operatore ha autorizzato il riconoscimento **Triennale + Magistrale**: `tutteTri: true`, `tutteMag: true` **e `notaMag: true`** (nota `COVER_NOTA_MAG`, `Cover!C40`). Dichiaralo nel report. Con la magistrale nel riconoscimento la riga EsamiDaFare (`COVER_STATO_MAG`) è sempre evidenziata: `cover.statoMag: "✔"` con debiti (CFU da sostenere + scheda EsamiDaFare nel PDF), `"∅"` senza debiti (0 CFU, niente scheda).
6. **Affidabilità (R10, in `regole-affidabilita.md`):** **solo se l'operatore la chiede** (rallenta la pratica). Righe CV in attesa = POSSIBILE. Se l'operatore dice di saltarla: si salta: il Registro non cambia.

## 5. Scrittura: un piano, una verifica, una scrittura (senza conferma preventiva)

Procedura completa in `references/scrittura.md`. In breve:

1. Componi il piano della fase (range + valori [+ sfondo] della whitelist, più, se serve, la riga del Registro: lo stato resta `in lavorazione` per tutto il riconoscimento, quindi di norma basta aggiornare Ultimo aggiornamento e Storia, es. `Rev 0 riconoscimento scritto 06/10 18:00`). Includi `esami` per il controllo delle somme.
2. `python3 -I ${CLAUDE_PLUGIN_ROOT}/scripts/verifica_scrittura.py piano.json --richieste richieste.json` (nel piano `"foglioVuoto": true` se il file di riconoscimento è una copia nuova del template: le richieste diventano molto più corte): **una** verifica di tutto (whitelist, colonne vietate, tipi, menu, somme di riga/colonna, CFU per indirizzo). Errori → correggi il piano.
3. **Scrivi subito, senza chiedere il "sì"** (anche in interattiva): esami, matrice, `CFU_per_CV` con colonna A compilata, riga CV, Cover e Registro.
4. **Una** `update_spreadsheet` con l'array `riconoscimento` di `richieste.json` (valori, sfondi e la copia Trash → Input in un colpo) e **una** `update_values` per il Registro. Se è stato scelto **PDF subito**, la stessa scrittura del Registro mette `richiesto` nella colonna PDF. Confronta gli intervalli aggiornati restituiti con il riepilogo della verifica: nessuna rilettura del foglio.
5. Connettore Sheets assente → ripiego JSON + menu Importa (`formato-json.md`).

## 6. Dopo la scrittura: fermata e domanda

Subito dopo la scrittura mostra il riepilogo (tabella dei target, CFU da esami e da CV per indirizzo, ipotesi) e salva il report (§7). Con **PDF subito**: rileggi solo la cella PDF del Registro (dopo ~60 s dalla scrittura; il report si scrive nel frattempo) e mostra il link. Poi **fermati** con **una** `AskUserQuestion` (`header`: `Procedo?`): `Procedi (chiudi la pratica)` · `Ho modificato il file: rileggi e allinea` · `Correggo in chat`. Se l'operatore modifica il file, il PDF già prodotto va rigenerato in chiusura. Non passare a **cfu-express-chiudi** senza risposta.

## 6bis. Allineamento alle modifiche dell'operatore

Quando l'operatore risponde (anche solo "procedi"), prima di proseguire rileggi con **una** `get_values` per intervallo la matrice `Input!Q42:CB<ultima riga esami>` e la colonna A di `CFU_per_CV!A2:F<n>`. Colonna A: numero = quei CFU; `sì` = CFU della colonna F; `no`, `0` o vuota = nessun CFU. Se la riga CV `Input!Q41:CB41` non corrisponde alla colonna A, riscrivila (piano → `verifica_scrittura.py` → una scrittura, senza chiedere) e aggiorna la Storia del Registro. Le modifiche manuali alla matrice non si toccano: segnala solo eventuali violazioni (somme di riga/colonna, R7) in chat. Poi prosegui con **cfu-express-chiudi**.

## 7. Report finale (in chat e nel file)

Contenuto: decisioni per target (tabella), ipotesi applicate, INCERTO e POSSIBILE (prima gli "ERRORE:" e le "ATTRIBUZIONE MANCATA:"), totali per indirizzo dall'esito, CFU assunti dei V.O. da confermare, CV in attesa, nota del riconoscimento incrociato (se serve, da proporre per la mail). Salvalo anche come `cfu_express_report_<AAAAMMGG-HHMM>.md` nella cartella (`create_file`, `text/markdown`, senza conversione). Chiudi indicando la skill successiva: **cfu-express-chiudi**.

## 8. Spiegazioni (sola lettura)

Se l'operatore chiede perché una scelta: nessuna scrittura; rileggi il foglio da Drive, rispondi con i numeri, nomina la regola (R…), proponi le correzioni in tabella `# | Modifica | Da → A | Grado | Motivo | Effetto` senza applicarle. Si scrive di nuovo solo su ordine esplicito (nuovo JSON).

## 9. Da non fare

- Usare il browser per leggere o scrivere celle del foglio; scaricare il foglio intero per conoscerne la struttura (è in `whitelist.json`).
- Scrivere nel foglio senza aver fatto passare il piano da `verifica_scrittura.py`, o in celle fuori dalla whitelist; rileggere il foglio a ogni scrittura (la verifica è una, prima).
- Chiedere il "sì" prima di scrivere un'ipotesi di riconoscimento (esami o CV): si scrive subito, si chiede dopo.
- Proseguire alla chiusura senza la domanda del §6 e senza aver riallineato la riga CV alla colonna A (§6bis).
- Cambiare il merito delle regole per "fare prima": in automatica le ambiguità diventano ipotesi dichiarate, non scorciatoie.
- Proseguire con la sola gialla quando il modulo dichiara una laurea i cui esami sono solo in un altro allegato, senza chiedere.
- Scrivere nel foglio (oltre alla riga del Registro) con una fermata F0 aperta; inviare la mail di chiarimenti senza ok esplicito.
- Tutti i divieti di merito di R11.
