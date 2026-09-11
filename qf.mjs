import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")).trim(),l.slice(l.indexOf("=")+1).trim()]));
const k=env.SUPABASE_SERVICE_ROLE_KEY;
const r=await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${process.argv[2]}`,{headers:{apikey:k,Authorization:`Bearer ${k}`}});
fs.writeFileSync(process.argv[3], await r.text());
console.log(r.status,"→",process.argv[3]);
