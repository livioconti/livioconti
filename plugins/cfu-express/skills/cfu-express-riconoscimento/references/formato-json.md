# Formato del file `cfu_express_<AAAAMMGG-HHMM>.json`

Lo scrive Claude nella cartella della pratica con il connettore Drive (`create_file`, `contentMimeType: application/json`, `disableConversionToGoogleType: true`, `parentId` = cartella del file di riconoscimento). Lo legge **CFU → Importa riconoscimento (Express)** (`ImportaRiconoscimento.gs`), che sceglie il file `cfu_express_*.json` modificato più di recente. Un nome nuovo per ogni importazione: i file precedenti restano come traccia.

Ogni blocco è **facoltativo**: si scrive solo ciò che è presente. Valori: numeri come numeri, testi come stringhe (mai iniziare con `=`, `+`, `-`), date `gg/mm/aaaa`, celle vuote `""`.

```json
{
  "versione": 1,
  "studente": "COGNOME_NOME",
  "trash":        { "sfondo": "#FFFF99", "righe": [[1, "Università", "Facoltà", "Corso", "Esame", 28, "12/03/2010", 6, "MAT/05"]],
                    "righeExtra": [[2, "Università", "Facoltà", "Corso", "Esame dal certificato", 27, "10/02/2005", 6, "MAT/09"]] },
  "trashAzzurra": { "sfondo": "#C6D9F1", "righe": [] },
  "esami":        { "righe": [[1, "Università", "Facoltà", "Corso", "Esame", 28, "12/03/2010", 6, "MAT/05"]],
                    "cfuAssunti": [4] },
  "matrice":      { "celle": [[42, "T", 9], [43, "AK", 3]],
                    "cv": [["T", 6]] },
  "cfuPerCV":     { "righe": [["", "Triennale", "T", "Target", 123, 6, 6, "A", "Evidenza dal CV"]] },
  "affidabilita": { "righe": [[42, "Triennale", "T", "Esame", "Target", "A", 9, "", "AFFIDABILE: …"]] },
  "cover":        { "tutteTri": true, "indTri": [true, true, true, true], "tutteMag": false, "indMag": [false, false, false], "notaMag": false, "statoMag": "∅" },
  "registro":     { "idPratica": "CFU-AAAA-NNN", "provenienza": "cfu@", "stato": "in lavorazione", "nota": "…" },
  "attesi":       { "daEsami": [0, 0, 0, 0, 0, 0, 0], "daCV": [0, 0, 0, 0, 0, 0, 0] }
}
```

| Blocco | Cosa fa lo script |
|---|---|
| `trash`, `trashAzzurra` | svuota il foglio (A:I, valori e formati) e scrive le righe da A1 con lo `sfondo` d'origine; crea `Trash_tabella_azzurra` se manca. `righeExtra` (solo `trash`): esami inclusi da altri allegati su indicazione dell'operatore, scritti subito sotto `righe` **senza sfondo né formati**. |
| `esami` | svuota i valori di `INPUT_ESAMI` (mai le formule) e scrive le righe da R0. `cfuAssunti` = indici (da 0) delle righe con CFU di vecchio ordinamento assunti: la cella CFU diventa `#E06666`; toglie il rosso rimasto da pratiche precedenti. |
| `matrice` | `celle` = `[riga del foglio, colonna, CFU]` sulla matrice (righe di `INPUT_MATRICE`). `cv` = `[colonna, CFU]` sulla riga `INPUT_CV_MATRICE`. Svuota prima la matrice (e la riga CV **solo se `cv` è presente**: senza `cv` la riga CV resta com'è). Solo celle con CFU > 0; il resto vuoto. Centra i valori di tutta la matrice e della riga CV (il template ha un allineamento non uniforme). |
| `cfuPerCV` | righe da A2 (9 colonne del §6 delle regole). Se la colonna A ha già decisioni dell'operatore chiede conferma prima di sovrascrivere (`"sovrascriviDecisioni": true` per saltare la domanda). |
| `affidabilita` | spegne la colorazione, svuota da A2 e scrive le righe (9 colonne, stato come prefisso della Motivazione). |
| `cover` | `tutteTri`/`tutteMag` spuntano il gruppo; `indTri` (4 valori) / `indMag` (3 valori) spuntano le singole caselle: per il livello richiesto **tutte `true`** anche se lo studente indica un solo indirizzo (regole R1/R9; singoli indirizzi solo su indicazione esplicita dell'operatore); aggiorna `COVER_STATO_MAG` (∅/✗) come il trigger del foglio. `notaMag` (`true`/`false`) spunta o toglie `COVER_NOTA_MAG` (`Cover!C40`): `true` obbligatorio per una triennale che chiede la magistrale con debiti, riconosciuta Triennale + Magistrale su autorizzazione dell'operatore (regole R9). `statoMag` (`"✔"` / `"∅"` / `"✗"`) scrive `COVER_STATO_MAG` (`Cover!C29`): con la magistrale mai `✗` (`✔` con debiti → EsamiDaFare nel PDF; `∅` senza debiti, 0 CFU). Se assente vale la logica automatica (∅ se c'è la magistrale). |
| `registro` | (ripiego) aggiorna la riga con quell'`idPratica`: Stato (menu del Registro), Ultimo aggiornamento, Note. Con la scrittura diretta il Registro lo scrive Claude (processo.md). |
| `attesi` | totali per indirizzo attesi (7 valori, ordine di `INPUT_RIEP_CODICI`) da confrontare con `INPUT_RIEPILOGO` dopo la scrittura. |

**Esito.** Dopo l'importazione lo script scrive `cfu_express_esito_<data>.json` nella stessa cartella: blocchi scritti, errori (celle "Errore", totali diversi dagli attesi, formule cambiate), riepilogo per indirizzo (previsti, da CV, da esami, bonus, riconosciuti, rimanenti). Claude lo rilegge da Drive (`read_file_content` o `download_file_content`) per la verifica: niente browser.
