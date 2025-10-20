/* =========================
   Randomized content pools
   ========================= */
// Map each *theme* (not strict term) to pools of sentences & bullets.
// Add as many sentences/bullets as you like — more items = more variety.
const POOLS = {
  DRIVER_BUDGET: {
    sentences: [
      "Last-year heads and value brands often match the same COR limits as flagship models.",
      "Forgiveness is primarily about head size, CG and MOI, not marketing names.",
      "Loft and shaft fit matter more than chasing a single 'hot' face.",
      "Acoustics and feel changed a lot year to year; pick the sound that gives you confidence."
    ],
    checklist: [
      "Loft for launch window (10.5–12° fits most)",
      "Shaft weight & flex matched to tempo",
      "Adjustable hosel or back weight for spin control",
      "Face angle/draw setting if you fight a fade",
      "Head shape you like at address"
    ]
  },

  DRIVER_PREMIUM: {
    sentences: [
      "Current-gen drivers bring tighter tolerances and more adjustable weighting.",
      "You’ll often see more consistent ball speed retention on mishits.",
      "Swing-weight and shaft profile out of the box can vary by vendor — check the spec sheet."
    ],
    checklist: [
      "Spin window vs launch (mid/low spin if you launch high)",
      "Back/heel mass for stability or draw bias",
      "Stock shaft profile (don’t fear made-for if it fits)",
      "Sound/feel preference — it changes confidence"
    ]
  },

  DRIVER_GAME_IMPROVEMENT: {
    sentences: [
      "High-MOI heads reduce gear-effect sidespin and keep ball speed on the map.",
      "Draw-biased weighting can straighten a weak fade without swing changes.",
      "Upright lie settings nudge start line left for many players."
    ],
    checklist: [
      "Back/heel weighting options",
      "460cc head for max forgiveness",
      "Upright/draw hosel settings",
      "Face tech consistency across the face"
    ]
  },

  BALL_TOUR: {
    sentences: [
      "Urethane covers give you greenside spin and flight control in wind.",
      "Compression and feel vary — pick the sound/feel that helps distance control.",
      "Bulk pricing swings during season changes and holidays."
    ],
    checklist: [
      "Urethane vs ionomer cover",
      "Compression suited to swing speed",
      "Dimple pattern for stability",
      "Dozen vs bulk value packs"
    ]
  },

  BALL_VALUE_3PC: {
    sentences: [
      "Three-piece balls balance price and performance for most golfers.",
      "Ionomer covers are durable; urethane adds bite on wedges.",
      "Lower compression options help slow/medium speeds launch higher."
    ],
    checklist: [
      "Cover material & durability",
      "Compression feel",
      "High-visibility color",
      "Wind stability"
    ]
  },

  TRAINING_ALIGNMENT: {
    sentences: [
      "Two sticks on the ground nail stance and target line quickly.",
      "Gate drills with sticks sharpen start line and face control.",
      "Look for high-contrast colors you can see in rough or low light."
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
      "Weighted/whippy trainers smooth sequencing and tempo from the top.",
      "Heavier heads promote shallowing and rhythm over hit impulse.",
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
      "Indoors, prioritize units that measure spin and club data, not just estimate.",
      "Exportable shot libraries make practice stick over time."
    ],
    checklist: [
      "Measured vs modeled data",
      "Outdoor ball-flight capture",
      "App export & session history",
      "Battery life & mounting ease"
    ]
  },

  IRONS_PLAYERS_DISTANCE: {
    sentences: [
      "Hollow or thin-face designs give speed in compact shapes.",
      "Loft jacking is common — check gapping at the bottom of the bag.",
      "Blend sets if you want GI long irons with sleeker scoring clubs."
    ],
    checklist: [
      "Loft & gapping",
      "Forgiveness vs topline look",
      "Shaft weight/profile",
      "Blend options across the set"
    ]
  },

  IRONS_FORGED: {
    sentences: [
      "Forged heads emphasize feedback and flight control.",
      "Sole width and bounce matter for your turf interaction.",
      "Finish durability varies — raw, chrome and PVD wear differently."
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
      "A 50° wedge bridges modern PW to SW gaps for tighter yardages.",
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

  // Generic fallback pool for unknown terms
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
      "Prime/fast shipping when timing matters"
    ]
  }
};

// Lightweight term→theme mapping so many terms can share a pool.
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

  if (t.includes('gap wedge') || t.includes('50')) return 'WEDGE_GAP_50';

  return 'GENERIC';
}

// Compose a fresh paragraph + checklist for a term on every run.
function blurbFor(term, rng) {
  const theme = themeFor(term);
  const pool = POOLS[theme] || POOLS.GENERIC;

  // choose 2–3 sentences, 3–5 bullets
  const sCount = 2 + Math.floor(rng() * 2);   // 2–3
  const bCount = 3 + Math.floor(rng() * 3);   // 3–5

  // simple sampling without mutation
  const sentences = sampleDistinct(pool.sentences, sCount, rng);
  const bullets   = sampleDistinct(pool.checklist, bCount, rng);

  return {
    paragraph: sentences.join(' '),
    checklist: bullets
  };
}

// helper to sample distinct items from a small array
function sampleDistinct(arr, k, rng) {
  const used = new Set(), out = [];
  while (out.length < k && used.size < arr.length) {
    const i = Math.floor(rng() * arr.length);
    if (used.has(i)) continue;
    used.add(i); out.push(arr[i]);
  }
  return out;
}