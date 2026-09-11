// Consulta rápida a PostgREST de prod. Uso: node scripts/q.mjs "users?select=nombre,area&limit=5"
import fs from "node:fs";
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const res = await fetch(`${url}/rest/v1/${process.argv[2]}`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const body = await res.text();
console.log(res.status, body.slice(0, 12000));
