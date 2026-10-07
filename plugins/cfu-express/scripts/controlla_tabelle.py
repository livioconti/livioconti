#!/usr/bin/env python3
"""Controllo e pulizia delle tabelle esami del modulo (plugin cfu-express), deterministico.

Uso:  python3 -I controlla_tabelle.py <modulo_testo.txt | afchunk.htm> [--json out.json]

Ingresso: il file <nome>_testo.txt scritto dal componente Gmail "Riconoscimento CFU"
(righe "a | b | c" fra [TABELLA n · sfondo #xxxxxx] e [FINE TABELLA n], eventuali righe
[ATTENZIONE TABELLA n: ...]) oppure l'HTML word/afchunk.htm del .doc (già decodificato).

Per ogni tabella esami (intestazione N. | Università | ... | SSD) produce:
  grezze  = righe per Trash: i valori COME SCRITTI dallo studente (solo spazi doppi tolti),
            riallineati alle 9 colonne; mai normalizzati (30 e lode resta "30 e lode");
  pulite  = righe per Input!A42:I secondo R3 (30 e lode -> 31, 23/30 -> 23, date gg/mm/20aa,
            SSD con la barra, N. rinumerato);
  anomalie = elenco con livello:
     STRUTTURA  celle unite, numero di celle diverso da 9, valori slittati di colonna
                -> NON scrivere: verifica approfondita (confronta col Word) e chiedi all'operatore;
     DATO       voto/data/CFU/SSD non riconoscibili, V.O. senza CFU, N. non progressivo
                -> casi ambigui di R3: una domanda prima di scrivere;
     NOTA       normalizzazioni fatte (30 e lode -> 31 ...): solo da dichiarare nel report.
Stampa un riepilogo leggibile; con --json scrive anche il risultato completo.
Exit 0 = nessuna anomalia STRUTTURA/DATO, 2 = da verificare.
"""
import html, json, re, sys

COLONNE = ["N.", "Università", "Facoltà", "Corso di Laurea", "Esame", "Voto", "Data", "CFU", "SSD"]
GIUDIZI = re.compile(r"^(idone[oa]|ido|sup(erato)?|approvato|buono|ottimo|distinto|suff\.?|sufficiente|discreto|appr\.?|conv(alidato)?|ric(onosciuto)?)$", re.I)
LODE = re.compile(r"^30\s*(/\s*30)?\s*(e\s*)?(l|lode|con\s+lode)$", re.I)
SU30 = re.compile(r"^(\d{2})\s*/\s*30$")
DATA = re.compile(r"^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$")
SSD = re.compile(r"^[A-Z]{1,4}(-[A-Z]{1,4})*/\d{2}$")   # MAT/05, SECS-P/08, L-FIL-LET/10
SSD_SPECIALI = {"NN", "PROFIN_S"}
VO = re.compile(r"\b(v\.?\s?o\.?|vecchio ordinamento|ante\s*509|ord\.?\s*previgente)\b", re.I)


def pulisci_spazi(s):
    return re.sub(r"\s+", " ", str(s or "").replace(" ", " ")).strip()


# ---------------------------------------------------------------- lettura
def tabelle_da_testo(t):
    """[{n, colore, righe: [[celle]], attenzioni: [str]}] dal formato _testo.txt."""
    tab, cur = [], None
    for riga in t.splitlines():
        m = re.match(r"^\[TABELLA (\d+)(?: · sfondo (#[0-9a-fA-F]{6}))?\]$", riga.strip())
        if m:
            cur = {"n": int(m.group(1)), "colore": (m.group(2) or "").lower(), "righe": [], "attenzioni": []}
            tab.append(cur); continue
        if re.match(r"^\[FINE TABELLA \d+\]$", riga.strip()):
            cur = None; continue
        m = re.match(r"^\[ATTENZIONE TABELLA (\d+): (.*)\]$", riga.strip())
        if m:
            for x in tab:
                if x["n"] == int(m.group(1)): x["attenzioni"].append(m.group(2))
            continue
        if cur is not None:
            cur["righe"].append([pulisci_spazi(c) for c in riga.split("|")])
    return tab


def tabelle_da_html(h):
    h = re.sub(r"(?is)<(style|script|head).*?</\1>", "", h)
    out = []
    for n, t in enumerate(re.findall(r"(?is)<table.*?</table>", h), 1):
        col = re.search(r"(?i)(?:bgcolor|background(?:-color)?)\s*[:=]\s*[\"']?#?([0-9a-f]{6})", t)
        x = {"n": n, "colore": ("#" + col.group(1).lower()) if col else "", "righe": [], "attenzioni": []}
        for k, tr in enumerate(re.findall(r"(?is)<tr.*?</tr>", t), 1):
            celle = re.findall(r"(?is)<t[dh]([^>]*)>(.*?)</t[dh]>", tr)
            for attr, _ in celle:
                sp = re.search(r"(?i)(colspan|rowspan)\s*=\s*[\"']?(\d+)", attr)
                if sp and int(sp.group(2)) > 1:
                    x["attenzioni"].append(f"esame {k - 1} con celle unite ({sp.group(1).lower()}={sp.group(2)})")
            x["righe"].append([pulisci_spazi(html.unescape(re.sub(r"<[^>]+>", " ", c))) for _, c in celle])
        out.append(x)
    return out


# ---------------------------------------------------------------- pulizia R3
def voto_pulito(v):
    s = pulisci_spazi(v)
    if not s: return "", "voto mancante"
    if LODE.match(s): return 31, f"'{s}' → 31"
    m = SU30.match(s)
    if m: return int(m.group(1)), f"'{s}' → {m.group(1)}"
    if re.fullmatch(r"\d{2}", s):
        n = int(s)
        return (n, None) if 18 <= n <= 31 else (n, f"voto fuori scala: {s}")
    if GIUDIZI.match(s): return s, None
    return s, f"voto non riconosciuto: '{s}'"


def data_pulita(v):
    s = pulisci_spazi(v)
    m = DATA.match(s)
    if not m: return s, (f"data non riconosciuta: '{s}'" if s else "data mancante")
    g, me, a = int(m.group(1)), int(m.group(2)), m.group(3)
    a = int(a) + (2000 if len(a) == 2 else 0)
    if not (1 <= g <= 31 and 1 <= me <= 12 and 1950 <= a <= 2100):
        return s, f"data non valida: '{s}'"
    nuova = f"{g:02d}/{me:02d}/{a}"
    return nuova, (f"'{s}' → {nuova}" if nuova != s else None)


def ssd_pulito(v):
    s = pulisci_spazi(v).upper().replace(";", ",")
    if s in ("-", "–", "—", "N.D.", "ND", "/"): s = "NN"      # nessun SSD (tirocinio, prova finale)
    s = re.sub(r"(/\d{2})\s*/\s*(?=[A-Z])", r"\1 ", s)       # ING-INF/05 / INF/01 -> due SSD
    s = re.sub(r"(/\d{2})(?=[A-Z])", r"\1 ", s)            # CHIM/01CHIM/01 -> CHIM/01 CHIM/01
    parti = [p.strip() for p in re.split(r"[,\s]+(?=[A-Z])", s) if p.strip()]
    out = []
    for p in parti:
        q = p.replace(" ", "")
        if not "/" in q:
            m = re.match(r"^([A-Z\-]+?)-?(\d{2})$", q)   # ICAR21 -> ICAR/21
            if m: q = f"{m.group(1)}/{m.group(2)}"
        if q.endswith("/") and any(x.startswith(q) for x in parti if x != p):
            continue                                       # "CHIM/" accanto a "CHIM/01": frammento
        if q not in out:                                   # SSD ripetuti: una volta sola
            out.append(q)
    nuovo = ", ".join(out)
    ok = all(SSD.match(p) or p in SSD_SPECIALI for p in out) if out else False
    nota = None if nuovo == pulisci_spazi(v) else f"SSD '{pulisci_spazi(v)}' → {nuovo}"
    return nuovo, nota, (None if ok or not out else f"SSD non riconoscibile: '{pulisci_spazi(v)}'")


def cfu_pulito(v, riga_testo):
    s = pulisci_spazi(v).replace(",", ".")
    if re.fullmatch(r"\d+(\.\d+)?", s):
        n = float(s); n = int(n) if n.is_integer() else n
        return n, (None if n > 0 else "CFU = 0")
    if VO.search(riga_testo) or s.upper() in ("VO", "V.O.", "-", "N.D.", ""):
        return s, ("V.O. senza CFU: chiedi i CFU da assumere (R3bis)" if VO.search(riga_testo) else
                   (f"CFU mancanti" if not s else f"CFU non numerici: '{s}'"))
    return s, f"CFU non numerici: '{s}'"


# ---------------------------------------------------------------- analisi
def e_intestazione(r):
    return len(r) >= 5 and r[0].lower().startswith("n") and any("esame" in c.lower() for c in r)


def analizza(tab):
    righe = [r for r in tab["righe"] if any(r)]
    if not righe or not e_intestazione(righe[0]):
        return None
    intest, dati = righe[0], righe[1:]
    anom = [{"livello": "STRUTTURA", "riga": None, "testo": a} for a in tab["attenzioni"]]
    if len(intest) != 9:
        anom.append({"livello": "STRUTTURA", "riga": 0, "testo": f"intestazione con {len(intest)} colonne invece di 9"})
    grezze, pulite = [], []
    for k, r in enumerate(dati, 1):
        rotta = len(r) != 9
        if rotta:
            anom.append({"livello": "STRUTTURA", "riga": k,
                         "testo": f"{len(r)} celle invece di 9: {' | '.join(r)} (celle unite o divise: ricostruisci col Word)"})
            r = (r + [""] * 9)[:9]
        g = [pulisci_spazi(c) for c in r]
        # valori slittati: una data nel voto, un voto nei CFU, ecc.
        if not rotta and (DATA.match(g[5]) or (re.fullmatch(r"\d{2}", g[6]) and DATA.match(g[7] or ""))):
            anom.append({"livello": "STRUTTURA", "riga": k, "testo": f"valori slittati di colonna: {' | '.join(g)}"})
            rotta = True
        grezze.append(g)
        if rotta:   # i controlli sui singoli campi sarebbero solo conseguenze del disallineamento
            pulite.append([k] + g[1:]); continue
        testo = " ".join(g)
        voto, nv = voto_pulito(g[5]); data, nd = data_pulita(g[6])
        cfu, nc = cfu_pulito(g[7], testo); ssd, ns, es = ssd_pulito(g[8])
        for nota in (nv, nd):
            if nota:
                livello = "NOTA" if "→" in nota else "DATO"
                anom.append({"livello": livello, "riga": k, "testo": f"{g[4]}: {nota}"})
        if nc: anom.append({"livello": "DATO", "riga": k, "testo": f"{g[4]}: {nc}"})
        if ns: anom.append({"livello": "NOTA", "riga": k, "testo": f"{g[4]}: {ns}"})
        if es: anom.append({"livello": "DATO", "riga": k, "testo": f"{g[4]}: {es}"})
        for i, nome in ((1, "Università"), (2, "Facoltà"), (3, "Corso di Laurea"), (4, "Esame")):
            if not g[i]: anom.append({"livello": "DATO", "riga": k, "testo": f"{nome} vuota"})
        if g[0] and g[0] != str(k):
            anom.append({"livello": "NOTA", "riga": k, "testo": f"N. '{g[0]}' → {k}"})
        pulite.append([k, g[1], g[2], g[3], g[4], voto, data, cfu, ssd])
    tot = sum(r[7] for r in pulite if isinstance(r[7], (int, float)))
    return {"tabella": tab["n"], "colore": tab["colore"], "intestazione": intest,
            "grezze": grezze, "pulite": pulite, "cfu_totali": tot, "anomalie": anom}


def main():
    src = open(sys.argv[1], encoding="utf-8", errors="replace").read()
    tab = tabelle_da_html(src) if re.search(r"(?i)<table", src) else tabelle_da_testo(src)
    esami = [a for a in (analizza(t) for t in tab) if a]
    gialle = [a for a in esami if a["colore"] == "#ffff99"] or esami[:1]
    azzurre = [a for a in esami if a["colore"] == "#c6d9f1"] or esami[1:2]
    da_verificare = False
    for nome, lst in (("GIALLA", gialle), ("AZZURRA", azzurre)):
        for a in lst:
            a["ruolo"] = nome.lower()
            print(f"Tabella {a['tabella']} {nome} ({a['colore'] or 'colore ?'}): {len(a['pulite'])} esami, {a['cfu_totali']:g} CFU")
            for x in a["anomalie"]:
                print(f"  {x['livello']:<9} riga {x['riga'] if x['riga'] is not None else '-'}: {x['testo']}")
                da_verificare |= x["livello"] in ("STRUTTURA", "DATO")
    if not esami:
        print("Nessuna tabella esami riconosciuta: leggi il Word e chiedi all'operatore."); da_verificare = True
    if "--json" in sys.argv:
        json.dump({"gialla": gialle[0] if gialle else None, "azzurra": azzurre[0] if azzurre else None},
                  open(sys.argv[sys.argv.index("--json") + 1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("ESITO:", "DA VERIFICARE (STRUTTURA/DATO: vedi sopra, non scrivere prima)" if da_verificare else "OK")
    sys.exit(2 if da_verificare else 0)


if __name__ == "__main__":
    main()
