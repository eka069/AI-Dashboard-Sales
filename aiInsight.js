// aiInsight.js — Komunikasi dengan LLM (Groq atau Ollama)

// ── Build prompt dari ringkasan data ─────────────────────────
function buildPrompt(stats, focusQuestion = '') {
  const catLines = stats.categories
    .map(c => ` - ${c.category}: Sales $${(c.sales/1000).toFixed(1)}K, Profit $${(c.profit/1000).toFixed(1)}K, Margin ${c.margin}%`)
    .join('\n');

  const subcatLines = stats.subcategories
    .map(s => ` - ${s.subcat} (${s.category}): Sales $${(s.sales/1000).toFixed(1)}K, Margin ${s.margin}%`)
    .join('\n');

  const territoryLines = stats.territories
    .slice(0, 5)
    .map(t => ` - ${t.territory}: Sales $${(t.sales/1000).toFixed(1)}K, Profit $${(t.profit/1000).toFixed(1)}K, Margin ${t.margin}%`)
    .join('\n');

  const context = `
Berikut adalah ringkasan data penjualan Adventure Works:

KESELURUHAN:
- Total Sales    : $${(stats.totalSales/1000000).toFixed(2)}M
- Total Profit   : $${(stats.totalProfit/1000).toFixed(0)}K
- Profit Margin  : ${stats.overallMargin}%
- Total Orders   : ${stats.totalOrders.toLocaleString()}
- Total Customers: ${stats.totalCustomers.toLocaleString()}
- Total Qty Sold : ${stats.totalQty.toLocaleString()}

PERFORMA PER KATEGORI:
${catLines}

PERFORMA PER SUB-KATEGORI:
${subcatLines}

TOP 5 TERRITORY DARI 10 TOTAL (diurutkan Revenue tertinggi — territory lain TIDAK ditampilkan di sini):
${territoryLines}

Kategori terbaik (margin): ${stats.bestCategory ? stats.bestCategory.category + ' (' + stats.bestCategory.margin + '%)' : '-'}
Kategori terburuk (margin): ${stats.worstCategory ? stats.worstCategory.category + ' (' + stats.worstCategory.margin + '%)' : '-'}
`;

  const question = focusQuestion ||
    'Berikan insight bisnis yang paling penting dari data ini dalam 3 poin singkat. ' +
    'Sertakan rekomendasi konkret untuk tiap poin. Gunakan Bahasa Indonesia.';

  return context + '\n---\nPertanyaan: ' + question;
}

// ── Panggil LLM dan dapatkan insight ─────────────────────────
async function getInsight(stats, focusQuestion = '') {
  const prompt = buildPrompt(stats, focusQuestion);
  if (CONFIG.AI_PROVIDER === 'ollama') {
    return await callOllama(prompt);
  } else {
    return await callGroq(prompt);
  }
}

// ── Implementasi Ollama ───────────────────────────────────────
async function callOllama(prompt) {
  const res = await fetch(CONFIG.OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: { temperature: 0.3, num_predict: 800 }
    })
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.response;
}

// ── Implementasi Groq ─────────────────────────────────────────
async function callGroq(prompt) {
  const res = await fetch(CONFIG.GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: CONFIG.GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah analis bisnis senior yang memberi insight singkat, praktis, dan langsung ke poin. Gunakan Bahasa Indonesia.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.3
    })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Groq error: ${err.error?.message || res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// ── Narasi alert batch ────────────────────────────────────────
async function narrateAllAlerts(anomalies) {
  const allItems = [
    ...anomalies.profitOutliers,
    ...anomalies.momSpikes.slice(0, 3)
  ];
  if (allItems.length === 0) return 'Tidak ada anomali signifikan terdeteksi.';

  const itemLines = allItems.map((a, i) => {
    if (a.type === 'profit_outlier')
      return `${i+1}. [${a.severity.toUpperCase()}] Sub-kategori ${a.name}: margin ${a.margin}% (Z=${a.zScore})`;
    if (a.type === 'mom_spike')
      return `${i+1}. [${a.severity.toUpperCase()}] Sales ${a.month}: ${a.changePct}% MoM (${a.direction})`;
    return `${i+1}. [INFO] IQR outlier: ${a.subcat}`;
  }).join('\n');

  const prompt = `Kamu adalah analis bisnis yang memberi alert singkat dan actionable.
Berikut anomali di data penjualan Adventure Works:

${itemLines}

Untuk setiap anomali, tulis satu kalimat alert dalam Bahasa Indonesia.
Format: "• [nama/bulan]: [fakta mengejutkan] — [rekomendasi 1 kata kerja]"
Urutkan dari yang paling kritis. Langsung list tanpa preamble.`;

  if (CONFIG.AI_PROVIDER === 'ollama') return await callOllama(prompt);
  return await callGroq(prompt);
}