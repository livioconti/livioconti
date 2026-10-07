# Riconoscimento CFU — add-on Gmail/Drive

Un solo progetto Apps Script che fa due cose:

| Modo | Chi | Cosa fa |
|---|---|---|
| **A mano** (pannello in Gmail) | chiunque installa l'add-on | Con la mail aperta: "Salva allegati qui" → cartella `CFU_COGNOME_NOME` (o `Revisione_NN` se esiste), file di riconoscimento, riga nel registro. |
| **Automatico** (facoltativo) | solo chi preme **Attiva** nel pannello | Ogni ora salva gli allegati delle nuove mail con etichetta `CFU` o `CFUpresidenza` e aggiorna il registro. |

Lo scaricamento automatico è personale: lo attiva ogni utente per la propria casella, dalla sezione *Scaricamento automatico* in fondo al pannello. Per chi non lo attiva l'add-on resta "a richiesta".

## Regole dello scaricamento automatico

- **Prima mail della pratica**: crea `CFU_GDrive/CFU_COGNOME_NOME`, salva gli allegati e crea il file di riconoscimento dal template.
- **Mail successive**, sia nello stesso thread sia in un nuovo thread per lo stesso studente: vanno in `CFU_COGNOME_NOME/Revisione_02`, `Revisione_03`, …
- **Mail con allegati già tutti presenti** (stesso nome e dimensione), per esempio la stessa pratica inoltrata sia da cfu@ sia da presidenza: non crea nessuna cartella, aggiunge solo una nota in *Storia*.
- **Mail ignorate**: quelle inviate da te, quelle senza allegati e quelle arrivate prima dell'attivazione.
- **Mail già salvate a mano** con il pulsante: non vengono salvate una seconda volta.
- **Oggetti riconosciuti**: `Fwd: CFU NOME_COGNOME` e `Ingegneria Gestionale_Fwd: CFU NOME_COGNOME`, la variante delle mail della presidenza. Con un oggetto diverso la cartella si chiama `CFU_DA_SMISTARE_<oggetto>`.

## Testo dei moduli (per il plugin cfu-express)

Quando salva un allegato Word (`.doc` dei moduli di richiesta, `.docx`), lo script scrive accanto `<nome>_testo.txt` con anagrafica, richiesta e tabelle (`[TABELLA n · sfondo #ffff99]` = gialla, `#c6d9f1` = azzurra). Il plugin legge quel file invece di scaricare e decodificare il Word, che il connettore Drive spesso legge vuoto. Vale sia per lo scaricamento automatico sia per il pulsante. Per le pratiche già in CFU_GDrive: dall'editor esegui una volta `creaTestiModuliEsistenti`.

## Registro (`Registro pratiche CFU`)

Lo script trova le colonne **per intestazione**, quindi puoi spostarle senza problemi; non rinominarle però. Lo script scrive solo:

- **Pratica nuova**: una riga subito sotto l'ultima pratica (mai in fondo al foglio) con ID `CFU-AAAA-NNN`, stato `da fare`, Revisione 0, link a cartella, file e mail, e una voce in Storia.
- **Pratica esistente** (cercata prima per thread, poi per studente):
  - aggiorna *Revisione*, *Storia* e *Ultimo aggiornamento*, e completa i link mancanti;
  - lo **stato** cambia solo da `inviata` o `in attesa segreteria` a `da rivedere`. Negli altri stati resta com'è.
- **Non tocca** *Mail (link)* (è una formula: scriverci la rompe), *Operatore* (delle righe esistenti), *Inviata il*, *Aperta il*, *Note*, *PDF* né le altre righe.

Corrispondenza revisioni: Revisione 0 corrisponde alla cartella principale, Revisione 1 a `Revisione_02`, Revisione 2 a `Revisione_03`, e così via.

Se il registro non è raggiungibile, per esempio per un collega senza accesso, gli allegati vengono salvati lo stesso e il pannello lo segnala. Per escluderlo del tutto: `AGGIORNA_REGISTRO = false`.

## Etichette Gmail

Bastano `CFU` e `CFUpresidenza`, applicate dai filtri della skill *cfu-setup-gmail*. **Non servono sottoetichette di stato**: lo stato vive solo nel registro. Due posti da tenere allineati sarebbero più lavoro e più errori.

## Installazione / aggiornamento

1. Apri il progetto Apps Script esistente e sostituisci `Codice.gs` e `appsscript.json` con questi file. Per vedere `appsscript.json`: Impostazioni progetto → "Mostra il file manifest".
2. Ricarica Gmail e apri una mail CFU. L'add-on chiede di nuovo le autorizzazioni, perché ora servono la lettura delle mail (per la ricerca automatica) e i trigger.
3. Se vuoi lo scaricamento automatico, nel pannello premi **Attiva** nella sezione *Scaricamento automatico*.

Per verificare l'esecuzione automatica: editor Apps Script → *Esecuzioni*. Ogni mail elaborata compare nel log con l'esito.

> Se il dominio limita l'accesso completo a Gmail per le app di terze parti, l'autorizzazione `https://mail.google.com/` potrebbe essere bloccata. In quel caso il pulsante manuale continua a funzionare; per l'automatico serve il via libera dell'amministratore.
