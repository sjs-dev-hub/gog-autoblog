// bot.js — Guild of Golf — Daily Deals
// - Unique titles/slugs per run
// - Optional AI blurbs (OPENAI_API_KEY, USE_AI)
// - Amazon Search links
// - Amazon Native Shopping Ads (image widget) per term

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---------- setup paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- load config ----------
const cfg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "config.json"), "utf8")
);

// sanitize categories/terms
cfg.categories = (cfg.categories || []).map((c) => ({
  title: String(c.title || "").trim(),
  terms: Array.from(
    new Set((c.terms || []).map((t) => String(t).trim()).filter(Boolean))
  ),
}));
const AMAZON_TAG = cfg.amazonTag || "";

// ---------- OpenAI (optional) ----------
let openai = null;
const USE_AI = (process.env.USE_AI || "0") === "1";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_MAXTOKENS = Number(process.env.OPENAI_MAXTOKENS || 700);

if (USE_AI && process.env.OPENAI_API_KEY) {
  const { OpenAI } = await import("openai");
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ---------- utils ----------
function amazonSearch(q, tag) {
  const base = `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;
  if (!tag) return base;
  return `${base}&tag=${encodeURIComponent(tag)}`;
}

// Amazon Native Shopping Ads widget (renders a product image grid)
// NOTE: We include a per-block onejs snippet. It’s simplest & works in static sites.
// Amazon policy allows widgets; make sure your tag is correct.
function amazonWidget(term, tag) {
  const safeTerm = String(term).replace(/"/g, "");
  const tracking = (tag || "").replace(/"/g, "");
  return `
<div class="amzn-native" style="margin: 8px 0 12px;">
  <script type="text/javascript">
    amzn_assoc_placement = "adunit0";
    amzn_assoc_search_bar = "false";
    amzn_assoc_tracking_id = "${tracking}";
    amzn_assoc_ad_mode = "search";
    amzn_assoc_ad_type = "smart";
    amzn_assoc_marketplace = "amazon";
    amzn_assoc_region = "US";
    amzn_assoc_default_search_phrase = "${safeTerm}";
    amzn_assoc_default_category = "SportingGoods";
    amzn_assoc_title = "";
  </script>
  <script src="//z-na.amazon-adsystem.com/widgets/onejs?MarketPlace=US"></script>
</div>
`.trim();
}

function utcParts(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return { y, m, day, hh, mm };
}
function toSlug(s) {
  return String(s)
    .toLowerCase()
    .replace(/\s*\$\s*/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
function humanize(term) {
  let t = String(term).trim();
  t = t.replace(/\s*\$\s*/g, " $");
  t = t.replace(/\bpro v1\b/gi, "Pro V1");
  return t;
}

// deterministic RNG
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash32(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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
  const used = new Set(),
    out = [];
  while (out.length < k && used.size < arr.length) {
    const i = Math.floor(rng() * arr.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(arr[i]);
  }
  return out;
}

// pools for fallback blurbs
const POOLS = {
  GENERIC: {
    sentences: [
      "Use this search to jump into relevant options and filter by price, reviews and shipping.",
      "Sort by rating with a sensible review count to avoid paid noise.",
      "Scan size/fit details and return policy before checkout.",
    ],
    checklist: [
      "Price vs review volume",
      "Model year / tech carryover",
      "Sizing/fit & returns",
      "Fast shipping if timing matters",
    ],
  },
  DRIVER_BUDGET: {
    sentences: [
      "Forgiveness comes from head size, CG and MOI more than flashy names.",
      "Loft and shaft fit usually matter more than a single ‘hot’ face.",
      "Sound/feel that boosts confidence is worth distance on mishits.",
    ],
    checklist: [
      "Loft for launch window (10.5–12° fits most)",
      "Shaft weight & flex matched to tempo",
      "Adjustable hosel/back weight",
      "Face angle/draw setting if you fight a fade",
    ],
  },
  // … (to keep length reasonable we’ll map terms→themes and use GENERIC as needed)
};

// light theme mapping
function themeFor(term) {
  const t = term.toLowerCase();
  if (t.includes("driver") && t.includes("$300")) return "DRIVER_BUDGET";
  return "GENERIC";
}

async function makeBlurb(term, rng) {
  const theme = POOLS[themeFor(term)] || POOLS.GENERIC;
  const sentCount = 2 + Math.floor(rng() * 2);
  const chkCount = 3 + Math.floor(rng() * 2);

  // Try AI (optional)
  if (openai) {
    try {
      const prompt = `Write a short, helpful buying note (80–120 words) about "${term}" for a golf deals blog. Plain, practical, no fluff.`;
      const res = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: OPENAI_MAXTOKENS,
        temperature: 0.7,
        messages: [
          { role: "system", content: "You write concise, practical gear buying notes." },
          { role: "user", content: prompt },
        ],
      });
      const paragraph =
        res.choices?.[0]?.message?.content?.trim() ||
        theme.sentences.slice(0, sentCount).join(" ");
      const checklist = sampleDistinct(theme.checklist, chkCount, rng);
      return { paragraph, checklist, ai: true };
    } catch (e) {
      // fallback to template
    }
  }
  // Fallback template
  return {
    paragraph: theme.sentences.slice(0, sentCount).join(" "),
    checklist: sampleDistinct(theme.checklist, chkCount, rng),
    ai: false,
  };
}

// canonicalization for titles/slugs
function canonicalLabel(term) {
  const t = term.toLowerCase();
  if (t.includes("driver") && t.includes("$300")) return "drivers ≤ $300";
  return humanize(term).toLowerCase();
}
function buildNiceTitle(siteTitle, y, m, d, chosenTerms) {
  const labels = [];
  const seen = new Set();
  for (const t of chosenTerms) {
    const lbl = canonicalLabel(t);
    if (!seen.has(lbl)) {
      labels.push(lbl);
      seen.add(lbl);
    }
    if (labels.length >= 3) break;
  }
  const dateStr = `${y}-${m}-${d}`;
  const suffix = labels.length ? `: ${labels.join(", ")}` : "";
  return `${siteTitle || "Daily Golf Deals"} — ${dateStr}${suffix}`;
}
function buildNiceSlug(y, m, d, chosenTerms) {
  const labels = [];
  const seen = new Set();
  for (const t of chosenTerms) {
    const lbl = canonicalLabel(t);
    if (!seen.has(lbl)) {
      labels.push(lbl);
      seen.add(lbl);
    }
    if (labels.length >= 5) break;
  }
  let base = `golf-deals-${labels.map((l) => toSlug(l)).join("-")}`;
  if (base.length > 80) base = base.slice(0, 80).replace(/-+[^-]*$/, "");
  return `${y}-${m}-${d}-${base}.md`;
}

// intro/outro variants
const INTRO = [
  "Practical picks only—each section outlines the decision points so you know what matters before you click. Here’s what we’re tracking right now:",
  "If you want value without doom-scrolling, start here. A bit of context first, then focused filters to scan prices and specs quickly:",
];
const OUTRO = [
  "New variants post regularly—check back tomorrow. Some links may be monetized (Amazon Associates).",
  "We refresh this feed automatically. Bookmark if it helps. Some links may be monetized (Amazon Associates).",
];

// ---------- main ----------
(async function main() {
  const now = new Date();
  const { y, m, day, hh, mm } = utcParts(now);
  const dateKey = `${y}-${m}-${day}`;

  // manual runs vary with SLUG_SUFFIX; daily is stable
  const suffixRaw = process.env.SLUG_SUFFIX || "";
  const seedStr = suffixRaw ? `${dateKey}::${suffixRaw}` : `${dateKey}::daily`;
  const rng = mulberry32(hash32(seedStr));

  const postsDir = path.join(__dirname, "_posts");
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

  // choose 3–4 categories, 3–5 terms each
  const numCats = 3 + Math.floor(rng() * 2);
  let sections = sampleN(cfg.categories, numCats, rng).map((c) => {
    const k = 3 + Math.floor(rng() * 3);
    return { title: c.title, terms: sampleN(c.terms, k, rng) };
  });
  sections = shuffle(sections, mulberry32(hash32(seedStr) ^ 0x9e3779b1));
  const flatTerms = sections.flatMap((s) => s.terms);

  // title/slug
  const postTitle = buildNiceTitle(cfg.siteTitle, y, m, day, flatTerms);
  let filename = buildNiceSlug(y, m, day, flatTerms);
  if (fs.existsSync(path.join(postsDir, filename))) {
    filename = filename.replace(/\.md$/, `-${Math.random().toString(36).slice(2, 6)}.md`);
  }

  // date for front matter: daily 07:00Z, manual now
  const fmTime = suffixRaw ? `${y}-${m}-${day} ${hh}:${mm}:00 +0000` : `${y}-${m}-${day} 07:00:00 +0000`;

  // compose
  let md = `---\n`;
  md += `layout: post\n`;
  md += `title: "${postTitle}"\n`;
  md += `date: ${fmTime}\n`;
  md += `categories: deals\n`;
  md += `---\n\n`;

  md += `${INTRO[hash32(seedStr) % INTRO.length]}\n\n`;

  // sections
  for (const sec of sections) {
    if (!sec.terms.length) continue;
    md += `### ${sec.title}\n\n`;

    for (const term of sec.terms) {
      const t = humanize(term);
      const info = await makeBlurb(term, rng);

      md += `**${t}.** ${info.paragraph}\n\n`;
      md += `_What to compare:_\n`;
      for (const item of info.checklist) md += `- ${item}\n`;
      md += `\n➡️  [See ${t} on Amazon](${amazonSearch(term, AMAZON_TAG)})\n\n`;

      // 🔹 Add Amazon image widget
      if (AMAZON_TAG) {
        md += `${amazonWidget(term, AMAZON_TAG)}\n\n`;
      }
    }
  }

  md += `${OUTRO[(hash32(seedStr) + 7) % OUTRO.length]}\n`;

  fs.writeFileSync(path.join(postsDir, filename), md, "utf8");
  console.log("📝 Wrote post:", filename);
})();