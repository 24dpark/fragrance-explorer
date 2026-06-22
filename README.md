# Fragrance Explorer

A browser-based explorer for ~24,000 perfumes from Fragrantica, with a built-in
fragrance **layering recommender**. No server, no build step — just open
`index.html` in any browser.

## Features

- **Search & filter** ~24k perfumes by name, brand, note, or perfumer
- Filter by gender, main accord (84 of them), and minimum rating
- Sort by most reviewed, highest rated, newest, oldest, or name
- **🧪 Layering recommender** — for any scent, get the best fragrances to
  layer it with, ranked by perfumery theory (complementary accords + shared
  bridge notes), with honest match tiers
- **Layer two scents** — pick any two fragrances and get a compatibility
  verdict plus an application tip (which to spray first)
- Click any suggested match to explore *its* matches (chain discovery)

## Files

| File | What it is |
|------|------------|
| `index.html`  | The whole app — HTML, CSS, and JavaScript in one file |
| `layering.js` | The layering engine: accord-pairing map, scoring, match tiers |
| `perfumes.js` | The data — ~24,000 perfumes as a JS variable (`window.PERFUMES`) |
| `prep.py`     | Script that converts the raw Fragrantica CSV into `perfumes.js` |

## Run it

Just open `index.html` in a browser. That's it.

## Data & credit

Data sourced from the [Fragrantica.com Fragrance Dataset](https://www.kaggle.com/datasets/olgagmiufana1/fragrantica-com-fragrance-dataset)
on Kaggle (CC BY-NC-SA 4.0). Layering suggestions are computed from perfumery
theory, not crowd-sourced "people actually wear these together" data — treat
them as solid starting points, not gospel.
