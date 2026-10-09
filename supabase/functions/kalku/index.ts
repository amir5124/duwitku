// supabase/functions/kalku/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/^\*---+$/gm, '')
    .replace(/^[\s]*[-*+]\s+/gm, '• ')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

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

    // ✅ Kirim user_id sebagai parameter
    const { data: usage, error: usageError } = await supabaseAdmin.rpc('check_and_use_feature', {
      p_user_id: userId,      // ← tambahkan ini
      p_feature: 'kalku',
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
        JSON.stringify({ error: 'limit_reached', message: 'Kuota Kalku AI harian habis' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { message, transactions, balance, totalIncome, totalExpense } = await req.json()

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const recentTransactions = (transactions || []).slice(0, 10).map((t: any) => ({
      tipe: t.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran',
      jumlah: `Rp${t.amount.toLocaleString()}`,
      kategori: t.category,
      merchant: t.merchant || '-',
      tanggal: new Date(t.timestamp).toLocaleDateString('id-ID'),
    }))

    const systemPrompt = `Kamu adalah **KalKu**, asisten keuangan pribadi yang ramah dan cerdas dalam Bahasa Indonesia.

**Data Keuangan Pengguna:**
- 💰 Saldo saat ini: Rp${(balance || 0).toLocaleString()}
- 📈 Total pemasukan bulan ini: Rp${(totalIncome || 0).toLocaleString()}
- 📉 Total pengeluaran bulan ini: Rp${(totalExpense || 0).toLocaleString()}
- 💵 Tabungan: Rp${((totalIncome || 0) - (totalExpense || 0)).toLocaleString()}

**10 Transaksi Terbaru:**
${JSON.stringify(recentTransactions, null, 2)}

**Aturan PENTING:**
1. Perkenalkan diri sebagai "KalKu"
2. Jawab dengan 3-5 kalimat pendek saja
3. Gunakan bahasa yang ramah dan santai
4. Tambahkan emoji secukupnya (💰, 📊, 💡, ⚠️, ✅)
5. ⚠️ JANGAN gunakan markdown: **bold**, *italic*, # heading, ---, bullet points
6. ⚠️ JANGAN gunakan format list dengan angka atau bullet (-, *, +)
7. Gunakan spasi dan emoji untuk memisahkan ide
8. Tulislah dalam satu paragraf atau kalimat-kalimat pendek`

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
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }]
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Anthropic API error:', errText)
      return new Response(
        JSON.stringify({ error: 'Anthropic API error', detail: errText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    const rawReply = data.content?.[0]?.text ?? 'Maaf, KalKu sedang tidak bisa menjawab saat ini. Coba lagi ya! 🙏'
    const reply = cleanMarkdown(rawReply)

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('KalKu error:', err)
    return new Response(
      JSON.stringify({ error: 'Gagal memproses permintaan', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})