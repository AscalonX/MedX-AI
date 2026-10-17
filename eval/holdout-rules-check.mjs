import { readFileSync, readdirSync } from "node:fs";
const R = process.argv[2], file = process.argv[3];
const rules = JSON.parse(readFileSync(file, "utf8"));
const norm = (t) => " " + t.normalize("NFC").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
const PUNCT = [",", ".", ";", ":", "!", "?", "\n"], WORDS = [" but ", " ma ", " però ", " pero ", "แต่"];
function clause(b){let c=0;for(const p of PUNCT)c=Math.max(c,b.lastIndexOf(p)+1);for(const w of WORDS){const i=b.lastIndexOf(w);if(i!==-1)c=Math.max(c,i+w.length-(w.endsWith(" ")?1:0));}return b.slice(c);}
function hit(text, term){term=norm(term).slice(1);for(let i=text.indexOf(term);i!==-1;i=text.indexOf(term,i+1)){const b=clause(text.slice(Math.max(0,i-rules.negationWindowChars),i));if(!rules.negationCues.some(c=>b.includes(c)))return true;}return false;}
let tp=0,fn=0,fp=0,tn=0;
for (const f of readdirSync(R).filter(f=>f.startsWith("HO-"))) {
  const c = JSON.parse(readFileSync(R+"/"+f,"utf8"));
  const text = norm(c.turns.map(t=>t.text).join(" \n "));
  const fired = rules.rules.filter(r=>r.match.every(g=>g.some(t=>hit(text,t)))).map(r=>r.id);
  const pos = fired.length>0;
  if (c.gold.escalate && pos) tp++; else if (c.gold.escalate) fn++; else if (pos) fp++; else tn++;
  console.log(c.id, c.lang, "gold:", c.gold.escalate?c.gold.category:"none", "| fired:", fired.join(",")||"-", c.gold.escalate!==pos?"  <-- MISMATCH":"");
}
console.log(`recall ${tp}/${tp+fn}  false-alarm ${fp}/${fp+tn}`);
