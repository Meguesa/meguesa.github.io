/* ===== Helpers ===== */
const IVA_RATE = 0.16;     // fijo
const DIAS_PERIODO = 30;   // fijo

const fmtMXN = (n) => new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(n || 0);
const fmtPct = (n) => `${(n || 0).toFixed(2)}%`;

function round2(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }

function parseDateLocal(iso){
  // iso: 'YYYY-MM-DD'
  const [y, m, d] = iso.split('-').map(Number);
  // Mediodía local para evitar desfases UTC/DST
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
  // Ajuste si el mes resultante no tiene ese día
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
  tablaBody: document.querySelector('#tabla tbody'),

  // Resumen
  resSubtotal: $('resSubtotal'),
  resIva: $('resIva'),
  resEnganche: $('resEnganche'),
  resFinanciar: $('resFinanciar'),
  resMensualidad: $('resMensualidad'),
  resTotalFin: $('resTotalFin'),

  // Sección 2
  cliente2: $('cliente2'),
  financiarIncl2: $('financiarIncl2'),
  tasaAnual2: $('tasaAnual2'),
  meses2: $('meses2'),
  primerPago2: $('primerPago2'),
  ivaModo2: $('ivaModo2'),
  pagosHechos2: $('pagosHechos2'),
  montoPagado2: $('montoPagado2'),
  btnCalcularPagos: $('btnCalcularPagos'),
};

let lastResult = null;

/* ===== Defaults ===== */
(function init(){
  // fecha default: hoy + 30
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
  d.setDate(d.getDate() + 30);

  if (ui.primerPago) ui.primerPago.value = formatDateISO(d);
  if (ui.primerPago2) ui.primerPago2.value = formatDateISO(d);

  // Forzar constantes visibles
  if (ui.ivaPct) ui.ivaPct.value = String(IVA_RATE * 100);
  if (ui.diasPeriodo) ui.diasPeriodo.value = String(DIAS_PERIODO);

  if (ui.btnCalcular) ui.btnCalcular.addEventListener('click', (e) => { e.preventDefault(); calcular(); });
  if (ui.btnLimpiar) ui.btnLimpiar.addEventListener('click', (e) => { e.preventDefault(); limpiar(); });
  if (ui.btnPDF) ui.btnPDF.addEventListener('click', (e) => { e.preventDefault(); generarPDF(); });

  if (ui.btnCalcularPagos) ui.btnCalcularPagos.addEventListener('click', (e) => { e.preventDefault(); calcularDesdePagos(); });
})();

/* ===== Core (Sección 1) ===== */
function getInputs(){
  const total = Number(ui.total?.value || 0);
  const engPct = Number(ui.enganchePct?.value || 0) / 100;
  const engMonto = Number(ui.engancheMonto?.value || 0);
  const tasaAnual = Number(ui.tasaAnual?.value || 0) / 100;
  const meses = parseInt(ui.meses?.value || '0', 10);
  const primerPago = ui.primerPago?.value ? parseDateLocal(ui.primerPago.value) : new Date();
  const ivaModo = ui.ivaModo?.value || 'total'; // total | interes
  const ivaRate = IVA_RATE;         // fijo
  const diasPeriodo = DIAS_PERIODO; // fijo
  const cliente = (ui.cliente?.value || '').trim();

  return { total, engPct, engMonto, tasaAnual, meses, primerPago, ivaRate, ivaModo, diasPeriodo, cliente };
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

function calcular(){
  const inp = getInputs();
  const errs = validar(inp);
  if (errs.length){
    alert(errs.join('\n'));
    return;
  }

  // Enganche: si hay monto, manda. Si no, usa porcentaje
  let engancheIncl = inp.engMonto > 0 ? inp.engMonto : inp.total * inp.engPct;
  engancheIncl = Math.min(engancheIncl, inp.total);
  engancheIncl = round2(engancheIncl);

  // Recalcular % enganche para alinear visualmente
  const enganchePctReal = inp.total > 0 ? (engancheIncl / inp.total) : 0;
  if (ui.enganchePct) ui.enganchePct.value = (enganchePctReal * 100).toFixed(2);

  const subtotalTotal = round2(inp.total / (1 + inp.ivaRate));
  const ivaTotal = round2(inp.total - subtotalTotal);

  const financiarIncl = round2(inp.total - engancheIncl);
  const financiarSub = round2(financiarIncl / (1 + inp.ivaRate));

  // Tasa periodo por base 360: (tasaAnual/360) * diasPeriodo
  const rate = (inp.tasaAnual / 360) * inp.diasPeriodo;

  // Pago por periodo (sin IVA)
  let pagoSub = pmt(rate, inp.meses, financiarSub);
  pagoSub = round2(pagoSub);

  // Armado de corrida
  const { rows, totalPagos } = buildSchedule({
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

  render(lastResult);
}

/* ===== Sección 2 (Cálculo desde pagos) ===== */
function getInputsPagos(){
  const financiarIncl = Number(ui.financiarIncl2?.value || 0);
  const tasaAnual = Number(ui.tasaAnual2?.value || 0) / 100;
  const meses = parseInt(ui.meses2?.value || '0', 10);
  const primerPago = ui.primerPago2?.value ? parseDateLocal(ui.primerPago2.value) : new Date();
  const ivaModo = ui.ivaModo2?.value || 'total';
  const pagosHechos = parseInt(ui.pagosHechos2?.value || '0', 10);
  const montoPagado = Number(ui.montoPagado2?.value || 0);
  const cliente = (ui.cliente2?.value || '').trim();

  return {
    cliente,
    financiarIncl,
    tasaAnual,
    meses,
    primerPago,
    ivaModo,
    pagosHechos,
    montoPagado,
    ivaRate: IVA_RATE,
    diasPeriodo: DIAS_PERIODO
  };
}

function validarPagos(inp){
  const errs = [];
  if (!(inp.financiarIncl > 0)) errs.push('Captura un Monto a financiar (con IVA) mayor a 0.');
  if (!(inp.meses > 0)) errs.push('Captura meses totales (mayor a 0).');
  if (inp.tasaAnual < 0) errs.push('Tasa anual inválida.');
  if (inp.pagosHechos < 0) errs.push('Pagos hechos inválido.');
  if (inp.pagosHechos > inp.meses) errs.push('Pagos hechos no puede ser mayor a meses totales.');
  if (inp.montoPagado < 0) errs.push('Monto pagado inválido.');
  return errs;
}

function buildSchedule({ pvSub, rate, meses, primerPago, ivaRate, ivaModo, pagoSub }){
  let saldo = pvSub;
  const rows = [];
  let totalPagos = 0;

  for (let k = 1; k <= meses; k++){
    const fecha = addMonths(primerPago, k - 1);

    let interes = round2(saldo * rate);
    let capital = round2(pagoSub - interes);

    let saldoFinal = round2(saldo - capital);

    // Ajuste último pago para cerrar saldo por redondeos
    if (k === meses){
      capital = round2(capital + saldoFinal);
      saldoFinal = 0;
    }

    const baseIVA = (ivaModo === 'interes') ? interes : (capital + interes);
    const ivaPago = round2(baseIVA * ivaRate);
    const pagoTotal = round2(capital + interes + ivaPago);

    rows.push({
      n: k,
      fecha,
      saldoInicial: saldo,
      capital,
      interes,
      iva: ivaPago,
      pago: pagoTotal,
      saldoFinal
    });

    totalPagos = round2(totalPagos + pagoTotal);
    saldo = saldoFinal;
  }

  return { rows, totalPagos };
}

function calcularDesdePagos(){
  const inp = getInputsPagos();
  const errs = validarPagos(inp);
  if (errs.length){
    alert(errs.join('\n'));
    return;
  }

  const financiarSubOriginal = round2(inp.financiarIncl / (1 + inp.ivaRate));
  const rate = (inp.tasaAnual / 360) * inp.diasPeriodo;

  let pagoSub = pmt(rate, inp.meses, financiarSubOriginal);
  pagoSub = round2(pagoSub);

  // Avanzamos pagos hechos para encontrar saldo actual
  let saldo = financiarSubOriginal;
  let esperadoPagado = 0;

  for (let k = 1; k <= inp.pagosHechos; k++){
    const interes = round2(saldo * rate);
    const capital = round2(pagoSub - interes);

    const baseIVA = (inp.ivaModo === 'interes') ? interes : (capital + interes);
    const ivaPago = round2(baseIVA * inp.ivaRate);
    const pagoTotal = round2(capital + interes + ivaPago);

    esperadoPagado = round2(esperadoPagado + pagoTotal);
    saldo = round2(saldo - capital);
    if (saldo < 0) saldo = 0;
  }

  // Si capturan montoPagado, ajusta diferencia como abono extra (aprox) a capital
  if (inp.montoPagado > 0){
    const diff = round2(inp.montoPagado - esperadoPagado);
    if (Math.abs(diff) >= 1){
      const extraCapitalSub = round2(diff / (1 + inp.ivaRate));
      saldo = round2(saldo - extraCapitalSub);
      if (saldo < 0) saldo = 0;
    }
  }

  const mesesRestantes = inp.meses - inp.pagosHechos;
  const primerPagoRestante = addMonths(inp.primerPago, inp.pagosHechos);

  const { rows, totalPagos } = buildSchedule({
    pvSub: saldo,
    rate,
    meses: mesesRestantes,
    primerPago: primerPagoRestante,
    ivaRate: inp.ivaRate,
    ivaModo: inp.ivaModo,
    pagoSub
  });

  const mensualidad = rows.length ? rows[0].pago : 0;

  lastResult = {
    mode: 'pagos',

    cliente: inp.cliente,
    total: inp.financiarIncl,

    tasaAnual: inp.tasaAnual,
    meses: mesesRestantes,
    primerPago: primerPagoRestante,
    ivaRate: inp.ivaRate,
    ivaModo: inp.ivaModo,
    diasPeriodo: inp.diasPeriodo,

    subtotalTotal: financiarSubOriginal,
    ivaTotal: round2(inp.financiarIncl - financiarSubOriginal),

    engancheIncl: 0,
    enganchePctReal: 0,

    financiarIncl: inp.financiarIncl,
    financiarSub: financiarSubOriginal,

    rate,
    pagoSub,
    mensualidad,
    totalPagos,
    rows,

    pagosHechos: inp.pagosHechos,
    montoPagado: inp.montoPagado,
    esperadoPagado
  };

  render(lastResult);
}

/* ===== Render ===== */
function render(res){
  ui.resSubtotal.textContent = fmtMXN(res.subtotalTotal);
  ui.resIva.textContent = fmtMXN(res.ivaTotal);

  if (res.mode === 'pagos'){
    const pagadoTxt = (res.montoPagado > 0) ? fmtMXN(res.montoPagado) : fmtMXN(res.esperadoPagado || 0);
    ui.resEnganche.textContent = `Pagos hechos: ${res.pagosHechos || 0} · Pagado: ${pagadoTxt}`;
  } else {
    ui.resEnganche.textContent = `${fmtMXN(res.engancheIncl)} (${fmtPct(res.enganchePctReal*100)})`;
  }

  ui.resFinanciar.textContent = fmtMXN(res.financiarIncl);
  ui.resMensualidad.textContent = fmtMXN(res.mensualidad);
  ui.resTotalFin.textContent = fmtMXN(res.totalPagos);

  ui.tablaBody.innerHTML = '';
  for (const r of res.rows){
    const tr = document.createElement('tr');
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
}

/* ===== Limpiar ===== */
function limpiar(){
  // Sección 1
  ui.cliente.value = '';
  ui.total.value = '';
  ui.enganchePct.value = '';
  ui.engancheMonto.value = '';
  ui.tasaAnual.value = '';
  ui.meses.value = '';
  ui.ivaPct.value = String(IVA_RATE * 100);
  ui.ivaModo.value = 'total';
  ui.diasPeriodo.value = String(DIAS_PERIODO);

  // Sección 2
  if (ui.cliente2) ui.cliente2.value = '';
  if (ui.financiarIncl2) ui.financiarIncl2.value = '';
  if (ui.tasaAnual2) ui.tasaAnual2.value = '';
  if (ui.meses2) ui.meses2.value = '';
  if (ui.ivaModo2) ui.ivaModo2.value = 'total';
  if (ui.pagosHechos2) ui.pagosHechos2.value = '';
  if (ui.montoPagado2) ui.montoPagado2.value = '';

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

async function generarPDF(){
  if (!lastResult) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'letter' });

  // Logo (arriba derecha)
  let logoDataUrl = null;
  try{
    logoDataUrl = await loadImageAsDataURL('/assets/logo.jpg');
  }catch(e){
    logoDataUrl = null;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  if (logoDataUrl){
    const logoW = 200;
    const logoH = 132;
    const x = pageWidth - 40 - logoW;
    const yLogo = 28;
    doc.addImage(logoDataUrl, 'JPEG', x, yLogo, logoW, logoH);
  }

  const company = 'Jardines de Juan Pablo';
  const titulo = (lastResult.mode === 'pagos') ? 'CORRIDA DESDE PAGOS' : 'VENTA CON FINANCIAMIENTO';
  const cliente = lastResult.cliente || '—';

  const left = 40;
  let y = 48;

  doc.setFont('helvetica','bold');
  doc.setFontSize(14);
  doc.text(company, left, y);

  doc.setFontSize(12);
  doc.text(titulo, left, y + 18);

  doc.setFont('helvetica','normal');
  doc.setFontSize(10);

  y += 42;

  const ivaModoTxt = (lastResult.ivaModo === 'interes')
    ? 'IVA sobre interés'
    : 'IVA sobre (capital + interés)';

  const labelX = left;
  const valueX = left + 150;
  const lineH = 14;

  const items = [
    { label: 'Cliente:', value: cliente },
    { label: 'Monto a financiar (con IVA):', value: fmtMXN(lastResult.financiarIncl) },
    { label: 'Monto a financiar (sin IVA):', value: fmtMXN(lastResult.financiarSub) },
    { label: 'Tasa anual:', value: `${fmtPct(lastResult.tasaAnual * 100)} · Días/periodo: ${DIAS_PERIODO} (base 360)` },
    { label: 'Meses:', value: `${lastResult.meses} · Primer pago: ${formatDateHuman(lastResult.primerPago)}` },
    { label: 'IVA:', value: `${fmtPct(lastResult.ivaRate * 100)} · Modo: ${ivaModoTxt}` },
    { label: 'Mensualidad aprox.:', value: fmtMXN(lastResult.mensualidad) },
    { label: 'Total (suma de pagos):', value: fmtMXN(lastResult.totalPagos) }
  ];

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

  const body = lastResult.rows.map(r => ([
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

  // Abrir en otra pestaña para previsualizar
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);

  const win = window.open(pdfUrl, '_blank');
  if (!win) window.location.href = pdfUrl;

  setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
}

/* ===== PWA ===== */
if ('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
