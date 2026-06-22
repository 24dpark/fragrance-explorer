// layering.js — Fragrance layering recommendation engine.
// No layering data exists in the dataset, so we compute compatibility from
// perfumery theory: complementary main accords + shared "bridge" notes.

// Accords that act as universal blenders — they sit under almost anything.
const BLENDERS = new Set(["musky", "amber", "woody", "vanilla", "powdery"]);

// Curated complementary accord pairs with a weight (how classic the combo is).
// Symmetric — order doesn't matter; we expand both directions below.
const PAIR_LIST = [
  ["vanilla","woody",3],["vanilla","oud",3],["vanilla","tobacco",3],["vanilla","leather",3],
  ["vanilla","coffee",3],["vanilla","smoky",3],["vanilla","amber",2],["vanilla","caramel",2],
  ["vanilla","coconut",3],["vanilla","almond",2],
  ["sweet","smoky",3],["sweet","woody",2],["sweet","warm spicy",2],["sweet","citrus",2],["sweet","leather",2],
  ["citrus","woody",3],["citrus","aquatic",3],["citrus","floral",2],["citrus","aromatic",2],
  ["citrus","amber",2],["citrus","fresh spicy",2],["citrus","marine",3],
  ["floral","woody",2],["floral","musky",2],["floral","fruity",2],["floral","oud",2],["floral","green",2],
  ["rose","oud",4],["rose","patchouli",3],["rose","saffron",3],["rose","woody",2],["rose","amber",2],
  ["oud","amber",2],["oud","saffron",3],["oud","sweet",2],["oud","leather",2],["oud","smoky",2],
  ["gourmand","woody",3],["gourmand","amber",2],["gourmand","tobacco",2],["gourmand","coffee",2],
  ["caramel","woody",2],["chocolate","woody",2],["chocolate","fruity",2],["coffee","woody",2],
  ["aquatic","woody",2],["aquatic","aromatic",2],["marine","woody",2],
  ["leather","tobacco",3],["leather","woody",2],["leather","smoky",2],
  ["warm spicy","woody",2],["warm spicy","amber",2],["fresh spicy","woody",2],
  ["fruity","sweet",2],["fruity","woody",2],
  ["green","aromatic",2],["green","woody",2],["green","citrus",2],
  ["patchouli","woody",2],["patchouli","amber",2],["patchouli","sweet",2],
  ["tobacco","woody",2],["smoky","woody",2],["honey","tobacco",2],["honey","floral",2],
  ["coconut","floral",2],["cherry","almond",3],["almond","woody",2],
  ["iris","woody",2],["iris","powdery",2],
  ["lavender","vanilla",3],["lavender","woody",2],["lavender","fresh spicy",2],
];

const PAIR_WEIGHTS = (() => {
  const m = new Map();
  for (const [a, b, w] of PAIR_LIST) { m.set(a + "|" + b, w); m.set(b + "|" + a, w); }
  return m;
})();

function pairWeight(a, b) {
  if (a === b) return 0.4;                      // same accord = common ground, mild
  const w = PAIR_WEIGHTS.get(a + "|" + b);
  if (w !== undefined) return w;
  if (BLENDERS.has(a) || BLENDERS.has(b)) return 1; // blenders go with anything
  return 0;
}

// Score how well B layers with A. Returns detailed signals so the UI can
// tier honestly: `bestW` is the weight of the single strongest *complementary*
// (curated, cross-accord) pairing — the real backbone of a good layer combo.
function layerScore(A, B) {
  let score = 0, best = null, bestW = 0;
  const aacc = A.accords, bacc = B.accords;
  for (let i = 0; i < aacc.length; i++) {
    for (let j = 0; j < bacc.length; j++) {
      const w = pairWeight(aacc[i], bacc[j]);
      score += w * (1 - i * 0.12) * (1 - j * 0.12);   // top accords weigh more
      // best complementary pair = highest curated weight, ignoring blender(1) & same-accord
      if (aacc[i] !== bacc[j] && PAIR_WEIGHTS.has(aacc[i] + "|" + bacc[j]) && w > bestW) {
        bestW = w; best = [aacc[i], bacc[j]];
      }
    }
  }
  // if no curated pair, fall back to noting a blender link for the "why" text
  if (!best) {
    outer:
    for (const a of aacc) for (const b of bacc) {
      if (a !== b && (BLENDERS.has(a) || BLENDERS.has(b))) { best = [a, b]; break outer; }
    }
  }

  // shared notes act as a bridge so the two blend smoothly
  const shared = [];
  for (const n of A._notes) {
    if (B._notes.has(n)) { shared.push(n); if (shared.length >= 4) break; }
  }
  score += Math.min(shared.length, 3) * 1.2;

  // penalize near-duplicates (no point layering two nearly identical scents)
  const common = A.accords.filter(a => B.accords.includes(a)).length;
  if (common >= 4) score -= 2.5;

  // nudge toward well-loved, credible partners
  score += ((B.rating || 3) - 3) * 0.8;

  return { score, best, bestW, shared, sharedCount: shared.length };
}

// Honest tier based on the overall match score. Calibrated to the real score
// distribution across the catalog (scores cluster ~21-26, top out near 30+),
// so "Excellent" stays rare and the badges actually spread out within a list.
// A genuine classic complementary pairing (bestW >= 3) is also required for the
// top tier, so a high score built only from blender accords can't fake it.
// Returns [label, cssClass, barPercent].
function layerTier(r) {
  const s = r.score, w = r.bestW;
  if (s >= 27 && w >= 3) return ["Excellent match", "s-excellent", 100];
  if (s >= 24.5)         return ["Great match", "s-great", 82];
  if (s >= 21.5)         return ["Good match", "s-good", 64];
  if (s >= 18)           return ["Worth a try", "s-try", 46];
  return ["Experimental", "s-try", 32];
}

// Return the top layering partners for a source fragrance.
function layerPartners(src, all, limit = 8) {
  const out = [];
  for (const c of all) {
    if (c._id === src._id) continue;
    if ((c.votes || 0) < 80) continue;          // keep partners credible
    if (c.brand === src.brand && c.name === src.name) continue;
    const r = layerScore(src, c);
    if (r.score > 1) out.push({ p: c, ...r });
  }
  // sort by overall match score so order agrees with the displayed tier,
  // then by how classic the pairing is, then bridges, then popularity
  out.sort((a, b) =>
    b.score - a.score ||
    b.bestW - a.bestW ||
    b.sharedCount - a.sharedCount ||
    (b.p.votes || 0) - (a.p.votes || 0)
  );
  return out.slice(0, limit);
}
