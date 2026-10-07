#!/usr/bin/env python3
"""Riallineamento dopo le modifiche dell'operatore (plugin cfu-express), deterministico.

Uso:  python3 -I riallinea.py foglio.json [--piano piano.json] [--stato nuovo_stato.json]

foglio.json (Claude lo compone con poche get_values, valori come restituiti dal connettore):
{
  "stato":        contenuto di cfu_express_stato.json (fotografia dell'ultima scrittura di Claude),
  "esami":        Input!A42:I<ultima>       (righe esami),
  "matrice":      Input!Q42:CB<ultima>      (righe, dalla colonna Q),
  "cv":           Input!Q41:CB41            (una riga, dalla colonna Q),
  "cfuPerCV":     CFU_per_CV!A2:I<n>        (può essere []),
  "affidabilita": Affidabilita_CFU!A2:I<n>  (può essere [])
}

Fonte di verità = foglio Input (la matrice e la riga CV li modifica l'operatore):
 1. elenca le celle di Input cambiate rispetto alla fotografia (matrice e riga CV);
 2. CFU_per_CV: la colonna A segue la riga CV di Input (numero; 0 se tolto); per un target con CFU
    da CV messi a mano senza proposta aggiunge una riga "inserita dall'operatore"; ricalcola G
    (CFU del target ancora da riconoscere dopo gli esami). Se invece l'operatore ha cambiato solo la
    colonna A di CFU_per_CV (Input invariato), vale la colonna A e si riscrive la riga CV di Input.
    Se ha cambiato entrambe in modo diverso: conflitto, vale Input (segnalato);
 3. Affidabilita_CFU (solo se non è vuoto): aggiorna "CFU attribuiti" delle celle cambiate, aggiunge
    le celle nuove con motivazione "DA VALUTARE" (grado e stato li decide Claude con R10 prima di
    scrivere), trasforma in POSSIBILE le celle azzerate dall'operatore.
Stampa le modifiche trovate; con --piano scrive il piano per verifica_scrittura.py (modalità
revisione: righe intere, le celle in più vengono svuotate); con --stato la nuova fotografia.
"""
import json, os, re, sys

QUI = os.path.dirname(os.path.abspath(__file__))
WL = json.load(open(os.path.join(QUI, "whitelist.json"), encoding="utf-8"))
TARGET = {t["col"]: t for t in WL["target"]}
COL0 = 17  # colonna Q
TRI = {0, 1, 2, 3, 8, 12, 23, 28, 123, 128}


def n2col(n):
    s = ""
    while n: n, r = divmod(n - 1, 26); s = chr(65 + r) + s
    return s


def col2n(c):
    n = 0
    for ch in c: n = n * 26 + ord(ch) - 64
    return n


def num(v):
    s = str(v if v is not None else "").strip().replace(",", ".")
    if s in ("", "-"): return 0
    try:
        x = float(s); return int(x) if x.is_integer() else x
    except ValueError:
        return None


def celle(righe, riga0):
    """{(riga, col): cfu>0} da righe di valori che partono dalla colonna Q."""
    out = {}
    for i, r in enumerate(righe or []):
        for j, v in enumerate(r):
            c = n2col(COL0 + j)
            x = num(v)
            if c in TARGET and x: out[(riga0 + i, c)] = x
    return out


def colonna_a(v, f):
    s = str(v or "").strip().lower()
    if s in ("sì", "si", "s", "yes"): return num(f) or 0
    if s in ("no", "", "n"): return 0
    x = num(s)
    return x if x is not None else 0


def intero(x):
    return int(x) if float(x).is_integer() else x


def livello(c):
    return "Triennale" if TARGET[c]["codice"] in TRI else "Magistrale"


def main():
    d = json.load(open(sys.argv[1], encoding="utf-8"))
    stato = d.get("stato") or {}
    esami = d.get("esami") or []
    m_ora = celle(d.get("matrice"), 42)
    cv_ora = {c: x for (_, c), x in celle([d.get("cv") or []], 41).items()}
    m_prima = {(int(k.split("|")[0]), k.split("|")[1]): v for k, v in (stato.get("matrice") or {}).items()}
    cv_prima = stato.get("cv") or {}
    if not stato:   # pratica scritta prima della fotografia: non si sa cosa ha scritto Claude
        print("Nessuna fotografia (cfu_express_stato.json): vale Input, senza attribuire le modifiche.")
        m_prima, cv_prima = dict(m_ora), dict(cv_ora)
    cpcv = [list(r) + [""] * (9 - len(r)) for r in (d.get("cfuPerCV") or []) if any(str(x).strip() for x in r)]
    cpcv_prima = [list(r) + [""] * (9 - len(r)) for r in (stato.get("cfuPerCV") or [])]
    aff = [list(r) + [""] * (9 - len(r)) for r in (d.get("affidabilita") or []) if any(str(x).strip() for x in r)]

    def nome_esame(riga):
        k = riga - 42
        return str(esami[k][4]) if 0 <= k < len(esami) and len(esami[k]) > 4 else f"riga {riga}"

    modifiche, conflitti = [], []
    for key in sorted(set(m_ora) | set(m_prima), key=lambda k: (k[0], col2n(k[1]))):
        a, b = m_prima.get(key, 0), m_ora.get(key, 0)
        if a != b:
            modifiche.append(f"Input!{key[1]}{key[0]} ({nome_esame(key[0])} → {TARGET[key[1]]['nome']}): {a} → {b}")

    # --- CFU_per_CV
    da_esami = {}
    for (r, c), x in m_ora.items(): da_esami[c] = da_esami.get(c, 0) + x
    a_ora = {str(r[2]).strip(): colonna_a(r[0], r[5]) for r in cpcv if str(r[2]).strip()}
    a_prima = {str(r[2]).strip(): colonna_a(r[0], r[5]) for r in cpcv_prima if str(r[2]).strip()}
    cv_finale = dict(cv_ora)
    riscrivi_cv = False
    for c in sorted(set(cv_ora) | set(cv_prima) | set(a_ora) | set(a_prima), key=col2n):
        if c not in TARGET: continue
        in_ora, in_prima = cv_ora.get(c, 0), num(cv_prima.get(c, 0)) or 0
        ca_ora, ca_prima = a_ora.get(c), a_prima.get(c)
        cambiato_input = in_ora != in_prima
        cambiata_a = ca_ora is not None and ca_prima is not None and ca_ora != ca_prima
        if cambiato_input:
            modifiche.append(f"Input!{c}41 (CV → {TARGET[c]['nome']}): {in_prima} → {in_ora}")
            if cambiata_a and ca_ora != in_ora:
                conflitti.append(f"{TARGET[c]['nome']}: Input {in_ora}, CFU_per_CV colonna A {ca_ora} → vale Input")
        elif cambiata_a:
            modifiche.append(f"CFU_per_CV colonna A ({TARGET[c]['nome']}): {ca_prima} → {ca_ora} → riga CV di Input aggiornata")
            cv_finale[c] = ca_ora
            riscrivi_cv = True
    nuove_cpcv = []
    viste = set()
    for r in cpcv:
        c = str(r[2]).strip()
        r = list(r)
        if c in TARGET:
            viste.add(c)
            r[0] = cv_finale.get(c, 0)
            prev = TARGET[c]["previsti"] or 0
            r[6] = intero(max(0, prev - min(prev, da_esami.get(c, 0))))
        nuove_cpcv.append(r)
    for c, x in sorted(cv_finale.items(), key=lambda kv: col2n(kv[0])):
        if c not in viste and x:
            prev = TARGET[c]["previsti"] or 0
            nuove_cpcv.append([x, livello(c), c, TARGET[c]["nome"], str(TARGET[c]["codice"]), x,
                               intero(max(0, prev - min(prev, da_esami.get(c, 0)))), "",
                               "Inserito dall'operatore in Input (riga CV): evidenza da indicare"])
            modifiche.append(f"CFU_per_CV: nuova riga per {TARGET[c]['nome']} ({x} CFU messi a mano in Input)")

    # --- Affidabilita_CFU (solo se già compilato)
    nuove_aff, da_valutare = None, []
    if aff:
        tutte = dict(m_ora); tutte.update({(41, c): x for c, x in cv_finale.items()})
        prima = dict(m_prima); prima.update({(41, c): num(x) or 0 for c, x in cv_prima.items()})
        per_cella = {}
        for r in aff:
            try: per_cella[(int(num(r[0])), str(r[2]).strip())] = r
            except (TypeError, ValueError): pass
        out = []
        for key in sorted(set(tutte) | set(per_cella), key=lambda k: (k[0], col2n(k[1]) if k[1] in TARGET else 999)):
            r = per_cella.get(key)
            x = tutte.get(key, 0)
            if r is None:
                if not x: continue
                riga, c = key
                dall_op = prima.get(key, 0) != x
                r = [riga, livello(c), c, nome_esame(riga) if riga >= 42 else
                     ("CV: inserito dall'operatore" if dall_op else "CV"), TARGET[c]["nome"], "", x, "",
                     "DA VALUTARE: cella inserita dall'operatore" if dall_op else "DA VALUTARE: cella senza riga di affidabilità"]
                da_valutare.append(f"{c}{riga}"); out.append(r); continue
            r = list(r)
            vecchio = num(r[6]) or 0
            if x and x != vecchio:
                r[6] = x
                if prima.get(key, 0) != x:
                    r[8] = f"{r[8]} · operatore: {vecchio} → {x} CFU (DA VALUTARE)".strip(" ·")
                    da_valutare.append(f"{key[1]}{key[0]}")
            elif not x and vecchio:
                r[6], r[7] = "", vecchio
                r[8] = f"POSSIBILE: tolto dall'operatore (erano {vecchio} CFU)"
            out.append(r)
        nuove_aff = out

    # --- uscita
    print("MODIFICHE DELL'OPERATORE:" if modifiche else "Nessuna modifica dell'operatore rispetto all'ultima scrittura.")
    for x in modifiche: print("  -", x)
    for x in conflitti: print("  CONFLITTO:", x)
    if da_valutare: print("  Affidabilità da rivalutare (R10) prima di scrivere:", ", ".join(da_valutare))
    if "--piano" in sys.argv:
        piano = {"riconoscimento": []}
        n_old = len(d.get("cfuPerCV") or [])
        n = max(len(nuove_cpcv), n_old, 1)
        piano["riconoscimento"].append({"range": f"CFU_per_CV!A2:I{1 + n}",
                                        "valori": [r[:9] for r in nuove_cpcv] + [[""] * 9] * (n - len(nuove_cpcv))})
        if riscrivi_cv:
            riga = [cv_finale.get(n2col(COL0 + j), "") or "" for j in range(col2n("CB") - COL0 + 1)]
            piano["riconoscimento"].append({"range": "Input!Q41:CB41", "valori": [riga]})
        if nuove_aff is not None:
            n_old = len(d.get("affidabilita") or [])
            n = max(len(nuove_aff), n_old, 1)
            piano["riconoscimento"].append({"range": f"Affidabilita_CFU!A2:I{1 + n}",
                                            "valori": [r[:9] for r in nuove_aff] + [[""] * 9] * (n - len(nuove_aff))})
        piano["esami"] = esami
        json.dump(piano, open(sys.argv[sys.argv.index("--piano") + 1], "w", encoding="utf-8"), ensure_ascii=False)
        print("  piano pronto (verificalo con verifica_scrittura.py; con 'DA VALUTARE' completa prima grado e stato)")
    if "--stato" in sys.argv:
        nuovo = {"matrice": {f"{r}|{c}": x for (r, c), x in m_ora.items()},
                 "cv": cv_finale, "cfuPerCV": [r[:9] for r in nuove_cpcv]}
        json.dump(nuovo, open(sys.argv[sys.argv.index("--stato") + 1], "w", encoding="utf-8"), ensure_ascii=False)
    sys.exit(1 if conflitti else 0)


if __name__ == "__main__":
    main()
