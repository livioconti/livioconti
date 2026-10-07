# Check point (cfu-express)

L'operatore sceglie all'avvio **express con check point** o **express senza check point** ("fai l'express di Rossi senza check point"). Se non lo dice: una sola `AskUserQuestion` all'avvio, `Con check point (Consigliata)` / `Senza check point`. La scelta vale per tutta la pratica (apertura, riconoscimento, chiusura) e si scrive nel report.

- **Con check point:** Claude si ferma ai punti CP1–CP5 se c'è qualcosa da decidere o da controllare.
- **Senza check point:** Claude arriva alla fine senza fermarsi: casi dubbi risolti con la scelta più prudente, **dichiarata** nel report; alla fine un solo riepilogo con tutto ciò che avrebbe chiesto.
- **In entrambi i casi nessuna mail parte senza l'ok esplicito dell'operatore** (bozze sì, invio no).

| CP | Quando | Con check point | Senza check point |
|---|---|---|---|
| **CP1 Modulo e dati** | dopo la lettura: `controlla_tabelle.py` (R2bis) e controllo di coerenza (`fermata-chiarimenti.md`) | se ci sono anomalie STRUTTURA, DATO o F0: tabella delle anomalie e **una** `AskUserQuestion`: `Prepara la mail alla segreteria` (bozza "rispondi a tutti" con le domande, invio solo con ok; Registro `in attesa segreteria` dopo l'invio) · `Prosegui con ipotesi dichiarate` · `Correggo io i dati`. Nessuna anomalia: si prosegue senza domande | si prosegue con le ricostruzioni e le ipotesi più prudenti. Se c'è un'anomalia **sostanziale** (F0): riconoscimento e PDF si fanno lo stesso, ma in chiusura si prepara **solo la bozza di chiarimenti** alla segreteria (non quella con il PDF) e il riepilogo finale lo dice in testa |
| **CP2 Riconoscimento** | dopo la scrittura di esami, CV e Cover (cfu-express-riconoscimento §5) | riepilogo + report, poi `AskUserQuestion` (`Procedi` · `Ho modificato il file: rileggi e allinea` · `Correggo in chat`). L'operatore può cambiare matrice, riga CV e colonna A di `CFU_per_CV` direttamente nel file | si prosegue |
| **CP3 Riallineamento CFU_per_CV** | **ogni volta** che si riprende una pratica già scritta (risposta a CP2, nuova sessione, cfu-express-chiudi o affidabilità) | `riallinea.py` (sotto): modifiche dell'operatore in chat, scrittura senza chiedere; solo i **conflitti** (stesso target cambiato in modo diverso in Input e in `CFU_per_CV`) si chiedono | `riallinea.py`; nei conflitti vale Input, segnalato nel riepilogo |
| **CP4 Riallineamento Affidabilita_CFU** | come CP3, **solo se il foglio `Affidabilita_CFU` è già compilato** (non lo si crea per questo) | righe aggiornate da `riallinea.py`; le righe `DA VALUTARE` (celle nuove o cambiate dall'operatore) si valutano con R10 (`regole-affidabilita.md`) prima di scrivere | uguale |
| **CP5 PDF** | dopo la creazione del PDF (cfu-express-chiudi §1, o "PDF subito") | link al PDF ed elenco dei fogli, poi `AskUserQuestion`: `PDF corretto: prepara la bozza` · `Ho modificato il file: rigenera il PDF` · `Mi fermo qui` | si prepara subito la bozza con il PDF (o quella di chiarimenti, vedi CP1) e ci si ferma: **l'invio resta all'operatore** |

## Riallineamento (CP3 + CP4)

Fonte di verità: il foglio **Input** (matrice e riga CV 41), perché è lì che l'operatore corregge.

1. Alla **prima scrittura** del riconoscimento: `verifica_scrittura.py piano.json --richieste … --stato stato.json`, poi salva `stato.json` nella cartella della pratica come **`cfu_express_stato.json`** (`create_file`, `text/plain`, senza conversione; se esiste, sostituiscilo con `update_file` del contenuto o creane uno nuovo e cestina il vecchio). È la fotografia di ciò che ha scritto Claude.
2. Alla ripresa, poche letture: `Input!A42:I<ultima>`, `Input!Q41:CB<ultima>` (riga CV + matrice), `CFU_per_CV!A2:I<n>`, `Affidabilita_CFU!A2:I<n>` e il file `cfu_express_stato.json`. Componi `foglio.json` (formato in testa a `scripts/riallinea.py`) e lancia:
   `python3 -I ${CLAUDE_PLUGIN_ROOT}/scripts/riallinea.py foglio.json --piano piano.json --stato stato.json`
3. Lo script elenca le modifiche dell'operatore e prepara il piano:
   - **CFU_per_CV:** colonna A = CFU della riga CV di Input (0 se tolti); riga nuova per i CFU da CV messi a mano senza proposta (evidenza da completare: chiedila all'operatore con check point, altrimenti "indicata dall'operatore"); colonna G ricalcolata. Se l'operatore ha cambiato **solo** la colonna A, vale la colonna A e si riscrive la riga CV di Input.
   - **Affidabilita_CFU** (se compilato): CFU attribuiti aggiornati; celle azzerate → `POSSIBILE: tolto dall'operatore`; celle nuove o cambiate → `DA VALUTARE`, che Claude sostituisce con grado e stato R10 prima di scrivere (nessuna riga `DA VALUTARE` nel foglio).
4. `verifica_scrittura.py piano.json --richieste … --stato …` (modalità revisione: niente `foglioVuoto`), una `update_spreadsheet`, nuovo `cfu_express_stato.json`, Storia del Registro + `riallineato alle modifiche dell'operatore <gg/mm hh:mm>`.
5. Le modifiche manuali alla matrice **non si correggono**: si segnalano soltanto eventuali violazioni (somme di riga/colonna, R7) nel riepilogo.

Pratiche scritte prima della 1.10 (senza `cfu_express_stato.json`): non si sa cosa abbia scritto Claude, quindi vale Input per la riga CV e la colonna A si allinea a Input; l'affidabilità si aggiorna solo nei CFU attribuiti, senza dire chi ha cambiato cosa.
