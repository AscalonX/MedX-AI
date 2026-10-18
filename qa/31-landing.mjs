// Landing smoke (M-07, M-12): server HTML of "/" in the reference section order, English by default, persona links,
// honest model label, assets, the product video, /demo, /patient, robots and /api/health.
//   BASE=http://localhost:3133 node qa/31-landing.mjs
// Env: EXPECT_PROVIDER (default mock), EXPECT_STORE (default postgres on a non-local BASE; file or tmp-ephemeral
// locally), ALLOW_NO_VIDEO=1 turns a missing product video into a SKIP line instead of a failure.
import { BASE, LOCAL, req, check, done } from './lib.mjs';

const SECTION_IDS = ['nav', 'hero', 'built-with', 'video', 'how-it-works', 'features', 'safety', 'why', 'demo-accounts', 'phone-and-web', 'under-the-hood', 'limitations', 'cta', 'footer'];
const PERSONAS = ['patient', 'nurse-rossi', 'doctor-bianchi', 'pharm-conti', 'pharm-wong', 'ops-head'];
const NAV = [['#how-it-works', 'How it works'], ['#features', 'Features'], ['#safety', 'Safety'], ['#demo-accounts', 'Try a role'], ['/demo', 'Try the demo']];
const VIDEO = '/media/medx-demo.mp4', POSTER = '/media/medx-demo-poster.jpg';
const stripScripts = h => h.replace(/<script[\s\S]*?<\/script>/gi, '');
const textOf = h => stripScripts(h).replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const skip = (id, name, why) => console.log(`SKIP [${id}] ${name} (${why})`);

const page = await req('GET', '/');
const html = page.text, visible = stripScripts(html);
check('LP01', 'GET / -> 200 text/html', page.status === 200 && /text\/html/.test(page.headers.get('content-type') || ''), [page.status, page.headers.get('content-type')]);
check('LP02', 'GET / server HTML is English: <html lang="en">', /<html[^>]*\slang="en"/.test(html), html.match(/<html[^>]*>/)?.[0]?.slice(0, 80));

// Section order: first occurrence of each id="..." must follow the reference order.
const pos = SECTION_IDS.map(id => visible.search(new RegExp(`\\sid="${id}"`)));
check('LP03', `all ${SECTION_IDS.length} section ids present (${SECTION_IDS.join(', ')})`, pos.every(p => p >= 0), SECTION_IDS.filter((_, i) => pos[i] < 0));
check('LP04', 'sections appear in the reference order', pos.every((p, i) => i === 0 || p > pos[i - 1]), SECTION_IDS.map((id, i) => `${id}@${pos[i]}`));

// Sticky nav: the four anchors + Try the demo, language toggle with EN, Thai and Italian.
const links = [...visible.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(m => [m[1].replace(/&amp;/g, '&'), m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()]);
check('LP05', 'nav links: How it works, Features, Safety, Try a role, Try the demo (/demo)', NAV.every(([href, label]) => links.some(([h, l]) => h === href && l === label)), NAV.filter(([href, label]) => !links.some(([h, l]) => h === href && l === label)));
check('LP06', 'language toggle offers English, Thai and Italian (radio group)', /role="radio"[^>]*>EN</.test(visible) && /lang="th"[^>]*>ไทย</.test(visible) && /role="radio"[^>]*>IT</.test(visible), 'toggle buttons not found');

// Hero: one H1, two CTAs, Fin named, trust chips.
const text = textOf(html);
check('LP07', 'exactly one <h1> on the page', (visible.match(/<h1[\s>]/g) || []).length === 1, (visible.match(/<h1[\s>]/g) || []).length);
check('LP08', 'hero CTAs: Try the demo (/demo) and Watch in 60 seconds (#video)', links.some(([h, l]) => h === '/demo' && l === 'Try the demo') && links.some(([h, l]) => h === '#video' && /Watch in 60 seconds/.test(l)), links.filter(([h]) => h === '#video' || h === '/demo'));
check('LP09', 'hero subtitle names Fin', /\bFin\b/.test(text.slice(text.indexOf('Every word'), text.indexOf('Every word') + 600)), text.slice(text.indexOf('Every word'), text.indexOf('Every word') + 300));
const chips = ['Synthetic data only', 'Thai, Italian, English', 'Every field cites the patient'];
check('LP10', `trust chips: ${chips.join(' / ')}`, chips.every(c => text.includes(c)), chips.filter(c => !text.includes(c)));
check('LP11', 'built-with strip names AMD Developer Hackathon ACT III, Gemma, Next.js, Expo, worded "built" (no partner claim)', ['AMD Developer Hackathon ACT III', 'Gemma', 'Next.js', 'Expo'].every(x => text.includes(x)) && /Built (with|for)/i.test(text) && !/\bpartner(s|ed)? with\b|\bofficial partner\b/i.test(text), 'built-with strip incomplete');

// Try a role: 6 persona cards, each one link to /demo/<persona>, with the synthetic notice.
const roleSection = visible.slice(visible.search(/\sid="demo-accounts"/), visible.search(/\sid="phone-and-web"/));
const personaLinks = [...roleSection.matchAll(/href="\/demo\/([a-z-]+)"/g)].map(m => m[1]);
check('LP12', 'Try a role: one link per DEMO_PERSONAS card (/demo/<id> for all 6)', PERSONAS.every(p => personaLinks.filter(x => x === p).length === 1) && personaLinks.length === 6, personaLinks);
check('LP13', 'Try a role carries "Synthetic data only. Do not enter real patient information."', textOf(roleSection).includes('Synthetic data only. Do not enter real patient information.'), textOf(roleSection).slice(0, 300));
const personaPages = await Promise.all(PERSONAS.map(async p => [p, (await fetch(`${BASE}/demo/${p}`)).status]));
check('LP14', 'every persona page /demo/<id> -> 200', personaPages.every(([, s]) => s === 200), personaPages);

// How it works: numbered steps, the last one is the human; Try saying chips link to the patient app in en, th, it.
const sampleLinks = links.filter(([h]) => h.startsWith('/patient/?new=1&lang=') && h.includes('&sample='));
check('LP15', '"Try saying" chips link to /patient/?new=1&lang=..&sample=.. in en, th and it', ['en', 'th', 'it'].every(l => sampleLinks.some(([h]) => h.includes(`lang=${l}&`))), sampleLinks.map(([h]) => h));

// Honesty and claim boundary.
const health = await req('GET', '/api/health');
const amd = health.json?.provider === 'amd' || /amd/i.test(String(health.json?.hardware || ''));
check('LP16', 'never claims "runs on AMD" unless /api/health says AMD', amd || !/runs on AMD/i.test(text), text.match(/.{40}runs on AMD.{20}/i)?.[0]);
check('LP17', 'footer claim boundary: supports clinicians, does not diagnose, treat, prescribe or decide urgency', /does not diagnose/i.test(text) && /prescribe/i.test(text) && /urgency/i.test(text), text.slice(text.lastIndexOf('footer') - 10).slice(0, 200));
check('LP18', 'landing has no staff chrome ("Signed in as") and no /api/metrics polling', !html.includes('Signed in as') && !html.includes('/api/metrics'), 'staff chrome or metrics polling found');
check('LP19', 'no emoji or sparkle characters in the visible page', !/[\u{1F300}-\u{1FAFF}\u{2728}\u{2B50}]/u.test(text), text.match(/.{20}[\u{1F300}-\u{1FAFF}\u{2728}\u{2B50}].{20}/u)?.[0]);

// Assets referenced by the page (brand art and real UI stills) are served.
const assets = [...new Set([...html.matchAll(/\/(?:landing|brand)\/[A-Za-z0-9_.-]+\.(?:webp|png|jpg|svg)/g)].map(m => m[0]))];
const assetStatus = await Promise.all(assets.map(async a => { const r = await fetch(BASE + a); await r.arrayBuffer(); return [a, r.status, r.headers.get('content-type')]; }));
check('LP20', `every /landing and /brand image on the page -> 200 image/* (${assets.length} files)`, assets.length >= 9 && assetStatus.every(([, s, t]) => s === 200 && /^image\//.test(t || '')), assetStatus.filter(([, s, t]) => s !== 200 || !/^image\//.test(t || '')));

// Product video: Range request -> 206 (FIXED PATH /media/medx-demo.mp4) and the page plays it.
const range = await fetch(BASE + VIDEO, { headers: { Range: 'bytes=0-1023' } }); const body = await range.arrayBuffer();
if (range.status === 404 && process.env.ALLOW_NO_VIDEO === '1') skip('LP21', `${VIDEO} answers a Range request with 206`, 'video not delivered yet; ALLOW_NO_VIDEO=1');
else check('LP21', `${VIDEO} answers "Range: bytes=0-1023" with 206 video/mp4 and 1024 bytes`, range.status === 206 && /video\/mp4/.test(range.headers.get('content-type') || '') && body.byteLength === 1024 && /^bytes 0-1023\/\d+$/.test(range.headers.get('content-range') || ''), [range.status, range.headers.get('content-type'), range.headers.get('content-range'), body.byteLength]);
if (range.status === 206 || range.status === 200) {
  check('LP22', 'the video section plays the file: <video ... controls muted playsinline preload="metadata" poster>, no autoplay', new RegExp(`<video[^>]*>[\\s\\S]*?${VIDEO.replace(/\./g, '\\.')}|<video[^>]*src="${VIDEO.replace(/\./g, '\\.')}`).test(visible) && /<video[^>]*\scontrols/.test(visible) && /<video[^>]*\smuted/.test(visible) && /<video[^>]*playsInline|<video[^>]*playsinline/i.test(visible) && /<video[^>]*preload="metadata"/.test(visible) && /<video[^>]*poster=/.test(visible) && !/<video[^>]*autoplay/i.test(visible), visible.match(/<video[^>]*>/)?.[0]);
  const poster = await fetch(BASE + POSTER); await poster.arrayBuffer();
  check('LP23', `${POSTER} -> 200 image/jpeg`, poster.status === 200 && /image\/jpeg/.test(poster.headers.get('content-type') || ''), [poster.status, poster.headers.get('content-type')]);
} else skip('LP22', 'video player markup', 'no video file');

// Other entry points.
const others = await Promise.all(['/demo', '/th', '/it', '/patient/', '/patient/index.html', '/robots.txt', '/sitemap.xml', '/opengraph-image.png'].map(async p => { const r = await fetch(BASE + p); const t = await r.text(); return [p, r.status, t]; }));
for (const [p, s] of others) check('LP24', `GET ${p} -> 200`, s === 200, s);
const robots = others.find(([p]) => p === '/robots.txt')[2];
check('LP25', 'robots.txt disallows /review, /pharmacy, /ops and /api', ['/review', '/pharmacy', '/ops', '/api'].every(p => new RegExp(`^Disallow: ${p}$`, 'm').test(robots)), robots);
const demoHtml = others.find(([p]) => p === '/demo')[2];
check('LP26', '/demo is English on first paint and lists all 6 personas', /<html[^>]*\slang="en"/.test(demoHtml) && PERSONAS.every(p => demoHtml.includes(`href="/demo/${p}"`)), PERSONAS.filter(p => !demoHtml.includes(`href="/demo/${p}"`)));

// /api/health: provider and store kind.
const expectProvider = process.env.EXPECT_PROVIDER || 'mock';
const expectStore = process.env.EXPECT_STORE ? [process.env.EXPECT_STORE] : LOCAL ? ['file', 'tmp-ephemeral'] : ['postgres'];
check('LP27', `/api/health provider=${expectProvider}, store in [${expectStore.join(', ')}], storeOk`, health.status === 200 && health.json?.provider === expectProvider && expectStore.includes(health.json?.store) && health.json?.storeOk === true, health.json);
console.log(`   health: ${JSON.stringify(health.json)}`);
done();
