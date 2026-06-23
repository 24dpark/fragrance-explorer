// search.js - forgiving fuzzy search for the fragrance catalog.
// Goals: typo tolerance, word-order independence, accent-insensitive
// ("lancome" finds "Lancome/Lancôme"), and relevance ranking so the
// best match floats to the top instead of needing a near-exact string.

// Normalize text: lowercase, strip accents, turn punctuation into spaces.
// "L'Eau d'Issey (Pour Homme)" -> "l eau d issey pour homme"
function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // remove diacritic marks
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Levenshtein edit distance with an early-exit ceiling. Once we know the
// distance exceeds `max`, we stop and return max+1 (cheaper than full calc).
function editDistance(a, b, max) {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev = new Array(lb + 1);
  let curr = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;   // whole row past ceiling, give up
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

// How many typos to forgive for a token of a given length.
function tolerance(len) {
  if (len <= 3) return 0;   // short tokens must be exact (avoids noise)
  if (len <= 6) return 1;
  return 2;
}

// Does one query token match this perfume? A token matches if the full
// haystack contains it as a substring, OR any name/brand word is within
// the typo tolerance of it (so "sauvag", "savage", "sauvage" all hit).
function tokenMatches(token, p) {
  if (p._hay.includes(token)) return true;
  const tol = tolerance(token.length);
  if (tol === 0) return false;
  for (const w of p._words) {
    if (Math.abs(w.length - token.length) > tol) continue;
    if (editDistance(token, w, tol) <= tol) return true;
  }
  return false;
}

// Relevance score for ranking matches. Higher is better. Rewards matches in
// the name over the brand over the notes, plus exact/prefix bonuses.
function relevance(p, tokens, rawQuery) {
  let score = 0;
  const nm = p._nameNorm, br = p._brandNorm;
  if (nm === rawQuery) score += 100;            // exact name
  if (nm.startsWith(rawQuery)) score += 40;     // name starts with query
  if (nm.includes(rawQuery)) score += 25;       // name contains whole query
  if (br.includes(rawQuery)) score += 10;       // brand contains query
  for (const t of tokens) {
    if (nm.includes(t)) score += 8;
    else if (br.includes(t)) score += 4;
    else if (p._hay.includes(t)) score += 2;
    else score += 1;                            // fuzzy-only match
  }
  score += Math.min((p.votes || 0) / 20000, 3); // light popularity nudge
  return score;
}

// Attach precomputed normalized fields to every perfume once at load.
function indexForSearch(data) {
  for (const p of data) {
    p._nameNorm = normalize(p.name);
    p._brandNorm = normalize(p.brand);
    const notes = [...p.top, ...p.mid, ...p.base].join(" ");
    const perf = (p.perfumers || []).join(" ");
    p._hay = normalize(p.name + " " + p.brand + " " + notes + " " + perf);
    // word list used for fuzzy (typo) matching: name + brand words only,
    // kept small so edit-distance stays fast across 24k records.
    p._words = Array.from(new Set((p._nameNorm + " " + p._brandNorm).split(" ").filter(Boolean)));
  }
}

// Main entry: return matches for a query, ranked by relevance.
// All tokens must match (AND), but each token is forgiving on its own.
function searchPerfumes(data, query) {
  const raw = normalize(query);
  if (!raw) return null;                 // null = "no query", caller shows all
  const tokens = raw.split(" ").filter(Boolean);
  const out = [];
  for (const p of data) {
    let all = true;
    for (const t of tokens) {
      if (!tokenMatches(t, p)) { all = false; break; }
    }
    if (all) { p._score = relevance(p, tokens, raw); out.push(p); }
  }
  out.sort((a, b) => b._score - a._score);
  return out;
}
