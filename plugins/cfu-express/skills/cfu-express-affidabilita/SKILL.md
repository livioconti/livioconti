---
name: cfu-express-affidabilita
description: "Controllo di affidabilità Express (AFFIDABILE / INCERTO / POSSIBILE) di un riconoscimento CFU già presente nel foglio RiconoscimentoCFU_IngGestionale: legge il file da Drive, valuta ogni cella della matrice e della riga CV con le regole R10 e scrive il foglio Affidabilita_CFU con un JSON importato da CFU → Importa riconoscimento (Express). Usala per \"affidabilità express\", \"controllo affidabilità\" dopo modifiche manuali alla matrice."
---

# cfu-express-affidabilita

È un **test**, non un riconoscimento: non sposta, non aggiunge e non toglie CFU. Regole di merito: `references/regole-affidabilita.md` (R10 stati) e `references/regole.md` (R7 gradi, R5) della skill **cfu-express-riconoscimento**. Formato del JSON: `references/formato-json.md` della stessa skill.

## Passi

0. **Individua la pratica** come in `references/processo.md` della skill cfu-express-apri (mail aperta, nome/cognome, ID o link): il file è quello della colonna *File riconoscimento* del Registro.
1. **Lettura (Drive, una volta):** `download_file_content` del foglio in xlsx; openpyxl nel workspace. Servono `INPUT_ESAMI`, `INPUT_MATRICE`, `INPUT_CV_MATRICE`, `INPUT_TARGET_NOMI`, `INPUT_TARGET_CODICI`, `INPUT_T_PREVISTI`, `INPUT_T_DA_ESAMI`, `INPUT_T_RIMANENTI`, `INPUT_CONTROLLI`, `INPUT_CV_CONTROLLI`, `CFU_per_CV` e lo sfondo della colonna CFU di `INPUT_ESAMI` (rosso `#E06666` = CFU assunti di un V.O.). Se manca un nome, fermati e dillo.
2. **Valutazione (R10):** ogni cella con CFU > 0 → una riga AFFIDABILE o INCERTO; coppie A/B escluse → POSSIBILE (con CFU potenziali; "ATTRIBUZIONE MANCATA:" se applicabili subito). Grado A/B/C su curricolari e Inglese Tecnico, `Libero` sui target senza programma. Controlli strutturali: "Errore" nei controlli, colonne oltre `INPUT_T_PREVISTI`, target saturato da un solo B/C, A scartato per un grado inferiore. Nel dubbio: INCERTO.
3. **Verifica nel workspace:** CFU attribuiti = valore della cella; somma uguale alla matrice; ogni POSSIBILE su una cella vuota; nessuna cella mancante o doppia; testi mai con `=`, `+`, `-` iniziali.
4. **Scrittura:** piano con `Affidabilita_CFU!A2:I` (il Registro non cambia, solo Storia + `affidabilità <data>` se vuoi tracciarla), verifica unica con `verifica_scrittura.py`, "sì" dell'operatore, una scrittura diretta col connettore Sheets (procedura in `references/scrittura.md` della skill cfu-express-riconoscimento). Ripiego senza connettore: JSON + **CFU → Importa riconoscimento (Express)**.
5. **In chat:** conteggio verde / grigio / rosso; INCERTO con il motivo (prima gli "ERRORE:"); POSSIBILE con CFU potenziali (prima le "ATTRIBUZIONE MANCATA:"). I colori: **CFU → Affidabilità riconoscimento (mostra/nascondi)**.

## Da non fare

Scrivere altro che `Affidabilita_CFU` e la riga del Registro; correggere la matrice; usare il browser per scrivere celle.
