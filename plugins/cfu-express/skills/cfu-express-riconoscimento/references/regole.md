# Regole del riconoscimento (merito) — cfu-express

Queste sono le regole di merito del riconoscimento, identiche a quelle del plugin interattivo (riconoscimento-cfu-v30): cambiano solo il modo di leggere e scrivere il foglio, non le decisioni. In caso di dubbio prevale questo file.


## REGOLA FONDAMENTALE — solo la tabella gialla

- **Il riconoscimento CFU (matrice, target, voti, Cover) si basa ESCLUSIVAMENTE sugli esami della tabella GIALLA del Word.**
- La tabella gialla → `Trash` (riferimento) **e** blocco esami di `Input` (dati su cui si fa il riconoscimento).
- La tabella **azzurra** → **solo** il foglio `Trash_tabella_azzurra`. **Mai** in `Input`, **mai** in `Trash`, **mai** usata per attribuire CFU, per calcolare voti o come candidata di un target, nemmeno per i target liberi o senza voto.
- Se l'utente chiede esplicitamente di considerare anche un esame della tabella azzurra, fallo solo per quell'esame, dichiarandolo, e solo dopo averlo portato in Input su sua indicazione.
- **Laurea dichiarata ma esami non nella gialla.** Se il modulo dichiara una laurea (conseguita o in corso) i cui esami **non** sono nella tabella gialla ma si trovano in un altro file allegato (certificato, autocertificazione, piano di studi), **segnalalo e chiedi** prima del riconoscimento, anche in modalità automatica: `Includi gli esami dal certificato` / `Solo tabella gialla`. Senza risposta esplicita vale la tabella gialla. Se l'operatore li include: puliti come la gialla, vanno **sia in `Trash` sia in `Input`**, in entrambi **subito sotto** le righe della gialla (numerazione progressiva). In `Trash` **senza sfondo e senza alcun formato**: così si distinguono dagli esami della gialla, che hanno lo sfondo d'origine. In `Input` solo valori, come sempre. Nel riepilogo e nel report scrivi la fonte ("righe N–M dal certificato …"). Con due titoli così completati valuta il riconoscimento incrociato (R5).

## R1. Modulo di richiesta: cosa dichiara e cosa chiede lo studente

Prima di qualunque decisione: se fra i file c'è il **modulo di richiesta compilato** (di solito il Word "Richiesta CFU" con le tabelle; a volte un PDF o un modulo a parte), leggilo come testo. Cerca:

1. **Titolo dichiarato:** laurea **conseguita** (classe, corso, ateneo, anno, voto se indicati), **da conseguire** (iscritto a quale corso, anno, data prevista) oppure **nessuna laurea**. Controlla con la tabella gialla: una laurea conseguita ha la prova finale. Segnala le incongruenze (es. "conseguita" ma senza prova finale; "nessuna laurea" ma c'è una tesi; due titoli dichiarati → valuta R5).
2. **Cosa chiede:** il **livello** (triennale, magistrale, entrambi, corso singolo…) e gli **indirizzi** (triennali: Meccatronica, Logistico-Economico, Gestione digitale dei processi edilizi, Manutenzione aeronautica; magistrali: Produzione e gestione di beni e servizi, Sistemi energetici, Industria 4.0), oppure "tutti" / non indicato.
3. **Cos'altro dichiara:** competenze, conoscenze, corsi, master, certificazioni, lingue, esperienze di lavoro. Sono le candidate del **riconoscimento da CV** (R8), mai della matrice esami.

**Riassunto all'operatore (in chat, 4–6 righe, prima di proseguire):** chi è lo studente; titolo e carriera dichiarati; cosa chiede (livello e indirizzi); cos'altro dichiara; incongruenze o dati mancanti. Uso del riassunto:
- il **livello** del modulo decide livello e **Cover** (R9). **Gli indirizzi richiesti non restringono mai il riconoscimento:** se lo studente chiede anche un solo indirizzo triennale, il riconoscimento (matrice) e la Cover si fanno per **tutti** gli indirizzi triennali (`tutteTri` + tutte le caselle triennali); se chiede anche un solo indirizzo magistrale, per **tutti** gli indirizzi magistrali (`tutteMag` + tutte le caselle magistrali). Gli indirizzi indicati dallo studente si riportano solo nel riassunto e nel report ("indirizzo richiesto: …");
- due titoli dichiarati (triennale + magistrale/specialistica) → valuta il riconoscimento incrociato (R5);
- un titolo dichiarato i cui esami **non** sono nella tabella gialla ma in un altro allegato → segnala e chiedi (REGOLA FONDAMENTALE), anche in modalità automatica;
- le competenze dichiarate vanno al passo CV (R8) solo se l'operatore l'ha scelto; altrimenti scrivile nel riassunto come "dichiarate, non valutate";
- se il modulo manca o non si legge, dillo in una riga e prosegui con i soli dati della tabella gialla.

## R2. Estrazione delle tabelle (gialla e azzurra)

- **Lettura veloce:** usa prima `read_file_content` (Drive) sul Word: dà il testo e le tabelle senza dover trascrivere file binari. Scarica il binario (`download_file_content` → .docx, `word/document.xml`) **solo** se dal testo non si distinguono con certezza le due tabelle: in quel caso i colori (`w:shd/@w:fill`) decidono quale è quale.
- **Tabelle da estrarre:** quelle con intestazione `N. | Università | Facoltà | Corso di Laurea | Esame | Voto | Data | CFU | SSD`:
  - **gialla** (es. `FFFF99`): esami della carriera dichiarata — di norma la prima; **è l'unica base del riconoscimento**;
  - **azzurra** (es. `C6D9F1`): esami di corsi non conclusi / altre carriere — di norma la seconda; **solo riferimento**.
  Ignora le righe di intestazione e le tabelle senza righe di dati (dillo in una riga: "tabella azzurra vuota"). Se non riesci a stabilire con certezza quale tabella è la gialla, **chiedi** prima di scrivere.
- **Tieni le due tabelle sempre separate**, dall'estrazione alla scrittura: mai unirle in un elenco unico.
- **Annota il colore di sfondo di ciascuna tabella** (`w:shd/@w:fill` nel .docx, `bgcolor`/`background` nell'HTML di un .doc): serve solo per lo sfondo dei Trash. Per il resto lavori con **valori di testo**: bordi, font e a capo del Word non si riportano. Un campo su più paragrafi diventa una riga sola (SSD uniti con `, `; testi uniti con uno spazio).
- **File .doc (vecchio formato):** `read_file_content` può tornare vuoto. Spesso il .doc è uno zip con `word/afchunk.htm` (HTML in **windows-1252**): scaricalo una volta, decodifica con `cp1252` e prendi le tabelle dall'HTML (il colore è in `bgcolor`).

## R3. Pulizia (una sola volta, prima di scrivere; vale per entrambe le tabelle)

| Caso | Valore pulito |
|---|---|
| `23/30`, `18 / 30`, `30/30` | `23`, `18`, `30` |
| `30 e lode`, `30/30 e lode`, `30L`, `30/30L`, `30 LODE`, `30 con lode` | **`31`** |
| `IDONEO`, `Idoneo`, `ido`, `sup`, `APPROVATO`, `BUONO`, `OTTIMO`, `SUFF.` | invariati (testo) |
| data `gg/mm/aa` | `gg/mm/20aa` |
| SSD su più righe o senza slash (`ICAR21`) | `ING-IND/16, ING-IND/17`; `ICAR/21` |
| parole attaccate nel nome esame | separate |
| spazi doppi, spazi iniziali/finali | rimossi |
| **N.** | rinumerato 1..N **separatamente per ciascuna tabella** |
| esame di **vecchio ordinamento** (`V.O.`, `v.o.`, `vecchio ordinamento`, `ante 509`, `ord. previgente` nel modulo di dichiarazione CFU o nella tabella gialla) **senza CFU** | in `Trash` **invariato**; in `Input` il valore scelto dall'utente (proposta: **10**) con cella rossa — vedi R3bis |

### R3bis. Esami di vecchio ordinamento senza CFU

- **Riconoscimento:** nel modulo di dichiarazione CFU e/o nella tabella gialla l'esame è indicato come vecchio ordinamento (`V.O.`, `VO`, `v.o.`, `vecchio ordinamento`, `ante 509`, `ord. previgente`; colonne Corso di Laurea, Esame, CFU o note) **e** la colonna CFU non contiene un numero (vuota, `VO`, `-`, `n.d.`…). Se il segnale è dubbio (es. solo un corso annuale senza dicitura V.O.), chiedilo come caso ambiguo.
- **Avviso e scelta (prima di scrivere):** elenca questi esami in chat e, nella **stessa** `AskUserQuestion` dei casi ambigui (R3), chiedi quanti CFU assumere: `10 CFU per tutti (Consigliata)` oppure `Scelgo io` (valori nel campo Altro, es. `Analisi I=12; Fisica=9`). Non usare valori diversi da quelli confermati.
- **`Trash`:** il campo CFU resta **esattamente come nel Word** (es. `VO`, vuoto): è il riferimento della dichiarazione.
- **`Input`:** nella colonna CFU (8ª di `INPUT_ESAMI`) scrivi il valore scelto (10 o quello indicato), poi colora lo **sfondo** di quella sola cella in rosso **`#E06666`**: tonalità diversa dal rosso `#FF0000` (testo non valido) e dal rosa `#F4CCCC` delle regole condizionali del Voto, e dallo sfondo delle celle di testo. Nel JSON: indice della riga in `esami.cfuAssunti` (lo script colora la cella). Nella verifica della colonna H la somma include i CFU assunti.
- Nel controllo di affidabilità queste righe sono al più INCERTO con motivazione "CFU assunti (V.O.)"; a fine riconoscimento ricorda in chat che i CFU assunti vanno confermati.

**Controllo di regolarità** sul risultato (in memoria, non nel foglio): N. progressivo; B–E non vuote; voto 18–31 o giudizio; data valida; CFU > 0; SSD riconoscibile (anche `NN`, `PROFIN_S`); nessun campo slittato. Non inventare CFU o voti mancanti, **con una sola eccezione**: esame di vecchio ordinamento senza CFU (R3bis), con il valore confermato dall'utente. Refusi evidenti (es. `ingengneria`) si correggono solo se l'utente ha chiesto di "pulire"; altrimenti si segnalano. Casi **ambigui**: raccoglili tutti e chiedili **in una sola domanda** prima di scrivere; i casi deterministici correggili senza chiedere.

## R4. Foglio Input: intervalli denominati, righe 24–26, codici indirizzo

| Nome | Contenuto |
|---|---|
| `INPUT_INDIRIZZI` | ID (1,2,3,8 tri; 5,6,7 mag) · denominazione · **limite CFU da CV** (48 tri, 24 mag) · livello |
| `INPUT_TARGET_NOMI` / `INPUT_TARGET_CODICI` | nome e codice indirizzo di ogni target |
| `INPUT_RIEP_CODICI` | codici delle colonne di riepilogo |
| `INPUT_TOT_CFU_SOSTENUTI` | totale CFU sostenuti (formula) |
| `INPUT_RIEPILOGO` | per indirizzo: previsti · da CV · da esami · bonus · riconosciuti · rimanenti |
| `INPUT_RIEP_CV` / `INPUT_RIEP_RIMANENTI` | righe "da CV" e "rimanenti" del riepilogo |
| `INPUT_T_PREVISTI` | CFU previsti per target (**tetto di colonna**) |
| `INPUT_T_DA_CV` / `INPUT_T_DA_ESAMI` | CFU da CV / da esami per target (formule) |
| `INPUT_T_BONUS` | bonus (manuale; non toccarlo) |
| `INPUT_T_RICONOSCIUTI` / `INPUT_T_RIMANENTI` | riconosciuti (cappati) / rimanenti per target |
| `INPUT_T_VOTO` | voto del target: media pesata; "-" con CFU da CV; 0 se solo esiti testuali |
| `INPUT_ESAMI_INTEST` | intestazione blocco esami |
| `INPUT_NOTA_LAVORO` | nota attività lavorativa (non è un esame) |
| `INPUT_CFU_PRECEDENTI` | CFU già riconosciuti in precedenza (**non per il CV**) |
| `INPUT_CV_CFU` | formula = massimo di `INPUT_RIEP_CV` (non sovrascriverla) |
| `INPUT_CV_MATRICE` | **la riga dei CFU da CV**, una cella per target |
| `INPUT_CV_CONTROLLI` | controlli per indirizzo della riga CV |
| `INPUT_ESAMI` | esami della **tabella gialla** , colonna CFU = 8ª |
| `INPUT_MATRICE` | CFU di ogni esame (riga) su ogni target (colonna) |
| `INPUT_CONTROLLI` | controllo di riga per indirizzo ("Errore" se supera i CFU dell'esame) |

**Righe 24–26 di Input (Q:BC, target triennali) → foglio EsamiDaFare.** Riga 24 = formula `=OR(Q8=0,Q8=123)` (inclusi per default); riga 26 = formula `=Q24*(1-Q25)*(Q34>0)=1` (esame da fare: incluso, non escluso a mano, con CFU rimanenti > 0; un esame riconosciuto per intero esce da solo da EsamiDaFare). La formula della riga 26 va scritta **senza separatori né VERO/FALSO**: il foglio è in italiano e le formule con la virgola scritte da script danno `#ERROR!` (svuotano EsamiDaFare). **Non scrivere mai nelle righe 24 e 26**: sono formule, e niente caselle di controllo (un clic sovrascriverebbe la formula). Riga 25 = **esclusione manuale**: casella di controllo, spuntata (`TRUE`) = esame tolto da EsamiDaFare; nel template sono spuntate per default AZ25:BC25 (a scelta, Tirocinio, Ulteriori Conoscenze, Prova Finale). Nei file vecchi senza caselle vale ancora il testo "NO". Tocca la riga 25 solo se l'utente lo chiede, scrivendo `TRUE`/`FALSE`, mai testo. **Svuotamento pratica** (`svuotaPratica` nello script del foglio): cancella anche i bonus `INPUT_T_BONUS` (Q32:CB32) e toglie le spunte da Q25:AY25; AZ25:BC25 restano spuntate.

### Codici indirizzo

0 = comune triennali · 1/2/3/8 = Meccatronica / Logistico-Economico / Edilizia / Aeronautica · 12, 23, 28, 123, 128 = combinazioni triennali · 4 = comune magistrali · 5/6/7 = Produzione / Sistemi energetici / Industria 4.0 · 56, 57 = combinazioni magistrali · 999 = "Altri esami" (parcheggio). **Triennali** = {0,1,2,3,8,12,23,28,123,128}; **magistrali** = {4,5,6,7,56,57}.

| # | Indirizzo | Codici che somma |
|---|---|---|
| 1 | Meccatronica (Tri.) | 0, 1, 12, 123, 128 |
| 2 | Logistico-Economico (Tri.) | 0, 2, 12, 23, 28, 123, 128 |
| 3 | Gestione digitale processi edilizi (Tri.) | 0, 3, 23, 123 |
| 4 | Manutenzione aeronautica (Tri.) | 0, 8, 28, 128 |
| 5 | Produzione e gestione beni/servizi (Mag.) | 4, 5, 56, 57 |
| 6 | Sistemi energetici (Mag.) | 4, 6, 56 |
| 7 | Industria 4.0 (Mag.) | 4, 7, 57 |

**Target speciali** (dal nome): Tirocinio, Ulteriori Conoscenze, Altre conoscenze utili (senza voto), Inglese Tecnico, Insegnamenti / Esami a scelta, Prova Finale, "Altri esami" (999). Il controllo di riga è **per indirizzo**: lo stesso esame può servire un target triennale e uno magistrale.

## R5. Base dati, livello, contesto e riconoscimento incrociato

- **Base dati:** esclusivamente gli esami in `INPUT_ESAMI`, cioè la tabella gialla. Prima di iniziare, verifica che il numero di esami in `INPUT_ESAMI` coincida con quello della tabella gialla (se la preparazione è stata fatta in questa pratica) e che nessuna riga provenga dalla tabella azzurra. `Trash_tabella_azzurra` **non si legge** durante il riconoscimento.
- **Livello:** esami triennali → target triennali; esami magistrali → target magistrali **e** triennali (un esame più avanzato copre un corso di base); ciclo unico → entrambi. Il livello della sorgente si legge dal corso di laurea (colonna D). **Eccezione — riconoscimento incrociato (R5):** se lo studente ha **sia** una triennale A **sia** una magistrale/specialistica B, anche gli esami di A possono andare su target magistrali.
- **Contesto di provenienza (colonne C e D):** esame sostenuto nell'ambiente disciplinare proprio della materia → riconoscilo con **generosità** (niente decurtazioni); ambiente lontano e contenuto incerto → eventuale riconoscimento parziale **dichiarato**. Economia/Management → target economico-gestionali; Matematica/Fisica/Statistica → target di base; Ingegneria → target tecnici; Informatica → target informatici; Agraria/Psicologia/Scienze politiche/Giurisprudenza/Lettere → caso per caso. Il contesto non è mai da solo motivo di esclusione e non promuove di grado (R7).

### Riconoscimento incrociato fra carriere (A + B → C o D)

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

## R6. Ottimizzazione — OBBLIGATORIO

**5.2.0 Usa i dati così come sono:** valori insoliti si segnalano ma si usano. Limiti ammessi solo strutturali: CFU dell'esame per indirizzo, `INPUT_T_PREVISTI`, tetto per grado (R7).

**Procedi per target, non per esame:**
1. Pool degli esami (solo gialla): riga, nome, SSD, facoltà e corso, CFU, voto (o esito), CFU residui **per indirizzo**.
2. **Esiti non numerici** solo per Tirocinio, Inglese Tecnico, Ulteriori Conoscenze / Altre conoscenze utili: consumali per primi lì.
3. Ordina i target: curricolari specifici → con più candidati → **per ultimi i liberi**.
4. Per ogni target: candidati **prima per grado (R7), poi per voto decrescente** dentro il grado. Il voto non fa salire di grado.
5. **Target liberi** (Insegnamenti / Esami a scelta) = esami residui a voto più alto.
6. **Doppia valenza:** un esame usato nel triennale è ancora interamente disponibile per il magistrale.
7. Preferisci i target con codice **0 / 4** per gli esami a voto alto.
8. Non lasciare target parziali se c'è un candidato compatibile libero (nei limiti del grado).
9. **Tetto di colonna:** `INPUT_T_DA_ESAMI ≤ INPUT_T_PREVISTI` (l'eccesso diluisce il voto).
10. **Target senza voto** (Tirocinio, Ulteriori/Altre conoscenze): riempili per ultimi con i CFU residui di qualunque esame compatibile della gialla.
11. **Satura i target invece di riempirne molti a metà**: un 9/9 è un esame in meno; spezza un esame su più colonne se serve (somma di riga per indirizzo ≤ CFU dell'esame). Esempio: Matematica generale (6, voto 21) + Metodi matematici dell'economia (6, voto 24) verso due target da 9 → ❌ 6/9 + 6/9; ✅ 9/9 + 3/9. Mai oltre il tetto del grado; se il voto peggiora, dichiara il trade-off.
12. **Compatibilità = nome + contenuto + SSD**, non SSD da solo (economia ad Agraria `AGR/01`, statistica a Psicologia `M-PSI/03`, matematica a Economia `SECS-S/06`, disegno ad Architettura `ICAR/17`). Se coincide solo l'SSD è compatibilità debole. Quando decidi sul nome contro l'SSD, scrivilo nella motivazione.
13. **Passata finale sui CFU residui:** per i target con `INPUT_T_RIMANENTI` fra 1 e 3, cerca CFU spendibili **per esame e per indirizzo** (`CFU − somma sulle colonne di quell'indirizzo`; un esame speso su un altro indirizzo è ancora disponibile; attenzione ai residui frazionari) e usa il candidato almeno di grado B con voto più alto. Ripeti finché serve.

## R7. Gradi di compatibilità

| Grado | Quando | Tetto dei CFU da quell'esame su quel target |
|---|---|---|
| **A — Piena** | il target *è* la materia dell'esame | fino al **100%**: può saturare da solo |
| **B — Parziale** | copre una componente o è affine ma distinta | max **1/3** dei CFU previsti (per eccesso) per ciascun contributo; un B da solo non satura mai il target |
| **C — Debole** | coincide solo SSD, una parola o l'area | **0** sui curricolari; solo target liberi e senza voto |

a. Il voto non promuove di grado. b. Più contributi B solo se coprono componenti diverse. c. Se esiste un A si usa quello. d. **Saturazione per somma:** un target si può saturare anche **senza A**, se la somma di più contributi parziali (B da esami, B da CV accettato, o misti esami + CV) copre componenti **diverse** del target e ciascuno rispetta il tetto di 1/3: in quel caso il target è **chiuso** e le celle sono valutate come normali B (niente segnalazione di saturazione). Resta vietato saturare con **un solo** B/C o con più B sulla **stessa** componente (un 3/9 motivato vale più di un 9/9 indifendibile). e. Dichiara sempre il grado (per un B, la componente coperta). f. Test prima di saturare con un solo esame: "il docente del corso target direbbe che non c'è nulla da seguire?" Se no, è B.

Esempi: Economia e Gestione delle Imprese Industriali → Organizzazione aziendale **A**; Economia Aziendale → Organizzazione aziendale **A**; **Sociologia Industriale → Organizzazione aziendale B** (max 3/9, solo con un A); Statistica I → Gestione della Qualità **B**; Ricerca Operativa → Modellazione dei sistemi produttivi e logistici **A**; Diritto delle Procedure Concorsuali → Diritto commerciale **A**; Matematica Finanziaria → Metodi Matematici per l'Ingegneria **B**; Storia Economica → Economia dell'innovazione **C**; Chimica → Chimica e Scienza dei Materiali **B** (manca scienza dei materiali). I gradi valgono anche per il CV.

### Regole per tipo di target

- Curricolari: solo voti numerici; mai tesi/prova finale o esiti idoneo come sorgente; saturabili da un solo esame solo se grado A.
- Tirocinio, Inglese Tecnico, Ulteriori/Altre conoscenze: esiti APPR/IDO ammessi e preferiti; poi residui; grado C ammesso.
- Prova Finale come target: mai.
- Priorità: curricolari → ulteriori conoscenze → tirocinio → a scelta.

### Controlli prima di scrivere il JSON

Ogni riga della matrice con CFU corrisponde a un esame della **tabella gialla** (o a un esame incluso da un altro allegato su indicazione dell'operatore, REGOLA FONDAMENTALE); somme di riga per indirizzo ≤ CFU dell'esame; somme di colonna ≤ `INPUT_T_PREVISTI`; nessun curricolare saturato da un solo B/C (la saturazione per somma di B su componenti diverse, da esami e/o CV, è ammessa: punto d); nessun B oltre 1/3; nessun A scartato per un grado inferiore; nessun esame a voto ≥ 27 libero con un target compatibile disponibile o servito da un voto peggiore dello stesso grado; nessun target senza voto con residui attribuibili; nessuna coppia di target dello stesso ambito entrambi parziali quando uno si può saturare; nessun target a 1–3 CFU dalla chiusura con CFU spendibili. Poi scrivi il blocco `matrice` e i totali attesi (`attesi.daEsami`).

Chiudi con la tabella `target | CFU | esami usati | grado | voto risultante | motivazione` e gli esami rimasti liberi con CFU spendibili per indirizzo.

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

## R9. Cover — solo intervalli `COVER_*`

| Nome | Cosa fare |
|---|---|
| `COVER_COGNOME` | se già compilato (`XXXX_YYYY`) lascialo; scrivi solo se vuoto o su indicazione |
| `COVER_TUTTE_TRI` / `COVER_TUTTE_MAG` | spunta secondo il livello: livello triennale richiesto (anche per un solo indirizzo) → `COVER_TUTTE_TRI` `TRUE`; livello magistrale richiesto (anche per un solo indirizzo) → `COVER_TUTTE_MAG` `TRUE` |
| `COVER_IND_TRI` / `COVER_IND_MAG` | **tutte** le caselle del livello richiesto a `TRUE` (4 triennali, 3 magistrali), anche se lo studente ha indicato un solo indirizzo; le caselle di un livello non richiesto restano `FALSE`. Spunta singoli indirizzi solo su indicazione esplicita dell'operatore in chat |
| `COVER_RIGHE` | verifica; EsamiDaFare e Cons solo se richiesti |
| `COVER_STATO_MAG` (`Cover!C29`, riga "Esami che è necessario sostenere per iscriversi alla Laurea Magistrale") | **Se il riconoscimento comprende la magistrale la riga è sempre evidenziata, mai `✗`**: `∅` = accesso senza debiti, **0 CFU** da sostenere, scheda EsamiDaFare **non** allegata; `✔` = debiti formativi, riga con il **numero di CFU da sostenere** e scheda **EsamiDaFare allegata** al PDF. Con triennale + richiesta di magistrale con debiti (caso di `COVER_NOTA_MAG`) vale sempre `✔`. Solo valori del menu `✔`/`∅`/`✗`; in Express `cover.statoMag`. Senza magistrale: `✗` |
| `COVER_NOTA_MAG` (`Cover!C40`) | **`TRUE` obbligatorio** quando lo studente ha solo una triennale, chiede la magistrale con debiti formativi (requisiti curriculari mancanti) e l'operatore autorizza il riconoscimento **sia triennale sia magistrale**: la nota spiega che la magistrale richiede esami integrativi e che la pratica è svolta anche per la triennale. In Express: `cover.notaMag: true`. In tutti gli altri casi `FALSE` |
| `COVER_AVVISO_DOTT` | solo se richiesto |
| `COVER_NOMEFILE` | **mai scrivere** (formula) |

**Nessuna nota libera nella Cover** (niente campo `COVER_NOTE` né testi aggiunti): le note sulla pratica vanno in chat e, se servono, nella mail di accompagnamento.

Lo spunta "tutte" attiva il gruppo (trigger `onEdit`): verifica che risulti `TRUE`. Solo `TRUE`/`FALSE`, mai testo. Nessun autofit nei fogli Tri.*, Mag.*, EsamiDaFare, Cons. Se un nome manca, segnalalo.

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

## R11. Divieti (merito)

- **Non usare mai gli esami della tabella azzurra** in `Input`, nella matrice, nei voti, nel riconoscimento da CV o nella Cover; non scriverli in `Trash`.
- Non nascondere, eliminare, rinominare, spostare o duplicare fogli; non crearne, salvo `Trash_tabella_azzurra` se manca. `Trash`, `Trash_tabella_azzurra`, `CFU_per_CV`, `Affidabilita_CFU` si riempiono soltanto.
- Scrivere `Affidabilita_CFU` **solo** nel controllo di affidabilità (R10), quando richiesto.
- **Allineamento della matrice:** i valori scritti nella matrice (`INPUT_MATRICE` e riga CV) sono **centrati**. Il template VGD ha le righe 42–57 senza allineamento (numeri a destra) e le righe 58–1003 centrate: l'importazione Express centra tutto il blocco; nel flusso interattivo, se l'allineamento non è uniforme, segnalalo (si sistema una volta nel template: Q41:CB1003 → Allinea al centro).
- Non colorare celle (eccezioni: lo sfondo d'origine in `Trash` e `Trash_tabella_azzurra`, R2; la cella CFU rossa `#E06666` degli esami V.O. con CFU assunti, R3bis) e non aggiungere o modificare regole condizionali (eccezione: estensione delle regole del Voto a R0, solo su richiesta).
- Non inserire né eliminare righe in `Input`; non scrivere sopra R0 o nelle formule (righe 24 e 26 comprese).
- Non toccare impostazioni di stampa; non esportare PDF o altri file (li produce **cfu-express-chiudi**).
- Non usare i target "Altri esami" (999) né Prova Finale per un riconoscimento; non mettere CFU da CV in `INPUT_CFU_PRECEDENTI` o `INPUT_NOTA_LAVORO`.
