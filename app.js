// app.js — Capstone Orchestrator
// Data load → anomaly detect → render visual → AI story (async)

// ── Warna Semantis ────────────────────────────────────────────
const COLOR = {
  normal:    '#64748b',
  good:      '#059669',
  warn:      '#d97706',
  severe:    '#dc2626',
  warning:   '#ea580c',
  accent:    '#0ea5e9',
  accent2:   '#8b5cf6',
  highlight: '#f59e0b',
  bikes:     '#0ea5e9',
  clothing:  '#8b5cf6',
  accessories: '#10b981'
};

function categoryColor(cat) {
  const c = (cat || '').trim().toLowerCase();
  if (c === 'bikes') return COLOR.bikes;
  if (c === 'clothing') return COLOR.clothing;
  if (c === 'accessories') return COLOR.accessories;
  // fallback substring match only if exact match fails
  if (c.includes('bike')) return COLOR.bikes;
  if (c.includes('cloth')) return COLOR.clothing;
  if (c.includes('access')) return COLOR.accessories;
  return COLOR.accent;
}

function anomalyColor(severity) {
  return COLOR[severity] || COLOR.normal;
}

function profitColor(value) {
  if (value < 0) return COLOR.severe;
  if (value < 10) return COLOR.warn;
  return COLOR.good;
}

// ── Helper: parse angka ───────────────────────────────────────
function parseNum(val) {
  if (val === undefined || val === null || val === '') return 0;
  const num = parseFloat(String(val).trim().replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

// ── Helper: parse tanggal ─────────────────────────────────────
function parseDate(str) {
  if (!str) return null;
  const d = new Date(str.trim());
  return isNaN(d.getTime()) ? null : d;
}

let rawData = [];
let summaryStats = {};
let currentAnomalies = {};
let activeFilters = {
  startDate: null, endDate: null,
  category: 'all', subcat: 'all',
  segment: 'all', territory: 'all'
};

// ── Entry point ───────────────────────────────────────────────
d3.csv('sales_data.csv').then(async function (data) {
  // FASE 1: DATA
  rawData = data.map(d => ({
    orderId:    d['SalesOrderID'],
    orderDate:  parseDate(d['OrderDate']),
    customerId: d['CustomerID'],
    customerName: d['CustomerName'],
    segment:    d['Segment'],
    country:    d['CountryRegion'],
    city:       d['City'],
    province:   d['Province'],
    territory:  d['Territory'],
    productName: d['ProductName'],
    subcat:     d['SubCategory'],
    category:   d['Category'],
    qty:        +d['Qty'] || 0,
    unitPrice:  parseNum(d['UnitPrice']),
    sales:      parseNum(d['Sales']),
    discount:   parseNum(d['Discount']),
    productCost:parseNum(d['ProductCost']),
    totalCost:  parseNum(d['TotalCost']),
    profit:     parseNum(d['Profit'])
  })).filter(d => d.orderDate !== null && !isNaN(d.sales));

  populateFilters(rawData);
  applyFiltersAndRender();

  // Set model badge
  const mb = document.getElementById('model-badge');
  if (mb) mb.textContent = CONFIG.AI_PROVIDER === 'ollama' ? CONFIG.OLLAMA_MODEL : CONFIG.GROQ_MODEL;
  const fm = document.getElementById('footer-model');
  if (fm) fm.textContent = CONFIG.AI_PROVIDER === 'ollama' ? CONFIG.OLLAMA_MODEL : CONFIG.GROQ_MODEL;
});

// ── Populate filter dropdowns ─────────────────────────────────
function populateFilters(data) {
  const cats = [...new Set(data.map(d => d.category))].sort();
  const subcats = [...new Set(data.map(d => d.subcat))].sort();
  const segments = [...new Set(data.map(d => d.segment))].sort();
  const territories = [...new Set(data.map(d => d.territory))].sort();

  fillSelect('filter-category', cats);
  fillSelect('filter-subcat', subcats);
  fillSelect('filter-segment', segments);
  fillSelect('filter-territory', territories);

  // Date range
  const dates = data.map(d => d.orderDate).sort((a, b) => a - b);
  const minDate = dates[0].toISOString().split('T')[0];
  const maxDate = dates[dates.length - 1].toISOString().split('T')[0];
  document.getElementById('filter-start').value = minDate;
  document.getElementById('filter-end').value = maxDate;
  document.getElementById('filter-start').min = minDate;
  document.getElementById('filter-start').max = maxDate;
  document.getElementById('filter-end').min = minDate;
  document.getElementById('filter-end').max = maxDate;
  activeFilters.startDate = dates[0];
  activeFilters.endDate = dates[dates.length - 1];
}

function fillSelect(id, values) {
  const el = document.getElementById(id);
  if (!el) return;
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    el.appendChild(opt);
  });
}

// ── Apply filters + full re-render ───────────────────────────
function applyFiltersAndRender() {
  let filtered = rawData.filter(d => {
    if (activeFilters.startDate && d.orderDate < activeFilters.startDate) return false;
    if (activeFilters.endDate && d.orderDate > activeFilters.endDate) return false;
    if (activeFilters.category !== 'all' && d.category !== activeFilters.category) return false;
    if (activeFilters.subcat !== 'all' && d.subcat !== activeFilters.subcat) return false;
    if (activeFilters.segment !== 'all' && d.segment !== activeFilters.segment) return false;
    if (activeFilters.territory !== 'all' && d.territory !== activeFilters.territory) return false;
    return true;
  });

  if (filtered.length === 0) {
    showNoData(); return;
  }

  summaryStats = computeSummary(filtered);
  currentAnomalies = detectAllAnomalies(filtered);

  // FASE 2: RENDER VISUAL
  renderKPICards(summaryStats);
  renderCategoryChart(filtered);
  renderSubcatChart(filtered, buildAnomalyMap(currentAnomalies));
  renderTrendChart(filtered);
  renderTerritoryChart(filtered);
  renderScatterChart(filtered);
  renderTop10Chart(filtered);
  renderCategoryTable(summaryStats);
  renderAlertList(currentAnomalies);
  updateChartTitles(currentAnomalies);

  // FASE 3: AI (async, paralel)
  document.getElementById('narrative-title').textContent = 'Memuat analisis data...';
  document.getElementById('narrative-title').classList.remove('loaded');
  document.getElementById('insight-output').innerHTML = '<p class="insight-placeholder">Memuat insight dari AI...</p>';

  Promise.allSettled([
    generateTitle(summaryStats, currentAnomalies),
    generateStory(summaryStats, currentAnomalies),
    getInsight(summaryStats, 'Berikan 3 insight paling penting dan rekomendasi konkret. Bahasa Indonesia.')
  ]).then(([titleR, storyR, insightR]) => {
    if (titleR.status === 'fulfilled') {
      const el = document.getElementById('narrative-title');
      if (el) { el.textContent = titleR.value.trim(); el.classList.add('loaded'); }
    }
    if (storyR.status === 'fulfilled') {
      const scr = parseStoryResponse(storyR.value);
      fillZone('setup-text', scr.setup);
      fillZone('conflict-text', scr.conflict);
      fillZone('resolution-text', scr.resolution);
    }
    if (insightR.status === 'fulfilled') {
      const el = document.getElementById('insight-output');
      if (el) el.innerHTML = formatInsight(insightR.value);
    }
  });
}

function fillZone(id, text) {
  const el = document.getElementById(id);
  if (!el || !text) return;
  el.textContent = text; el.classList.add('ai-loaded');
}

function showNoData() {
  document.getElementById('narrative-title').textContent = 'Tidak ada data untuk filter yang dipilih';
}

// ── computeSummary ────────────────────────────────────────────
function computeSummary(data) {
  const totalSales   = d3.sum(data, d => d.sales);
  const totalProfit  = d3.sum(data, d => d.profit);
  const totalQty     = d3.sum(data, d => d.qty);
  const totalOrders  = new Set(data.map(d => d.orderId)).size;
  const totalCustomers = new Set(data.map(d => d.customerId).filter(Boolean)).size;
  const margin = totalSales > 0 ? (totalProfit / totalSales * 100).toFixed(1) : '0.0';

  const byCategory = d3.rollups(data,
    v => ({ sales: d3.sum(v, d => d.sales), profit: d3.sum(v, d => d.profit) }),
    d => d.category
  ).map(([cat, v]) => ({
    category: cat,
    sales: v.sales,
    profit: v.profit,
    margin: v.sales > 0 ? (v.profit / v.sales * 100).toFixed(1) : '0.0'
  })).sort((a, b) => b.sales - a.sales);

  const bySubcat = d3.rollups(data,
    v => ({ sales: d3.sum(v, d => d.sales), profit: d3.sum(v, d => d.profit), category: v[0].category }),
    d => d.subcat
  ).map(([subcat, v]) => ({
    subcat,
    category: v.category,
    sales: v.sales,
    profit: v.profit,
    margin: v.sales > 0 ? (v.profit / v.sales * 100).toFixed(1) : '0.0'
  })).sort((a, b) => b.margin - a.margin);

  const byTerritory = d3.rollups(data,
    v => ({ sales: d3.sum(v, d => d.sales), profit: d3.sum(v, d => d.profit) }),
    d => d.territory
  ).map(([territory, v]) => ({
    territory, sales: v.sales, profit: v.profit,
    margin: v.sales > 0 ? (v.profit / v.sales * 100).toFixed(1) : '0.0'
  })).sort((a, b) => b.sales - a.sales);

  const sorted = [...byCategory].sort((a, b) => +b.margin - +a.margin);

  return {
    totalSales, totalProfit, totalQty, totalOrders, totalCustomers,
    overallMargin: margin,
    categories: byCategory,
    subcategories: bySubcat,
    territories: byTerritory,
    bestCategory: sorted[0],
    worstCategory: sorted[sorted.length - 1]
  };
}

// ── KPI Cards ─────────────────────────────────────────────────
function renderKPICards(stats) {
  const cards = [
    { label: 'Total Sales',    value: `$${(stats.totalSales/1000000).toFixed(2)}M`,    sub: 'Revenue keseluruhan',   cls: 'kpi-blue' },
    { label: 'Total Profit',   value: `$${(stats.totalProfit/1000).toFixed(0)}K`,      sub: `Margin ${stats.overallMargin}%`, cls: stats.overallMargin < 0 ? 'kpi-red' : 'kpi-green' },
    { label: 'Profit Margin',  value: `${stats.overallMargin}%`,                       sub: 'Efisiensi keuntungan',  cls: +stats.overallMargin < 10 ? 'kpi-yellow' : 'kpi-green' },
    { label: 'Qty Terjual',    value: stats.totalQty.toLocaleString(),                 sub: 'Unit terjual',          cls: 'kpi-blue' },
    { label: 'Total Orders',   value: stats.totalOrders.toLocaleString(),              sub: 'Unique orders',         cls: 'kpi-purple' },
    { label: 'Total Customers',value: stats.totalCustomers.toLocaleString(),           sub: 'Unique customers',      cls: 'kpi-purple' }
  ];
  const container = document.getElementById('summary-cards');
  if (!container) return;
  container.innerHTML = cards.map(c => `
    <div class="kpi-card ${c.cls}">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-sub">${c.sub}</div>
    </div>`).join('');
}

// ── Chart: Sales per Category ─────────────────────────────────
function renderCategoryChart(data) {
  const container = d3.select('#chart-category');
  container.selectAll('*').remove();
  const margin = { top: 10, right: 20, bottom: 40, left: 90 };
  const w = (container.node()?.clientWidth || 300) - margin.left - margin.right;
  const h = 180 - margin.top - margin.bottom;

  const byCategory = d3.rollups(data,
    v => d3.sum(v, d => d.sales),
    d => d.category
  ).map(([cat, val]) => ({ category: cat, sales: val }))
    .sort((a, b) => b.sales - a.sales);

  const svg = container.append('svg')
    .attr('width', w + margin.left + margin.right)
    .attr('height', h + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, d3.max(byCategory, d => d.sales)]).range([0, w]);
  const y = d3.scaleBand().domain(byCategory.map(d => d.category)).range([0, h]).padding(0.3);

  svg.selectAll('.bar').data(byCategory).enter().append('rect')
    .attr('class', 'bar').attr('x', 0)
    .attr('y', d => y(d.category))
    .attr('width', d => x(d.sales))
    .attr('height', y.bandwidth())
    .attr('fill', d => categoryColor(d.category))
    .attr('rx', 3);

  svg.selectAll('.val-label').data(byCategory).enter().append('text')
    .attr('x', d => x(d.sales) + 4)
    .attr('y', d => y(d.category) + y.bandwidth() / 2)
    .attr('dominant-baseline', 'middle').attr('font-size', 10).attr('fill', '#94a3b8')
    .text(d => `$${(d.sales/1000).toFixed(0)}K`);

  svg.append('g').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
  svg.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat(d => `$${(d/1000).toFixed(0)}K`))
    .select('.domain').remove();
}

// ── Chart: Profit Margin per Sub-Kategori (with anomaly highlight) ──
function renderSubcatChart(data, anomalyMap = new Map()) {
  const container = d3.select('#chart-subcat');
  container.selectAll('*').remove();
  const margin = { top: 10, right: 60, bottom: 20, left: 130 };
  const w = (container.node()?.clientWidth || 460) - margin.left - margin.right;
  const h = 240 - margin.top - margin.bottom;

  const bySubcat = d3.rollups(data,
    v => ({ margin: d3.sum(v, d => d.profit) / d3.sum(v, d => d.sales) * 100 }),
    d => d.subcat
  ).map(([name, v]) => ({ name, margin: +v.margin.toFixed(1) }))
    .sort((a, b) => a.margin - b.margin);

  const getColor = (d) => {
    if (!anomalyMap.has(d.name)) return COLOR.normal;
    const a = anomalyMap.get(d.name);
    return a.severity === 'severe' ? COLOR.severe : a.severity === 'warning' ? COLOR.warning : COLOR.warn;
  };

  const svg = container.append('svg')
    .attr('width', w + margin.left + margin.right)
    .attr('height', h + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xMin = Math.min(d3.min(bySubcat, d => d.margin) - 5, -5);
  const xMax = d3.max(bySubcat, d => d.margin) + 5;
  const x = d3.scaleLinear().domain([xMin, xMax]).range([0, w]);
  const y = d3.scaleBand().domain(bySubcat.map(d => d.name)).range([0, h]).padding(0.25);

  // Zero line
  svg.append('line')
    .attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', h)
    .attr('stroke', '#475569').attr('stroke-dasharray', '4,3').attr('stroke-width', 1);

  svg.selectAll('.bar').data(bySubcat).enter().append('rect')
    .attr('class', 'bar')
    .attr('x', d => d.margin >= 0 ? x(0) : x(d.margin))
    .attr('y', d => y(d.name))
    .attr('width', d => Math.abs(x(d.margin) - x(0)))
    .attr('height', y.bandwidth())
    .attr('fill', d => getColor(d))
    .attr('rx', 3)
    .append('title')
    .text(d => {
      const tag = anomalyMap.has(d.name) ? ` [ANOMALI: Z=${anomalyMap.get(d.name).zScore}]` : '';
      return `${d.name}: ${d.margin}%${tag}`;
    });

  svg.selectAll('.label').data(bySubcat).enter().append('text')
    .attr('x', d => d.margin >= 0 ? x(d.margin) + 3 : x(d.margin) - 3)
    .attr('y', d => y(d.name) + y.bandwidth() / 2)
    .attr('text-anchor', d => d.margin >= 0 ? 'start' : 'end')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', 10)
    .attr('fill', d => anomalyMap.has(d.name) ? COLOR.severe : '#94a3b8')
    .attr('font-weight', d => anomalyMap.has(d.name) ? '600' : '400')
    .text(d => `${d.margin}%`);

  svg.append('g').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
}

// ── Chart: Tren Sales & Profit per Bulan ─────────────────────
function renderTrendChart(data) {
  const container = d3.select('#chart-trend');
  container.selectAll('*').remove();
  const margin = { top: 10, right: 20, bottom: 40, left: 55 };
  const w = (container.node()?.clientWidth || 500) - margin.left - margin.right;
  const h = 200 - margin.top - margin.bottom;

  const byMonth = d3.rollups(data,
    v => ({ sales: d3.sum(v, d => d.sales), profit: d3.sum(v, d => d.profit) }),
    d => d3.timeMonth(d.orderDate)
  ).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date - b.date);

  const svg = container.append('svg')
    .attr('width', w + margin.left + margin.right)
    .attr('height', h + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime().domain(d3.extent(byMonth, d => d.date)).range([0, w]);
  const yMax = d3.max(byMonth, d => d.sales);
  const yMin = d3.min(byMonth, d => d.profit);
  const y = d3.scaleLinear().domain([Math.min(yMin, 0), yMax]).range([h, 0]).nice();

  // Area sales
  const areaSales = d3.area()
    .x(d => x(d.date)).y0(y(0)).y1(d => y(d.sales)).curve(d3.curveMonotoneX);
  svg.append('path').datum(byMonth).attr('fill', COLOR.accent).attr('fill-opacity', 0.15)
    .attr('d', areaSales);

  // Line sales
  const lineSales = d3.line().x(d => x(d.date)).y(d => y(d.sales)).curve(d3.curveMonotoneX);
  svg.append('path').datum(byMonth).attr('fill', 'none').attr('stroke', COLOR.accent)
    .attr('stroke-width', 2).attr('d', lineSales);

  // Line profit
  const lineProfit = d3.line().x(d => x(d.date)).y(d => y(d.profit)).curve(d3.curveMonotoneX);
  svg.append('path').datum(byMonth).attr('fill', 'none').attr('stroke', COLOR.good)
    .attr('stroke-width', 1.5).attr('stroke-dasharray', '4,2').attr('d', lineProfit);

  // Zero line
  if (yMin < 0) {
    svg.append('line').attr('x1', 0).attr('x2', w).attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', COLOR.severe).attr('stroke-dasharray', '3,2').attr('stroke-width', 1);
  }

  svg.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat('%b %Y')))
    .selectAll('text').attr('transform', 'rotate(-30)').style('text-anchor', 'end').attr('font-size', 9);
  svg.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d => `$${(d/1000).toFixed(0)}K`)).select('.domain').remove();

  // Legend
  const legend = svg.append('g').attr('transform', `translate(${w - 120}, 0)`);
  legend.append('line').attr('x1', 0).attr('x2', 14).attr('y1', 5).attr('y2', 5)
    .attr('stroke', COLOR.accent).attr('stroke-width', 2);
  legend.append('text').attr('x', 18).attr('y', 9).attr('font-size', 9).attr('fill', '#94a3b8').text('Sales');
  legend.append('line').attr('x1', 0).attr('x2', 14).attr('y1', 20).attr('y2', 20)
    .attr('stroke', COLOR.good).attr('stroke-width', 1.5).attr('stroke-dasharray', '4,2');
  legend.append('text').attr('x', 18).attr('y', 24).attr('font-size', 9).attr('fill', '#94a3b8').text('Profit');

  // ── Tooltip interaktif ────────────────────────────────────────
  // Hapus tooltip lama jika ada
  d3.select('#trend-tooltip').remove();
  const tooltip = d3.select('body').append('div')
    .attr('id', 'trend-tooltip')
    .style('position', 'fixed')
    .style('background', '#1e293b')
    .style('border', '1px solid #334155')
    .style('border-radius', '8px')
    .style('padding', '8px 12px')
    .style('font-size', '12px')
    .style('color', '#e2e8f0')
    .style('pointer-events', 'none')
    .style('display', 'none')
    .style('z-index', '9999')
    .style('box-shadow', '0 4px 16px rgba(0,0,0,0.4)')
    .style('line-height', '1.6');

  // Garis vertikal cursor
  const bisect = d3.bisector(d => d.date).left;
  const focusLine = svg.append('line')
    .attr('y1', 0).attr('y2', h)
    .attr('stroke', '#475569').attr('stroke-width', 1).attr('stroke-dasharray', '4,2')
    .style('display', 'none');

  // Titik fokus Sales
  const focusDotSales = svg.append('circle')
    .attr('r', 4).attr('fill', COLOR.accent).attr('stroke', '#0f172a').attr('stroke-width', 2)
    .style('display', 'none');

  // Titik fokus Profit
  const focusDotProfit = svg.append('circle')
    .attr('r', 4).attr('fill', COLOR.good).attr('stroke', '#0f172a').attr('stroke-width', 2)
    .style('display', 'none');

  // Overlay transparan untuk menangkap mouse event
  svg.append('rect')
    .attr('width', w).attr('height', h)
    .attr('fill', 'none')
    .attr('pointer-events', 'all')
    .on('mousemove', function (event) {
      const [mx] = d3.pointer(event);
      const x0 = x.invert(mx);
      const idx = bisect(byMonth, x0, 1);
      const d0 = byMonth[idx - 1];
      const d1 = byMonth[idx];
      if (!d0) return;
      const d = (!d1 || (x0 - d0.date) < (d1.date - x0)) ? d0 : d1;

      const cx = x(d.date);
      const cySales = y(d.sales);
      const cyProfit = y(d.profit);

      focusLine.attr('x1', cx).attr('x2', cx).style('display', null);
      focusDotSales.attr('cx', cx).attr('cy', cySales).style('display', null);
      focusDotProfit.attr('cx', cx).attr('cy', cyProfit).style('display', null);

      const fmtDate = d3.timeFormat('%B %Y')(d.date);
      const fmtSales = `$${(d.sales / 1000).toFixed(1)}K`;
      const fmtProfit = `$${(d.profit / 1000).toFixed(1)}K`;
      const margin = d.sales > 0 ? (d.profit / d.sales * 100).toFixed(1) : '0.0';
      const profitClr = d.profit < 0 ? '#f87171' : '#34d399';

      tooltip
        .style('display', 'block')
        .html(`
          <div style="font-weight:600;margin-bottom:4px;color:#f1f5f9">${fmtDate}</div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:10px;height:2px;background:${COLOR.accent}"></span>
            Sales: <b style="color:#7dd3fc">${fmtSales}</b>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:10px;height:2px;background:${COLOR.good};border-top:1px dashed ${COLOR.good}"></span>
            Profit: <b style="color:${profitClr}">${fmtProfit}</b>
          </div>
          <div style="color:#94a3b8;font-size:11px;margin-top:2px">Margin: ${margin}%</div>
        `);

      // Posisi tooltip mengikuti mouse (viewport-relative)
      const [vx, vy] = [event.clientX, event.clientY];
      const ttW = 160;
      const left = vx + ttW + 16 > window.innerWidth ? vx - ttW - 10 : vx + 14;
      tooltip.style('left', left + 'px').style('top', (vy - 60) + 'px');
    })
    .on('mouseleave', function () {
      focusLine.style('display', 'none');
      focusDotSales.style('display', 'none');
      focusDotProfit.style('display', 'none');
      tooltip.style('display', 'none');
    });
}

// ── Chart: Territory Bar ──────────────────────────────────────
function renderTerritoryChart(data) {
  const container = d3.select('#chart-territory');
  container.selectAll('*').remove();
  const margin = { top: 10, right: 50, bottom: 40, left: 100 };
  const w = (container.node()?.clientWidth || 300) - margin.left - margin.right;
  const h = 280 - margin.top - margin.bottom;

  const byTerritory = d3.rollups(data,
    v => ({ sales: d3.sum(v, d => d.sales), profit: d3.sum(v, d => d.profit) }),
    d => d.territory
  ).map(([t, v]) => ({ territory: t, ...v })).sort((a, b) => b.sales - a.sales).slice(0, 8);

  const svg = container.append('svg')
    .attr('width', w + margin.left + margin.right)
    .attr('height', h + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xMax = Math.max(d3.max(byTerritory, d => d.sales), d3.max(byTerritory, d => d.profit));
  const x = d3.scaleLinear().domain([0, xMax]).range([0, w]);
  const y = d3.scaleBand().domain(byTerritory.map(d => d.territory)).range([0, h]).padding(0.3);
  // Two sub-bars per territory: Sales on top, Profit on bottom — clearly separated
  const ySub = d3.scaleBand().domain(['sales', 'profit']).range([0, y.bandwidth()]).padding(0.15);

  // Sales bars (always blue)
  svg.selectAll('.bar-sales').data(byTerritory).enter().append('rect')
    .attr('x', 0)
    .attr('y', d => y(d.territory) + ySub('sales'))
    .attr('width', d => x(d.sales))
    .attr('height', ySub.bandwidth())
    .attr('fill', COLOR.accent).attr('rx', 2)
    .append('title').text(d => `Sales: $${d.sales.toLocaleString()}`);

  // Profit bars (green if positive, red if negative)
  svg.selectAll('.bar-profit').data(byTerritory).enter().append('rect')
    .attr('x', 0)
    .attr('y', d => y(d.territory) + ySub('profit'))
    .attr('width', d => x(Math.abs(d.profit)))
    .attr('height', ySub.bandwidth())
    .attr('fill', d => d.profit < 0 ? COLOR.severe : COLOR.good).attr('rx', 2)
    .append('title').text(d => `Profit: $${d.profit.toLocaleString()}`);

  svg.append('g').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
  svg.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat(d => `$${(d/1000).toFixed(0)}K`)).select('.domain').remove();

  // Inline legend
  const legend = svg.append('g').attr('transform', `translate(0, -2)`);
  legend.append('rect').attr('x', w - 110).attr('y', -8).attr('width', 9).attr('height', 9).attr('fill', COLOR.accent);
  legend.append('text').attr('x', w - 97).attr('y', -1).attr('font-size', 9).attr('fill', '#94a3b8').text('Sales');
  legend.append('rect').attr('x', w - 55).attr('y', -8).attr('width', 9).attr('height', 9).attr('fill', COLOR.good);
  legend.append('text').attr('x', w - 42).attr('y', -1).attr('font-size', 9).attr('fill', '#94a3b8').text('Profit');
}

// ── Chart: Scatter Sales vs Profit ───────────────────────────
function renderScatterChart(data) {
  const container = d3.select('#chart-scatter');
  container.selectAll('*').remove();
  const margin = { top: 10, right: 20, bottom: 40, left: 60 };
  const w = (container.node()?.clientWidth || 320) - margin.left - margin.right;
  const h = 240 - margin.top - margin.bottom;

  // Aggregate per product
  const byProduct = d3.rollups(data,
    v => ({ sales: d3.sum(v, d => d.sales), profit: d3.sum(v, d => d.profit), category: v[0].category }),
    d => d.productName
  ).map(([name, v]) => ({ name, ...v })).filter(d => d.sales > 0);

  const svg = container.append('svg')
    .attr('width', w + margin.left + margin.right)
    .attr('height', h + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Sales values span from ~$7K to ~$3.3M (orders of magnitude apart).
  // A linear scale crushes every low-sales product into one overlapping
  // point near the origin. Log scale spreads them out so each product
  // — and its category color — is visible.
  const x = d3.scaleLog().domain([d3.min(byProduct, d => d.sales) * 0.8, d3.max(byProduct, d => d.sales) * 1.2]).range([0, w]);
  const yMin = Math.min(d3.min(byProduct, d => d.profit), 0);
  const yMax = d3.max(byProduct, d => d.profit);
  const y = d3.scaleLinear().domain([yMin, yMax]).range([h, 0]).nice();

  // Zero line
  svg.append('line').attr('x1', 0).attr('x2', w).attr('y1', y(0)).attr('y2', y(0))
    .attr('stroke', '#475569').attr('stroke-dasharray', '4,3').attr('stroke-width', 1);

  svg.selectAll('circle').data(byProduct).enter().append('circle')
    .attr('cx', d => x(d.sales)).attr('cy', d => y(d.profit))
    .attr('r', 7).attr('fill', d => categoryColor(d.category)).attr('fill-opacity', 0.75)
    .attr('stroke', d => categoryColor(d.category)).attr('stroke-width', 1.5)
    .append('title').text(d => `${d.name} (${d.category})\nSales: $${d.sales.toLocaleString()}\nProfit: $${d.profit.toLocaleString()}`);

  // Custom X-axis ticks: pilih nilai bulat yang tersebar merata di log domain
  const xDomain = x.domain();
  const logMin = Math.log10(xDomain[0]);
  const logMax = Math.log10(xDomain[1]);
  const customXTicks = [];
  for (let exp = Math.floor(logMin); exp <= Math.ceil(logMax); exp++) {
    [1, 2, 5].forEach(m => {
      const v = m * Math.pow(10, exp);
      if (v >= xDomain[0] && v <= xDomain[1]) customXTicks.push(v);
    });
  }
  // Batasi maksimal 6 ticks agar tidak padat
  const tickStep = Math.ceil(customXTicks.length / 6);
  const filteredTicks = customXTicks.filter((_, i) => i % tickStep === 0);

  const xAxis = d3.axisBottom(x)
    .tickValues(filteredTicks)
    .tickFormat(d => {
      if (d >= 1000000) return `$${(d/1000000).toFixed(1)}M`;
      if (d >= 1000) return `$${(d/1000).toFixed(0)}K`;
      return `$${d}`;
    })
    .tickSize(4);

  const xAxisG = svg.append('g').attr('transform', `translate(0,${h})`).call(xAxis);
  xAxisG.select('.domain').remove();
  xAxisG.selectAll('text')
    .attr('font-size', 9)
    .attr('fill', '#94a3b8')
    .attr('dy', '1.2em');
  xAxisG.selectAll('line').attr('stroke', '#334155');

  svg.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d => `$${(d/1000).toFixed(0)}K`)).select('.domain').remove();

  // X axis label
  svg.append('text').attr('x', w / 2).attr('y', h + 38)
    .attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#64748b').text('Sales (skala log) →');
  svg.append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -45)
    .attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#64748b').text('Profit →');
}

// ── Chart: Top 10 Products by Profit ─────────────────────────
function renderTop10Chart(data) {
  const container = d3.select('#chart-top10');
  container.selectAll('*').remove();
  const margin = { top: 10, right: 70, bottom: 20, left: 170 };
  const w = (container.node()?.clientWidth || 460) - margin.left - margin.right;
  const h = 260 - margin.top - margin.bottom;

  const byProduct = d3.rollups(data,
    v => ({ profit: d3.sum(v, d => d.profit), sales: d3.sum(v, d => d.sales), category: v[0].category }),
    d => d.productName
  ).map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.profit - a.profit).slice(0, 10);

  const svg = container.append('svg')
    .attr('width', w + margin.left + margin.right)
    .attr('height', h + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, d3.max(byProduct, d => d.profit)]).range([0, w]);
  const y = d3.scaleBand().domain(byProduct.map(d => d.name)).range([0, h]).padding(0.25);

  svg.selectAll('.bar').data(byProduct).enter().append('rect')
    .attr('class', 'bar').attr('x', 0)
    .attr('y', d => y(d.name))
    .attr('width', d => x(Math.max(d.profit, 0)))
    .attr('height', y.bandwidth())
    .attr('fill', d => categoryColor(d.category)).attr('rx', 3);

  svg.selectAll('.label').data(byProduct).enter().append('text')
    .attr('x', d => x(Math.max(d.profit, 0)) + 4)
    .attr('y', d => y(d.name) + y.bandwidth() / 2)
    .attr('dominant-baseline', 'middle').attr('font-size', 9).attr('fill', '#94a3b8')
    .text(d => `$${(d.profit/1000).toFixed(1)}K`);

  svg.append('g').call(d3.axisLeft(y).tickSize(0)
    .tickFormat(d => d.length > 22 ? d.slice(0, 20) + '…' : d))
    .select('.domain').remove();
}

// ── Category Table ────────────────────────────────────────────
function renderCategoryTable(stats) {
  const container = document.getElementById('category-table');
  if (!container) return;
  const rows = stats.categories.map(c => `
    <tr>
      <td><span class="cat-dot" style="background:${categoryColor(c.category)}"></span>${c.category}</td>
      <td>$${(c.sales/1000).toFixed(1)}K</td>
      <td>$${(c.profit/1000).toFixed(1)}K</td>
      <td style="color:${profitColor(+c.margin)};font-weight:600">${c.margin}%</td>
    </tr>`).join('');
  container.innerHTML = `
    <table class="perf-table">
      <thead><tr><th>Kategori</th><th>Sales</th><th>Profit</th><th>Margin</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Alert List ────────────────────────────────────────────────
function renderAlertList(anomalies) {
  const sevCount = countSeverity(anomalies);
  const badgeSev = document.getElementById('badge-severe');
  const badgeWarn = document.getElementById('badge-warning');
  if (badgeSev) badgeSev.textContent = sevCount.severe + ' Kritis';
  if (badgeWarn) badgeWarn.textContent = sevCount.warning + ' Peringatan';

  const container = document.getElementById('alert-tab-raw');
  if (!container) return;

  const items = [];
  anomalies.profitOutliers.forEach(a => items.push({
    severity: a.severity,
    label: `Profit Margin Anomali: ${a.name}`,
    detail: `margin ${a.margin}% | Z-score ${a.zScore} | ${a.direction === 'low' ? 'jauh di bawah' : 'jauh di atas'} rata-rata`
  }));
  anomalies.momSpikes.forEach(a => items.push({
    severity: a.severity,
    label: `Sales ${a.direction === 'drop' ? 'Turun' : 'Naik'} Drastis: ${a.month}`,
    detail: `${a.changePct}% MoM | $${Number(a.current).toLocaleString()} vs $${Number(a.previous).toLocaleString()}`
  }));
  (anomalies.iqrOutliers?.bySubcat || []).forEach(a => items.push({
    severity: a.severity,
    label: `Distribusi Tidak Normal: ${a.subcat}`,
    detail: `${a.count} transaksi outlier | rata-rata $${Number(a.avgSales).toLocaleString()}`
  }));

  container.innerHTML = items.length === 0
    ? '<p class="placeholder-text">Tidak ada anomali signifikan.</p>'
    : items.map(i => `<div class="alert-item">
        <div class="ai-dot ${i.severity}"></div>
        <div><div class="ai-label">${i.label}</div>
        <div class="ai-detail">${i.detail}</div></div>
      </div>`).join('');
}

// ── buildAnomalyMap ───────────────────────────────────────────
function buildAnomalyMap(anomalies) {
  const map = new Map();
  anomalies.profitOutliers.forEach(a => {
    map.set(a.name, { severity: a.severity, zScore: a.zScore, direction: a.direction });
  });
  return map;
}

// ── Update chart titles ───────────────────────────────────────
function updateChartTitles(anomalies) {
  const worstProfit = anomalies.profitOutliers[0];
  if (worstProfit) {
    const sign = +worstProfit.margin < 0 ? 'RUGI' : 'Outlier';
    const el = document.getElementById('chart-title-subcat');
    if (el) el.textContent = `Profit Margin per Sub-Kategori — ${worstProfit.name} ${sign} (${worstProfit.margin}%)`;
  }
}

// ── Narasi AI tombol ──────────────────────────────────────────
async function requestAlertNarration() {
  const btn = document.getElementById('btn-narrate');
  const output = document.getElementById('ai-narration-output');
  if (!btn || !output) return;
  btn.disabled = true; btn.textContent = 'Memproses...';
  switchAlertTab('ai', document.querySelectorAll('.alert-tab')[1]);
  output.innerHTML = '<p class="loading-text"><span class="spinner-inline"></span>Mengirim ke AI...</p>';
  try {
    const n = await narrateAllAlerts(currentAnomalies);
    output.innerHTML = n.split('\n').filter(l => l.trim())
      .map(l => `<div class="narration-line">${l.replace(/\*\*/g, '')}</div>`).join('');
  } catch (e) { output.innerHTML = `<p style="color:#dc2626">${e.message}</p>`; }
  finally { btn.disabled = false; btn.textContent = '🤖 Narasi AI'; }
}

function switchAlertTab(tab, btnEl) {
  document.querySelectorAll('.alert-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.alert-tab-content').forEach(c => c.style.display = 'none');
  if (btnEl) btnEl.classList.add('active');
  const t = document.getElementById('alert-tab-' + tab);
  if (t) t.style.display = 'block';
}

// ── Insight request ───────────────────────────────────────────
async function requestInsight() {
  const btn = document.getElementById('btn-insight');
  const output = document.getElementById('insight-output');
  const q = document.getElementById('custom-question');
  if (!btn || !output) return;
  btn.disabled = true; btn.textContent = 'Memproses...';
  output.innerHTML = '<div class="insight-loading"><div class="spinner"></div><span>Mengirim ke AI...</span></div>';
  try {
    output.innerHTML = formatInsight(await getInsight(summaryStats, q?.value?.trim() || ''));
  } catch (e) { output.innerHTML = `<div class="insight-error">${e.message}</div>`; }
  finally { btn.disabled = false; btn.textContent = 'Minta Insight →'; }
}

function quickAsk(q) {
  const el = document.getElementById('custom-question');
  if (el) el.value = q;
  requestInsight();
}

function formatInsight(text) {
  let t = text.replace(/\*\*\*(.+?)\*\*\*/g, '$1').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  let html = '';
  t.split('\n').forEach(l => {
    l = l.trim();
    if (!l) { html += '<div class="insight-gap"></div>'; return; }
    if (/^\d+\.\s/.test(l)) { html += `<div class="insight-item">${l.replace(/^\d+\.\s/, '<b>$&</b>')}</div>`; return; }
    if (/^[*\-]\s/.test(l)) { html += `<div class="insight-bullet">&bull;&nbsp; ${l.replace(/^[*\-]\s/, '')}</div>`; return; }
    html += `<div class="insight-line">${l}</div>`;
  });
  return html;
}

// ── Filter event handlers ─────────────────────────────────────
function onFilterChange() {
  const start = document.getElementById('filter-start').value;
  const end = document.getElementById('filter-end').value;
  activeFilters.startDate = start ? new Date(start) : null;
  activeFilters.endDate = end ? new Date(end + 'T23:59:59') : null;
  activeFilters.category  = document.getElementById('filter-category').value;
  activeFilters.subcat    = document.getElementById('filter-subcat').value;
  activeFilters.segment   = document.getElementById('filter-segment').value;
  activeFilters.territory = document.getElementById('filter-territory').value;
  applyFiltersAndRender();
}

function resetFilters() {
  document.getElementById('filter-category').value  = 'all';
  document.getElementById('filter-subcat').value    = 'all';
  document.getElementById('filter-segment').value   = 'all';
  document.getElementById('filter-territory').value = 'all';
  // Reset dates to full range
  const dates = rawData.map(d => d.orderDate).sort((a, b) => a - b);
  document.getElementById('filter-start').value = dates[0].toISOString().split('T')[0];
  document.getElementById('filter-end').value   = dates[dates.length-1].toISOString().split('T')[0];
  activeFilters = {
    startDate: dates[0], endDate: dates[dates.length-1],
    category: 'all', subcat: 'all', segment: 'all', territory: 'all'
  };
  applyFiltersAndRender();
}