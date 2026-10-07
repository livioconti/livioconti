# Scrittura diretta nel foglio (connettore Google Sheets)

Claude decide e scrive: niente JSON da importare, niente browser. Il file di riconoscimento può restare chiuso.

## Cosa si scrive (whitelist)

Solo queste celle. Tutto il resto del file e del Registro non si scrive mai. La lista completa e leggibile da script è `scripts/whitelist.json` del plugin.

| Fase | Cosa | Dove | Come |
|---|---|---|---|
| Apertura | nome studente | `Cover!G19` | testo `COGNOME_NOME` |
| Dati | tabella gialla | `Trash!A1:I` | valori **grezzi** (come scritti, riallineati alle 9 colonne) + sfondo d'origine (es. `#FFFF99`) |
| Dati | tabella azzurra | `Trash_tabella_azzurra!A1:I` | valori grezzi + sfondo d'origine |
| Dati | esami (= gialla pulita, R3) | `Input!A42:I` | valori puliti: lo script li copia da Trash e riscrive solo le celle cambiate dalla pulizia |
| Dati | CFU assunti V.O. | `Input!H<riga>` | solo sfondo `#E06666` |
| Esami | matrice | `Input!Q42:CB` | solo valori (la formattazione è già nel foglio); mai `BC`, `BD:BF`, `CB` |
| CV | proposte | `CFU_per_CV!A2:I` | valori, colonna A **compilata con i CFU proposti** |
| CV | CFU applicati | `Input!Q41:CB41` | valori della colonna A di `CFU_per_CV` (subito alla prima scrittura; riallineati dopo le modifiche dell'operatore) |
| Affidabilità (solo se chiesta) | tabella | `Affidabilita_CFU!A2:I` | valori |
| Cover | livelli e indirizzi | `B25` + `C25:C28` (tri), `B31` + `C31:C33` (mag) | `TRUE`/`FALSE`, **sempre anche le singole caselle**: per il livello richiesto tutte `TRUE` (anche se lo studente indica un solo indirizzo, regole R1/R9) |
| Cover | esami per la magistrale | `C29` | `✔` / `∅` / `✗` (regole R9) |
| Cover | nota magistrale | `C40` | `TRUE`/`FALSE` (regole R9) |
| Cover (solo su richiesta) | Cons, avviso dottorato, esclusioni EsamiDaFare | `C30`, `C43`, `Input!Q25:BC25` | `TRUE`/`FALSE` |
| Registro | riga dello studente | solo le colonne calcolate (processo.md: Stato, Revisione, Inviata il, link, Mail (messageId), Ultimo aggiornamento, Storia in coda, PDF); mai `Mail (link)` né `Note` | valori esatti del menu Stato |

Perché le singole caselle della Cover: il legame "tutte" → indirizzi e lo stato di C29 li fa lo script `onEdit`, che parte solo con una modifica fatta a mano. Scrivendo dall'esterno vanno scritte tutte le caselle.

## Come (una fase = una scrittura)

1. **Nessuna lettura del foglio.** Il template è fisso, le copie mantengono gli stessi `sheetId` e una pratica nuova è vuota: target, codici, CFU previsti, celle scrivibili e `sheetId` sono in `whitelist.json`. Si legge dal foglio solo la colonna A di `CFU_per_CV` (secondo giro CV, `get_values`); dal Registro la riga 1 e la riga della pratica, una volta per sessione (`get_values` su `Registro!A1:O<n>`).
2. Componi il **piano** della fase in un JSON nel workspace (`range` + `valori` [+ `sfondo`], `esami`, blocco `registro` con `intestazioni`, `riga`, `campi`) e lancia **una volta**:
   `python3 -I ${CLAUDE_PLUGIN_ROOT}/scripts/verifica_scrittura.py piano.json --richieste richieste.json`
   Verifica tutto in un colpo (whitelist, colonne vietate, dimensioni, tipi, menu, testi con `= + -`, somme di riga per indirizzo, colonne ≤ previsti), stampa i CFU per indirizzo e prepara le richieste pronte. Se dà errori, correggi il piano: nel foglio non è stato scritto nulla.
3. **Scrivi subito, senza chiedere conferma.** Il riepilogo si mostra dopo la scrittura, insieme alla domanda "procedo?" (SKILL §6).
4. **Due chiamate in tutto:**
   - file di riconoscimento: **una** `update_spreadsheet` con l'array `riconoscimento` di `richieste.json` (se una richiesta non è valida Google non applica nulla). Per stare corte le richieste usano: una `repeatCell` per lo sfondo di Trash; `copyPaste` (solo valori) da `Trash` a `Input!A42` quando gli esami coincidono, così viaggiano una volta sola; con `"foglioVuoto": true` nel piano (copia nuova del template) solo le celle piene della matrice. Esempio reale (12 esami): 27 KB → 10 KB;
   - Registro: **una** `update_values` con `registro.range` e `registro.values` (i `null` lasciano intatte le colonne non toccate, es. `Mail (link)`).
5. Fine: la risposta `status: success` vale come conferma; i totali per indirizzo sono quelli stampati al punto 2. **Nessuna rilettura.**

## Revisione di una pratica già scritta

Nel piano usa come `range` l'intero intervallo della whitelist (es. `Input!A42:I1003`) con le righe nuove in testa e righe vuote dopo: `updateCells` svuota le celle non fornite, quindi riscrittura e pulizia avvengono nella stessa chiamata. Mai fuori dalla whitelist.

## Se il connettore Sheets non è disponibile

Ripiego: JSON `cfu_express_*.json` + **CFU → Importa riconoscimento (Express)** (`formato-json.md`).
