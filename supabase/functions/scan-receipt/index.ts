// supabase/functions/scan-receipt/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    const userId = extractUserIdFromJWT(authHeader)

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Silakan login terlebih dahulu' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`👤 User ID: ${userId}`)

    // ✅ Cek kuota
    const { data: usage, error: usageError } = await supabaseAdmin.rpc('check_and_use_feature', {
      p_user_id: userId,
      p_feature: 'scan',
      p_free_limit: 3,
    })

    if (usageError) {
      console.error('Usage check error:', usageError)
      return new Response(
        JSON.stringify({ error: 'Gagal cek kuota', detail: usageError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!usage?.allowed) {
      return new Response(
        JSON.stringify({ error: 'limit_reached', message: 'Kuota scan harian habis' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { base64Image } = await req.json()

    if (!base64Image) {
      return new Response(
        JSON.stringify({ error: 'base64Image required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── PROMPT YANG LEBIH DETAIL ──────────────────────────────────────────
    const prompt = `Analisis struk belanja ini dengan teliti. Ekstrak informasi berikut dalam format JSON:

1. Total nominal pembayaran (dalam Rupiah, tanpa titik, hanya angka)
2. Nama toko/merchant
3. Tanggal transaksi (format: YYYY-MM-DD)
4. Daftar item yang dibeli (nama item, harga satuan, quantity jika ada)

Format response sebagai JSON:
{
  "amount": 15000,
  "merchant": "Indomaret",
  "date": "2024-01-15",
  "items": [
    { "name": "Indomie Goreng", "price": 3500, "quantity": 2 },
    { "name": "Telur", "price": 3000, "quantity": 1 }
  ],
  "total_items": 3,
  "confidence": 0.95
}

Jika tidak terbaca dengan jelas, berikan:
{
  "amount": 0,
  "merchant": "",
  "date": "",
  "items": [],
  "total_items": 0,
  "confidence": 0
}

Perhatikan detail kecil seperti:
- Harga satuan vs total
- Diskon atau potongan
- Pajak jika ada
- Nama produk yang terbaca`

    // ─── GUNAKAN MODEL YANG LEBIH BESAR ──────────────────────────────────
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022', // ✅ Pakai Sonnet 3.5 (lebih akurat)
        max_tokens: 2048, // ✅ Lebih banyak token untuk detail items
        temperature: 0.1, // ✅ Lebih rendah untuk akurasi
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
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
    const content = data.content?.[0]?.text || '{"amount":0,"merchant":"","items":[]}'

    let result
    try {
      // Cari JSON dalam response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        result = { amount: 0, merchant: '', items: [] }
      }
    } catch {
      result = { amount: 0, merchant: '', items: [] }
    }

    // ─── VALIDASI & NORMALISASI ────────────────────────────────────────────
    // Amount
    if (typeof result.amount !== 'number' || result.amount < 0) {
      result.amount = 0
    }

    // Merchant
    if (typeof result.merchant !== 'string') {
      result.merchant = ''
    }

    // Items
    if (!Array.isArray(result.items)) {
      result.items = []
    }

    // Format items untuk catatan
    let itemsText = ''
    if (result.items && result.items.length > 0) {
      itemsText = result.items.map((item: any) => {
        const qty = item.quantity || 1
        const price = item.price || 0
        return `${item.name || 'Item'} x${qty} = Rp${(price * qty).toLocaleString()}`
      }).join('\n')
    }

    // ─── RETURN DENGAN ITEMS ──────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        amount: result.amount,
        merchant: result.merchant,
        date: result.date || '',
        items: result.items || [],
        total_items: result.total_items || result.items?.length || 0,
        items_text: itemsText,
        confidence: result.confidence || 0,
        raw: content, // Untuk debugging
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Scan receipt error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})