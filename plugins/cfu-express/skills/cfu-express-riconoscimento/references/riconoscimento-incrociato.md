# Riconoscimento incrociato fra carriere — ratio e regole operative

Documento di riferimento della skill `cfu-express-riconoscimento` (references/regole.md, R5). Spiega **perché** gli esami di una triennale A possono essere riconosciuti su una magistrale D quando lo studente possiede anche una magistrale (o specialistica) B, e **perché questo non viola** la struttura 180 + 120 né il divieto di riconoscere i CFU del titolo di accesso.

## 1. Notazione

- **A** = laurea triennale già conseguita (180 CFU, livello 1).
- **B** = laurea magistrale/specialistica già conseguita (120 CFU, livello 2), costruita su A.
- **C** = nuova laurea triennale richiesta (180 CFU).
- **D** = nuova laurea magistrale richiesta (120 CFU), con accesso che richiede una laurea.
- **R_A**, **R_B** = CFU degli esami di A e di B riconosciuti su D.

## 2. Cosa protegge davvero la regola 180 + 120

Chi consegue una laurea magistrale deve avere alle spalle **una base di 180 CFU** (titolo di accesso e requisiti curriculari) **più 120 CFU magistrali distinti da quella base**. La regola "i CFU del titolo di accesso non si riconoscono sulla magistrale" serve a impedire il **doppio conteggio**: uno stesso CFU non può valere sia come base sia come credito della magistrale.

Il vincolo da rispettare quindi non è "un esame triennale non va mai su un target magistrale", ma questo **invariante**:

> **Dopo il riconoscimento su D, la carriera pregressa deve ancora contenere una base di almeno 180 CFU, disgiunta dai CFU riconosciuti su D, che soddisfi i requisiti curriculari di accesso a D.**

## 3. Verifica dell'invariante nei tre casi

**Caso 1 — solo A → magistrale D (la regola classica).**
Base disponibile dopo il riconoscimento = 180 − R_A. Deve essere ≥ 180, quindi **R_A = 0**: nessun esame di A si riconosce su D. Il divieto classico è un caso particolare dell'invariante. Se un corso di D ripete contenuti di A, la conseguenza corretta è la **sostituzione** del corso nel piano di studi, non un riconoscimento.

**Caso 2 — A + B → seconda triennale C.**
L'accesso a C richiede il diploma: nessun CFU universitario è "consumato" come base. Si riconoscono esami di A **e** di B secondo contenuto e grado (abbreviazione di carriera ordinaria). Un esame di B, più avanzato, può coprire un corso di C.

**Caso 3 — A + B → seconda magistrale D (riconoscimento incrociato).**
La carriera pregressa ha 300 CFU distinti. Base disponibile dopo il riconoscimento = (180 − R_A) + (120 − R_B) = 300 − (R_A + R_B). L'invariante richiede 300 − (R_A + R_B) ≥ 180, cioè **R_A + R_B ≤ 120**. È sempre vero, perché su D si riconoscono al massimo 120 CFU meno la prova finale. In più la base residua deve soddisfare i **requisiti curriculari** di D (minimi di CFU per gruppi di SSD): va verificato sugli esami **non** usati su D.

Gli esami di B rimasti fuori da D possono far parte della base: un credito di livello magistrale copre a maggior ragione un requisito di livello triennale. Per questo, con A + B, alcuni esami di A diventano disponibili per D: il loro ruolo di base viene coperto da crediti di B non usati, senza doppio conteggio.

**Paradosso che conferma la ratio.** Se con A + B si considerassero "consumati" tutti i CFU della catena di accesso, nemmeno gli esami di B sarebbero riconoscibili su D. Questo contraddice la prassi universalmente accettata del riconoscimento della prima magistrale sulla seconda. La lettura corretta è l'invariante, non il divieto letterale.

## 4. Condizioni operative per usare un esame di A su D

Un esame di A si attribuisce a un target di D solo se valgono **tutte** queste condizioni:

1. **Lo studente ha anche B** (magistrale o specialistica conclusa). Con solo A vale il Caso 1: niente esami di A su D.
2. **Invariante numerico:** per ogni indirizzo magistrale, (CFU totali di A + B) − (R_A + R_B) ≥ 180. I CFU da CV non entrano nel conto: non vengono dalla carriera.
3. **Requisiti curriculari:** se il regolamento di D li fissa per SSD, la base residua (esami di A e B non usati su D) li soddisfa. Se non sono noti, scrivilo nella nota per la mail come verifica a carico della Segreteria.
4. **Contenuto:** il corso di D non presuppone già quella materia a livello triennale. Esempio: "Metodi numerici" sta nella magistrale di Gestionale perché le triennali gestionali non lo hanno, quindi per chi ha Analisi Numerica I e II nella sua triennale è contenuto acquisito (grado A). Se invece il corso di D è il seguito avanzato dell'esame di A, l'esame di A vale al massimo grado B.
5. **Gradi e tetti** di §5.3 invariati. **Doppia valenza invariata**: lo stesso esame di A può servire anche un target triennale.
6. **Preferenza:** a parità di grado, usa prima gli esami di B. Gli esami di A completano i target che B non copre.
7. **Trasparenza:** a fine riconoscimento dai in chat la nota (testo standard al §6); la mail di accompagnamento la riporta se l'utente lo approva. Nessuna nota nella Cover.

## 5. Esempio (caso tipo, studente XXX)

A = laurea triennale in Ingegneria dell'informazione (Classe 9, 180 CFU). B = laurea specialistica nello stesso ambito (Classe 35/S, 120 CFU). Richiesta: magistrale in Ingegneria Gestionale. Valori illustrativi.

| Target D | Esame di A | Grado | CFU |
|---|---|---|---|
| Metodi numerici | Analisi Numerica I + II | A | 5 + 4 |
| Modellazione dei sistemi produttivi e logistici | Ricerca Operativa I (+ Ricerca Operativa II di B, 5) | A | 4 |
| Ricerca operativa II | Ricerca Operativa I (residuo) | B | 1 |
| Automazione dei processi industriali | Automazione Industriale I (+ Controllo digitale di B, 2) | A | 4 |
| Economia dell'innovazione | Economia dei Sistemi per l'Informazione | B | 3 |
| Diritto commerciale | Elementi di Diritto per l'Informatica | B | 2 |
| Digital innovation | Economia dei Sistemi per l'Informazione (residuo) | B | 2 |

Lato triennale (caso 2, esami di B su target triennali): Ricerca Operativa II → Ricerca operativa 1 CFU (A); Controllo digitale → Robotica 3 CFU (B); Complementi di Basi di Dati → Business intelligence 3 CFU (B). CFU riconosciuti: Meccatronica e Logistico-Economico da 105 a 109, Aeronautica da 85 a 86.

Verifica: Industria 4.0 (caso peggiore) ha R_A = 23 e R_B = 24, quindi la base residua è 300 − 47 = 253 ≥ 180 ✔. CFU riconosciuti sulla magistrale: Produzione da 29 a 46, Sistemi energetici da 35 a 53, Industria 4.0 da 39 a 62.

## 6. Testo standard della nota (chat e mail di accompagnamento)

> Il riconoscimento considera l'intera carriera pregressa. Per la Laurea Triennale sono stati riconosciuti anche esami della Laurea Specialistica (Classe XX/S). Per la Laurea Magistrale sono stati considerati sia gli esami della Laurea Specialistica sia gli esami della Laurea triennale (Classe YY) eccedenti i requisiti curriculari di accesso: nessun CFU è utilizzato contemporaneamente come requisito di accesso e come credito riconosciuto.

Tieni solo le frasi pertinenti: senza esami di B sui target triennali togli la seconda; senza esami di A sui target magistrali togli la terza.

Adatta classi e denominazioni (LM-xx al posto di xx/S, ecc.). Non iniziare mai il testo con `=`, `+` o `-`.

## 7. Dove va la nota

- **Mai nella Cover** né in altri fogli del file: il PDF resta quello standard e lo svuotamento del template non deve gestire nessuna nota.
- **In chat**, come commento finale del riconoscimento (skill cfu-express-riconoscimento), insieme alla verifica dell'invariante per indirizzo.
- **Nella mail di accompagnamento**, solo se serve e solo con l'ok dell'utente: la skill cfu-express-chiudi riconosce il riconoscimento incrociato dalla matrice e propone di aggiungere la nota al testo della bozza.
