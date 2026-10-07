# Fermata F0 — chiarimenti alla segreteria (dopo la lettura)

Si applica **subito dopo la lettura** dei dati (modulo di richiesta, tabelle, altri allegati, CV) e **prima** di scrivere qualunque cosa nel foglio. Vale in **tutte le modalità**, anche in quella automatica: un dato che non torna non si trasforma in ipotesi se cambia il riconoscimento.

## 1. Controllo di coerenza (dopo la lettura)

Raccogli in una lista **tutte** le anomalie, ciascuna con file, riga e dato:

| Tipo | Esempi |
|---|---|
| **Documenti mancanti o illeggibili** | modulo di richiesta assente; tabella gialla vuota; certificato o CV citati nel modulo ma non allegati; file protetto, scansione illeggibile |
| **Titolo dichiarato non coerente** | laurea "conseguita" senza prova finale; "nessuna laurea" ma c'è una tesi; classe o corso diversi tra modulo e certificato; date di conseguimento incompatibili |
| **Esami incoerenti tra fonti** | esame nella gialla ma non nel certificato (o viceversa); voti, CFU, date o SSD diversi; somma dei CFU della laurea **molto** diversa da quella attesa (vedi §1bis) |
| **Dati essenziali mancanti** | esami senza voto, senza data o senza CFU (escluso il V.O. gestito con i CFU assunti, R3bis); SSD mancanti in blocco; ateneo o corso non indicati |
| **Richiesta non chiara** | livello o indirizzi non indicati e non deducibili; richiesta per un corso diverso da Ingegneria Gestionale; indirizzi incompatibili col livello |
| **Identità** | nome o cognome diversi tra mail, modulo e certificati |

## 1bis. Somma dei CFU della laurea: avviso o anomalia

Confronta la somma dei CFU della gialla con il totale atteso del titolo dichiarato (triennale 180, magistrale 120, ciclo unico 300/360).

- **Avviso (niente F0, niente mail):** la somma è **inferiore di poco** — indicativamente fino a ~15 CFU, cioè il peso tipico di prova finale/tesi, tirocinio, altre attività, idoneità o esami a scelta — e il titolo resta plausibile (gli esami curricolari ci sono, date e corso coerenti). Spesso lo studente non ha elencato la tesi, il tirocinio o altre voci non curricolari. Segnalalo all'operatore come **Avviso** nel report iniziale (CFU letti, CFU attesi, differenza, voci che probabilmente mancano) e prosegui con la sola gialla; ripetilo nel report finale e nella Storia.
- **Anomalia sostanziale (F0):** differenza grande (indicativamente oltre ~15 CFU o oltre il 10% del totale); somma **superiore** al totale atteso senza spiegazione; laurea dichiarata "conseguita" ma mancano prova finale **e** buona parte delle attività finali; mancano esami curricolari evidenti del corso dichiarato; esami di carriere diverse mescolati nella gialla; corso, classe o date incompatibili con il titolo dichiarato.
- Valuta sempre se ci sono incongruenze sostanziali anche quando la differenza è piccola (es. 173/180 ma con la prova finale assente in una laurea dichiarata conseguita): nel dubbio presenta il caso all'operatore come avviso con la domanda `Prosegui` / `Prepara la mail`, senza dare per scontata la mail.

Non sono anomalie da segreteria (si risolvono con le regole o con l'operatore): somma dei CFU di poco inferiore al totale atteso (§1bis), refusi evidenti, normalizzazioni (/30, lodi, date), esami V.O. senza CFU, scelta "includere o no gli esami di un altro allegato" (REGOLA FONDAMENTALE: è una domanda all'operatore).

## 2. Fermata

Se la lista è **vuota**: dillo in una riga ("Lettura: nessuna anomalia") e prosegui.

Se la lista **non è vuota**, fermati e mostra all'operatore la tabella `# | Anomalia | File | Dato letto | Domanda per la segreteria`, poi **una** `AskUserQuestion` (`header`: `Chiarimenti`):

- `Prepara la mail alla segreteria (Consigliata)` — bozza con le domande, pratica sospesa;
- `Prosegui con ipotesi dichiarate` — solo se le anomalie non cambiano il riconoscimento o l'operatore se ne assume la scelta: ogni ipotesi va nel report e nelle Note del Registro;
- `Correggo io i dati` — l'operatore indica le correzioni in chat, poi si prosegue.

## 3. Mail di richiesta chiarimenti

1. **Destinatari:** "rispondi a tutti" alla mail originale della pratica (`messageId` nel Registro, colonna `Mail (messageId)`, o in `pratica.json`; la segreteria destinataria è quella della colonna Provenienza), escluso l'utente; leggili con `get_thread`. Se l'operatore indica altri destinatari, usa quelli e dillo.
2. **Oggetto:** quello del thread (risposta). **Testo proposto** (modificabile):
   > Gentili colleghi,
   > per completare il riconoscimento CFU di XXX (nome e cognome) servono i seguenti chiarimenti:
   > 1. …
   > 2. …
   > Resto in attesa di un riscontro (eventualmente con i documenti integrativi).
   > Cordiali saluti,
   > <nome e cognome dell'operatore>

   Domande brevi e verificabili, una per anomalia, con il dato letto e il file ("nel certificato l'esame X risulta con 6 CFU, nella tabella del modulo con 9: quale è corretto?"). Niente giudizi sul riconoscimento, niente CFU proposti.
3. **Bozza:** connettore Gmail `create_draft` in risposta al messaggio originale (nessun allegato). Mostra in chat destinatari, oggetto e testo.
4. **Invio solo con ok esplicito** dell'operatore in chat riferito a questa bozza (oppure la invia lui da Gmail). Mai invio automatico.
5. **Registro**: niente da scrivere alla bozza. Quando la mail di chiarimenti (senza PDF) è inviata, il riallineamento porta lo stato a `in attesa segreteria`; Storia + `chiarimenti chiesti <data>: <domande in breve>`.
6. **Niente scrittura nel foglio della pratica** finché non arriva la risposta.

## 4. Ripresa

Quando arriva la risposta, l'operatore rilancia il riconoscimento ("riprendi la pratica XXX"):
1. `get_thread` sul thread originale: leggi la risposta della segreteria; eventuali nuovi allegati vanno salvati nella cartella della pratica (come in apertura) prima di rileggerli.
2. Applica le risposte (riassunto in chat: domanda → risposta → effetto), rifai il controllo del §1 sui dati aggiornati.
3. Registro: la risposta della segreteria riporta lo stato a `in lavorazione` (riallineamento); Storia + `risposta segreteria <data>`. Poi prosegui con il passo successivo.
