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
  return String(s).toLowerCase()
    .replace(/\s*\$\s*/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function humanize(term) {
  let t = String(term).trim();
  t = t.replace(/\s*\$\s*/g, ' $');
  t = t.replace(/\bpro v1\b/gi, 'Pro V1');
  return t;
}

/* ========== deterministic RNG (Mulberry32) ========== */
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash(s) {
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

/* =========================
   Knowledge base (compact, expandable)
   ========================= */
const KB = {
  "driver under $300": {
    para: `At this price you’re typically choosing last-year heads or value brands. That’s fine—COR is regulated and forgiveness is mostly about head size and weight placement.`,
    checklist: [
      "Loft (higher loft = easier launch; 10.5–12° fits most)",
      "Shaft flex & weight (match tempo; slower swings like lighter/softer)",
      "Adjustability (hosel/weights help tune launch & spin)",
      "Face angle (slight draw settings help fight a fade)"
    ]
  },
  "driver under $500": {
    para: `You’re in current-gen territory with more adjustable weights and tighter manufacturing tolerances. Expect more consistent ball speeds and refined acoustics.`,
    checklist: [
      "Spin window (mid–low spin if you’re launching high)",
      "MOI/forgiveness (larger back weight = more stable)",
      "Stock shaft profile (don’t fear “made-for” if it fits)",
      "Sound/feel (subjective but confidence matters)"
    ]
  },
  "best game improvement driver": {
    para: `High-MOI, draw-biased heads reduce gear-effect sidespin and stabilize mishits. Ideal if fairway-finding beats raw distance for your scores.`,
    checklist: [
      "Back/heel weighting (helps start line and closure)",
      "Head size (460cc = max forgiveness)",
      "Upright lie / draw setting options",
      "Face tech consistency across the face"
    ]
  },
  "Pro V1 deals": {
    para: `Tour-caliber urethane with mid-flight, soft feel and excellent wedge spin. If your short-game is a weapon, urethane balls return strokes.`,
    checklist: [
      "3-piece urethane vs ionomer (greenside spin vs durability)",
      "Compression feel (Pro V1 ~mid; x-models are firmer)",
      "Dozen vs bulk pricing (seasonal dips are real)",
      "Practice-stamp packs for value"
    ]
  },
  "golf balls 3 piece": {
    para: `Three-piece designs balance price with performance: typically ionomer covers with lively cores for speed and decent flight control.`,
    checklist: [
      "Cover (urethane = more spin; ionomer = value/durability)",
      "Dimple pattern (wind stability)",
      "Compression (softer feel for slower speeds)",
      "Color/visibility on overcast days"
    ]
  },
  "alignment sticks": {
    para: `Cheap, high-leverage training aid. Use two on the ground for stance and target line; mix in gate drills for start-line control.`,
    checklist: [
      "Length & stiffness (don’t bend too easily)",
      "High-contrast color (visibility on grass)",
      "Caps for safety (no sharp ends)",
      "Bundle with clips for plane/putting gates"
    ]
  },
  "swing tempo trainer": {
    para: `Tempo trainers smooth sequencing and help create repeatable rhythm—particularly helpful for players who rush from the top.`,
    checklist: [
      "Weight placement (heavy head promotes shallowing)",
      "Length (longer = more tempo feedback)",
      "Flex profile (more whip = better timing cues)",
      "Indoor-safe grip/cover"
    ]
  },
  "golf launch monitor": {
    para: `Personal launch monitors are now accurate enough outdoors to guide gapping and equipment choices. Indoors, look for better spin/club tracking.`,
    checklist: [
      "Measured vs modeled spin/club data",
      "Outdoor ball-flight capture quality",
      "Software/app export (CSV/shot library)",
      "Battery life and tripod/leveling ease"
    ]
  },
  "swing analyzer": {
    para: `Wearable sensors reveal face/path tendencies and tempo ratios. They’re best for practice sessions—not tournament rounds.`,
    checklist: [
      "Club or glove mount options",
      "Face/path/tempo metrics reported",
      "Video sync for feedback",
      "Subscription cost vs features"
    ]
  },
  "putting mat": {
    para: `Roll quality matters more than gimmicks. A 9–11 stimp is realistic for home use and helps distance control drills stick.`,
    checklist: [
      "Mat speed & trueness",
      "Return track or drop-cup",
      "Alignment guides for start line",
      "Storage (roll-up without creases)"
    ]
  },
  "players distance irons": {
    para: `Hollow-body or thin-face designs give speed with a compact look. Great for mid-caps chasing ball speed without a shovelly profile.`,
    checklist: [
      "Loft jacking (watch gapping at the bottom)",
      "Forgiveness vs topline preference",
      "Shaft weight/profile match",
      "Set blending with GI long irons"
    ]
  },
  "forged irons": {
    para: `Forged heads emphasize feel and workability. They’re less forgiving but reward center strikes with precise flight windows.`,
    checklist: [
      "Blade length & sole width (turf interaction)",
      "Bounce & grind through the set",
      "Swing-weight consistency",
      "Chroming/durability of finish"
    ]
  },
  "gap wedge 50": {
    para: `A 50° gap wedge bridges modern iron lofts and your 56/60. It tightens yardage gaps and adds a versatile flight around the green.`,
    checklist: [
      "Loft/lie fit relative to PW & SW",
      "Bounce/grind for your turf/sand",
      "Groove sharpness & spin durability",
      "Shaft match to your irons"
    ]
  }
};

/* =========================
   Article templates
   ========================= */
const INTRO = [
  `New day, new deals. Below is a focused shortlist with **why** each search matters and **what to compare** before you buy.`,
  `If you want value without doom-scrolling, start here: context on the pick, then quick filters that surface the right options fast.`,
  `Practical picks only—each section explains the decision points, then links you straight to high-intent results.`
];
const BRIDGE = [
  `Here’s today’s cut:`,
  `Start with these categories:`,
  `Highlights for your next range session or checkout:`
];
const OUTRO = [
  `We refresh this feed automatically. If a link helps you, bookmark this page. Some links may be monetized (Amazon Associates).`,
  `Come back tomorrow for new picks. We add context first, links second—so you can buy with confidence. Some links may be monetized (Amazon Associates).`
];

/* =========================
   Main
   ========================= */
(function main () {
  const now = new Date();
  const { y, m, day, hh, mm } = utcParts(now);
  const dateKey = `${y}-${m}-${day}`;

  // Seed: manual uses SLUG_SUFFIX (so multiple runs today differ); daily uses date
  const suffixRaw = process.env.SLUG_SUFFIX || '';
  const seedStr = suffixRaw ? `${dateKey}::${suffixRaw}` : `${dateKey}::daily`;
  const rng = mulberry32(hash(seedStr));

  // 1) Pick 2–3 random categories
  const numCats = 2 + Math.floor(rng() * 2); // 2 or 3
  const chosenCats = sampleN(cfg.categories, numCats, rng);

  // 2) For each category, pick 2–4 random terms
  const MAX_ITEMS = Number(cfg.itemsPerCategory || 5);
  const sections = chosenCats.map(cat => {
    const minItems = 2, maxItems = Math.min(4, MAX_ITEMS, (cat.terms || []).length || 0);
    const k = Math.max(minItems, Math.min(maxItems, 2 + Math.floor(rng() * 3)));
    const picks = sampleN(cat.terms || [], k, rng);
    return { title: cat.title, terms: picks };
  });

  // 3) Build a descriptive slug & readable title from the selected terms
  const flatTerms = sections.flatMap(s => s.terms);
  const slugBits = flatTerms.slice(0, 5).map(toSlug).filter(Boolean);
  let baseSlug = slugBits.length ? `golf-deals-${slugBits.join('-')}` : 'golf-deals';
  if (baseSlug.length > 80) baseSlug = baseSlug.slice(0, 80).replace(/-+[^-]*$/, '');
  const titleBits = flatTerms.slice(0, 3).map(humanize);
  const titleTail = titleBits.length ? `: ${titleBits.join(', ')}` : '';

  // 4) Determine filename and date
  const postsDir = path.join(__dirname, '_posts');
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

  let filename = `${y}-${m}-${day}-${baseSlug}.md`;
  const full = (n) => path.join(postsDir, n);
  if (fs.existsSync(full(filename))) {
    const nonce = Math.random().toString(36).slice(2, 6);
    filename = `${y}-${m}-${day}-${baseSlug}-${nonce}.md`;
  }
  const fmTime = suffixRaw ? `${y}-${m}-${day} ${hh}:${mm}:00 +0000`
                           : `${y}-${m}-${day} 07:00:00 +0000`;

  // 5) Compose article
  let md = `---\n`;
  md += `layout: post\n`;
  md += `title: "${(cfg.siteTitle || 'Daily Golf Deals')} — ${dateKey}${titleTail}"\n`;
  md += `date: ${fmTime}\n`;
  md += `categories: deals\n`;
  md += `---\n\n`;

  md += `${INTRO[Math.floor(rng() * INTRO.length)]} ${BRIDGE[Math.floor(rng() * BRIDGE.length)]}\n\n`;

  sections.forEach((sec) => {
    md += `### ${sec.title}\n\n`;
    // For each chosen term, add a paragraph + checklist + link
    for (const term of sec.terms) {
      const t = humanize(term);
      const kb = KB[term] || {
        para: `This is a high-intent search—use it to jump straight to relevant options and filter by price, reviews, and shipping.`,
        checklist: [
          "Price vs review count (value > hype)",
          "Recent model year or tech carryover",
          "Size/fit options and returns",
          "Prime/fast shipping when timing matters"
        ]
      };
      md += `**${t}.** ${kb.para}\n\n`;
      md += `_What to compare:_\n`;
      for (const item of kb.checklist) md += `- ${item}\n`;
      md += `\n➡️  [See ${t} on Amazon](${amazonSearch(term, cfg.amazonTag)})\n\n`;
    }
  });

  md += `${OUTRO[Math.floor(rng() * OUTRO.length)]}\n`;

  // 6) Write file
  fs.writeFileSync(full(filename), md, 'utf8');
  console.log('📝 Wrote post:', filename);
})();