/* ===== Helpers / Constantes ===== */
const IVA_RATE = 0.16;     // fijo
const DIAS_PERIODO = 30;   // fijo

const fmtMXN = (n) => new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(n || 0);
const fmtPct = (n) => `${(n || 0).toFixed(2)}%`;

function round2(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }

// ✅ Sumas exactas (sin redondeo acumulado): sumar en centavos
function toCents(n){ return Math.round((Number(n) || 0) * 100); }
function fromCents(c){ return (Number(c) || 0) / 100; }

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

// ✅ Obtener tamaño natural de una imagen (para NO deformar firma en PDF)
function getImageSize(dataUrl){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = reject;
    img.src = dataUrl;
  });
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
  diasPeriodo: $('diasPeriodo'),
  btnCalcular: $('btnCalcular'),
  btnLimpiar: $('btnLimpiar'),
  btnPDF: $('btnPDF'),
  btnCompartir: $('btnCompartir'),

  tablaBody: document.querySelector('#tabla tbody'),

  // Acordeón sección 2
  togglePagos: $('togglePagos'),
  panelPagos: $('panelPagos'),

  // Sección 2 (Abono a capital)
  abonoPago: $('abonoPago'),
  abonoExtra: $('abonoExtra'),
  btnSimularAbono: $('btnSimularAbono'),
  btnLimpiarAbono: $('btnLimpiarAbono'),

  // Resumen
  resSubtotal: $('resSubtotal'),
  resIva: $('resIva'),
  resEnganche: $('resEnganche'),
  resFinanciar: $('resFinanciar'),
  resMensualidad: $('resMensualidad'),
  resTotalFin: $('resTotalFin'),

  // Firma (canvas)
  firmaCanvas: $('firmaCanvas'),
  btnLimpiarFirma: $('btnLimpiarFirma'),
};

let lastResult = null;     // lo que se está mostrando
let baseResult = null;     // corrida base (sin abono) para simular sobre ella

/* ===== Firma (canvas) ===== */
const firmaPad = {
  canvas: null,
  ctx: null,
  drawing: false,
  hasInk: false,
};

function initFirmaPad(){
  if (!ui.firmaCanvas) return;

  firmaPad.canvas = ui.firmaCanvas;

  const resize = () => {
    const canvas = firmaPad.canvas;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    // conservar firma si ya había
    const prev = firmaPad.hasInk ? canvas.toDataURL('image/png') : null;

    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#111';

    firmaPad.ctx = ctx;

    if (prev){
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = prev;
    } else {
      ctx.clearRect(0, 0, rect.width, rect.height);
    }
  };

  resize();
  window.addEventListener('resize', resize);

  const getPos = (ev) => {
    const rect = firmaPad.canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  };

  const onDown = (ev) => {
    ev.preventDefault();
    firmaPad.drawing = true;
    firmaPad.canvas.setPointerCapture?.(ev.pointerId);

    const p = getPos(ev);
    firmaPad.ctx.beginPath();
    firmaPad.ctx.moveTo(p.x, p.y);
  };

  const onMove = (ev) => {
    if (!firmaPad.drawing) return;
    ev.preventDefault();

    const p = getPos(ev);
    firmaPad.ctx.lineTo(p.x, p.y);
    firmaPad.ctx.stroke();

    firmaPad.hasInk = true;
  };

  const onUp = (ev) => {
    if (!firmaPad.drawing) return;
    ev.preventDefault();
    firmaPad.drawing = false;
  };

  firmaPad.canvas.addEventListener('pointerdown', onDown);
  firmaPad.canvas.addEventListener('pointermove', onMove);
  firmaPad.canvas.addEventListener('pointerup', onUp);
  firmaPad.canvas.addEventListener('pointercancel', onUp);

  if (ui.btnLimpiarFirma){
    ui.btnLimpiarFirma.addEventListener('click', (e) => {
      e.preventDefault();
      limpiarFirma();
    });
  }
}

function limpiarFirma(){
  if (!firmaPad.canvas || !firmaPad.ctx) return;
  const rect = firmaPad.canvas.getBoundingClientRect();
  firmaPad.ctx.clearRect(0, 0, rect.width, rect.height);
  firmaPad.hasInk = false;
}

function getFirmaDataUrl(){
  if (!firmaPad.canvas || !firmaPad.hasInk) return null;
  return firmaPad.canvas.toDataURL('image/png');
}

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

  if (ui.btnSimularAbono) ui.btnSimularAbono.addEventListener('click', (e) => { e.preventDefault(); simularAbonoCapital(); });
  if (ui.btnLimpiarAbono) ui.btnLimpiarAbono.addEventListener('click', (e) => { e.preventDefault(); limpiarAbono(); });

  // Acordeón: cerrado al iniciar
  if (ui.togglePagos && ui.panelPagos){
    ui.togglePagos.setAttribute('aria-expanded', 'false');
    ui.panelPagos.hidden = true;

    ui.togglePagos.addEventListener('click', () => {
      const isOpen = ui.togglePagos.getAttribute('aria-expanded') === 'true';
      ui.togglePagos.setAttribute('aria-expanded', String(!isOpen));
      ui.panelPagos.hidden = isOpen;
    });
  }

  // Firma
  initFirmaPad();
})();

/* ===== Core (Sección 1) ===== */
function getInputs(){
  const total = Number(ui.total?.value || 0);
  const engPct = Number(ui.enganchePct?.value || 0) / 100;
  const engMonto = Number(ui.engancheMonto?.value || 0);
  const tasaAnual = Number(ui.tasaAnual?.value || 0) / 100;
  const meses = parseInt(ui.meses?.value || '0', 10);
  const primerPago = ui.primerPago?.value ? parseDateLocal(ui.primerPago.value) : new Date();
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
    ivaModo: 'total', // fijo
    diasPeriodo: DIAS_PERIODO
  };
}

function validar(inp){
  const errs = [];
  if (!(inp.total > 0)) errs.push('Captura un monto total mayor a 0.');
  if (!(inp.meses > 0)) errs.push('Captura meses (mayor a 0).');
  if (inp.tasaAnual < 0) errs.push('Tasa anual inválida.');
  if (inp.engMonto < 0) errs.push('Pago Inicial inválido.');
  if (inp.engPct < 0) errs.push('% Pago Inicial inválido.');
  return errs;
}

// ✅ totalPagos sin redondeo acumulado (centavos)
function buildScheduleBase({ pvSub, rate, meses, primerPago, ivaRate, pagoSub }){
  let saldo = pvSub;
  const rows = [];
  let totalPagosC = 0; // centavos

  for (let k = 1; k <= meses; k++){
    const fecha = addMonths(primerPago, k - 1);

    let interes = round2(saldo * rate);
    let capital = round2(pagoSub - interes);

    let saldoFinal = round2(saldo - capital);

    if (k === meses){
      capital = round2(capital + saldoFinal);
      saldoFinal = 0;
    }

    const baseIVA = (capital + interes); // fijo: IVA sobre (capital + interés)
    const ivaPago = round2(baseIVA * ivaRate);
    const pagoTotal = round2(capital + interes + ivaPago);

    rows.push({ n:k, fecha, saldoInicial:saldo, capital, interes, iva:ivaPago, pago:pagoTotal, saldoFinal });

    totalPagosC += toCents(pagoTotal);   // ✅ suma exacta
    saldo = saldoFinal;
  }

  return { rows, totalPagos: fromCents(totalPagosC) };
}

function calcular(){
  const inp = getInputs();
  const errs = validar(inp);
  if (errs.length){ alert(errs.join('\n')); return; }

  // Pago Inicial: si hay monto, manda. Si no, usa porcentaje
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

  baseResult = lastResult;
  render(lastResult);
}

/* ===== Sección 2: Abono a capital (solo mantener plazo y recalcular mensualidad) ===== */
function simularAbonoCapital(){
  if (!baseResult){
    alert('Primero calcula una corrida en la sección "Datos".');
    return;
  }

  const pagoN = parseInt(ui.abonoPago?.value || '0', 10);
  const extraTotal = Number(ui.abonoExtra?.value || 0);
  const mesesBase = baseResult.mesesOriginal || baseResult.meses;

  const errs = [];
  if (!(pagoN >= 1 && pagoN <= mesesBase)) errs.push(`El número de pago debe estar entre 1 y ${mesesBase}.`);
  if (!(extraTotal > 0)) errs.push('Captura un abono adicional mayor a 0.');
  if (errs.length){ alert(errs.join('\n')); return; }

  // Abono extra capturado como “con IVA” -> convertir a “sin IVA” para capital
  const extraCapitalSub = round2(extraTotal / (1 + baseResult.ivaRate));

  const rate = baseResult.rate;
  const pagoSubBase = baseResult.pagoSub;

  let saldo = baseResult.financiarSub;
  const rows = [];
  let totalPagosC = 0; // ✅ centavos

  function pushRow(n, pagoSub, extraCapSub, forceClose){
    const fecha = addMonths(baseResult.primerPago, n - 1);

    let interes = round2(saldo * rate);
    let capital = round2(pagoSub - interes + (extraCapSub || 0));

    if (capital >= saldo) capital = round2(saldo);

    let saldoFinal = round2(saldo - capital);

    if (forceClose && saldoFinal !== 0){
      capital = round2(capital + saldoFinal);
      saldoFinal = 0;
    }

    const baseIVA = (capital + interes);
    const ivaPago = round2(baseIVA * baseResult.ivaRate);
    const pagoTotal = round2(capital + interes + ivaPago);

    rows.push({
      n, fecha,
      saldoInicial: saldo,
      capital, interes, iva: ivaPago,
      pago: pagoTotal,
      saldoFinal,
      abonoExtraTotal: (n === pagoN) ? extraTotal : 0
    });

    totalPagosC += toCents(pagoTotal); // ✅ suma exacta
    saldo = saldoFinal;
  }

  // 1) De pago 1 a pagoN (aplicando el abono en pagoN)
  for (let n = 1; n <= pagoN; n++){
    const extraThis = (n === pagoN) ? extraCapitalSub : 0;
    const forceClose = (n === mesesBase);
    pushRow(n, pagoSubBase, extraThis, forceClose);
    if (saldo <= 0) break;
  }

  if (saldo <= 0){
    lastResult = {
      ...baseResult,
      mode: 'abono',
      meses: rows.length,
      rows,
      totalPagos: fromCents(totalPagosC),
      mensualidad: baseResult.mensualidad,
      abonoPagoN: pagoN,
      abonoExtra: extraTotal
    };
    render(lastResult);
    return;
  }

  // 2) Mantener plazo y recalcular mensualidad desde el siguiente pago
  const remainingPeriods = mesesBase - pagoN;
  if (remainingPeriods <= 0){
    lastResult = {
      ...baseResult,
      mode: 'abono',
      meses: rows.length,
      rows,
      totalPagos: fromCents(totalPagosC),
      mensualidad: baseResult.mensualidad,
      abonoPagoN: pagoN,
      abonoExtra: extraTotal
    };
    render(lastResult);
    return;
  }

  let pagoSubNuevo = pmt(rate, remainingPeriods, saldo);
  pagoSubNuevo = round2(pagoSubNuevo);

  for (let j = 1; j <= remainingPeriods; j++){
    const n = pagoN + j;
    const forceClose = (n === mesesBase);
    pushRow(n, pagoSubNuevo, 0, forceClose);
    if (saldo <= 0) break;
  }

  const idxNext = pagoN; // pagoN+1 en índice 0-based
  const mensualidadNueva = rows[idxNext] ? rows[idxNext].pago : baseResult.mensualidad;

  lastResult = {
    ...baseResult,
    mode: 'abono',
    meses: rows.length,
    rows,
    totalPagos: fromCents(totalPagosC),
    pagoSubNuevo,
    mensualidad: mensualidadNueva,
    mensualidadAnterior: baseResult.mensualidad,
    abonoPagoN: pagoN,
    abonoExtra: extraTotal
  };

  render(lastResult);

  // abre el acordeón si estaba cerrado
  if (ui.togglePagos && ui.panelPagos){
    ui.togglePagos.setAttribute('aria-expanded', 'true');
    ui.panelPagos.hidden = false;
  }
}

function limpiarAbono(){
  if (ui.abonoPago) ui.abonoPago.value = '';
  if (ui.abonoExtra) ui.abonoExtra.value = '';

  if (baseResult){
    lastResult = baseResult;
    render(lastResult);
  } else {
    ui.tablaBody.innerHTML = '';
    ui.btnPDF.disabled = true;
    if (ui.btnCompartir) ui.btnCompartir.disabled = true;

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
    ui.resEnganche.textContent =
      `Abono en pago #${res.abonoPagoN}: +${fmtMXN(res.abonoExtra)} · Nueva mensualidad: ${fmtMXN(res.mensualidad)}`;
  } else {
    ui.resEnganche.textContent = `${fmtMXN(res.engancheIncl)} (${fmtPct(res.enganchePctReal*100)})`;
  }

  ui.resFinanciar.textContent = fmtMXN(res.financiarIncl);
  ui.resMensualidad.textContent = fmtMXN(res.mensualidad);
  ui.resTotalFin.textContent = fmtMXN(res.totalPagos);

  ui.tablaBody.innerHTML = '';
  for (const r of (res.rows || [])){
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
  if (ui.btnCompartir) ui.btnCompartir.disabled = false;
}

/* ===== Limpiar ===== */
function limpiar(){
  if (ui.cliente) ui.cliente.value = '';
  if (ui.producto) ui.producto.value = '';
  if (ui.total) ui.total.value = '';
  if (ui.enganchePct) ui.enganchePct.value = '';
  if (ui.engancheMonto) ui.engancheMonto.value = '';
  if (ui.tasaAnual) ui.tasaAnual.value = '';
  if (ui.meses) ui.meses.value = '';
  if (ui.ivaPct) ui.ivaPct.value = String(IVA_RATE * 100);
  if (ui.diasPeriodo) ui.diasPeriodo.value = String(DIAS_PERIODO);

  if (ui.abonoPago) ui.abonoPago.value = '';
  if (ui.abonoExtra) ui.abonoExtra.value = '';

  ui.tablaBody.innerHTML = '';
  ui.btnPDF.disabled = true;
  if (ui.btnCompartir) ui.btnCompartir.disabled = true;

  ui.resSubtotal.textContent = '—';
  ui.resIva.textContent = '—';
  ui.resEnganche.textContent = '—';
  ui.resFinanciar.textContent = '—';
  ui.resMensualidad.textContent = '—';
  ui.resTotalFin.textContent = '—';

  limpiarFirma();

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
  const { openPreview = true, returnBlob = false } = opts;
  if (!lastResult) return null;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'letter' });

  // Logo
  let logoDataUrl = null;
  try{ logoDataUrl = await loadImageAsDataURL('/assets/logo.jpg'); }catch(e){ logoDataUrl = null; }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

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

  // ===== Firma =====
  const firmaUrl = getFirmaDataUrl(); // null si no firmaron
  let firmaSize = null;
  if (firmaUrl){
    try{ firmaSize = await getImageSize(firmaUrl); }catch(e){ firmaSize = null; }
  }

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

  // Detalle
  const labelX = left;
  const valueX = left + 160;
  const lineH = 14;

  const items = [
    { label: 'Producto:', value: producto },
    { label: 'Cliente:', value: cliente },
    { label: 'Pago Inicial:', value: fmtMXN(lastResult.engancheIncl ?? 0) },
    { label: 'Monto a financiar (con IVA):', value: fmtMXN(lastResult.financiarIncl) },
    { label: 'Monto a financiar (sin IVA):', value: fmtMXN(lastResult.financiarSub) },
    { label: 'Tasa anual:', value: `${fmtPct(lastResult.tasaAnual * 100)} · Días/periodo: ${DIAS_PERIODO} (base 360)` },
    { label: 'Meses:', value: `${lastResult.meses} · Primer pago: ${formatDateHuman(lastResult.primerPago)}` },
    { label: 'Mensualidad aprox.:', value: fmtMXN(lastResult.mensualidad) },
    { label: 'Total (suma de pagos):', value: fmtMXN(lastResult.totalPagos) }
  ];

  if (lastResult.mode === 'abono'){
    items.splice(3, 0, {
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

  y += 10;

  // Tabla
  const head = [[
    '#','Fecha','Saldo inicial (sin IVA)','Abono capital','Interés','IVA','Pago','Saldo final'
  ]];

  const rows = lastResult.rows || [];

  // ✅ Totales exactos (centavos), sin round2 acumulado
  let sumInteresC = 0;
  let sumIvaC = 0;
  let sumPagoC = 0;
  for (const r of rows){
    sumInteresC += toCents(r.interes);
    sumIvaC += toCents(r.iva);
    sumPagoC += toCents(r.pago);
  }
  const sumInteres = fromCents(sumInteresC);
  const sumIva = fromCents(sumIvaC);
  const sumPago = fromCents(sumPagoC);

  const body = rows.map(r => ([
    String(r.n),
    formatDateHuman(r.fecha),
    fmtMXN(r.saldoInicial),
    fmtMXN(r.capital),
    fmtMXN(r.interes),
    fmtMXN(r.iva),
    fmtMXN(r.pago),
    fmtMXN(r.saldoFinal)
  ]));

  // Totales al final
  const foot = [[
    '', 'TOTALES', '', '',
    fmtMXN(sumInteres),
    fmtMXN(sumIva),
    fmtMXN(sumPago),
    ''
  ]];

  doc.autoTable({
    startY: y,
    head,
    body,
    foot,
    showFoot: 'lastPage',
    styles: { font:'helvetica', fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [20,20,20] },
    footStyles: { fillColor: [245,245,245], textColor: 20, fontStyle: 'bold' },
    theme: 'grid',
    margin: { left, right: 40, bottom: 140 } // reserva para firma + legal
  });

  // ===== Firma en PDF (SIN deformar) =====
  function drawFirmaPDF(yTop){
    const lineW = 260;
    const x1 = (pageWidth - lineW) / 2;
    const x2 = x1 + lineW;

    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.text('Firma del Cliente', pageWidth/2, yTop, { align:'center' });

    const boxW = lineW;
    const boxH = 44;
    const imgY = yTop + 10;

    if (firmaUrl){
      try{
        if (firmaSize && firmaSize.w > 0 && firmaSize.h > 0){
          const scale = Math.min(boxW / firmaSize.w, boxH / firmaSize.h);
          const drawW = firmaSize.w * scale;
          const drawH = firmaSize.h * scale;

          const drawX = (pageWidth / 2) - (drawW / 2);   // centrado
          const drawY = imgY + (boxH - drawH) / 2;       // centrado vertical

          doc.addImage(firmaUrl, 'PNG', drawX, drawY, drawW, drawH);
        } else {
          // fallback si no se pudo medir
          doc.addImage(firmaUrl, 'PNG', x1, imgY, boxW, boxH);
        }
      }catch(e){}
    }

    const yLine = imgY + boxH + 6;
    doc.line(x1, yLine, x2, yLine);

    doc.setFontSize(9);
    doc.text(cliente, pageWidth/2, yLine + 14, { align:'center' });

    return (yLine + 26) - yTop;
  }

  // Legal (para última página)
  const legalTxt =
    'LEGAL: Esta cotización es únicamente para fines informativos y de simulación. ' +
    'La tasa de interés es fija y el cálculo considera IVA sobre capital e interés. ' +
    'Los importes mostrados son estimaciones basadas en los datos capturados y pueden variar por redondeos, fechas y políticas internas. ' +
    'La presente no constituye contrato, autorización ni compromiso de otorgar financiamiento. ' +
    'La operación queda sujeta a validación, aprobación y condiciones comerciales de MEGUESA S.A. de C.V.';

  const totalPages = doc.getNumberOfPages();
  doc.setPage(totalPages);

  doc.setFont('helvetica','normal');
  doc.setFontSize(8);

  const legalLines = doc.splitTextToSize(legalTxt, pageWidth - left - 40);
  const legalLineH = 10;
  const legalH = legalLines.length * legalLineH;

  const bottomPadding = 18;
  const legalTopY = pageH - bottomPadding - legalH;

  const sigBlockH = 95; // aprox
  let sigY = legalTopY - 12 - sigBlockH;

  const lastTableY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : 0;

  // si no cabe arriba de la tabla, agregamos página
  if (sigY < (lastTableY + 16)){
    doc.addPage();
    const newTotal = doc.getNumberOfPages();
    doc.setPage(newTotal);
    // recalcular sigY para nueva página (legal queda igual abajo)
    sigY = legalTopY - 12 - sigBlockH;
  }

  // Dibuja firma y legal
  drawFirmaPDF(sigY);
  doc.setFont('helvetica','normal');
  doc.setFontSize(8);
  doc.text(legalLines, left, legalTopY);

  // Nombre archivo
  const safeCliente = (cliente || 'cliente')
    .replace(/[^\w\- ]+/g,'')
    .trim()
    .replace(/\s+/g,'_');

  const fname = `Cotizacion_${safeCliente}_${new Date().toISOString().slice(0,10)}.pdf`;

  const pdfBlob = doc.output('blob');

  if (returnBlob){
    return { blob: pdfBlob, filename: fname };
  }

  if (openPreview){
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const win = window.open(pdfUrl, '_blank');
    if (!win) window.location.href = pdfUrl;
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
  }

  return null;
}

/* ===== Compartir ===== */
function buildShareText(res){
  const cliente = res.cliente || '—';
  const producto = res.producto || '';
  const lines = [];

  lines.push('COTIZACIÓN · VENTA CON FINANCIAMIENTO');
  if (producto) lines.push(`Producto: ${producto}`);
  lines.push(`Cliente: ${cliente}`);
  lines.push(`Pago Inicial: ${fmtMXN(res.engancheIncl ?? 0)}`);
  lines.push(`Monto a financiar (con IVA): ${fmtMXN(res.financiarIncl)}`);
  lines.push(`Plazo: ${res.meses} meses`);
  lines.push(`Tasa anual: ${fmtPct((res.tasaAnual || 0) * 100)} · Días/periodo: ${res.diasPeriodo || 30} (base 360)`);
  lines.push(`Mensualidad aprox.: ${fmtMXN(res.mensualidad)}`);
  lines.push(`Total (suma de pagos): ${fmtMXN(res.totalPagos)}`);

  if (res.mode === 'abono'){
    lines.push(`Simulación abono: Pago #${res.abonoPagoN} +${fmtMXN(res.abonoExtra)} (con IVA)`);
    lines.push(`Nueva mensualidad: ${fmtMXN(res.mensualidad)}`);
  }

  return lines.join('\n');
}

async function compartirCotizacion(){
  if (!lastResult){
    alert('Primero calcula una corrida.');
    return;
  }

  const texto = buildShareText(lastResult);

  // intentamos adjuntar PDF
  let pdfOut = null;
  try{
    pdfOut = await generarPDF({ openPreview:false, returnBlob:true });
  }catch(e){ pdfOut = null; }

  if (pdfOut && pdfOut.blob){
    const file = new File([pdfOut.blob], pdfOut.filename || 'Cotizacion.pdf', { type:'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })){
      try{
        await navigator.share({ title:'Cotización', text: texto, files: [file] });
        return;
      }catch(e){}
    }
  }

  // share sin archivo
  if (navigator.share){
    try{
      await navigator.share({ title:'Cotización', text: texto });
      return;
    }catch(e){ return; }
  }

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

/* ===== PWA ===== */
if ('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
