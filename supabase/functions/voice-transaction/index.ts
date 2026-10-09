// @ts-nocheck
// supabase/functions/voice-transaction/index.ts
// Edge Function untuk parsing voice input dengan Claude AI

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  
  Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
  
    try {
      const { text, userId } = await req.json();
  
      if (!text) {
        return new Response(
          JSON.stringify({ error: 'Text is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
  
      const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
  
      const systemPrompt = `Kamu adalah KalKu, asisten keuangan yang membantu mencatat transaksi dari percakapan user.
  
  **Tugas:**
  1. Analisis teks dari user
  2. Ekstrak informasi transaksi dalam format JSON
  3. Kategorikan dengan tepat
  
  **Format Output (Hanya JSON):**
  {
    "parsed": {
      "type": "EXPENSE" atau "INCOME",
      "amount": number (dalam Rupiah),
      "category": "MAKANAN" | "TRANSPORTASI" | "BELANJA" | "TAGIHAN" | "KESEHATAN" | "PENDIDIKAN" | "HIBURAN" | "TABUNGAN" | "KUOTA" | "KOS" | "HUTANG" | "ZAKAT" | "GAJI" | "BONUS" | "INVESTASI" | "HADIAH" | "FREELANCE" | "BISNIS" | "LAINNYA",
      "merchant": string (nama tempat jika ada),
      "note": string (deskripsi singkat),
      "confidence": number (0-1, seberapa yakin)
    },
    "question": string (jika butuh klarifikasi, null jika tidak),
    "response": string (balasan ke user)
  }
  
  **Kategori yang Tersedia:**
  - MAKANAN: makan, minum, resto, warteg, cafe, kopi
  - TRANSPORTASI: gojek, grab, taxi, bensin, motor, mobil
  - BELANJA: belanja, shopping, baju, sepatu, kebutuhan rumah
  - TAGIHAN: listrik, air, internet, telepon, bpjs
  - KESEHATAN: obat, dokter, rumah sakit, vitamin
  - PENDIDIKAN: buku, kursus, les, sekolah, kuliah
  - HIBURAN: bioskop, game, netflix, liburan
  - KUOTA: pulsa, kuota, paket data
  - KOS: kos, sewa, kontrak
  - HUTANG: bayar hutang, angsuran, cicilan
  - ZAKAT: zakat, sedekah, infak
  - GAJI: gaji, salary, honor
  - BONUS: bonus, thr
  - INVESTASI: investasi, reksadana, saham
  - HADIAH: hadiah, gift
  - FREELANCE: freelance, project, order
  - BISNIS: bisnis, jualan, dagang
  
  **Panduan:**
  - Jika user menyebut "beli", "bayar", "habis" → EXPENSE
  - Jika user menyebut "dapat", "terima", "gajian" → INCOME
  - Nominal otomatis dianggap Rupiah
  - Jika tidak jelas, return "question" dengan pertanyaan klarifikasi
  
  **Contoh Input:**
  "beli makan siang 25 ribu di warteg"
  **Output:**
  {
    "parsed": {
      "type": "EXPENSE",
      "amount": 25000,
      "category": "MAKANAN",
      "merchant": "Warteg",
      "note": "makan siang",
      "confidence": 0.95
    },
    "question": null,
    "response": "Oke! Aku catat pengeluaran Rp25.000 untuk Makanan di Warteg. Ada yang lain?"
  }
  
  **Contoh Input (tidak jelas):**
  "bayar 50 ribu"
  **Output:**
  {
    "parsed": null,
    "question": "Untuk apa pembayaran Rp50.000 ini? (misal: makan, transportasi, tagihan)",
    "response": "Untuk apa pembayaran Rp50.000 ini? Biar aku catat dengan tepat ya 😊"
  }`;
  
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          temperature: 0.3,
          system: systemPrompt,
          messages: [{ role: 'user', content: text }]
        })
      });
  
      if (!response.ok) {
        const errText = await response.text();
        console.error('Claude API error:', errText);
        return new Response(
          JSON.stringify({ error: 'Claude API error', detail: errText }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
  
      const data = await response.json();
      let result = data.content?.[0]?.text || '';
  
      // Bersihkan JSON dari markdown
      result = result.replace(/```json/g, '').replace(/```/g, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        console.error('Failed to parse Claude response:', result);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to parse AI response', 
            raw: result 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
  
      return new Response(
        JSON.stringify({ 
          success: true, 
          ...parsed,
          raw: result 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  
    } catch (err) {
      console.error('Voice transaction error:', err);
      return new Response(
        JSON.stringify({ error: 'Gagal memproses', detail: String(err) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  });