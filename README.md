# AI Dashboard — Adventure Works Sales
**Capstone Project · Data Visualization**

Dashboard AI-augmented yang menggabungkan D3.js, anomaly detection statistik, dan Large Language Model (Groq API) untuk menghasilkan insight otomatis dari data penjualan Adventure Works (2001–2004).

---

## 🚀 Cara Menjalankan

### 1. Siapkan API Key Groq
1. Buka [console.groq.com](https://console.groq.com) dan daftar gratis
2. Generate API Key dari menu **API Keys**
3. Buka file `config.js` dan ganti:
   ```js
   GROQ_API_KEY: 'ISI_API_KEY_GROQ_KAMU_DI_SINI',
   ```

### 2. Buka Dashboard
Karena menggunakan `d3.csv()` untuk load file lokal, kamu perlu menjalankan via **local server** (bukan double-click file):

**Opsi A — Python (paling mudah):**
```bash
cd ai-dashboard
python -m http.server 8080
# Buka http://localhost:8080
```

**Opsi B — VS Code Live Server:**
Install extension "Live Server" di VS Code, klik kanan `index.html` → "Open with Live Server"

**Opsi C — Node.js:**
```bash
npx serve .
```

### 3. Tunggu AI Narasi Muncul
Saat dashboard pertama kali dimuat:
1. Chart D3 akan muncul dalam ~1-2 detik
2. Alert anomali otomatis muncul
3. Judul naratif + SCR story zones diisi Groq (~3-5 detik)
4. Insight panel otomatis terisi

---

## 📁 Struktur File

```
ai-dashboard/
├── index.html          # Layout utama (tab bar + 3 zona SCR)
├── style.css           # Semua styling (dark theme)
├── config.js           # ⚠️ API key & konfigurasi — JANGAN di-commit!
├── app.js              # Orkestrator utama: load data, render, filter
├── aiInsight.js        # Komunikasi LLM (Groq atau Ollama)
├── anomalyDetector.js  # Deteksi anomali: Z-score, MoM, IQR
├── storyEngine.js      # Narasi SCR otomatis via LLM
├── sales_data.csv      # Dataset Adventure Works
└── README.md           # Dokumentasi ini
```

---

## 🎯 Fitur Dashboard

### KPI Cards (6 metrik)
- Total Sales, Total Profit, Profit Margin, Qty Terjual, Total Orders, Total Customers

### Visualisasi (6 chart D3.js)
| Chart | Deskripsi |
|-------|-----------|
| Profit Margin per Sub-Kategori | Bar horizontal + highlight anomali otomatis |
| Tren Sales & Profit | Line chart + area, per bulan |
| Sales per Kategori | Bar horizontal berwarna per kategori |
| Territory Performance | Sales + Profit per wilayah |
| Scatter Sales vs Profit | Membuktikan "sales besar ≠ profit tinggi" |
| Top 10 Produk by Profit | Bar horizontal ranking produk |

### AI Features
- **Judul naratif otomatis** — dihasilkan Groq berdasarkan data aktual
- **SCR Story Zones** — Setup / Conflict / Resolution dari LLM
- **Anomaly Detection** — Z-score, Month-over-Month, IQR
- **Narasi Alert** — LLM menjelaskan setiap anomali
- **Custom Question** — tanya apapun tentang data

### Filter Interaktif
- Order Date (range), Category, Sub-Category, Segment, Territory
- Semua chart + AI insight otomatis update saat filter berubah

---

## 🤖 Model AI yang Digunakan
- **Default**: `llama-3.1-8b-instant` via Groq API (gratis, cepat)
- Ganti di `config.js` ke `llama-3.3-70b-versatile` untuk kualitas lebih baik
- Bisa switch ke Ollama (lokal) dengan ubah `AI_PROVIDER: 'ollama'`

---

## 📊 Dataset
- **Sumber**: Adventure Works Sales (Microsoft sample database)
- **Periode**: Juli 2001 – Juli 2004
- **Baris**: 18.106 transaksi
- **Kolom**: SalesOrderID, OrderDate, ShipDate, ShipMethod, CustomerID, CustomerName, Segment, CountryRegion, City, Province, Territory, ProductName, SubCategory, Category, Qty, UnitPrice, Sales, Discount, ProductCost, TotalCost, Profit
- **Kategori**: Bikes, Clothing, Accessories
- **Territory**: Australia, Canada, France, Germany, Northwest, Southwest, Northeast, Southeast, Central, United Kingdom

---

## 💡 Insight Utama dari Data
1. **Bikes** mendominasi revenue (~97% total sales) tapi Accessories punya margin terbaik (55-62%)
2. **Caps (Clothing)** memiliki margin negatif (-2.3%) — rugi, perlu review harga/diskon
3. **Mountain Bikes** = produk profit terbesar meski bukan margin tertinggi
4. **Southwest territory** = revenue terbesar secara konsisten
5. **Sales besar ≠ profit tinggi** — terbukti di scatter plot (Clothing: sales kecil, margin negatif)

---

## 📝 Refleksi

### Apa yang Berhasil
- Integrasi D3.js + Groq API berjalan mulus dengan arsitektur modular
- Progressive enhancement: chart muncul dulu, AI narasi menyusul — tidak ada blank screen
- Filter interaktif yang re-trigger seluruh pipeline (data → anomaly → chart → AI) bekerja dengan baik
- Anomaly detection Z-score berhasil flag Caps sebagai outlier margin negatif secara otomatis
- Layout SCR membuat dashboard "bercerita" secara natural dari atas ke bawah

### Apa yang Bisa Diperbaiki
- Quality prompt bisa dioptimasi lebih lanjut untuk model kecil (1b/8b)
- Scatter plot bisa ditambah tooltip lebih kaya (hover = nama produk)
- Perlu error handling lebih robust untuk CORS issues saat demo
- Bisa ditambah animasi transisi D3 saat filter berubah

### Yang Ingin Ditambahkan
Jika ada lebih banyak waktu, saya ingin menambahkan **drill-down per territory** — klik satu territory di chart, semua chart lain otomatis filter ke territory tersebut (brushing & linking). Ini akan membuat eksplorasi data jauh lebih intuitif dan menghilangkan kebutuhan filter dropdown manual.

---

*Dibuat untuk Final Project Data Visualization · 2026*
