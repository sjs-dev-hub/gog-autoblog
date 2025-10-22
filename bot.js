// bot.js — Guild of Golf — Daily Deals (layout A/B/C, hybrid specific-links mode)

const fs = require('fs');
const path = require('path');

// === CONFIG LOAD ===
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
cfg.categories = (cfg.categories || []).map(c => ({
  title: String(c.title || '').trim(),
  terms: Array.from(new Set((c.terms || []).map(t => String(t).trim()).filter(Boolean)))
}));

// === UTILITIES ===
function amazonSearch(q, tag) { return `https://www.amazon.com/s?k=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}`; }
function utcParts(d=new Date()){return{y:d.getUTCFullYear(),m:String(d.getUTCMonth()+1).padStart(2,'0'),day:String(d.getUTCDate()).padStart(2,'0'),hh:String(d.getUTCHours()).padStart(2,'0'),mm:String(d.getUTCMinutes()).padStart(2,'0')};}
function toSlug(s){return String(s).toLowerCase().replace(/\s*\$\s*/g,'').replace(/[^a-z0-9]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');}
function humanize(t){return String(t).trim().replace(/\s*\$\s*/g,' $');}
function hash32(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0);}
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function shuffle(a,r){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
function sampleN(a,n,r){return shuffle(a,r).slice(0,Math.min(n,a.length));}

// === OPENAI HELPER ===
async function maybeAI(prompt,max=500){
  if(String(process.env.USE_AI||'0')!=='1'||!process.env.OPENAI_API_KEY) return null;
  try{
    const {OpenAI}=require('openai');
    const c=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const m=process.env.OPENAI_MODEL||'gpt-4o-mini';
    const r=await c.chat.completions.create({
      model:m,
      messages:[{role:'system',content:`Write SEO-friendly, factual golf gear copy. Avoid prices, promises, or brand bias.`},{role:'user',content:prompt}],
      temperature:0.8,
      max_tokens:max
    });
    return r.choices?.[0]?.message?.content?.trim()||null;
  }catch(e){console.log('[AI fail]',e.message);return null;}
}

// === AI BUILDERS ===
async function aiIntro(title,date,topics){
  const prompt=`Write 2–3 engaging sentences introducing a golf-gear daily-deals roundup titled "${title} — ${date}". Mention practicality and comparisons on Amazon.`;
  return (await maybeAI(prompt,150))||`Fresh golf-gear search shortcuts for ${date}. Compare specs, reviews, and prices faster—these Amazon searches highlight what golfers ask about most.`;
}

async function aiTerm(term){
  const prompt=`Topic: ${term}.
Write ~120 words describing how to shop for it (benefits, specs, mistakes).
Add 1–2 generic example product types (no brands) to make it concrete.
Finish with 3 bullet points under "What to compare:".`;
  const txt=await maybeAI(prompt,260);
  if(!txt) return {para:`${term} buying notes.`,bullets:['Spec differences','Durability','Fit for swing'],examples:['Standard','Pro']};
  const parts=txt.split(/What to compare:/i);
  const para=parts[0].trim();
  const bullets=(parts[1]||'').split('\n').map(l=>l.replace(/^[-•]\s*/,'').trim()).filter(Boolean).slice(0,4);
  return {para,bullets};
}

async function aiQuickPicks(terms){
  const prompt=`From these golf topics: ${terms.join(', ')}.
Return 3 quick picks (Best for..., reason). No brand names.`;
  const txt=await maybeAI(prompt,180);
  if(!txt) return null;
  return txt.split('\n').filter(l=>l.startsWith('-')).map(s=>s.replace(/^-\s*/,''));
}

async function aiFAQ(terms){
  const prompt=`Make 3 Q&A pairs for golfers comparing ${terms.join(', ')}. Format Q:... A:...`;
  const txt=await maybeAI(prompt,300);
  if(!txt) return null;
  const lines=txt.split('\n').map(s=>s.trim()).filter(Boolean);
  const qa=[];
  for(let i=0;i<lines.length;i++){
    if(/^Q:/i.test(lines[i])&&/^A:/i.test(lines[i+1]||'')){
      qa.push({q:lines[i].slice(2).trim(),a:lines[i+1].slice(2).trim()});
    }
  }
  return qa.slice(0,3);
}

// === MAIN ===
(async()=>{
  const now=new Date();const {y,m,day,hh,mm}=utcParts(now);
  const dateStr=`${y}-${m}-${day}`;
  const postsDir=path.join(__dirname,'_posts');if(!fs.existsSync(postsDir))fs.mkdirSync(postsDir,{recursive:true});
  const suffix=process.env.SLUG_SUFFIX||'';const rng=mulberry32(hash32(dateStr+suffix));
  const cats=sampleN(cfg.categories,3+Math.floor(rng()*2),rng);
  const sections=cats.map(c=>({title:c.title,terms:sampleN(c.terms,3+Math.floor(rng()*2),rng)}));
  const flat=sections.flatMap(s=>s.terms);
  const title=`${cfg.siteTitle||'Golf Deals'} — ${dateStr}`;
  const slug=`${y}-${m}-${day}-deals-${toSlug(flat.slice(0,3).join('-'))}.md`;
  const fmDate=`${y}-${m}-${day} 07:00:00 +0000`;

  const intro=await aiIntro(title,dateStr,flat);
  const blurbs={};
  for(const t of flat){blurbs[t]=await aiTerm(t);}

  const quick=await aiQuickPicks(flat)||[];
  const faq=await aiFAQ(flat)||[];

  function renderTerm(t){
    const b=blurbs[t];
    let md=`**${humanize(t)}.** ${b.para}\n\n_What to compare:_\n`;
    b.bullets.forEach(x=>md+=`- ${x}\n`);
    md+=`\n➡️ [Compare ${humanize(t)} on Amazon](${amazonSearch(t,cfg.amazonTag)})\n`;
    return md;
  }

  // === LAYOUT ROTATION ===
  const layout=Math.floor(rng()*3); // 0,1,2
  let body='';

  if(layout===0){ // Layout A
    body+=`${intro}\n\n### Today’s Topics\n\n`;
    for(const s of sections){body+=`#### ${s.title}\n\n`;s.terms.forEach(t=>body+=renderTerm(t)+'\n');}
    if(quick.length){body+=`### Quick Picks\n\n${quick.map(x=>`- ${x}`).join('\n')}\n\n`;}
    if(faq.length){body+=`### FAQ\n\n`;faq.forEach(q=>body+=`**Q: ${q.q}**\n\n${q.a}\n\n`);}
  }else if(layout===1){ // Layout B
    body+=`${intro}\n\n### Buyer Tips\n\n- Check launch angle, spin, and shaft fit\n- Compare forgiveness vs. workability\n- Read recent reviews, not old models\n\n`;
    const mix=shuffle(sections,rng);
    for(const s of mix){body+=`#### ${s.title}\n\n`;s.terms.forEach(t=>body+=renderTerm(t)+'\n');}
    body+=`### Related Searches\n\n${flat.slice(0,5).map(t=>`- [${humanize(t)} — on Amazon](${amazonSearch(t,cfg.amazonTag)})`).join('\n')}\n\n`;
  }else{ // Layout C – Insight
    body+=`${intro}\n\n### Gear Insights\n\n`;
    for(const s of sections){
      body+=`#### ${s.title}\n\n`;
      for(const t of s.terms){
        const b=blurbs[t];
        body+=`**${humanize(t)}** — ${b.para}\n\n_Sample product types:_ ${['forged cavity','game-improvement head','tour ball','launch trainer'][Math.floor(rng()*4)]} etc.\n\n`;
        body+=`➡️ [Explore ${humanize(t)} on Amazon](${amazonSearch(t,cfg.amazonTag)})\n\n`;
      }
    }
    body+=`### Buying Checklist\n\n- Define your gapping & launch window\n- Match shaft weight to tempo\n- Verify loft/lie specs before checkout\n- Read fit notes & return policies\n\n`;
  }

  body+=`*Automatically refreshed; affiliate links via Amazon Associates.*`;
  const md=`---\nlayout: post\ntitle: "${title}"\ndate: ${fmDate}\ncategories: deals\n---\n\n${body}\n`;
  fs.writeFileSync(path.join(postsDir,slug),md,'utf8');
  console.log('📝 Wrote post:',slug);
})();