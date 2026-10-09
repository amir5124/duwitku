import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT HELPER
// ─────────────────────────────────────────────────────────────────────────────
function extractUserIdFromJWT(authHeader: string | null): string | null {
  if (!authHeader) return null
  try {
    const token = authHeader.replace('Bearer ', '')
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    return payload.sub || null
  } catch (e) {
    console.error('JWT decode error:', e)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VALID CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
const VALID_CATEGORIES = new Set([
  'MAKANAN', 'TRANSPORTASI', 'BELANJA', 'TAGIHAN', 'KESEHATAN',
  'PENDIDIKAN', 'HIBURAN', 'KUOTA', 'KOS', 'HUTANG', 'ZAKAT',
  'GAJI', 'BONUS', 'INVESTASI', 'FREELANCE', 'BISNIS',
  'TABUNGAN', 'HADIAH', 'KEBUTUHAN', 'LAINNYA',
])

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Anda adalah AI parser transaksi keuangan Indonesia yang sangat pintar.
Tugas: Ekstrak SEMUA transaksi dari teks dan return JSON array.

FORMAT OUTPUT (HANYA JSON array, tanpa teks lain, tanpa markdown):
[{"amount":number,"type":"INCOME"|"EXPENSE","category":string,"merchant":string|null,"description":string,"confidence":number}]

═══════════════════════════════
ATURAN TIPE TRANSAKSI:
═══════════════════════════════
INCOME (uang masuk):
- gaji, gajian, digaji, terima gaji, salary
- bonus, thr, insentif, komisi
- dapat uang, dapet uang, terima uang, dibayar, dibayarin, bayaran
- freelance, fee, honor, honorarium, project selesai
- jualan, laku, omzet, profit, untung, keuntungan, pendapatan
- dagang, bisnis dapat, hasil jualan
- investasi cair, dividen, bunga, return investasi
- hadiah, kado, reward, dapat hadiah
- refund, kembalian uang, uang kembali
- transfer masuk, terima transfer, kiriman

EXPENSE (uang keluar):
- beli, bayar, bayarin, bayar
- makan, minum, jajan, ngemil, nongkrong
- belanja, shopping
- transfer, kirim uang, kirimin
- topup, top up, isi saldo, isi pulsa
- cicil, cicilan, angsuran, kredit
- habis, abis, keluar uang
- traktir, traktiran, traktirannya
- sewa, kontrak, kos, bayar kos
- isi bensin, parkir, bayar tol
- nabung, tabung (uang keluar ke tabungan)
- zakat, sedekah, infak, donasi

═══════════════════════════════
KATEGORI TERSEDIA:
═══════════════════════════════
MAKANAN     → makan, minum, kopi, resto, cafe, warteg, jajan, snack, boba,
               nasi, ayam, soto, bakso, pizza, burger, mie, gorengan, sarapan
TRANSPORTASI → gojek, grab, ojek, taxi, bensin, motor, mobil, kereta, krl,
               mrt, lrt, angkot, parkir, tol, pesawat, bus, bis
BELANJA     → baju, sepatu, tas, celana, kaos, jam tangan, aksesoris,
               shopee, tokopedia, lazada, supermarket, indomaret, alfamart
TAGIHAN     → listrik, pln, air, pdam, internet, wifi, indihome, telepon,
               bpjs, asuransi, tagihan bulanan
KESEHATAN   → obat, dokter, rs, rumah sakit, klinik, apotek, vitamin,
               suplemen, periksa, puskesmas
PENDIDIKAN  → buku, kursus, les, sekolah, kuliah, ukt, spp, workshop,
               seminar, udemy, ruangguru
HIBURAN     → nonton, bioskop, netflix, spotify, game, steam, liburan,
               wisata, hotel, hiburan
KUOTA       → pulsa, kuota, paket data, kartu, telkomsel, xl, indosat, tri
KOS         → kos, kost, kontrakan, sewa rumah, sewa kamar, ngekos
HUTANG      → hutang, utang, bayar hutang, cicilan, angsuran, kredit
ZAKAT       → zakat, sedekah, infak, donasi, sumbangan, amal
GAJI        → gaji, gajian, salary, upah, honor
BONUS       → bonus, thr, insentif, komisi
INVESTASI   → investasi, reksadana, saham, obligasi, dividen, deposito, emas
FREELANCE   → freelance, project, klien, order, desain, coding, konten
BISNIS      → jualan, dagang, bisnis, usaha, omzet, laba
TABUNGAN    → nabung, tabung, tabungan, simpan, celengan
HADIAH      → hadiah, kado, gift, reward, dapat hadiah
KEBUTUHAN   → sabun, shampo, deterjen, sembako, beras, minyak, telur, gula,
               kebutuhan rumah, dapur
LAINNYA     → semua yang tidak masuk kategori lain

═══════════════════════════════
ATURAN NOMINAL:
═══════════════════════════════
- 20rb / 20ribu / 20k  = 20000
- 5jt / 5juta          = 5000000
- 1.5jt                = 1500000
- 200.000 / 200,000    = 200000
- 100rb                = 100000
- 2.5rb                = 2500
- 50k                  = 50000

═══════════════════════════════
ATURAN PENTING:
═══════════════════════════════
1. Ekstrak SEMUA transaksi dari satu teks sekaligus — satu teks bisa ≥2 transaksi
2. Setiap transaksi yang berbeda = objek terpisah dalam array
3. Confidence: 0.95+ sangat yakin | 0.8 yakin | 0.6 cukup | <0.5 tidak yakin
4. merchant: nama tempat/toko jika disebutkan, null jika tidak ada
5. description: deskripsi singkat max 50 karakter
6. Jika teks obrolan biasa tanpa transaksi/nominal → return []
7. HANYA JSON array, tidak ada teks lain sama sekali

═══════════════════════════════
CONTOH:
═══════════════════════════════
Input: "gaji 3jt beli makan siang 25rb di warteg sama bayar listrik 150rb"
Output:
[
  {"amount":3000000,"type":"INCOME","category":"GAJI","merchant":null,"description":"gaji bulanan","confidence":0.97},
  {"amount":25000,"type":"EXPENSE","category":"MAKANAN","merchant":"Warteg","description":"makan siang","confidence":0.96},
  {"amount":150000,"type":"EXPENSE","category":"TAGIHAN","merchant":null,"description":"bayar listrik","confidence":0.95}
]

Input: "dapet bonus thr 2jt sama freelance project 500rb"
Output:
[
  {"amount":2000000,"type":"INCOME","category":"BONUS","merchant":null,"description":"bonus thr","confidence":0.97},
  {"amount":500000,"type":"INCOME","category":"FREELANCE","merchant":null,"description":"freelance project","confidence":0.95}
]

Input: "halo apa kabar"
Output: []

Input: "transfer ke adek 200rb"
Output:
[{"amount":200000,"type":"EXPENSE","category":"LAINNYA","merchant":null,"description":"transfer ke adek","confidence":0.90}]`

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth ───────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    const userId = extractUserIdFromJWT(authHeader)

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Silakan login terlebih dahulu' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Request body ───────────────────────────────────────────────────────
    const body = await req.json()
    const { text, hints } = body

    if (!text || typeof text !== 'string' || text.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: 'Teks terlalu pendek' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const trimmed = text.trim()
    console.log(`📝 Parsing: "${trimmed}"`)
    if (hints) console.log(`💡 Hints:`, hints)

    // ── API Key ────────────────────────────────────────────────────────────
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Build user message dengan hints ────────────────────────────────────
    let userMessage = `Teks: "${trimmed}"`

    if (hints) {
      const hintLines = [
        hints.typeHint,
        hints.categoryHint,
        hints.nominalHint,
      ].filter(Boolean).join('\n')

      if (hintLines) {
        userMessage += `\n\nHINT (gunakan sebagai referensi tambahan):\n${hintLines}`
      }
    }

    // ── Call Claude API ────────────────────────────────────────────────────
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        temperature: 0.1,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Claude API error:', errText)
      return new Response(
        JSON.stringify({ error: 'Claude API error', detail: errText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    const rawText: string = data.content?.[0]?.text ?? '[]'

    console.log('📤 Claude raw:', rawText.substring(0, 300))

    // ── Parse JSON ─────────────────────────────────────────────────────────
    let parsed: any[]
    try {
      const clean = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim()

      parsed = JSON.parse(clean)

      if (!Array.isArray(parsed)) {
        // Coba ekstrak array dari dalam teks
        const match = clean.match(/\[[\s\S]*\]/)
        if (match) {
          parsed = JSON.parse(match[0])
        } else {
          throw new Error('Response bukan array')
        }
      }
    } catch (parseErr) {
      console.error('Parse error:', parseErr, 'Raw:', rawText.substring(0, 200))
      return new Response(
        JSON.stringify({ error: 'Gagal parse response Claude', raw: rawText.substring(0, 300) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Validasi & format hasil ────────────────────────────────────────────
    const result = parsed
      .filter((item: any) => {
        const amount = typeof item.amount === 'number' ? Math.abs(item.amount) : 0
        return amount >= 100 // minimum Rp100
      })
      .map((item: any) => {
        const category = VALID_CATEGORIES.has(item.category) ? item.category : 'LAINNYA'
        const type = item.type === 'INCOME' ? 'INCOME' : 'EXPENSE'
        const confidence = typeof item.confidence === 'number'
          ? Math.min(Math.max(item.confidence, 0), 1)
          : 0.7

        return {
          amount: Math.abs(Math.round(item.amount)),
          type,
          category,
          merchant: item.merchant && String(item.merchant).trim() !== 'null'
            ? String(item.merchant).trim().substring(0, 50)
            : undefined,
          description: String(item.description || '').substring(0, 100),
          confidence,
        }
      })

    // ── Return ─────────────────────────────────────────────────────────────
    if (result.length === 0) {
      console.log('ℹ️ No valid transactions detected')
      return new Response(
        JSON.stringify({ transactions: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Parsed ${result.length} transactions:`, result.map(r => `${r.type} ${r.amount} ${r.category}`).join(' | '))

    return new Response(
      JSON.stringify({ transactions: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Fatal error:', err)
    return new Response(
      JSON.stringify({ error: 'Gagal memproses', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})