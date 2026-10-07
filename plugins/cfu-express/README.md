# CFU Express – UNINETTUNO (plugin 1.9.1)

Plugin **alternativo e distinto** da `riconoscimento-cfu-uninettuno` (il plugin interattivo). Stesso **merito** del riconoscimento (regole in `skills/cfu-express-riconoscimento/references/regole.md`, identiche a quelle del plugin interattivo); cambia il metodo: **nessuna lettura o scrittura del foglio tramite browser.**


## Requisiti (dalla 1.3)

- Connettore **Google Sheets** attivo nella chat: Claude scrive direttamente nel file di riconoscimento e nel Registro, solo nelle celle elencate in `scripts/whitelist.json`, dopo una verifica unica del piano (`scripts/verifica_scrittura.py`), **senza chiedere conferma prima** (dalla 1.6): poi si ferma e chiede se procedere, così l'operatore può modificare il file. Il file può restare chiuso.
- PDF a file chiuso: incolla `scripts/PdfRegistro.gs` nel progetto Apps Script del **Registro pratiche CFU** ed esegui una volta `installaPdfRegistro()` (crea la colonna PDF e un controllo ogni minuto). Claude scrive `richiesto` nella colonna PDF e lo script produce il PDF con la stessa logica del menu del template.
- `ImportaRiconoscimento.gs` resta come ripiego quando il connettore Sheets non è disponibile.

## Come si avvia

Due modi, stesso flusso:

- **Da una mail aperta** in Gmail con Claude in Chrome: "riconoscimento express" sulla mail `… CFU NOME_COGNOME`.
- **Senza mail né browser**, da una chat qualsiasi con i connettori Drive, Sheets e Gmail: "riconoscimento express di Fantozzi", "express della pratica CFU-2026-011" o "riconoscimento express" + link della cartella in CFU_GDrive. Claude trova la pratica nel Registro (nome in qualsiasi ordine, anche solo il cognome), poi in CFU_GDrive, poi in Gmail; con più candidati chiede quale.

Se la pratica non è ancora aperta, prima la apre (cfu-express-apri) **riusando** cartella, file e allegati già creati dallo scaricamento automatico o dal pulsante "Salva allegati qui" del componente Gmail *Riconoscimento CFU*. Il browser serve solo se mancano gli allegati in cartella (un clic su "Aggiungi tutti a Drive") e per allegare il PDF alla bozza; senza browser Claude chiede di premere "Salva allegati qui" e prepara la bozza senza allegato.

## Come funziona

1. Claude legge tutto da Google Drive (Word delle tabelle, CV, foglio scaricato in xlsx).
2. Decide con le regole di merito, in modalità **automatica** (nessuna domanda, report iniziale con le ipotesi e report finale con le decisioni) o **interattiva** (fermate di revisione).
3. Scrive **un solo file** `cfu_express_<data>.json` nella cartella della pratica.
4. L'operatore preme **CFU → Importa riconoscimento (Express)**: lo script scrive Trash, Input, matrice, CFU_per_CV, Affidabilita_CFU, Cover e la riga del Registro, poi salva `cfu_express_esito_<data>.json` con i controlli.
5. Claude rilegge l'esito da Drive e chiude con il report (anche salvato come `cfu_express_report_<data>.md`).

CV (dalla 1.6): Claude compila la colonna A di `CFU_per_CV` con i CFU proposti e li applica subito; l'operatore può cambiarla e, alla ripresa, Claude riallinea la riga CV.

## Skill

| Skill | Passi | Cosa fa |
|---|---|---|
| `cfu-express-apri` | 0-1 | apre la pratica dalla mail (come nel plugin interattivo) |
| `cfu-express-riconoscimento` | 2-5 | preparazione, matrice, CV, Cover, affidabilità via JSON |
| `cfu-express-affidabilita` | 5 | solo controllo di affidabilità, via JSON |
| `cfu-express-chiudi` | 6-8 | PDF, bozza di risposta, invio su conferma |

## Installazione nel template (una volta)

1. Nel progetto Apps Script del template aggiungi il file `scripts/ImportaRiconoscimento.gs`.
2. Dopo l'aggiornamento a 1.1.0 **sostituisci** `ImportaRiconoscimento.gs` nel template (la versione 1.0 scrive il Registro per numero di colonna e, con la colonna Provenienza in A, sbaglierebbe colonna).
3. In `onOpen()` aggiungi la voce `.addItem('Importa riconoscimento (Express)', 'importaRiconoscimento')` (già presente in `scripts/Codice.gs`, versione completa del file del template con questa sola riga in più).
4. Tieni `Affidabilita.gs` v3 (incluso).
5. Al primo uso lo script chiede l'autorizzazione (Drive per leggere il JSON e scrivere l'esito; Fogli per aggiornare il Registro).

Le pratiche aperte prima dell'installazione non hanno la voce di menu: per quelle usa il plugin interattivo o aggiungi i due file allo script della pratica.

## Uso con il plugin interattivo

I due plugin possono stare entrambi installati: le skill Express si attivano con "express", "automatico", "veloce". Per evitare ambiguità, tienine attivo uno alla volta.

## Requisiti

- Account @uninettunouniversity.net con accesso a CFU_GDrive, al template VGD e al Registro.
- Connettori Google Drive, Google Sheets e Gmail; Claude in Chrome solo per due azioni (dalla 1.7): un clic su "Aggiungi tutti a Drive" in apertura (il connettore Gmail elenca gli allegati ma non li scarica) e la bozza "Rispondi a tutti" con il PDF in chiusura.
- Gmail: due filtri con le etichette principali `CFU` e `CFUpresidenza` (solo per l'operatore; le skill non usano etichette).
- Registro con le colonne del 06/10/2026: Stato calcolato (6 valori), Revisione, Inviata il, Storia, PDF (processo.md).

## Versioni

| Plugin | Data | Novità |
|---|---|---|
| 1.9.1 | 08/10/2026 | **Trash grezzo, Input pulito** reso esplicito (Trash conserva `30 e lode`, `23/30`…; prima la skill diceva "righe pulite per trash"); nuovo `scripts/controlla_tabelle.py` (R2bis), sempre: righe grezze per Trash, righe pulite R3 per Input, anomalie STRUTTURA (celle unite/divise, colonne slittate → verifica approfondita e conferma dell'operatore), DATO (casi ambigui) e NOTA (normalizzazioni); il testo dei moduli segnala le celle unite; `verifica_scrittura.py` copia gli esami da Trash e riscrive solo le celle cambiate dalla pulizia |
| 1.9.0 | 08/10/2026 | Più veloce: modulo letto da `<nome>_testo.txt` creato dal componente Gmail allo scaricamento (niente download e decodifica del .doc); regole divise in `regole.md` (casi frequenti, 24 KB invece di 33) + `regole-casi.md` (V.O., incrociato, CV) + `regole-affidabilita.md`, lette solo se servono; `verifica_scrittura.py` produce richieste compatte (sfondo con una `repeatCell`, esami copiati da Trash a Input con `copyPaste`, `foglioVuoto` per le copie nuove: 27 → 10 KB); passo **PDF subito** in automatica (PDF chiesto nella stessa scrittura del Registro, chiusura che lo riusa); decisioni dell'operatore in R7: Metodologia della ricerca sociale → Probabilità e Statistica grado C, informatica di base fuori da Ingegneria → Informatica fino a 4/9 |
| 1.8.0 | 08/10/2026 | Pratica indicabile senza mail né browser: nome e/o cognome (qualsiasi ordine), ID pratica o link della cartella/del file, risolti da Registro → CFU_GDrive → Gmail (processo.md § *Individuare la pratica*); apertura che riusa cartella, foglio e allegati dello scaricamento automatico del componente Gmail (browser saltato se gli allegati sono già in cartella); stato `da fare` anche con cartella creata in automatico e Aperta il vuoto; numerazione `Revisione_NN` allineata alle cartelle esistenti (NN = Revisione + 1, prima `Revisione_02`); chiusura senza browser con bozza senza allegato; fermata F0: stato `in attesa segreteria` (non più `attesa-chiarimenti`, rifiutato dal menu dello Stato) |
| 1.7.0 | 07/10/2026 | Apertura sempre prima dell'analisi (cartella, foglio di riconoscimento, allegati in cartella, poi lettura dei documenti), anche se l'operatore chiede subito il riconoscimento; browser ridotto a un clic in apertura e alla bozza con PDF in chiusura; CFU della laurea di poco inferiori al totale atteso (es. 173/180, voci non curricolari non elencate) = avviso all'operatore, non fermata F0 né mail; F0 solo per incongruenze sostanziali (fermata-chiarimenti §1bis) |
| 1.6.0 | 07/10/2026 | Ipotesi di riconoscimento (esami e CV) scritte subito nel file senza chiedere il "sì"; CV con colonna A precompilata e applicata in Input!Q41:CB41; fermata dopo la scrittura ("procedo?") con rilettura e riallineamento alle modifiche dell'operatore. Restano le fermate F0 ed "esami fuori dalla gialla" |
| 1.5.0 | 06/10/2026 | Indirizzi: se lo studente chiede anche un solo indirizzo triennale si riconoscono e si spuntano in Cover **tutti** i triennali; se chiede anche un solo indirizzo magistrale, **tutti** i magistrali (singoli indirizzi solo su indicazione esplicita dell'operatore) |
| 1.4.0 | 06/10/2026 | Registro semplificato: stato calcolato da Gmail e Drive (da fare, in lavorazione, in attesa segreteria, inviata, da rivedere, annullata), niente Passo/Fermata, revisioni sulla stessa riga, Storia, riallineamento all'avvio di ogni skill; sottoetichette Gmail abolite; bozza sempre in risposta al messaggio della segreteria |
| 1.3.0 | 06/10/2026 | PDF a file chiuso dal Registro (`scripts/PdfRegistro.gs`, colonna PDF = richiesto); stesso template per uso manuale ed Express (nessuna modifica al template); scrittura diretta col connettore Google Sheets (niente JSON da importare, niente browser, foglio non letto: mappa fissa in `scripts/whitelist.json`); verifica unica del piano con `scripts/verifica_scrittura.py` (whitelist, colonne vietate, tipi, menu, somme) prima di scrivere, che prepara anche le richieste per il connettore (una `update_spreadsheet` sul file + una `update_values` sul Registro per fase); affidabilità solo su richiesta; JSON + Importa come ripiego |
| 1.2.0 | 06/10/2026 | triennale che chiede la magistrale con debiti, riconosciuta Triennale + Magistrale su autorizzazione dell'operatore → `COVER_NOTA_MAG` (Cover!C40) obbligatoria (`cover.notaMag` nel JSON, `ImportaRiconoscimento.gs` v1.2: ricopiare lo script nel template); verifica in chiusura; valori Fermata del Registro aggiornati a W1–W5; con la magistrale riga EsamiDaFare della Cover (C29) sempre evidenziata: ✔ con debiti (CFU da sostenere + scheda EsamiDaFare nel PDF) o ∅ senza debiti (0 CFU) — `cover.statoMag` nel JSON; passo o fermata saltati su indicazione dell'operatore → Registro spostato subito al passo successivo |
| 1.1.1 | 06/10/2026 | avviso "file aperto in altre schede" prima di scrivere nei fogli dal browser |
| 1.1.0 | 06/10/2026 | due provenienze delle richieste (cfu@ e presidenza.ingegneria@): colonna **Provenienza** in testa al Registro, campo `provenienza` in `pratica.json` e nel blocco `registro`; famiglie di etichette `CFU` e `CFUpresidenza`; oggetto riconosciuto come `… CFU NOME_COGNOME` (non più solo `Fwd: CFU`); `ImportaRiconoscimento.gs` 1.1 trova le colonne del Registro per intestazione |
| 1.0.3 | 06/10/2026 | fermata F0 dopo la lettura (anche in automatica): anomalie → bozza di mail alla segreteria, invio solo con ok, nessun JSON finché non arriva la risposta |
| 1.0.2 | 06/10/2026 | `trash.righeExtra` (esami da altri allegati in Trash senza sfondo); saturazione per somma di B ammessa; l'importazione centra la matrice; `ImportaRiconoscimento.gs` aggiornato |
| 1.0.1 | 06/10/2026 | nuova regola: laurea dichiarata con esami fuori dalla gialla → domanda anche in modalità automatica (includere dal certificato o solo gialla) |
| 1.0.0 | 06/10/2026 | prima versione: lettura da Drive, scrittura con JSON + Importa riconoscimento, modalità automatica e interattiva, esito e report salvati nella cartella |
