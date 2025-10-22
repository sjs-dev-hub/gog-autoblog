// bot.js
// Guild of Golf — Daily Deals content generator
// - Non-redundant titles/slugs
// - Randomized copy per topic
// - Same-day duplicate-prevention
// - Optional AI paragraphs via OpenAI (env-driven)

// --------------------------------------------------
// Optional: load .env locally; CI ignores if not present
try { require('dotenv').config(); } catch (_) {}
// --------------------------------------------------

const fs = require('fs');
const path = require('path');

/* =========================
   Load config
   ========================= */
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// normalize/unique each category's terms defensively
cfg.categories = (cfg.categories || []).map(c => ({
  title: String(c.title || '').trim(),
  terms: Array.from(new Set((c.terms || []).map(t => String(t).trim()).filter(Boolean)))
}));

/* =========================
   Utilities
   ========================= */
function amazonSearch(q, tag) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}`;
}
function utcParts(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return { y, m, day, hh, mm };
}
function toSlug(s) {
  return String(s)
    .toLowerCase()
    .replace(/\s*\$\s*/g, '')         // remove $ spacing
    .replace(/[^a-z0-9]+/g, '-')      // non-alnum -> hyphen
    .replace(/-+/g, '-')              // collapse
    .replace(/^-|-$/g, '');           // trim
}
function humanize(term) {
  let t = String(term).trim();
  t = t.replace(/\s*\$\s*/g, ' $');   // "$300" spacing
  t = t.replace(/\bpro v1\b/gi, 'Pro V1');
  return t;
}

/* ===== deterministic RNG (Mulberry32) & helpers ===== */
function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
function sampleN(arr, n, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sampleDistinct(arr, k, rng) {
  const used = new Set(), out = [];
  while (out.length < k && used.size < arr.length) {
    const i = Math.floor(rng() * arr.length);
    if (used.has(i)) continue;
    used.add(i); out.push(arr[i]);
  }
  return out;
}

/* =========================
   Randomized content pools (fallback)
   ========================= */
const POOLS = {
  DRIVER_BUDGET: {
    sentences: [
      "Last-year heads and value brands often match the same COR limits as premium lines.",
      "Forgiveness comes from head size, CG and MOI more than flashy names.",
      "Loft and shaft fit usually matter more than a single ‘hot’ face.",
      "Sound and feel change year to year—choose what boosts confidence."
    ],
    checklist: [
      "Loft for launch window (10.5–12° fits most)",
      "Shaft weight & flex matched to tempo",
      "Adjustable hosel/back weight for spin control",
      "Face angle/draw setting if you fight a fade",
      "Head shape you like at address"
    ]
  },
  DRIVER_PREMIUM: {
    sentences: [
      "Current-gen drivers bring tighter tolerances and more adjustable weighting.",
      "Expect better ball-speed retention on mishits and refined acoustics.",
      "Swing-weight and shaft profile vary by vendor—check the spec sheet."
    ],
    checklist: [
      "Spin window vs launch (mid/low spin if you launch high)",
      "Back/heel mass for stability or draw bias",
      "Stock shaft profile fit",
      "Sound/feel preference (confidence matters)"
    ]
  },
  DRIVER_GAME_IMPROVEMENT: {
    sentences: [
      "High-MOI heads tame sidespin and keep speed on map-misses.",
      "Draw-biased weighting can straighten a weak fade without lessons.",
      "Upright lie settings nudge start line left for many golfers."
    ],
    checklist: [
      "Back/heel weighting options",
      "460cc head for max forgiveness",
      "Upright/draw hosel settings",
      "Face tech consistency"
    ]
  },
  BALL_TOUR: {
    sentences: [
      "Urethane covers provide greenside spin and wind control.",
      "Compression and feel affect distance control more than raw speed.",
      "Bulk pricing swings during season changes and holidays."
    ],
    checklist: [
      "Urethane vs ionomer cover",
      "Compression for swing speed",
      "Dimple stability in wind",
      "Dozen vs bulk/practice packs"
    ]
  },
  BALL_VALUE_3PC: {
    sentences: [
      "Three-piece balls balance price with performance for most golfers.",
      "Ionomer is durable; urethane adds bite on wedges.",
      "Lower compression helps slow/medium speeds launch higher."
    ],
    checklist: [
      "Cover durability vs spin",
      "Compression feel",
      "High-visibility color",
      "Wind stability"
    ]
  },
  TRAINING_ALIGNMENT: {
    sentences: [
      "Two sticks lock in stance and target line quickly.",
      "Gate drills sharpen start line and face control.",
      "High-contrast colors stay visible in rough or low light."
    ],
    checklist: [
      "Stiffness & length",
      "End caps for safety",
      "Color visibility",
      "Clips for plane/putting drills"
    ]
  },
  TRAINING_TEMPO: {
    sentences: [
      "Weighted or whippy trainers smooth sequencing from the top.",
      "Heavier heads promote rhythm over hit impulse.",
      "Longer versions exaggerate timing cues for feel learners."
    ],
    checklist: [
      "Head weight placement",
      "Overall length",
      "Flex/whip profile",
      "Indoor-safe grip/cover"
    ]
  },
  TECH_LAUNCH_MONITOR: {
    sentences: [
      "Personal launch monitors are accurate enough outdoors for gapping.",
      "Indoors, prioritize units that measure spin and club data.",
      "Exportable shot libraries make progress trackable."
    ],
    checklist: [
      "Measured vs modeled data",
      "Outdoor flight capture quality",
      "App export & session history",
      "Battery life & mounting ease"
    ]
  },
  IRONS_PLAYERS_DISTANCE: {
    sentences: [
      "Hollow or thin-face designs give ball speed in compact shapes.",
      "Loft jacking is common—check gapping at the bottom.",
      "Blend sets if you want GI long irons with sleeker scoring clubs."
    ],
    checklist: [
      "Loft & gapping",
      "Forgiveness vs topline look",
      "Shaft weight/profile",
      "Blend options across set"
    ]
  },
  IRONS_FORGED: {
    sentences: [
      "Forged heads emphasize feedback and flight control.",
      "Sole width and bounce must match your turf.",
      "Finish durability varies—raw, chrome and PVD wear differently."
    ],
    checklist: [
      "Blade length & sole geometry",
      "Bounce/grind through set",
      "Swing-weight consistency",
      "Finish durability"
    ]
  },
  WEDGE_GAP_50: {
    sentences: [
      "A 50° wedge bridges modern PW-to-SW gaps for tighter yardages.",
      "Bounce and sole grind should match your turf and delivery.",
      "Keep shaft and swing-weight consistent with your irons."
    ],
    checklist: [
      "Loft/lie relative to PW & SW",
      "Bounce/grind for turf/sand",
      "Groove sharpness & durability",
      "Shaft match to irons"
    ]
  },
  GENERIC: {
    sentences: [
      "Use this search to jump straight into relevant options and filter by price, reviews and shipping.",
      "Sort by rating with a minimum review count to avoid paid noise.",
      "Scan size/fit details and return policy before checkout."
    ],
    checklist: [
      "Price vs review count",
      "Model year / tech carryover",
      "Sizing/fit & returns",
      "Fast shipping if timing matters"
    ]
  }
};

// Term → theme mapping
function themeFor(term) {
  const t = term.toLowerCase();
  if (t.includes('pro v1')) return 'BALL_TOUR';
  if (t.includes('3 piece') || t.includes('3-piece')) return 'BALL_VALUE_3PC';
  if (t.includes('driver') && t.includes('$300')) return 'DRIVER_BUDGET';
  if (t.includes('driver') && t.includes('$500')) return 'DRIVER_PREMIUM';
  if (t.includes('game improvement') && t.includes('driver')) return 'DRIVER_GAME_IMPROVEMENT';
  if (t.includes('alignment')) return 'TRAINING_ALIGNMENT';
  if (t.includes('tempo')) return 'TRAINING_TEMPO';
  if (t.includes('launch monitor')) return 'TECH_LAUNCH_MONITOR';
  if (t.includes('players distance')) return 'IRONS_PLAYERS_DISTANCE';
  if (t.includes('forged irons') || (t.includes('forged') && t.includes('iron'))) return 'IRONS_FORGED';
  if (t.includes('gap wedge') || t.includes(' 50')) return 'WEDGE_GAP_50';
  return 'GENERIC';
}

/* =========================
   Canonicalization & de-duplication
   ========================= */
function canonicalLabel(term) {
  const t = term.toLowerCase();
  if (t.includes('driver') && t.includes('$300')) return 'drivers ≤ $300';
  if (t.includes('driver') && t.includes('$500')) return 'drivers ≤ $500';
  if (t.includes('game improvement') && t.includes('driver')) return 'GI drivers';
  if (t.includes('pro v1')) return 'Pro V1 balls';
  if (t.includes('3 piece') || t.includes('3-piece')) return '3-piece balls';
  if (t.includes('alignment')) return 'alignment sticks';
  if (t.includes('tempo')) return 'tempo trainers';
  if (t.includes('launch monitor')) return 'launch monitors';
  if (t.includes('players distance irons')) return 'players-distance irons';
  if (t.includes('forged irons')) return 'forged irons';
  if (t.includes('gap wedge') || t.includes(' 50')) return '50° gap wedges';
  return humanize(term).toLowerCase();
}
function conflictKey(term) {
  const t = term.toLowerCase();
  if (t.includes('driver') && (t.includes('$300') || t.includes('$500') || t.includes('game improvement')))
    return 'driver-tier';
  if (t.includes('pro v1') || t.includes('3 piece') || t.includes('3-piece'))
    return 'ball-family';
  return null;
}
function dedupeConflicts(terms, rng) {
  const byGroup = new Map();
  const rest = [];

  for (const term of terms) {
    const key = conflictKey(term);
    if (!key) { rest.push(term); continue; }
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(term);
  }

  const resolved = [];
  for (const [key, list] of byGroup.entries()) {
    if (key === 'driver-tier') {
      const has500 = list.some(t => t.includes('$500'));
      const has300 = list.some(t => t.includes('$300'));
      const hasGI  = list.some(t => t.includes('game improvement'));
      if (has500 && has300) { resolved.push(list.find(t => t.includes('$500'))); }
      else if ((has500 || has300) && hasGI) {
        resolved.push(list.find(t => t.includes('$500') || t.includes('$300')));
      } else {
        resolved.push(list[Math.floor(rng() * list.length)]);
      }
    } else if (key === 'ball-family') {
      const pro = list.find(t => t.toLowerCase().includes('pro v1'));
      resolved.push(pro || list[Math.floor(rng() * list.length)]);
    } else {
      resolved.push(list[Math.floor(rng() * list.length)]);
    }
  }
  return [...rest, ...resolved];
}
function buildNiceTitle(siteTitle, y, m, d, chosenTerms) {
  const labels = [];
  const seen = new Set();
  for (const t of chosenTerms) {
    const label = canonicalLabel(t);
    if (!seen.has(label)) { seen.add(label); labels.push(label); }
    if (labels.length >= 3) break;
  }
  const dateStr = `${y}-${m}-${d}`;
  const suffix = labels.length ? `: ${labels.join(', ')}` : '';
  return `${siteTitle || 'Daily Golf Deals'} — ${dateStr}${suffix}`;
}
function buildNiceSlug(y, m, d, chosenTerms) {
  const labels = [];
  const seen = new Set();
  for (const t of chosenTerms) {
    const label = canonicalLabel(t);
    if (!seen.has(label)) { seen.add(label); labels.push(label); }
    if (labels.length >= 5) break;
  }
  let base = `golf-deals-${labels.map(l => toSlug(l)).join('-')}`;
  if (base.length > 80) base = base.slice(0, 80).replace(/-+[^-]*$/, '');
  return `${y}-${m}-${d}-${base}.md`;
}

/* =========================
   AI loader + blurb generator (AI-first, fallback to pools)
   ========================= */
let _openai = null;
async function getOpenAI() {
  if (process.env.USE_AI !== '1') return null;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (_openai) return _openai;
  const { default: OpenAI } = await import('openai');
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

async function blurbFor(term, rng) {
  const ai = await getOpenAI();
  const t = humanize(term);

  // Try AI JSON output first (kept small/cheap)
  if (ai) {
    try {
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const maxTokens = Number(process.env.OPENAI_MAXTOKENS || 700);

      const system = `
You are a concise golf-gear expert writing buyer advice.
Return strict JSON: {"paragraph":"...", "checklist":["...","...","..."]}.
- 1 paragraph (80-120 words), practical, no hype.
- 4-5 checklist bullet fragments, actionable, no trailing periods.
- Do NOT include prices or brand claims; stay evergreen.
      `.trim();

      const user = `
Topic: ${t}
Context categories you might cover: drivers, balls, training aids, launch monitors, irons, wedges.
      `.trim();

      const resp = await ai.chat.completions.create({
        model,
        temperature: 0.7,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      });

      const content = resp.choices?.[0]?.message?.content || "{}";
      const data = JSON.parse(content);
      if (data.paragraph && Array.isArray(data.checklist) && data.checklist.length) {
        const bullets = data.checklist.slice(0, 5).map(s => String(s).trim()).filter(Boolean);
        return { paragraph: String(data.paragraph).trim(), checklist: bullets };
      }
    } catch (_) {
      // Any API/JSON error—fall through to pools
    }
  }

  // Deterministic fallback using POOLS
  const pool = POOLS[themeFor(term)] || POOLS.GENERIC;
  const sCount = 2 + Math.floor(rng() * 2);  // 2–3 sentences
  const bCount = 3 + Math.floor(rng() * 3);  // 3–5 bullets
  const sentences = sampleDistinct(pool.sentences, sCount, rng);
  const bullets = sampleDistinct(pool.checklist, bCount, rng);
  return { paragraph: sentences.join(' '), checklist: bullets };
}

/* =========================
   Article scaffolding
   ========================= */
const INTRO = [
  `If you want value without doom-scrolling, start here. We explain what to compare, then link straight into high-intent searches.`,
  `Today’s shortlist is built for speed: a bit of context first, then focused filters to scan prices and specs quickly.`,
  `Practical picks only—each section outlines the decision points so you know what matters before you click.`
];
const BRIDGE = [
  `Here’s what we’re tracking right now:`,
  `Start with these categories:`,
  `Today’s quick cuts:`
];
const OUTRO = [
  `We refresh this feed automatically. Bookmark if it helps. Some links may be monetized (Amazon Associates).`,
  `New variants post regularly—check back tomorrow. Some links may be monetized (Amazon Associates).`
];

/* =========================
   Main
   ========================= */
(async function main () {
  const now = new Date();
  const { y, m, day, hh, mm } = utcParts(now);
  const dateKey = `${y}-${m}-${day}`;

  // manual runs vary by SLUG_SUFFIX; daily stable by date
  const suffixRaw = process.env.SLUG_SUFFIX || '';
  let seedStr = suffixRaw ? `${dateKey}::${suffixRaw}` : `${dateKey}::daily`;

  const postsDir = path.join(__dirname, '_posts');
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

  // Try up to 8 times to avoid same combo today (signature guard)
  let attempt = 0, rng, sections, flatTerms, sig;
  while (attempt < 8) {
    rng = mulberry32(hash32(seedStr));

    const numCats = 3 + Math.floor(rng() * 2); // 3–4 categories
    const chosenCats = sampleN(cfg.categories, numCats, rng);

    const MAX_ITEMS = Number(cfg.itemsPerCategory || 5);
    sections = chosenCats.map(cat => {
      const minItems = 3, maxItems = Math.min(5, MAX_ITEMS, (cat.terms || []).length || 0);
      const k = Math.max(minItems, Math.min(maxItems, 3 + Math.floor(rng() * 3))); // 3–5
      return { title: cat.title, terms: sampleN(cat.terms || [], k, rng) };
    });

    // Shuffle sections for variety
    sections = shuffle(sections, mulberry32(hash32(seedStr) ^ 0x9e3779b1));

    flatTerms = sections.flatMap(s => s.terms);
    // De-duplicate overlapping/near-duplicate topics (driver tiers, ball families, etc.)
    flatTerms = dedupeConflicts(flatTerms, rng);

    // Signature for same-day duplicate check
    const termKey = flatTerms.map(t => toSlug(t)).sort().join('|');
    sig = `sig:${hash32(termKey).toString(16)}`;

    const todays = fs.readdirSync(postsDir).filter(f => f.startsWith(`${y}-${m}-${day}-`) && f.endsWith('.md'));
    const dup = todays.some(f => {
      try { return fs.readFileSync(path.join(postsDir, f), 'utf8').includes(`<!-- ${sig} -->`); }
      catch { return false; }
    });
    if (!dup) break;

    attempt++; seedStr += `::${attempt}`;
  }

  // Build title & slug using canonicalized labels
  const postTitle = buildNiceTitle(cfg.siteTitle, y, m, day, flatTerms);
  let filename = buildNiceSlug(y, m, day, flatTerms);
  const full = (n) => path.join(postsDir, n);
  if (fs.existsSync(full(filename))) {
    const nonce = Math.random().toString(36).slice(2, 6);
    filename = filename.replace(/\.md$/, `-${nonce}.md`);
  }

  // Date in front-matter: daily = 07:00 UTC; manual = now
  const fmTime = suffixRaw ? `${y}-${m}-${day} ${hh}:${mm}:00 +0000`
                           : `${y}-${m}-${day} 07:00:00 +0000`;

  // Compose article
  const intro = INTRO[hash32(seedStr) % INTRO.length];
  const bridge = BRIDGE[(hash32(seedStr) + 7) % BRIDGE.length];
  const outro = OUTRO[(hash32(seedStr) + 13) % OUTRO.length];

  let md = `---\n`;
  md += `layout: post\n`;
  md += `title: "${postTitle}"\n`;
  md += `date: ${fmTime}\n`;
  md += `categories: deals\n`;
  md += `---\n\n`;

  md += `<!-- ${sig} -->\n\n`;
  md += `${intro} ${bridge}\n\n`;

  // Render sections & randomized blurbs
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];

    // Skip sections that lost all terms after de-dupe
    const keptTerms = sec.terms.filter(t => flatTerms.includes(t));
    if (!keptTerms.length) continue;

    md += `### ${sec.title}\n\n`;

    const leadIns = [
      (t) => `**${t}.** A fast way to compare current options and pricing:`,
      (t) => `**${t}.** Use these filters when you want clarity, not clutter:`,
      (t) => `**${t}.** Clean jumping-off points with minimal noise:`
    ];
    md += `${leadIns[(hash32(seedStr + i) % leadIns.length)](sec.title)}\n\n`;

    for (const term of keptTerms) {
      const t = humanize(term);
      const info = await blurbFor(term, rng); // may use AI or fallback
      md += `**${t}.** ${info.paragraph}\n\n`;
      md += `_What to compare:_\n`;
      for (const item of info.checklist) md += `- ${item}\n`;
      md += `\n➡️  [See ${t} on Amazon](${amazonSearch(term, cfg.amazonTag)})\n\n`;
    }
  }

  md += `${outro}\n`;

  fs.writeFileSync(full(filename), md, 'utf8');
  console.log('📝 Wrote post:', filename);
})();
