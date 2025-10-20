const fs = require('fs');
const path = require('path');

/* =========================
   Load config (unchanged)
   ========================= */
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

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
    .replace(/\s*\$\s*/g, '')         // normalize “$300”
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
   Randomized content pools
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
      "Prime/fast shipping if timing matters"
    ]
  }
};

// Map terms → pools (themes). Expand as you add terms.
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
  if (t.includes('forged')) return 'IRONS_FORGED';
  if (t.includes('gap wedge') || t.includes(' 50')) return 'WEDGE_GAP_50';
  return 'GENERIC';
}

// Compose fresh paragraph + checklist per term using pools.
function blurbFor(term, rng) {
  const pool = POOLS[themeFor(term)] || POOLS.GENERIC;
  const sCount = 2 + Math.floor(rng() * 2); // 2–3 sentences
  const bCount = 3 + Math.floor(rng() * 3); // 3–5 bullets
  const sentences = sampleDistinct(pool.sentences, sCount, rng);
  const bullets   = sampleDistinct(pool.checklist, bCount, rng);
  return { paragraph: sentences.join(' '), checklist: bullets };
}

/* =========================
   Article templates
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
(function main () {
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

    sections = shuffle(sections, mulberry32(hash32(seedStr) ^ 0x9e3779b1));

    flatTerms = sections.flatMap(s => s.terms);
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

  // slug & title
  const slugBits = flatTerms.slice(0, 6).map(toSlug).filter(Boolean);
  let baseSlug = slugBits.length ? `golf-deals-${slugBits.join('-')}` : 'golf-deals';
  if (baseSlug.length > 80) baseSlug = baseSlug.slice(0, 80).replace(/-+[^-]*$/, '');

  let filename = `${y}-${m}-${day}-${baseSlug}.md`;
  const full = (n) => path.join(postsDir, n);
  if (fs.existsSync(full(filename))) {
    const nonce = Math.random().toString(36).slice(2, 6);
    filename = `${y}-${m}-${day}-${baseSlug}-${nonce}.md`;
  }

  const fmTime = suffixRaw ? `${y}-${m}-${day} ${hh}:${mm}:00 +0000`
                           : `${y}-${m}-${day} 07:00:00 +0000`;

  const titleBits = flatTerms.slice(0, 3).map(humanize);
  const titleTail = titleBits.length ? `: ${titleBits.join(', ')}` : '';
  const intro = INTRO[hash32(seedStr) % INTRO.length];
  const bridge = BRIDGE[(hash32(seedStr) + 7) % BRIDGE.length];
  const outro = OUTRO[(hash32(seedStr) + 13) % OUTRO.length];

  // Compose article
  let md = `---\n`;
  md += `layout: post\n`;
  md += `title: "${(cfg.siteTitle || 'Daily Golf Deals')} — ${dateKey}${titleTail}"\n`;
  md += `date: ${fmTime}\n`;
  md += `categories: deals\n`;
  md += `---\n\n`;

  md += `<!-- ${sig} -->\n\n`;
  md += `${intro} ${bridge}\n\n`;

  sections.forEach((sec, i) => {
    md += `### ${sec.title}\n\n`;
    const leadIns = [
      (t) => `**${t}.** A fast way to compare current options and pricing:`,
      (t) => `**${t}.** Use these filters when you want clarity, not clutter:`,
      (t) => `**${t}.** Clean jumping-off points with minimal noise:`
    ];
    md += `${leadIns[(hash32(seedStr + i) % leadIns.length)](sec.title)}\n\n`;

    for (const term of sec.terms) {
      const t = humanize(term);
      const info = blurbFor(term, rng);  // <<< randomized paragraph + checklist
      md += `**${t}.** ${info.paragraph}\n\n`;
      md += `_What to compare:_\n`;
      for (const item of info.checklist) md += `- ${item}\n`;
      md += `\n➡️  [See ${t} on Amazon](${amazonSearch(term, cfg.amazonTag)})\n\n`;
    }
  });

  md += `${outro}\n`;

  fs.writeFileSync(full(filename), md, 'utf8');
  console.log('📝 Wrote post:', filename);
})();