#!/usr/bin/env python3
"""Verifica UNICA del piano di scrittura (plugin cfu-express) prima di inviarlo al foglio.

Uso:  python3 -I verifica_scrittura.py piano.json [--richieste out.json]
      Con --richieste scrive anche le richieste pronte per il connettore Google Sheets:
      out.json = {"riconoscimento": [...requests per update_spreadsheet...], "registro": {"range": ..., "values": ...}}

piano.json:
{
  "riconoscimento": [ {"range": "Input!A42:I66", "valori": [[...], ...], "sfondo": "#FFFF99"}, ... ],
  "registro": {"intestazioni": ["Provenienza", ...],            # riga 1 del Registro (letta una volta)
               "riga": 7, "nuova": false,
               "campi": {"Stato": "in lavorazione", "Ultimo aggiornamento": "...", ...}},
  "esami": [[1, "Univ", "Fac", "Corso", "Esame", 28, "gg/mm/aaaa", 6, "SSD"], ...]   # facoltativo: righe di Input
}

Controlla, tutto in una volta:
 1. ogni range scritto è DENTRO un intervallo della whitelist (scripts/whitelist.json) e non tocca colonne vietate;
 2. dimensioni dei valori = dimensioni del range;
 3. tipi: righe di 9 valori, CFU numerici > 0 o "", caselle TRUE/FALSE, menu ammessi, nessun testo che inizi con = + -;
 4. matrice (se ci sono "esami"): per ogni esame e indirizzo somma ≤ CFU dell'esame; per ogni colonna somma ≤ previsti;
 5. Registro: solo colonne ammesse, valori dei menu esatti, mai "Mail (link)".
Stampa OK e il riepilogo delle celle che verranno scritte, oppure l'elenco degli errori (exit 1).
Dopo la scrittura basta confrontare gli "updatedRange" restituiti dal connettore con questo riepilogo: nessuna rilettura del foglio.
"""
import json, re, sys, os
from collections import defaultdict

QUI = os.path.dirname(os.path.abspath(__file__))
WL = json.load(open(os.path.join(QUI, "whitelist.json"), encoding="utf-8"))

def col2n(c):
    n = 0
    for ch in c: n = n * 26 + ord(ch) - 64
    return n

def n2col(n):
    s = ""
    while n: n, r = divmod(n - 1, 26); s = chr(65 + r) + s
    return s

def parse(rng):
    m = re.match(r"^(?:'?([^'!]+)'?!)?([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$", rng.strip())
    if not m: raise ValueError(f"range non valido: {rng}")
    sh, c1, r1, c2, r2 = m.groups()
    c2, r2 = c2 or c1, r2 or r1
    return sh, col2n(c1), int(r1), col2n(c2), int(r2)

INDIRIZZI = {1: {0, 1, 12, 123, 128}, 2: {0, 2, 12, 23, 28, 123, 128}, 3: {0, 3, 23, 123}, 8: {0, 8, 28, 128},
             5: {4, 5, 56, 57}, 6: {4, 6, 56}, 7: {4, 7, 57}}
TARGET = {t["col"]: t for t in WL["target"]}

def main():
    piano = json.load(open(sys.argv[1], encoding="utf-8"))
    err, riepilogo = [], []
    zone = [(z, parse(z["range"])) for z in WL["riconoscimento"]]
    matrice = defaultdict(float)  # (riga, col) -> cfu

    for i, w in enumerate(piano.get("riconoscimento", [])):
        try:
            sh, c1, r1, c2, r2 = parse(w["range"])
        except ValueError as e:
            err.append(str(e)); continue
        dentro = [z for z, (zs, zc1, zr1, zc2, zr2) in zone
                  if zs == sh and zc1 <= c1 and c2 <= zc2 and zr1 <= r1 and r2 <= zr2]
        if not dentro:
            err.append(f"#{i} {w['range']}: FUORI dalla whitelist"); continue
        z = min(dentro, key=lambda z: (parse(z["range"])[3] - parse(z["range"])[1]))  # zona più stretta
        vals = w.get("valori")
        if z.get("solo_sfondo"):
            if vals is not None: err.append(f"#{i} {w['range']}: in {z['nome']} si scrive solo lo sfondo")
            if w.get("sfondo") not in (z["solo_sfondo"], None, ""): err.append(f"#{i} {w['range']}: sfondo ammesso solo {z['solo_sfondo']}")
        if w.get("sfondo") and not (z.get("sfondo") or z.get("solo_sfondo")):
            err.append(f"#{i} {w['range']}: sfondo non ammesso in {z['nome']}")
        for col in z.get("escludi_colonne", []):
            if c1 <= col2n(col) <= c2:
                # ammesso solo se tutte le celle di quella colonna sono vuote
                k = col2n(col) - c1
                if vals and any(row[k] not in ("", None, 0) for row in vals):
                    err.append(f"#{i} {w['range']}: valore in colonna vietata {col} ({TARGET.get(col, {}).get('nome', '')})")
        if z.get("solo_su_richiesta"):
            riepilogo.append(f"ATTENZIONE {w['range']} ({z['nome']}): da scrivere solo su richiesta esplicita")
        if vals is not None:
            if len(vals) != r2 - r1 + 1 or any(len(r) != c2 - c1 + 1 for r in vals):
                err.append(f"#{i} {w['range']}: dimensioni {len(vals)}x{len(vals[0]) if vals else 0} ≠ range {r2-r1+1}x{c2-c1+1}"); continue
            for ri, row in enumerate(vals):
                for ci, v in enumerate(row):
                    cella = f"{sh}!{n2col(c1+ci)}{r1+ri}"
                    if isinstance(v, str) and v[:1] in ("=", "+", "-"):
                        err.append(f"{cella}: testo che inizia con '{v[:1]}' (diventerebbe formula)")
                    t = z["tipo"]
                    if t == "bool" and v not in (True, False):
                        err.append(f"{cella}: atteso TRUE/FALSE, trovato {v!r}")
                    elif t == "menu" and v not in z["valori"]:
                        err.append(f"{cella}: valore {v!r} non nel menu {z['valori']}")
                    elif t == "cfu":
                        if v in ("", None): continue
                        if not isinstance(v, (int, float)) or v <= 0:
                            err.append(f"{cella}: CFU non valido {v!r}")
                        elif z["nome"] == "matrice":
                            matrice[(r1 + ri, n2col(c1 + ci))] += v
        riepilogo.append(f"{w['range']:<28} → {z['nome']}" + (f" (sfondo {w['sfondo']})" if w.get("sfondo") else ""))

    # coerenza matrice
    esami = piano.get("esami")
    if matrice:
        coln = defaultdict(float)
        for (r, c), v in matrice.items(): coln[c] += v
        for c, v in coln.items():
            prev = TARGET.get(c, {}).get("previsti")
            if prev and v > prev: err.append(f"colonna {c} ({TARGET[c]['nome']}): {v:g} > previsti {prev:g}")
        if esami:
            for r in sorted({r for r, _ in matrice}):
                k = r - 42
                if k >= len(esami): err.append(f"riga {r}: CFU nella matrice ma nessun esame in Input"); continue
                cfu = esami[k][7]
                for ind, codici in INDIRIZZI.items():
                    s = sum(v for (rr, c), v in matrice.items() if rr == r and TARGET[c]["codice"] in codici)
                    if isinstance(cfu, (int, float)) and s > cfu:
                        err.append(f"riga {r} ({esami[k][4]}): {s:g} CFU sull'indirizzo {ind} > {cfu:g} dell'esame")

    # Registro
    reg = piano.get("registro")
    if reg:
        R = WL["registro"]
        ammesse = R["colonne_nuova_riga"] if reg.get("nuova") else R["colonne_aggiornamento"]
        intest = reg.get("intestazioni") or []
        for nome, v in reg.get("campi", {}).items():
            if nome in R["mai"] or nome not in ammesse:
                err.append(f"Registro: colonna '{nome}' non scrivibile in questo passo"); continue
            if intest and nome not in intest:
                err.append(f"Registro: intestazione '{nome}' non trovata nella riga 1"); continue
            if nome in R["menu"] and v not in R["menu"][nome]:
                err.append(f"Registro: '{nome}' = {v!r} non nel menu {R['menu'][nome]}")
            if isinstance(v, str) and v[:1] in ("=", "+", "-"):
                err.append(f"Registro: '{nome}' inizia con '{v[:1]}'")
            if intest:
                riepilogo.append(f"Registro!{n2col(intest.index(nome)+1)}{reg.get('riga')} → {nome}")

    if err:
        print("ERRORI (niente è stato scritto):"); [print(" -", e) for e in err]; sys.exit(1)
    if "--richieste" in sys.argv:
        out = sys.argv[sys.argv.index("--richieste") + 1]
        json.dump(richieste(piano), open(out, "w", encoding="utf-8"), ensure_ascii=False)
        riepilogo.append(f"richieste pronte in {out}")
    print("OK: il piano scrive solo celle della whitelist.")
    [print("  ", r) for r in riepilogo]
    if matrice:
        tot = {ind: sum(v for (r, c), v in matrice.items() if TARGET[c]["codice"] in cod) for ind, cod in INDIRIZZI.items()}
        print("  CFU da esami per indirizzo (1,2,3,8,5,6,7):", [tot[k] for k in (1, 2, 3, 8, 5, 6, 7)])

def cella(v):
    if v is None or v == "": return {}
    if isinstance(v, bool): return {"userEnteredValue": {"boolValue": v}}
    if isinstance(v, (int, float)): return {"userEnteredValue": {"numberValue": v}}
    return {"userEnteredValue": {"stringValue": str(v)}}

def rgb(h):
    h = h.lstrip("#"); return {"red": int(h[0:2], 16) / 255, "green": int(h[2:4], 16) / 255, "blue": int(h[4:6], 16) / 255}

def richieste(piano):
    """Una sola lista di richieste updateCells (valori e, se indicato, sfondo) per tutto il file di riconoscimento.
    Le celle del range non fornite vengono svuotate: per azzerare un intervallo basta passare righe vuote."""
    req = []
    for w in piano.get("riconoscimento", []):
        sh, c1, r1, c2, r2 = parse(w["range"])
        rng = {"sheetId": WL["sheetId"][sh], "startRowIndex": r1 - 1, "endRowIndex": r2,
               "startColumnIndex": c1 - 1, "endColumnIndex": c2}
        campi = []
        vals = w.get("valori")
        if vals is not None: campi.append("userEnteredValue")
        if w.get("sfondo"): campi.append("userEnteredFormat.backgroundColor")
        righe = []
        for ri in range(r2 - r1 + 1):
            row = []
            for ci in range(c2 - c1 + 1):
                c = cella(vals[ri][ci]) if vals is not None else {}
                if w.get("sfondo"): c["userEnteredFormat"] = {"backgroundColor": rgb(w["sfondo"])}
                row.append(c)
            righe.append({"values": row})
        req.append({"updateCells": {"range": rng, "rows": righe, "fields": ",".join(campi)}})
    out = {"riconoscimento": req}
    reg = piano.get("registro")
    if reg and reg.get("intestazioni"):
        intest = reg["intestazioni"]; riga = reg["riga"]
        cols = sorted(intest.index(n) + 1 for n in reg["campi"])
        c1, c2 = cols[0], cols[-1]
        vals = [None] * (c2 - c1 + 1)   # None = cella non toccata (update_values salta i null)
        for n, v in reg["campi"].items(): vals[intest.index(n) + 1 - c1] = v
        out["registro"] = {"range": f"Registro!{n2col(c1)}{riga}:{n2col(c2)}{riga}", "values": [vals]}
    return out

if __name__ == "__main__":
    main()
