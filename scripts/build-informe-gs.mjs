// Mete el cuerpo del script de Google Sheets dentro de un módulo TS, para que
// la app lo pueda servir. El .gs es la fuente; este archivo solo lo empaqueta.
//
//   node scripts/build-informe-gs.mjs
//
// El test `informe-gs.test.ts` falla si alguien toca el .gs y se olvida de
// correr esto, así que los dos no pueden quedar desincronizados en silencio.
import fs from "node:fs";

const cuerpo = fs.readFileSync("scripts/informe-cuerpo.gs", "utf8");
const ts = `// ARCHIVO GENERADO — no editar a mano.
// Sale de scripts/informe-cuerpo.gs vía scripts/build-informe-gs.mjs.
// El test informe-gs.test.ts falla si los dos se desincronizan.

/** El código que arma la planilla, tal cual lo ejecuta el Apps Script del dueño. */
export const INFORME_GS = ${JSON.stringify(cuerpo)};
`;
fs.writeFileSync("src/lib/finanzas/informe-gs.ts", ts);
console.log("informe-gs.ts generado:", (ts.length / 1024).toFixed(1), "KB");
