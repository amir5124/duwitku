// supabase/functions/classify-transaction/index.ts
// Edge Function untuk klasifikasi transaksi dengan Claude AI

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  
  // Daftar kategori yang tersedia
  const AVAILABLE_CATEGORIES = [
    'MAKANAN', 'TRANSPORTASI', 'BELANJA', 'TAGIHAN', 'KESEHATAN', 
    'PENDIDIKAN', 'HIBURAN', 'TABUNGAN', 'KUOTA', 'KOS', 
    'HUTANG', 'ZAKAT', 'GAJI', 'BONUS', 'INVESTASI', 
    'HADIAH', 'FREELANCE', 'BISNIS', 'LAINNYA'
  ];
  
  // Keyword mapping untuk fallback (jika AI gagal)
  const KEYWORD_MAP: Record<string, { category: string; type: 'INCOME' | 'EXPENSE' }> = {
    // Pengeluaran
    'makan': { category: 'MAKANAN', type: 'EXPENSE' },
    'resto': { category: 'MAKANAN', type: 'EXPENSE' },
    'warteg': { category: 'MAKANAN', type: 'EXPENSE' },
    'cafe': { category: 'MAKANAN', type: 'EXPENSE' },
    'kopi': { category: 'MAKANAN', type: 'EXPENSE' },
    'gojek': { category: 'TRANSPORTASI', type: 'EXPENSE' },
    'grab': { category: 'TRANSPORTASI', type: 'EXPENSE' },
    'bensin': { category: 'TRANSPORTASI', type: 'EXPENSE' },
    'transport': { category: 'TRANSPORTASI', type: 'EXPENSE' },
    'belanja': { category: 'BELANJA', type: 'EXPENSE' },
    'shopping': { category: 'BELANJA', type: 'EXPENSE' },
    'pempers': { category: 'BELANJA', type: 'EXPENSE' },
    'popok': { category: 'BELANJA', type: 'EXPENSE' },
    'listrik': { category: 'TAGIHAN', type: 'EXPENSE' },
    'air': { category: 'TAGIHAN', type: 'EXPENSE' },
    'internet': { category: 'TAGIHAN', type: 'EXPENSE' },
    'telepon': { category: 'TAGIHAN', type: 'EXPENSE' },
    'bpjs': { category: 'TAGIHAN', type: 'EXPENSE' },
    'obat': { category: 'KESEHATAN', type: 'EXPENSE' },
    'dokter': { category: 'KESEHATAN', type: 'EXPENSE' },
    'buku': { category: 'PENDIDIKAN', type: 'EXPENSE' },
    'kursus': { category: 'PENDIDIKAN', type: 'EXPENSE' },
    'bioskop': { category: 'HIBURAN', type: 'EXPENSE' },
    'netflix': { category: 'HIBURAN', type: 'EXPENSE' },
    'pulsa': { category: 'KUOTA', type: 'EXPENSE' },
    'kuota': { category: 'KUOTA', type: 'EXPENSE' },
    'kos': { category: 'KOS', type: 'EXPENSE' },
    'sewa': { category: 'KOS', type: 'EXPENSE' },
    'hutang': { category: 'HUTANG', type: 'EXPENSE' },
    'angsuran': { category: 'HUTANG', type: 'EXPENSE' },
    'cicilan': { category: 'HUTANG', type: 'EXPENSE' },
    'zakat': { category: 'ZAKAT', type: 'EXPENSE' },
    'sedekah': { category: 'ZAKAT', type: 'EXPENSE' },
    // Pemasukan
    'gaji': { category: 'GAJI', type: 'INCOME' },
    'salary': { category: 'GAJI', type: 'INCOME' },
    'honor': { category: 'GAJI', type: 'INCOME' },
    'bonus': { category: 'BONUS', type: 'INCOME' },
    'thr': { category: 'BONUS', type: 'INCOME' },
    'investasi': { category: 'INVESTASI', type: 'INCOME' },
    'reksadana': { category: 'INVESTASI', type: 'INCOME' },
    'saham': { category: 'INVESTASI', type: 'INCOME' },
    'freelance': { category: 'FREELANCE', type: 'INCOME' },
    'project': { category: 'FREELANCE', type: 'INCOME' },
    'bisnis': { category: 'BISNIS', type: 'INCOME' },
    'jualan': { category: 'BISNIS', type: 'INCOME' },
  };
  
  // Fungsi ekstrak nominal (fallback)
  function extractAmount(text: string): number {
    const patterns = [
      /(\d+[\.,]?\d*)\s*(?:rb|ribu|k|kilo)/i,
      /(\d+[\.,]?\d*)\s*(?:jt|juta|juta-an)/i,
      /(?:rp|Rp|IDR)\s*(\d+[\.,]?\d*)/i,
      /(?:sebesar|sekitar|±)\s*(\d+[\.,]?\d*)/i,
      /(\d{1,3}(?:[.,]\d{3})*)/i,
      /(\d+)/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let val = parseFloat(match[1].replace(/\./g, '').replace(/,/g, '.'));
        if (isNaN(val)) continue;
        
        const context = text.substring(
          Math.max(0, (match.index || 0) - 20),
          Math.min(text.length, (match.index || 0) + match[0].length + 20)
        );
        const lowerContext = context.toLowerCase();
        
        if (lowerContext.includes('rb') || lowerContext.includes('ribu') || lowerContext.includes('k') || lowerContext.includes(' kilo')) {
          val *= 1000;
        }
        if (lowerContext.includes('jt') || lowerContext.includes('juta')) {
          val *= 1000000;
        }
        
        if (val > 0) {
          return Math.round(val);
        }
      }
    }
    return 0;
  }
  
  // Fungsi ekstrak merchant (fallback)
  function extractMerchant(text: string): string | null {
    const patterns = [
      /(?:di|dari|ke|beli|pesan|ambil)\s+([a-z][a-z\s]{2,20})(?:\s+(?:sebesar|sekitar|total|bayar|ambil|makan|minum)|\s*$)/i,
      /(?:di|dari)\s+([a-z][a-z\s]{2,20})$/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let merchant = match[1].trim();
        merchant = merchant.replace(/\b(sebesar|sekitar|total|bayar|ambil|makan|minum|beli|pesan|dari|ke)\b/gi, '').trim();
        if (merchant.length > 2 && merchant.length < 50) {
          return merchant;
        }
      }
    }
    return null;
  }
  
  // Fallback parsing (rule-based)
  function fallbackParse(text: string) {
    const lower = text.toLowerCase();
    
    // Deteksi tipe
    const expenseKeywords = ['beli', 'bayar', 'habis', 'keluar', 'belanja', 'pesan', 'ambil'];
    const incomeKeywords = ['gaji', 'dapat', 'terima', 'bonus', 'masuk', 'income', 'pemasukan'];
    
    const isExpense = expenseKeywords.some(kw => lower.includes(kw));
    const isIncome = incomeKeywords.some(kw => lower.includes(kw));
    
    let type: 'INCOME' | 'EXPENSE' = isIncome && !isExpense ? 'INCOME' : 'EXPENSE';
    let category = 'LAINNYA';
    
    // Cari kategori dari keyword
    for (const [keyword, mapping] of Object.entries(KEYWORD_MAP)) {
      if (lower.includes(keyword)) {
        category = mapping.category;
        if (mapping.type === 'INCOME' && !isExpense) {
          type = 'INCOME';
        }
        break;
      }
    }
    
    const amount = extractAmount(text);
    const merchant = extractMerchant(text);
    
    return {
      type,
      amount,
      category,
      merchant,
      confidence: 0.5,
    };
  }
  
  Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
  
    try {
      const { text } = await req.json();
  
      if (!text || typeof text !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Text is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
  
      const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
      if (!apiKey) {
        console.warn('⚠️ ANTHROPIC_API_KEY not set, using fallback');
        
        // Fallback tanpa AI
        const fallback = fallbackParse(text);
        return new Response(
          JSON.stringify({ 
            success: true, 
            ...fallback,
            using_ai: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
  
      const systemPrompt = `Kamu adalah KalKu, asisten keuangan yang membantu mengklasifikasikan transaksi dari percakapan user.
  
  **Tugas:**
  1. Analisis teks dari user
  2. Tentukan apakah ini PEMASUKAN atau PENGELUARAN
  3. Pilih kategori yang paling sesuai dari daftar yang tersedia
  4. Ekstrak nominal dalam Rupiah
  5. Ekstrak nama merchant/toko jika ada
  
  **Kategori yang Tersedia:**
  ${AVAILABLE_CATEGORIES.join(', ')}
  
  **Panduan Kategori:**
  - MAKANAN: makan, minum, resto, warteg, cafe, kopi, teh, mie, nasi
  - TRANSPORTASI: gojek, grab, taxi, bensin, motor, mobil, transport
  - BELANJA: belanja, shopping, baju, sepatu, pempers, popok, peralatan rumah
  - TAGIHAN: listrik, air, internet, telepon, bpjs, token, pln, pdam
  - KESEHATAN: obat, dokter, rumah sakit, vitamin, apotek
  - PENDIDIKAN: buku, kursus, les, sekolah, kuliah, seminar
  - HIBURAN: bioskop, game, netflix, liburan, wisata, konser
  - KUOTA: pulsa, kuota, paket data
  - KOS: kos, sewa, kontrak, rumah, apartemen
  - HUTANG: hutang, angsuran, cicilan, kpr
  - ZAKAT: zakat, sedekah, infak, donasi
  - GAJI: gaji, salary, honor, upah
  - BONUS: bonus, thr, reward, komisi
  - INVESTASI: investasi, reksadana, saham, emas, crypto
  - FREELANCE: freelance, project, jasa
  - BISNIS: bisnis, jualan, dagang, usaha
  
  **Format Output (Hanya JSON, tanpa markdown):**
  {
    "type": "EXPENSE" atau "INCOME",
    "amount": number (dalam Rupiah),
    "category": "nama_kategori",
    "merchant": "nama_toko" atau null,
    "note": "deskripsi singkat",
    "confidence": 0.0-1.0
  }
  
  **Contoh:**
  Input: "beli pempers 10 rb di indomaret"
  Output: {"type":"EXPENSE","amount":10000,"category":"BELANJA","merchant":"Indomaret","note":"beli pempers","confidence":0.95}
  
  Input: "gajian 5 juta"
  Output: {"type":"INCOME","amount":5000000,"category":"GAJI","merchant":null,"note":"gajian","confidence":0.98}
  
  Input: "bayar listrik 200 ribu"
  Output: {"type":"EXPENSE","amount":200000,"category":"TAGIHAN","merchant":null,"note":"bayar listrik","confidence":0.97}
  
  **PENTING:** 
  - Hanya output JSON, tidak ada teks lain
  - Nominal otomatis dalam Rupiah
  - Jika tidak yakin, tetap pilih kategori terbaik dan turunkan confidence`;
  
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 512,
          temperature: 0.1,
          system: systemPrompt,
          messages: [{ role: 'user', content: text }]
        })
      });
  
      if (!response.ok) {
        const errText = await response.text();
        console.error('Claude API error:', errText);
        
        // Fallback jika AI gagal
        const fallback = fallbackParse(text);
        return new Response(
          JSON.stringify({ 
            success: true, 
            ...fallback,
            using_ai: false,
            ai_error: errText,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
  
      const data = await response.json();
      let result = data.content?.[0]?.text || '';
      
      // Bersihkan JSON
      result = result.replace(/```json/g, '').replace(/```/g, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        console.error('Failed to parse Claude response:', result);
        const fallback = fallbackParse(text);
        return new Response(
          JSON.stringify({ 
            success: true, 
            ...fallback,
            using_ai: false,
            parse_error: String(e),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
  
      // Validasi dan default value
      const responseData = {
        success: true,
        type: parsed.type || 'EXPENSE',
        amount: parsed.amount || extractAmount(text),
        category: parsed.category || 'LAINNYA',
        merchant: parsed.merchant || extractMerchant(text),
        note: parsed.note || text.slice(0, 100),
        confidence: parsed.confidence || 0.7,
        using_ai: true,
      };
  
      return new Response(
        JSON.stringify(responseData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  
    } catch (err) {
      console.error('Classification error:', err);
      
      // Fallback jika ada error
      try {
        const { text } = await req.json();
        const fallback = fallbackParse(text);
        return new Response(
          JSON.stringify({ 
            success: true, 
            ...fallback,
            using_ai: false,
            error: String(err),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Gagal memproses permintaan',
            using_ai: false,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
  });