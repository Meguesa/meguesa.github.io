/* ===== Helpers ===== */
const IVA_RATE = 0.16;     // fijo
const DIAS_PERIODO = 30;   // fijo

const fmtMXN = (n) => new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(n || 0);
const fmtPct = (n) => `${(n || 0).toFixed(2)}%`;

function round2(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }

function parseDateLocal(iso){
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function toDateSafe(v){
  if (v instanceof Date) return new Date(v.getTime());
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return parseDateLocal(v);
  return new Date(v);
}

function addMonths(date, months){
  const d = toDateSafe(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  d.setHours(12,0,0,0);
  return d;
}

function formatDateISO(d){
  const dd = toDateSafe(d);
  const y = dd.getFullYear();
  const m = String(dd.getMonth()+1).padStart(2,'0');
  const day = String(dd.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function formatDateHuman(d){
  const dd = toDateSafe(d);
  return dd.toLocaleDateString('es-MX', { year:'numeric', month:'short', day:'2-digit' });
}

// PMT (pago por periodo) sobre monto sin IVA
function pmt(rate, nper, pv){
  if (nper <= 0) return 0;
  if (rate === 0) return pv / nper;
  return (pv * rate) / (1 - Math.pow(1 + rate, -nper));
}

/* ===== UI refs ===== */
const $ = (id) => document.getElementById(id);

const ui = {
  // Sección 1
  cliente: $('cliente'),
  producto: $('producto'),
  total: $('total'),
  enganchePct: $('enganchePct'),
  engancheMonto: $('engancheMonto'),
  tasaAnual: $('tasaAnual'),
  meses: $('meses'),
  primerPago: $('primerPago'),
  ivaPct: $('ivaPct'),
  ivaModo: $('ivaModo'),
  diasPeriodo: $('diasPeriodo'),
  btnCalcular: $('btnCalcular'),
  btnLimpiar: $('btnLimpiar'),
  btnPDF: $('btnPDF'),
  btnCompartir: $('btnCompartir'),
  btnImprimir: $('btnImprimir'),

  tablaBody: document.querySelector('#tabla tbody'),

  // Sección 2
  abonoEfecto: $('abonoEfecto'),
  btnLimpiarAbono: $('btnLimpiarAbono'),

  // Resumen
  resSubtotal: $('resSubtotal'),
  resIva: $('resIva'),
  resEnganche: $('resEnganche'),
  resFinanciar: $('resFinanciar'),
  resMensualidad: $('resMensualidad'),
  resTotalFin: $('resTotalFin'),

  // Acordeón sección 2
  togglePagos: $('togglePagos'),
  panelPagos: $('panelPagos'),

  // Sección 2 (Abono a capital)
  abonoPago: $('abonoPago'),
  abonoExtra: $('abonoExtra'),
  btnSimularAbono: $('btnSimularAbono'),
};

let lastResult = null;     // lo que se está mostrando
let baseResult = null;     // corrida base (sin abono) para simular sobre ella

/* ===== Defaults ===== */
(function init(){
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
  d.setDate(d.getDate() + 30);

  if (ui.primerPago) ui.primerPago.value = formatDateISO(d);

  // Forzar constantes visibles
  if (ui.ivaPct) ui.ivaPct.value = String(IVA_RATE * 100);
  if (ui.diasPeriodo) ui.diasPeriodo.value = String(DIAS_PERIODO);

  if (ui.btnCalcular) ui.btnCalcular.addEventListener('click', (e) => { e.preventDefault(); calcular(); });
  if (ui.btnLimpiar) ui.btnLimpiar.addEventListener('click', (e) => { e.preventDefault(); limpiar(); });
  if (ui.btnPDF) ui.btnPDF.addEventListener('click', (e) => { e.preventDefault(); generarPDF(); });
  if (ui.btnCompartir) ui.btnCompartir.addEventListener('click', (e) => { e.preventDefault(); compartirCotizacion(); });
  if (ui.btnImprimir) ui.btnImprimir.addEventListener('click', (e) => { e.preventDefault(); abrirModoImpresion(); });
  
  if (ui.btnSimularAbono) ui.btnSimularAbono.addEventListener('click', (e) => { e.preventDefault(); simularAbonoCapital(); });
  if (ui.btnLimpiarAbono) ui.btnLimpiarAbono.addEventListener('click', (e) => { e.preventDefault(); limpiarAbono(); });

  // Acordeón: forzar cerrado al iniciar
  if (ui.togglePagos && ui.panelPagos){
    ui.togglePagos.setAttribute('aria-expanded', 'false');
    ui.panelPagos.hidden = true;

    ui.togglePagos.addEventListener('click', () => {
      const isOpen = ui.togglePagos.getAttribute('aria-expanded') === 'true';
      ui.togglePagos.setAttribute('aria-expanded', String(!isOpen));
      ui.panelPagos.hidden = isOpen;
    });
  }
})();

/* ===== Core (Sección 1) ===== */
function getInputs(){
  const total = Number(ui.total?.value || 0);
  const engPct = Number(ui.enganchePct?.value || 0) / 100;
  const engMonto = Number(ui.engancheMonto?.value || 0);
  const tasaAnual = Number(ui.tasaAnual?.value || 0) / 100;
  const meses = parseInt(ui.meses?.value || '0', 10);
  const primerPago = ui.primerPago?.value ? parseDateLocal(ui.primerPago.value) : new Date();
  const ivaModo = ui.ivaModo?.value || 'total';
  const cliente = (ui.cliente?.value || '').trim();
  const producto = (ui.producto?.value || '').trim();

  return {
    cliente,
    producto,
    total,
    engPct,
    engMonto,
    tasaAnual,
    meses,
    primerPago,
    ivaRate: IVA_RATE,
    ivaModo,
    diasPeriodo: DIAS_PERIODO
  };
}

function validar(inp){
  const errs = [];
  if (!(inp.total > 0)) errs.push('Captura un monto total mayor a 0.');
  if (!(inp.meses > 0)) errs.push('Captura meses (mayor a 0).');
  if (inp.tasaAnual < 0) errs.push('Tasa anual inválida.');
  if (inp.engMonto < 0) errs.push('Enganche inválido.');
  if (inp.engPct < 0) errs.push('% enganche inválido.');
  return errs;
}

function buildScheduleBase({ pvSub, rate, meses, primerPago, ivaRate, ivaModo, pagoSub }){
  let saldo = pvSub;
  const rows = [];
  let totalPagos = 0;

  for (let k = 1; k <= meses; k++){
    const fecha = addMonths(primerPago, k - 1);

    let interes = round2(saldo * rate);
    let capital = round2(pagoSub - interes);

    let saldoFinal = round2(saldo - capital);

    if (k === meses){
      capital = round2(capital + saldoFinal);
      saldoFinal = 0;
    }

    const baseIVA = (ivaModo === 'interes') ? interes : (capital + interes);
    const ivaPago = round2(baseIVA * ivaRate);
    const pagoTotal = round2(capital + interes + ivaPago);

    rows.push({ n:k, fecha, saldoInicial:saldo, capital, interes, iva:ivaPago, pago:pagoTotal, saldoFinal });

    totalPagos = round2(totalPagos + pagoTotal);
    saldo = saldoFinal;
  }

  return { rows, totalPagos };
}

function calcular(){
  const inp = getInputs();
  const errs = validar(inp);
  if (errs.length){ alert(errs.join('\n')); return; }

  let engancheIncl = inp.engMonto > 0 ? inp.engMonto : inp.total * inp.engPct;
  engancheIncl = Math.min(engancheIncl, inp.total);
  engancheIncl = round2(engancheIncl);

  const enganchePctReal = inp.total > 0 ? (engancheIncl / inp.total) : 0;
  if (ui.enganchePct) ui.enganchePct.value = (enganchePctReal * 100).toFixed(2);

  const subtotalTotal = round2(inp.total / (1 + inp.ivaRate));
  const ivaTotal = round2(inp.total - subtotalTotal);

  const financiarIncl = round2(inp.total - engancheIncl);
  const financiarSub = round2(financiarIncl / (1 + inp.ivaRate));

  const rate = (inp.tasaAnual / 360) * inp.diasPeriodo;

  let pagoSub = pmt(rate, inp.meses, financiarSub);
  pagoSub = round2(pagoSub);

  const { rows, totalPagos } = buildScheduleBase({
    pvSub: financiarSub,
    rate,
    meses: inp.meses,
    primerPago: inp.primerPago,
    ivaRate: inp.ivaRate,
    ivaModo: inp.ivaModo,
    pagoSub
  });

  const mensualidad = rows.length ? rows[0].pago : 0;

  lastResult = {
    mode: 'nueva',
    ...inp,
    mesesOriginal: inp.meses,

    engancheIncl,
    enganchePctReal,
    subtotalTotal,
    ivaTotal,
    financiarIncl,
    financiarSub,
    rate,
    pagoSub,
    mensualidad,
    totalPagos,
    rows
  };

  // Guardamos la corrida base para simulaciones de abono
  baseResult = lastResult;

  render(lastResult);
}

/* ===== Sección 2: Abono a capital (simulación) ===== */
function simularAbonoCapital(){
  if (!baseResult){
    alert('Primero calcula una corrida en la sección "Datos".');
    return;
  }

  const pagoN = parseInt(ui.abonoPago?.value || '0', 10);
  const extraTotal = Number(ui.abonoExtra?.value || 0);
  const efecto = ui.abonoEfecto?.value || 'acortar'; // acortar | recalcular

  const mesesBase = baseResult.mesesOriginal || baseResult.meses;

  const errs = [];
  if (!(pagoN >= 1 && pagoN <= mesesBase)) errs.push(`El número de pago debe estar entre 1 y ${mesesBase}.`);
  if (!(extraTotal > 0)) errs.push('Captura un abono adicional mayor a 0.');
  if (errs.length){ alert(errs.join('\n')); return; }

  // Extra capturado como “lo que paga el cliente (con IVA)”
  // - Si IVA es “total”, el extra incluye IVA -> lo convertimos a base sin IVA para capital
  // - Si IVA es “interes”, el extra se considera capital (sin IVA)
  const extraCapitalSub = (baseResult.ivaModo === 'total')
    ? round2(extraTotal / (1 + baseResult.ivaRate))
    : round2(extraTotal);

  const rate = baseResult.rate;
  const pagoSubBase = baseResult.pagoSub;

  let saldo = baseResult.financiarSub;
  const rows = [];
  let totalPagos = 0;

  // Helper: calcula una fila y regresa saldoFinal
  function pushRow(n, pagoSub, extraCapSub, forceClose){
    const fecha = addMonths(baseResult.primerPago, n - 1);

    let interes = round2(saldo * rate);
    let capital = round2(pagoSub - interes + (extraCapSub || 0));

    if (capital >= saldo) capital = round2(saldo);

    let saldoFinal = round2(saldo - capital);

    // si es el último periodo planificado, cerramos por redondeo
    if (forceClose && saldoFinal !== 0){
      capital = round2(capital + saldoFinal);
      saldoFinal = 0;
    }

    const baseIVA = (baseResult.ivaModo === 'interes') ? interes : (capital + interes);
    const ivaPago = round2(baseIVA * baseResult.ivaRate);
    const pagoTotal = round2(capital + interes + ivaPago);

    rows.push({
      n,
      fecha,
      saldoInicial: saldo,
      capital,
      interes,
      iva: ivaPago,
      pago: pagoTotal,
      saldoFinal,
      abonoExtraTotal: (n === pagoN) ? extraTotal : 0
    });

    totalPagos = round2(totalPagos + pagoTotal);
    saldo = saldoFinal;
  }

  // 1) Construimos del pago 1 al pagoN (aplicando abono en pagoN)
  for (let n = 1; n <= pagoN; n++){
    const extraThis = (n === pagoN) ? extraCapitalSub : 0;
    // si pagoN también es el último del plazo original, cerramos
    const forceClose = (n === mesesBase);
    pushRow(n, pagoSubBase, extraThis, forceClose);

    if (saldo <= 0) break; // liquidación anticipada
  }

  // Si se liquidó, ya terminamos
  if (saldo <= 0){
    lastResult = {
      ...baseResult,
      mode: 'abono',
      abonoEfecto: efecto,
      meses: rows.length,
      rows,
      totalPagos,
      mensualidad: baseResult.mensualidad,
      abonoPagoN: pagoN,
      abonoExtra: extraTotal
    };
    render(lastResult);
    return;
  }

  // 2) Continuación según efecto
  if (efecto === 'acortar'){
    // Mantener mensualidad y acortar plazo:
    for (let n = pagoN + 1; n <= mesesBase; n++){
      const forceClose = (n === mesesBase);
      pushRow(n, pagoSubBase, 0, forceClose);
      if (saldo <= 0) break;
    }

    lastResult = {
      ...baseResult,
      mode: 'abono',
      abonoEfecto: efecto,
      meses: rows.length,          // plazo resultante
      rows,
      totalPagos,
      mensualidad: baseResult.mensualidad,
      abonoPagoN: pagoN,
      abonoExtra: extraTotal
    };
    render(lastResult);
    return;
  }

  // Mantener plazo y recalcular mensualidad:
  const remainingPeriods = mesesBase - pagoN;
  if (remainingPeriods <= 0){
    lastResult = {
      ...baseResult,
      mode: 'abono',
      abonoEfecto: efecto,
      meses: rows.length,
      rows,
      totalPagos,
      mensualidad: baseResult.mensualidad,
      abonoPagoN: pagoN,
      abonoExtra: extraTotal
    };
    render(lastResult);
    return;
  }

  // Nuevo pagoSub (sin IVA) desde el siguiente periodo
  let pagoSubNuevo = pmt(rate, remainingPeriods, saldo);
  pagoSubNuevo = round2(pagoSubNuevo);

  for (let j = 1; j <= remainingPeriods; j++){
    const n = pagoN + j;
    const forceClose = (n === mesesBase);
    pushRow(n, pagoSubNuevo, 0, forceClose);
    if (saldo <= 0) break;
  }

  // Mensualidad a mostrar: el pago del siguiente periodo (si existe)
  const idxNext = pagoN; // index 0-based del pagoN+1
  const mensualidadNueva = rows[idxNext] ? rows[idxNext].pago : baseResult.mensualidad;

  lastResult = {
    ...baseResult,
    mode: 'abono',
    abonoEfecto: efecto,
    meses: rows.length,          // si liquidó antes, se acorta
    rows,
    totalPagos,
    pagoSubNuevo,
    mensualidad: mensualidadNueva,
    mensualidadAnterior: baseResult.mensualidad,
    abonoPagoN: pagoN,
    abonoExtra: extraTotal
  };

  render(lastResult);

  // Si el acordeón estaba cerrado, lo abrimos para que vean qué corrieron
  if (ui.togglePagos && ui.panelPagos){
    ui.togglePagos.setAttribute('aria-expanded', 'true');
    ui.panelPagos.hidden = false;
  }
}

function limpiarAbono(){
  if (ui.abonoPago) ui.abonoPago.value = '';
  if (ui.abonoExtra) ui.abonoExtra.value = '';
  if (ui.abonoEfecto) ui.abonoEfecto.value = 'acortar';

  // No borramos la corrida base; solo quitamos la simulación y regresamos a la base
  if (baseResult){
    lastResult = baseResult;
    render(lastResult);
  } else {
    // Si nunca calcularon la base, solo deshabilita PDF y limpia tabla/resumen
    ui.tablaBody.innerHTML = '';
    ui.btnPDF.disabled = true;

    ui.resSubtotal.textContent = '—';
    ui.resIva.textContent = '—';
    ui.resEnganche.textContent = '—';
    ui.resFinanciar.textContent = '—';
    ui.resMensualidad.textContent = '—';
    ui.resTotalFin.textContent = '—';

    lastResult = null;
  }
}

/* ===== Render ===== */
function render(res){
  ui.resSubtotal.textContent = fmtMXN(res.subtotalTotal);
  ui.resIva.textContent = fmtMXN(res.ivaTotal);

  if (res.mode === 'abono'){
    const efectoTxt = (res.abonoEfecto === 'recalcular')
      ? `Mantener plazo · Nueva mensualidad: ${fmtMXN(res.mensualidad)}`
      : `Mantener mensualidad · Plazo resultante: ${res.meses} meses`;
  
    ui.resEnganche.textContent = 
      `Abono en pago #${res.abonoPagoN}: +${fmtMXN(res.abonoExtra)} · Plazo resultante: ${res.meses} meses`;
  } else {
    ui.resEnganche.textContent = `${fmtMXN(res.engancheIncl)} (${fmtPct(res.enganchePctReal*100)})`;
  }

  ui.resFinanciar.textContent = fmtMXN(res.financiarIncl);
  ui.resMensualidad.textContent = fmtMXN(res.mensualidad);
  ui.resTotalFin.textContent = fmtMXN(res.totalPagos);

  ui.tablaBody.innerHTML = '';
  for (const r of res.rows){
    const tr = document.createElement('tr');

    // Si quieres resaltar el pago donde hubo abono, puedes aplicar estilo aquí:
    // if (r.abonoExtraTotal > 0) tr.classList.add('row-abono');

    tr.innerHTML = `
      <td>${r.n}</td>
      <td>${formatDateHuman(r.fecha)}</td>
      <td>${fmtMXN(r.saldoInicial)}</td>
      <td>${fmtMXN(r.capital)}</td>
      <td>${fmtMXN(r.interes)}</td>
      <td>${fmtMXN(r.iva)}</td>
      <td><strong>${fmtMXN(r.pago)}</strong></td>
      <td>${fmtMXN(r.saldoFinal)}</td>
    `;
    ui.tablaBody.appendChild(tr);
  }

  ui.btnPDF.disabled = false;
  if (ui.btnCompartir) ui.btnCompartir.disabled = false;
  if (ui.btnImprimir) ui.btnImprimir.disabled = false;
}

/* ===== Limpiar ===== */
function limpiar(){
  // Sección 1
  ui.cliente.value = '';
  if (ui.producto) ui.producto.value = '';
  ui.total.value = '';
  ui.enganchePct.value = '';
  ui.engancheMonto.value = '';
  ui.tasaAnual.value = '';
  ui.meses.value = '';
  ui.ivaPct.value = String(IVA_RATE * 100);
  ui.ivaModo.value = 'total';
  ui.diasPeriodo.value = String(DIAS_PERIODO);

  // Sección 2
  if (ui.abonoPago) ui.abonoPago.value = '';
  if (ui.abonoExtra) ui.abonoExtra.value = '';
  if (ui.abonoEfecto) ui.abonoEfecto.value = 'acortar';

  ui.tablaBody.innerHTML = '';
  ui.btnPDF.disabled = true;
  if (ui.btnCompartir) ui.btnCompartir.disabled = true;
  if (ui.btnImprimir) ui.btnImprimir.disabled = true;

  ui.resSubtotal.textContent = '—';
  ui.resIva.textContent = '—';
  ui.resEnganche.textContent = '—';
  ui.resFinanciar.textContent = '—';
  ui.resMensualidad.textContent = '—';
  ui.resTotalFin.textContent = '—';

  lastResult = null;
  baseResult = null;
}

/* ===== PDF ===== */
async function loadImageAsDataURL(url){
  const resp = await fetch(url, { cache: 'no-cache' });
  if (!resp.ok) throw new Error('No se pudo cargar el logo');
  const blob = await resp.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function generarPDF(opts = {}){
  // opts:
  // - openPreview: true/false (default true)
  // - returnBlob: true/false (default false)
  // - onePage: true/false (default false) -> comprime tabla para que quepa mejor
  const {
    openPreview = true,
    returnBlob = false,
    onePage = false
  } = opts;

  if (!lastResult) return null;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'letter' });

  // Logo (arriba derecha)
  let logoDataUrl = null;
  try{ logoDataUrl = await loadImageAsDataURL('/assets/logo.jpg'); }catch(e){ logoDataUrl = null; }

  const pageWidth = doc.internal.pageSize.getWidth();
  if (logoDataUrl){
    const logoW = 200;
    const logoH = 132;
    const x = pageWidth - 40 - logoW;
    const yLogo = 28;
    doc.addImage(logoDataUrl, 'JPEG', x, yLogo, logoW, logoH);
  }

  const company = 'Jardines de Juan Pablo';
  const titulo = 'VENTA CON FINANCIAMIENTO';
  const subtitulo = (lastResult.mode === 'abono') ? 'Simulación de Abono a Capital' : '';
  const cliente = lastResult.cliente || '—';
  const producto = lastResult.producto || '—';

  const left = 40;
  let y = 48;

  doc.setFont('helvetica','bold');
  doc.setFontSize(14);
  doc.text(company, left, y);

  doc.setFontSize(12);
  doc.text(titulo, left, y + 18);

  if (subtitulo){
    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.text(subtitulo, left, y + 32);
  }

  doc.setFont('helvetica','normal');
  doc.setFontSize(10);

  y += (subtitulo ? 56 : 42);

  const ivaModoTxt = (lastResult.ivaModo === 'interes')
    ? 'IVA sobre interés'
    : 'IVA sobre (capital + interés)';

  const labelX = left;
  const valueX = left + 150;
  const lineH = 14;

  const items = [
    { label: 'Producto:', value: producto },
    { label: 'Cliente:', value: cliente },
    { label: 'Monto a financiar (con IVA):', value: fmtMXN(lastResult.financiarIncl) },
    { label: 'Monto a financiar (sin IVA):', value: fmtMXN(lastResult.financiarSub) },
    { label: 'Tasa anual:', value: `${fmtPct(lastResult.tasaAnual * 100)} · Días/periodo: ${DIAS_PERIODO} (base 360)` },
    { label: 'Meses:', value: `${lastResult.meses} · Primer pago: ${formatDateHuman(lastResult.primerPago)}` },
    { label: 'IVA:', value: `${fmtPct(lastResult.ivaRate * 100)} · Modo: ${ivaModoTxt}` },
    { label: 'Mensualidad aprox.:', value: fmtMXN(lastResult.mensualidad) },
    { label: 'Total (suma de pagos):', value: fmtMXN(lastResult.totalPagos) }
  ];

  if (lastResult.mode === 'abono'){
    items.splice(2, 0, {
      label: 'Abono:',
      value: `Pago #${lastResult.abonoPagoN} · +${fmtMXN(lastResult.abonoExtra)} (con IVA)`
    });
  }

  for (const it of items){
    doc.setFont('helvetica','bold');
    doc.text(it.label, labelX, y);

    doc.setFont('helvetica','normal');
    doc.text(String(it.value ?? '—'), valueX, y);

    y += lineH;
  }

  y += 8;

  const head = [[
    '#','Fecha','Saldo inicial (sin IVA)','Abono capital','Interés','IVA','Pago','Saldo final'
  ]];

  // Si onePage=true, comprimimos tabla (misma idea que “modo impresión”)
  const body = (lastResult.rows || []).map(r => ([
    String(r.n),
    formatDateHuman(r.fecha),
    fmtMXN(r.saldoInicial),
    fmtMXN(r.capital),
    fmtMXN(r.interes),
    fmtMXN(r.iva),
    fmtMXN(r.pago),
    fmtMXN(r.saldoFinal)
  ]));

  doc.autoTable({
    startY: y,
    head,
    body,
    styles: { font:'helvetica', fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [20,20,20] },
    theme: 'grid',
    margin: { left, right: 40 }
  });

  const legalTxt =
    'LEGAL: Esta cotización es únicamente para fines informativos y de simulación. ' +
    'La tasa de interés es fija y el cálculo puede considerar IVA sobre capital e interés (según el modo seleccionado). ' +
    'Los importes mostrados son estimaciones basadas en los datos capturados y pueden variar por redondeos, fechas y políticas internas. ' +
    'La presente no constituye contrato, autorización ni compromiso de otorgar financiamiento. ' +
    'La operación queda sujeta a validación, aprobación y condiciones comerciales de MEGUESA S.A. de C.V.';

  const pageH = doc.internal.pageSize.getHeight();
  const yLegal = Math.min(doc.lastAutoTable.finalY + 16, pageH - 44);

  doc.setFont('helvetica','normal');
  doc.setFontSize(8);
  doc.text(legalTxt, left, Math.min(yLegal, pageH - 40), { maxWidth: pageWidth - left - 40 });

  // Nombre de archivo
  const safeCliente = (cliente || 'cliente')
    .replace(/[^\w\- ]+/g,'')
    .trim()
    .replace(/\s+/g,'_');

  const fname = `Cotizacion_${safeCliente}_${new Date().toISOString().slice(0,10)}.pdf`;

  // Salida: blob para compartir (sin abrir preview)
  const pdfBlob = doc.output('blob');

  if (returnBlob){
    return { blob: pdfBlob, filename: fname };
  }

  // Preview (comportamiento actual)
  if (openPreview){
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const win = window.open(pdfUrl, '_blank');
    if (!win) window.location.href = pdfUrl;
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
  }

  return null;
}

/* ===== Compartir / Impresión ===== */

// Escapa texto para HTML (para modo impresión)
function escHtml(s){
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Comprime filas para que quepa “1 hoja” (si la corrida es larga)
function compressRows(rows, maxRows = 18){
  if (!Array.isArray(rows)) return [];
  if (rows.length <= maxRows) return rows;

  const headCount = Math.floor((maxRows - 1) / 2);
  const tailCount = maxRows - 1 - headCount;

  const head = rows.slice(0, headCount);
  const tail = rows.slice(-tailCount);

  return [...head, { _ellipsis: true }, ...tail];
}

// Texto base para WhatsApp/Email (cotización)
function buildShareText(res){
  const ivaModoTxt = (res.ivaModo === 'interes')
    ? 'IVA sobre interés'
    : 'IVA sobre (capital + interés)';

  const cliente = res.cliente || '—';
  const producto = res.producto || res.productos || res.prod || ''; // por si tu campo se llama distinto

  const lines = [];
  lines.push('COTIZACIÓN · VENTA CON FINANCIAMIENTO');
  if (producto) lines.push(`Producto: ${producto}`);
  lines.push(`Cliente: ${cliente}`);
  lines.push(`Monto total (con IVA): ${fmtMXN(res.total)}`);
  if (res.engancheIncl != null) lines.push(`Enganche: ${fmtMXN(res.engancheIncl)} (${fmtPct((res.enganchePctReal || 0) * 100)})`);
  lines.push(`Monto a financiar (con IVA): ${fmtMXN(res.financiarIncl)}`);
  lines.push(`Plazo: ${res.meses} meses`);
  lines.push(`Tasa anual: ${fmtPct((res.tasaAnual || 0) * 100)} · Días/periodo: ${res.diasPeriodo || 30} (base 360)`);
  lines.push(`IVA: ${fmtPct((res.ivaRate || 0.16) * 100)} · Modo: ${ivaModoTxt}`);
  lines.push(`Mensualidad aprox.: ${fmtMXN(res.mensualidad)}`);
  lines.push(`Monto final financiado: ${fmtMXN(res.totalPagos)}`);

  // Si tienes leyenda legal en tu PDF/cotización, puedes incluir una línea corta aquí:
  // lines.push('Nota: Cotización sujeta a validación y condiciones comerciales.');

  return lines.join('\n');
}

// Intenta generar un PDF “1 hoja” SIN abrir pestaña: reusa tu generarPDF existente si soporta returnBlob.
// Si tu generarPDF actual NO devuelve blob, este wrapper lo obtiene clonando el doc: te digo abajo cómo adaptarlo.
async function generarPDFParaCompartir(){
  // Caso 1: tu generarPDF ya soporta { openPreview:false, returnBlob:true, onePage:true }
  // Si no, va a lanzar error y cae al catch.
  try{
    const out = await generarPDF({ openPreview:false, returnBlob:true });
    if (out && out.blob) return out;
  }catch(e){
    // seguimos al fallback (sin PDF adjunto)
  }
  return null;
}

async function compartirCotizacion(){
  if (!lastResult){
    alert('Primero calcula una corrida.');
    return;
  }

  const texto = buildShareText(lastResult);

  // Intentar adjuntar PDF (si el navegador lo permite)
  const pdfOut = await generarPDFParaCompartir();
  if (pdfOut && pdfOut.blob){
    const file = new File([pdfOut.blob], pdfOut.filename || 'Cotizacion.pdf', { type:'application/pdf' });

    // Web Share API con archivos
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })){
      try{
        await navigator.share({ title:'Cotización', text: texto, files: [file] });
        return;
      }catch(e){
        // si cancelan o falla, seguimos al siguiente método
      }
    }
  }

  // Web Share API (solo texto)
  if (navigator.share){
    try{
      await navigator.share({ title:'Cotización', text: texto });
      return;
    }catch(e){
      // si cancelan, no hacemos nada más
      return;
    }
  }

  // Fallback: WhatsApp o Email
  const usarWhatsApp = confirm('Tu navegador no soporta “Compartir”.\n\nOK = WhatsApp\nCancelar = Email');
  if (usarWhatsApp){
    const wa = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(wa, '_blank');
  } else {
    const subject = encodeURIComponent('Cotización · Venta con Financiamiento');
    const body = encodeURIComponent(texto);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }
}

function abrirModoImpresion(){
  if (!lastResult){
    alert('Primero calcula una corrida.');
    return;
  }

  const res = lastResult;
  const ivaModoTxt = (res.ivaModo === 'interes')
    ? 'IVA sobre interés'
    : 'IVA sobre (capital + interés)';

  // “1 hoja”: comprimimos si es muy larga
  const rows = res.rows || [];

  const detalle = [
    ['Producto', (res.producto || res.productos || res.prod || '—')],
    ['Cliente', (res.cliente || '—')],
    ['Monto total (con IVA)', fmtMXN(res.total)],
    ['Enganche', res.engancheIncl != null ? `${fmtMXN(res.engancheIncl)} (${fmtPct((res.enganchePctReal || 0) * 100)})` : '—'],
    ['Monto a financiar (con IVA)', fmtMXN(res.financiarIncl)],
    ['Tasa anual', fmtPct((res.tasaAnual || 0) * 100)],
    ['Plazo (meses)', String(res.meses || '—')],
    ['Primer pago', res.primerPago ? formatDateHuman(res.primerPago) : '—'],
    ['IVA', `${fmtPct((res.ivaRate || 0.16) * 100)} · ${ivaModoTxt}`],
  ];

  const filasHtml = rows.map(r => `
      <tr>
        <td>${escHtml(r.n)}</td>
        <td>${escHtml(formatDateHuman(r.fecha))}</td>
        <td style="text-align:right">${escHtml(fmtMXN(r.saldoInicial))}</td>
        <td style="text-align:right">${escHtml(fmtMXN(r.capital))}</td>
        <td style="text-align:right">${escHtml(fmtMXN(r.interes))}</td>
        <td style="text-align:right">${escHtml(fmtMXN(r.iva))}</td>
        <td style="text-align:right"><strong>${escHtml(fmtMXN(r.pago))}</strong></td>
        <td style="text-align:right">${escHtml(fmtMXN(r.saldoFinal))}</td>
      </tr>
    `).join('');

  const w = window.open('', '_blank');
  if (!w){
    alert('El navegador bloqueó la ventana de impresión. Permite popups y vuelve a intentar.');
    return;
  }

  const html = `
<!doctype html>
<html lang="es-MX">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Impresión · Cotización</title>
  <style>
    @page { size: letter; margin: 12mm; }
    body{ font-family: Arial, sans-serif; color:#111; }
    .header{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .title{ font-size:16px; font-weight:700; margin:0; }
    .subtitle{ font-size:12px; margin:4px 0 0 0; color:#333; }
    .logo{ height:70px; width:auto; object-fit:contain; }
    .grid{ display:grid; grid-template-columns: 1fr 1fr; gap:6px 12px; margin-top:10px; }
    .cell{ font-size:11px; line-height:1.25; }
    .k{ color:#555; font-weight:700; }
    .v{ color:#111; }
    .summary{ margin-top:10px; display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; }
    .box{ border:1px solid #ddd; border-radius:8px; padding:8px; }
    .box .k{ font-size:10px; }
    .box .v{ font-size:12px; margin-top:4px; font-weight:700; }
    table{ width:100%; border-collapse:collapse; margin-top:10px; font-size:9px; }
    th,td{ border:1px solid #ddd; padding:4px 5px; white-space:nowrap; }
    th{ background:#f3f4f6; text-align:left; }
    .ellipsis td{ text-align:center; color:#666; }
    .note{ margin-top:8px; font-size:9px; color:#555; }
    @media print{
      .note{ display:none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <p class="title">VENTA CON FINANCIAMIENTO</p>
      <p class="subtitle">Vista para impresión (1 hoja) · Puedes “Guardar como PDF”</p>
    </div>
    <img class="logo" src="/assets/logo.jpg" alt="Logo">
  </div>

  <div class="grid">
    ${detalle.map(([k,v]) => `
      <div class="cell"><span class="k">${escHtml(k)}:</span> <span class="v">${escHtml(v)}</span></div>
    `).join('')}
  </div>

  <div class="summary">
    <div class="box"><div class="k">Subtotal (sin IVA)</div><div class="v">${escHtml(fmtMXN(res.subtotalTotal))}</div></div>
    <div class="box"><div class="k">IVA total</div><div class="v">${escHtml(fmtMXN(res.ivaTotal))}</div></div>
    <div class="box"><div class="k">Mensualidad (aprox.)</div><div class="v">${escHtml(fmtMXN(res.mensualidad))}</div></div>
    <div class="box"><div class="k">Monto a financiar</div><div class="v">${escHtml(fmtMXN(res.financiarIncl))}</div></div>
    <div class="box"><div class="k">Monto final financiado</div><div class="v">${escHtml(fmtMXN(res.totalPagos))}</div></div>
    <div class="box"><div class="k">Plazo</div><div class="v">${escHtml(String(res.meses))} meses</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Fecha</th>
        <th>Saldo inicial (sin IVA)</th>
        <th>Abono capital</th>
        <th>Interés</th>
        <th>IVA</th>
        <th>Pago</th>
        <th>Saldo final</th>
      </tr>
    </thead>
    <tbody>
      ${filasHtml}
    </tbody>
  </table>

  <div class="note">
    Consejo: en el diálogo de impresión, selecciona “Guardar como PDF” y ajusta “Escala” si hiciera falta.
  </div>

  <script>
    // Lanzar impresión automáticamente
    setTimeout(() => window.print(), 250);
  </script>
</body>
</html>
`;

  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}


/* ===== PWA ===== */
if ('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
