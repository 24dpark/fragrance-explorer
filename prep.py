#!/usr/bin/env python3
"""Convert fra_cleaned.csv (Fragrantica) into a compact JSON for the explorer app."""
import csv, json, sys

SRC = "/mnt/c/Users/dnlpr/Downloads/archive/fra_cleaned.csv"
OUT = "/mnt/c/Users/dnlpr/Desktop/fragrance-explorer/perfumes.js"

def num(s):
    s = (s or "").strip().replace(",", ".")  # ratings use comma decimal
    try:
        return float(s)
    except ValueError:
        return None

def intnum(s):
    s = (s or "").strip()
    try:
        return int(float(s))
    except ValueError:
        return None

def clean(s):
    s = (s or "").strip()
    return "" if s.lower() in ("", "unknown", "nan") else s

def title(s):
    # turn "le-male-pride-collector" -> "Le Male Pride Collector"
    return " ".join(w.capitalize() for w in clean(s).replace("-", " ").split())

def notes(s):
    return [n.strip() for n in (s or "").split(",") if n.strip()]

rows = []
with open(SRC, encoding="cp1252", errors="replace") as f:
    reader = csv.DictReader(f, delimiter=";")
    for r in reader:
        name = title(r.get("Perfume"))
        brand = title(r.get("Brand"))
        if not name or not brand:
            continue
        accords = [clean(r.get(f"mainaccord{i}")) for i in range(1, 6)]
        accords = [a.lower() for a in accords if a]
        perfumers = [clean(r.get("Perfumer1")), clean(r.get("Perfumer2"))]
        perfumers = [title(p) for p in perfumers if p]
        rows.append({
            "name": name,
            "brand": brand,
            "country": clean(r.get("Country")),
            "gender": clean(r.get("Gender")).lower(),
            "rating": num(r.get("Rating Value")),
            "votes": intnum(r.get("Rating Count")),
            "year": intnum(r.get("Year")),
            "top": notes(r.get("Top")),
            "mid": notes(r.get("Middle")),
            "base": notes(r.get("Base")),
            "accords": accords,
            "perfumers": perfumers,
            "url": clean(r.get("url")),
        })

# Sort by votes desc so the most-reviewed show first by default
rows.sort(key=lambda x: (x["votes"] or 0), reverse=True)

import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.PERFUMES=")
    json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";")

# quick stats
total = len(rows)
rated = sum(1 for r in rows if r["rating"])
all_accords = {}
for r in rows:
    for a in r["accords"]:
        all_accords[a] = all_accords.get(a, 0) + 1
top_accords = sorted(all_accords.items(), key=lambda x: -x[1])[:15]
brands = len({r["brand"] for r in rows})

print(f"Wrote {total} perfumes to {OUT}")
print(f"  with rating: {rated}")
print(f"  unique brands: {brands}")
print(f"  distinct accords: {len(all_accords)}")
print(f"  top accords: {', '.join(a for a,_ in top_accords)}")
print(f"  output size: {os.path.getsize(OUT)/1024/1024:.1f} MB")
