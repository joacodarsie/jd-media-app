/**
 * El CSS del documento de propuesta.
 *
 * Vive acá y no en Tailwind porque es un documento IMPRESO: necesita hojas A4
 * reales, márgenes simétricos y una escala tipográfica fija. Es el mismo estilo
 * que quedó aprobado armando las propuestas de RIP Cerro y de Catch a mano.
 *
 * Dos cosas que costaron y no hay que volver a romper:
 *
 *  1. La escala. Antes había 24 tamaños distintos, varios separados por 0.1pt:
 *     diferencias que no se perciben pero que borran la jerarquía y hacen que
 *     el documento "se vea raro" sin poder señalar por qué. Ahora son 7 pasos.
 *
 *  2. Las hojas. En pantalla el contenido fluye; al imprimir, cada `.hoja` es
 *     una A4 con 15mm parejos en los cuatro lados y el pie anclado abajo. Antes
 *     el margen de abajo era menor que el de arriba y el contenido desbordaba,
 *     así que `overflow:hidden` se comía el pie.
 */
export const CSS_PROPUESTA = `
:root{
  --amarillo:#FFD400;
  --b85:rgba(255,255,255,.85);
  --b70:rgba(255,255,255,.70);
  --b55:rgba(255,255,255,.55);
  --b40:rgba(255,255,255,.40);
  --borde:rgba(255,255,255,.12);

  --t-eti:8.5pt;   /* rótulos en versalita */
  --t-min:9.5pt;   /* letra chica */
  --t-apo:10pt;    /* texto de apoyo */
  --t-cuerpo:11pt; /* cuerpo */
  --t-dest:12.5pt; /* subtítulo y destacados */
  --t-sec:17pt;    /* títulos de sección */
  --t-tit:44pt;    /* título */
}

.doc *{ box-sizing:border-box; }
.doc{
  font-size:var(--t-cuerpo); line-height:1.55; letter-spacing:-.004em; color:#fff;
}
.doc h1,.doc h2,.doc h3,.doc h4{ margin:0; }
.doc p{ margin:0; }
.doc b,.doc strong{ font-weight:700; }
.doc ul{ margin:0; padding:0; list-style:none; }

.hoja{ padding:26px 22px 34px; }
.hoja + .hoja{ border-top:1px solid var(--borde); }
.empuja{ display:none; }

/* ── Encabezado corrido ───────────────────────────────────── */
.top{ display:flex; align-items:center; justify-content:space-between; gap:20px; }
.top .marca{ display:flex; align-items:center; gap:9px; }
.jd{
  display:grid; place-items:center; width:24px; height:24px; border-radius:7px;
  background:var(--amarillo); color:#000; font-weight:900; font-size:9pt; letter-spacing:-.03em;
}
.nom{ font-size:var(--t-eti); font-weight:600; text-transform:uppercase; letter-spacing:.19em; color:var(--b70); }
.top .fecha{ font-size:var(--t-eti); text-transform:uppercase; letter-spacing:.13em; color:var(--b40); text-align:right; }

/* ── Portada ──────────────────────────────────────────────── */
.eyebrow{ margin-top:30px; font-size:var(--t-eti); font-weight:700; text-transform:uppercase; letter-spacing:.19em; color:var(--amarillo); }
.doc h1{ margin-top:9px; font-size:var(--t-tit); font-weight:900; line-height:1; letter-spacing:-.035em; }
.subtitulo{ margin-top:13px; font-size:var(--t-dest); font-weight:600; line-height:1.35; letter-spacing:-.015em; color:var(--b85); }
.lead{ margin-top:16px; max-width:16.2cm; font-size:var(--t-cuerpo); line-height:1.65; color:var(--b70); }
.lead b{ color:#fff; }

/* ── Secciones ────────────────────────────────────────────── */
.linea{ margin-top:26px; height:1px; background:linear-gradient(to right, rgba(255,212,0,.6), transparent); }
.doc section{ margin-top:28px; }
.cab{ display:flex; align-items:baseline; gap:12px; margin-bottom:16px; }
.cab .n{ font-size:var(--t-eti); font-weight:900; letter-spacing:.16em; color:var(--amarillo); }
.cab h2{ font-size:var(--t-sec); font-weight:700; letter-spacing:-.022em; }
.cab .aside{ margin-left:auto; font-size:var(--t-eti); text-transform:uppercase; letter-spacing:.13em; color:var(--b40); }

/* ── Pasos numerados ──────────────────────────────────────── */
.pasos{ display:grid; grid-template-columns:1fr 1fr; gap:17px 26px; }
.paso{ display:flex; gap:11px; }
.paso .i{
  flex:0 0 auto; display:grid; place-items:center; width:20px; height:20px; margin-top:1px;
  border-radius:50%; background:var(--amarillo); color:#000; font-size:9pt; font-weight:900;
}
.paso h4{ font-size:var(--t-cuerpo); font-weight:700; }
.paso p{ margin-top:4px; font-size:var(--t-apo); line-height:1.55; color:var(--b55); }

/* ── Grupos de incluidos ──────────────────────────────────── */
.grupos{ display:grid; grid-template-columns:1fr 1fr; gap:16px 26px; }
.grupo h4{ display:flex; gap:7px; font-size:var(--t-cuerpo); font-weight:700; }
.grupo h4 span{ color:var(--amarillo); }
.grupo p{ margin-top:5px; font-size:var(--t-apo); line-height:1.6; color:var(--b55); }

.doc ul.vinetas li{ position:relative; padding-left:17px; margin-bottom:8px; line-height:1.55; color:var(--b85); }
.doc ul.vinetas li:last-child{ margin-bottom:0; }
.doc ul.vinetas li::before{ content:"✦"; position:absolute; left:0; top:0; color:var(--amarillo); font-size:9pt; }
.doc ul.vinetas li b{ color:#fff; }

/* ── Tarjetas de cuenta ───────────────────────────────────── */
.cuentas{ display:grid; gap:15px; }
.cuentas.de2{ grid-template-columns:1fr 1fr; }
.cuentas.de3{ grid-template-columns:1fr 1fr 1fr; }
.cuenta{ border:1px solid var(--borde); border-radius:15px; padding:19px 21px; }
.cuenta.fuerte{ border-color:rgba(255,212,0,.4); background:rgba(255,212,0,.06); }
.cuenta .handle{ font-size:var(--t-dest); font-weight:900; letter-spacing:-.02em; word-break:break-word; }
.cuenta .rol{ margin-top:3px; font-size:var(--t-eti); font-weight:700; text-transform:uppercase; letter-spacing:.13em; color:var(--amarillo); }
.cuenta .precio{ margin-top:14px; font-size:23pt; font-weight:900; letter-spacing:-.03em; line-height:1; }
.cuenta .precio small{ font-size:var(--t-min); font-weight:500; color:var(--b40); margin-left:5px; letter-spacing:0; }
.cuenta .vol{ margin-top:14px; padding-top:13px; border-top:1px solid var(--borde); font-size:var(--t-apo); font-weight:700; color:var(--amarillo); }
.cuenta .desc{ margin-top:9px; font-size:var(--t-apo); line-height:1.55; color:var(--b55); }

/* ── Entrega del primer mes ───────────────────────────────── */
.etapas{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.etapa{ border:1px solid var(--borde); border-radius:13px; padding:16px 18px; }
.etapa.marcada{ border-color:rgba(255,212,0,.4); background:rgba(255,212,0,.05); }
.etapa .w{ font-size:var(--t-eti); font-weight:700; text-transform:uppercase; letter-spacing:.14em; color:var(--amarillo); }
.etapa h4{ margin-top:5px; font-size:var(--t-cuerpo); font-weight:700; }
.etapa ul{ margin-top:11px; }
.etapa ul li{ position:relative; font-size:var(--t-apo); margin-bottom:6px; padding-left:14px; line-height:1.5; color:var(--b55); }
.etapa ul li b{ color:var(--b85); }
.etapa ul li::before{ content:"·"; position:absolute; left:0; top:-5px; font-size:14pt; color:var(--amarillo); }

.aviso{
  margin-top:15px; border-left:2px solid var(--amarillo); background:rgba(255,212,0,.06);
  border-radius:0 10px 10px 0; padding:14px 17px; font-size:var(--t-apo); line-height:1.6; color:var(--b85);
}
.aviso b{ color:var(--amarillo); }

/* ── Inversión ────────────────────────────────────────────── */
.tabla{ border:1px solid var(--borde); border-radius:15px; overflow:hidden; }
.fila{ display:flex; align-items:center; justify-content:space-between; gap:20px; padding:15px 21px; border-bottom:1px solid var(--borde); }
.fila .q .t{ font-size:var(--t-cuerpo); font-weight:700; }
.fila .q .s{ margin-top:3px; font-size:var(--t-apo); color:var(--b55); }
.fila .m{ font-size:14pt; font-weight:700; letter-spacing:-.02em; white-space:nowrap; }
.fila.sub{ background:rgba(255,255,255,.03); }
.fila.sub .q .t{ font-weight:600; color:var(--b70); font-size:var(--t-apo); }
.fila.sub .m{ font-size:12pt; font-weight:600; color:var(--b70); }
.fila.rebaja .q .t{ color:var(--amarillo); }
.fila.rebaja .m{ color:var(--amarillo); }
.fila.total{
  border-bottom:none; background:rgba(255,212,0,.12); padding:21px;
  border-top:1px solid var(--amarillo);
}
.fila.total .q .t{ font-size:var(--t-eti); font-weight:700; text-transform:uppercase; letter-spacing:.16em; color:var(--amarillo); }
.fila.total .q .s{ margin-top:5px; font-size:var(--t-apo); color:var(--b70); }
.fila.total .m{ font-size:28pt; font-weight:900; letter-spacing:-.03em; }
.tachado{ font-size:var(--t-apo); font-weight:500; color:var(--b40); text-decoration:line-through; margin-right:11px; }

.arranque{
  margin-top:13px; border:1px solid var(--amarillo); border-radius:15px;
  background:rgba(255,212,0,.12); padding:17px 21px;
  display:flex; align-items:center; justify-content:space-between; gap:22px;
}
.arranque .k{ font-size:var(--t-eti); font-weight:700; text-transform:uppercase; letter-spacing:.16em; color:var(--amarillo); }
.arranque .v{ margin-top:5px; font-size:22pt; font-weight:900; letter-spacing:-.03em; line-height:1; }
.arranque .d{ max-width:9.8cm; text-align:right; font-size:var(--t-apo); line-height:1.6; color:var(--b70); }
.arranque .d b{ color:#fff; }

.claras{ margin-top:16px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; font-size:var(--t-apo); line-height:1.6; color:var(--b55); }
.claras b{ color:var(--amarillo); font-weight:700; }

.nota{ margin-top:15px; font-size:var(--t-min); line-height:1.6; color:var(--b40); }
.nota b{ color:var(--b70); }
.nota a{ color:var(--b55); }

/* ── Cierre ───────────────────────────────────────────────── */
.cierre{
  margin-top:26px; border:1px solid rgba(255,212,0,.3); border-radius:17px;
  padding:24px 26px; text-align:center; background:rgba(255,212,0,.05);
}
.cierre h2{ font-size:19pt; font-weight:900; letter-spacing:-.025em; }
.cierre p{ margin:11px auto 0; max-width:13.6cm; font-size:var(--t-cuerpo); line-height:1.62; color:var(--b70); }
.cierre p b{ color:var(--amarillo); }
.cierre .datos{ margin-top:15px; font-size:var(--t-apo); font-weight:700; color:var(--amarillo); }

/* ── Pie: la marca ya está arriba, acá va la referencia ────── */
.pie{
  margin-top:22px; padding-top:13px; border-top:1px solid var(--borde);
  display:flex; align-items:center; justify-content:space-between; gap:20px;
  font-size:var(--t-eti); text-transform:uppercase; letter-spacing:.12em; color:var(--b40);
}

/* ── En el celular, las rejillas de dos y tres se apilan ───── */
@media (max-width: 640px){
  :root{ --t-tit:34pt; --t-sec:15pt; }
  .pasos, .grupos, .etapas, .claras, .cuentas.de2, .cuentas.de3{ grid-template-columns:1fr; }
  .fila, .arranque{ flex-direction:column; align-items:flex-start; gap:10px; }
  .arranque .d, .top .fecha{ text-align:left; max-width:none; }
  .fila.total .m{ font-size:24pt; }
}

/* ── Impresión: hojas A4 de verdad ────────────────────────── */
@media print{
  @page{ size:A4; margin:0; }
  .no-print{ display:none !important; }
  *{ -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  :root{ --t-tit:44pt; --t-sec:17pt; }
  .hoja{
    padding:15mm; min-height:297mm;
    display:flex; flex-direction:column; border-top:none;
  }
  .hoja + .hoja{ break-before:page; }
  .empuja{ display:block; margin-top:auto; }
  .doc section, .paso, .grupo, .cuenta, .etapa, .tabla, .cierre, .pie, .arranque{ break-inside:avoid; }
  .cab{ break-after:avoid; }
  .pasos, .grupos, .etapas, .claras{ grid-template-columns:1fr 1fr; }
  .claras{ grid-template-columns:1fr 1fr 1fr; }
}
`;
