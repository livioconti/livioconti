# Regole per i casi meno frequenti (cfu-express)

Si leggono solo quando la pratica li presenta (richiamate da `regole.md`). Merito invariato.

## R3bis. Esami di vecchio ordinamento senza CFU

- **Riconoscimento:** nel modulo di dichiarazione CFU e/o nella tabella gialla l'esame è indicato come vecchio ordinamento (`V.O.`, `VO`, `v.o.`, `vecchio ordinamento`, `ante 509`, `ord. previgente`; colonne Corso di Laurea, Esame, CFU o note) **e** la colonna CFU non contiene un numero (vuota, `VO`, `-`, `n.d.`…). Se il segnale è dubbio (es. solo un corso annuale senza dicitura V.O.), chiedilo come caso ambiguo.
- **Avviso e scelta (prima di scrivere):** elenca questi esami in chat e, nella **stessa** `AskUserQuestion` dei casi ambigui (R3), chiedi quanti CFU assumere: `10 CFU per tutti (Consigliata)` oppure `Scelgo io` (valori nel campo Altro, es. `Analisi I=12; Fisica=9`). Non usare valori diversi da quelli confermati.
- **`Trash`:** il campo CFU resta **esattamente come nel Word** (es. `VO`, vuoto): è il riferimento della dichiarazione.
- **`Input`:** nella colonna CFU (8ª di `INPUT_ESAMI`) scrivi il valore scelto (10 o quello indicato), poi colora lo **sfondo** di quella sola cella in rosso **`#E06666`**: tonalità diversa dal rosso `#FF0000` (testo non valido) e dal rosa `#F4CCCC` delle regole condizionali del Voto, e dallo sfondo delle celle di testo. Nel JSON: indice della riga in `esami.cfuAssunti` (lo script colora la cella). Nella verifica della colonna H la somma include i CFU assunti.
- Nel controllo di affidabilità queste righe sono al più INCERTO con motivazione "CFU assunti (V.O.)"; a fine riconoscimento ricorda in chat che i CFU assunti vanno confermati.


## Riconoscimento incrociato fra carriere (A + B → C o D)

Prima di applicarlo leggi `riconoscimento-incrociato.md` (stessa cartella) (ratio, verifica numerica, esempio, testo della nota).

- **Quando:** in `INPUT_ESAMI` ci sono una triennale conclusa A (prova finale presente) **e** una magistrale/specialistica conclusa B. Con **solo A** gli esami di A **non** vanno sui target magistrali (divieto classico).
- **Seconda triennale C:** si usano A e B senza vincoli ulteriori (abbreviazione di carriera).
- **Seconda magistrale D:** un esame di A va su un target magistrale solo se:
  1. vale l'invariante 180 + 120: per ogni indirizzo magistrale, (CFU di A + B) − (R_A + R_B) ≥ 180, dove R = CFU degli esami di A e B riconosciuti su quell'indirizzo (il CV escluso);
  2. la base residua (esami non usati su D) soddisfa i requisiti curriculari di D, se noti;
  3. il corso di D non presuppone già quella materia a livello triennale (se è il "seguito" dell'esame di A, al massimo grado B);
  4. gradi, tetti e doppia valenza restano quelli del R6–R7; a parità di grado si preferiscono gli esami di B.
- **Procedura:** lato triennale (C), dopo la matrice con gli esami di A fai una passata con gli esami di B sui target triennali vuoti o parziali. Lato magistrale (D), fai prima la matrice con i soli esami di B, poi una **passata incrociata** sugli esami di A per i target magistrali vuoti o parziali. Ri-ottimizza le coppie quando un esame di A libera un esame di B per un target più specifico (es. Ricerca Operativa I su Modellazione, Ricerca Operativa II su Ricerca operativa II), scegliendo la configurazione con più CFU per indirizzo.
- **Obbligatorio, a fine riconoscimento (in chat, mai nel file):** la verifica dell'invariante per indirizzo e la **nota del riconoscimento incrociato** (testo standard, §6 del riferimento) come commento. La nota non va nella Cover: è la skill **cfu-express-chiudi** a proporla per la mail di accompagnamento.


## R8. Riconoscimento da CV — foglio `CFU_per_CV`

1. Leggi CV/certificazioni selezionati ed estrai evidenze concrete (ruoli, durata, mansioni, certificazioni). I diplomi (laurea, scuola superiore) non sono evidenze da CV.
2. Leggi capienze: `INPUT_T_PREVISTI`, `INPUT_T_DA_ESAMI`, `INPUT_T_RIMANENTI`, `INPUT_RIEPILOGO`, limiti CV di `INPUT_INDIRIZZI` (48 tri, 24 mag).
3. `CFU_per_CV` è **fisso** (fra `Input` e `Trash`): non crearlo, eliminarlo o rinominarlo, non riscriverne l'intestazione. Si scrive solo da **`A2`** (blocco `cfuPerCV` del JSON).
4. Colonne (intestazione già in A1:I1, da verificare): **A** Accetto/rifiuto (in Express Claude la compila con i CFU proposti; l'utente può cambiarla: `sì`/`no`, oppure **un numero = accetto con quei CFU**, es. `2`, `0` = rifiuto) · **B** Livello (`Triennale` / `Magistrale`, dal codice del target) · **C** Colonna (colonna della matrice) · **D** Target · **E** Indirizzi (codice indirizzo del target, es. `123`, `4`, `57`) · **F** CFU proposti (numero) · **G** CFU target ancora da riconoscere (numero, = `INPUT_T_RIMANENTI` prima del CV: CFU previsti del corso target meno quelli già riconosciuti da esami; **non** sono i CFU dell'esame né dell'attività) · **H** Grado affidabilità riconoscimento (A/B/C) · **I** Evidenza dal CV (verificabile). Mai `"3 / 3"` in una cella.
5. **Express:** scrivi le proposte con la colonna A già compilata (CFU proposti) e applica subito gli stessi CFU in `INPUT_CV_MATRICE`, senza chiedere. In chat, dopo la scrittura: proposta sintetica, effetto per indirizzo, voci scartate; poi **fermati** e chiedi se procedere: l'operatore può cambiare la colonna A nel file.
6. I CFU applicati sono sempre quelli della colonna A (numero = quel valore; `sì` = colonna F; `no`/`0`/vuota = nessuno).
7. Quando l'operatore risponde: rileggi `CFU_per_CV!A:F`, e se la colonna A è cambiata riscrivi `INPUT_CV_MATRICE` di conseguenza. `INPUT_CV_CFU` non si sovrascrive.
8. Verifica `INPUT_RIEP_CV` entro i limiti, nessun "Errore", `INPUT_RIEP_RIMANENTI ≥ 0`. Dopo la prima scrittura non modificare più la colonna A (è dell'operatore) né svuotare il foglio.
9. Avvisa prima che le colonne con CFU da CV mostrano "-" come voto (elenca i voti che si perderebbero).
10. Gli esami della tabella azzurra **non** sono evidenze da CV: non usarli nemmeno qui.

