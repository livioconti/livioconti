# Regole del controllo di affidabilità (cfu-express)

Usate solo dalla skill **cfu-express-affidabilita** (su richiesta). Gradi R7 e incrociato R5 in `regole.md`.

## R10. Controllo di affidabilità — regole

**Foglio `Affidabilita_CFU`** (fisso, fra `CFU_per_CV` e `Input`; non crearlo, eliminarlo o rinominarlo). Intestazione già in A1:I1, da verificare (**la colonna Stato non esiste più**; intestazioni del 06/10/2026):

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Riga | Livello | Colonna | Esame svolto / CV | Target | Grado affidabilità riconoscimento | CFU attribuiti | CFU potenziali | Motivazione |

- **Riga** (numero) e **Colonna** (lettera) calcolate dagli intervalli denominati (R4). Riga CV = riga di `INPUT_CV_MATRICE`.
- **Livello** = livello del target: `Triennale` o `Magistrale`, dal codice in `INPUT_TARGET_CODICI` (R4).
- **Esame svolto / CV** = colonna E di `INPUT_ESAMI` (per la riga CV: `CV: <evidenza sintetica>`, dall'evidenza di `CFU_per_CV`). **Target** = nome in `INPUT_TARGET_NOMI`.
- **Stato (senza colonna):** la valutazione AFFIDABILE / INCERTO / POSSIBILE si scrive come **prefisso della Motivazione**: `AFFIDABILE: …`, `INCERTO: …` (`INCERTO: ERRORE: …` per gli errori), `POSSIBILE: …` (`POSSIBILE: ATTRIBUZIONE MANCATA: …`). Le righe POSSIBILE si riconoscono anche dalla colonna CFU attribuiti vuota.
- **Grado affidabilità riconoscimento — regola fissa:** il grado misura quanto il contenuto dell'esame (o dell'evidenza CV) copre il **programma** del target, quindi si scrive solo dove un programma c'è:
  - **sempre A/B/C** sui target **curricolari** e su **Inglese Tecnico** (ha un contenuto preciso: la lingua);
  - **mai A/B/C** sui target **senza programma** — Insegnamenti a scelta, Esami a scelta dello studente, Ulteriori Conoscenze, Altre conoscenze utili, **Tirocinio** —: qui si scrive **`Libero`** (il grado non si applica), sia per gli esami sia per il CV. Il prefisso di stato di queste righe dipende solo dalla coerenza della fonte (esame a voto numerico per i liberi; attività o esame coerente per gli altri).
  - Il Grado riguarda la **coppia** esame → target, non l'esame: lo stesso esame può essere A su un target, B su un altro e `Libero` su un target senza programma.
- **CFU attribuiti** = valore attuale della cella (vuoto per POSSIBILE); **CFU potenziali** solo per POSSIBILE.
- **Motivazione** breve e verificabile; mai iniziare un testo con `=`, `+` o `-`.
- Una riga per cella, ordinate per Riga e poi per colonna.

**Stati:**
- **AFFIDABILE** — grado A, livello corretto, provenienza propria o neutra, nessuna violazione strutturale; oppure target libero con esame a voto numerico; oppure Tirocinio / Ulteriori Conoscenze / Altre conoscenze utili / Inglese Tecnico con esito o esame coerente; CV solo se accettato in `CFU_per_CV` e di grado A (oppure `Libero` su un target senza programma, es. Tirocinio).
- **INCERTO** — grado B o C; compatibilità decisa sul nome contro un SSD di altra area; provenienza lontana; dato insolito; esame di vecchio ordinamento con **CFU assunti** (cella CFU rossa `#E06666`; motivazione "CFU assunti (V.O.)"); cella coinvolta in una violazione strutturale ("Errore" nei controlli, colonna oltre `INPUT_T_PREVISTI`, target saturato da un solo B/C, A scartato per un grado inferiore); CV senza accettazione tracciata. Livello sbagliato (un esame di A su un target magistrale **non** è livello sbagliato se vale R5: in quel caso stato secondo il grado e, dopo il prefisso di stato, "Incrociato:"), esito non numerico su curricolare, CFU su Prova Finale o su "Altri esami" (999): INCERTO con motivazione **"INCERTO: ERRORE: …"**.
- **POSSIBILE** (cella vuota) — coppia esame → target di grado A o B, livello compatibile, voto numerico se il target è curricolare, mai Prova Finale / 999 / grado C. Motivazione = vincolo che la tiene fuori ("esame esaurito su Meccatronica", "target saturo", "CV in attesa di conferma in CFU_per_CV"). **CFU potenziali** = min(CFU spendibili dell'esame per quell'indirizzo, tetto di grado, `INPUT_T_PREVISTI`). Se esame e target hanno entrambi ancora capienza: motivazione che inizia con **"ATTRIBUZIONE MANCATA:"** e i CFU applicabili subito (non applicarla).
- Nel dubbio fra AFFIDABILE e INCERTO: INCERTO.

**Verifica:** prima di scrivere il JSON, ogni cella con CFU > 0 ha esattamente una riga AFFIDABILE o INCERTO con "CFU attribuiti" uguale al valore della cella, e la somma dei CFU attribuiti = somma della matrice; ogni POSSIBILE punta a una cella vuota. Dopo: riga 1 intatta, dati dalla riga 2, nessun altro foglio cambiato.

**In chat:** conteggio verde (AFFIDABILE) / grigio (INCERTO) / rosso (POSSIBILE); elenco degli INCERTO con il motivo (prima gli "ERRORE:"); elenco dei POSSIBILE con CFU potenziali (prima le "ATTRIBUZIONE MANCATA:"). I colori si vedono con **CFU → Affidabilità riconoscimento (mostra/nascondi)** (serve `Affidabilita.gs` v3).

