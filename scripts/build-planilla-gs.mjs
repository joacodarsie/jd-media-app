// Mete el cuerpo del script de la planilla personal del dueño dentro de un
// módulo TS, para que la app lo sirva en /api/finanzas/planilla/script.
//
//   node scripts/build-planilla-gs.mjs
//
// El test `planilla-gs.test.ts` falla si alguien toca el .gs y se olvida de
// correr esto.
import fs from "node:fs";

const cuerpo = fs.readFileSync("scripts/planilla-cuerpo.gs", "utf8");
const ts = `// ARCHIVO GENERADO — no editar a mano.
// Sale de scripts/planilla-cuerpo.gs vía scripts/build-planilla-gs.mjs.
// El test planilla-gs.test.ts falla si los dos se desincronizan.

/** El código de la planilla "Finanzas de Joaquín", tal cual lo ejecuta su cargador. */
export const PLANILLA_GS = ${JSON.stringify(cuerpo)};
`;
fs.writeFileSync("src/lib/finanzas/planilla-gs.ts", ts);
console.log("planilla-gs.ts generado:", (ts.length / 1024).toFixed(1), "KB");
