// supabase/functions/insights/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY') || ''
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    // ─── GET: Generate Insights ────────────────────────────────────────────
    if (req.method === 'GET' && path === 'insights') {
      // Ambil data transaksi 3 bulan terakhir
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', threeMonthsAgo.toISOString().split('T')[0])
        .order('date', { ascending: true })

      if (txError) throw txError

      // Ambil data challenges
      const { data: challenges } = await supabase
        .from('challenges')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')

      // Ambil progress user
      const { data: progress } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .single()

      // ─── Call Claude AI ──────────────────────────────────────────────────
      const insightPrompt = buildInsightPrompt(transactions, challenges, progress)

      const claudeResponse = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: insightPrompt,
            },
          ],
        }),
      })

      const claudeData = await claudeResponse.json()
      const insightText = claudeData.content?.[0]?.text || ''

      // ─── Parse Insight dari Claude ──────────────────────────────────────
      const insights = parseInsightResponse(insightText)

      return new Response(JSON.stringify({ 
        insights,
        raw: insightText,
        meta: {
          total_transactions: transactions?.length || 0,
          active_challenges: challenges?.length || 0,
          streak_days: progress?.streak_days || 0,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ─── Build Prompt untuk Claude ──────────────────────────────────────────────
function buildInsightPrompt(transactions: any[], challenges: any[], progress: any) {
  // Hitung statistik
  let totalIncome = 0
  let totalExpense = 0
  const categories: Record<string, number> = {}

  transactions?.forEach(tx => {
    if (tx.type === 'income') {
      totalIncome += tx.amount
    } else {
      totalExpense += tx.amount
      const cat = tx.category || 'other'
      categories[cat] = (categories[cat] || 0) + tx.amount
    }
  })

  const balance = totalIncome - totalExpense

  // Urutkan kategori terbesar
  const sortedCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return `Anda adalah asisten keuangan personal. Berikan insight prediktif dan saran berdasarkan data pengguna berikut:

DATA PENGGUNA:
- Total pemasukan 3 bulan terakhir: Rp ${totalIncome.toLocaleString()}
- Total pengeluaran 3 bulan terakhir: Rp ${totalExpense.toLocaleString()}
- Saldo sekarang: Rp ${balance.toLocaleString()}
- Kategori pengeluaran terbesar: ${sortedCategories.map(([cat, amt]) => `${cat} (Rp ${amt.toLocaleString()})`).join(', ')}
- Jumlah challenge aktif: ${challenges?.length || 0}
- Level: ${progress?.level || 1}
- Poin: ${progress?.total_points || 0}
- Streak: ${progress?.streak_days || 0} hari

Tolong berikan:
1. PREDIKSI: Berdasarkan pola pengeluaran, prediksi saldo 3 bulan ke depan jika kebiasaan tetap
2. REKOMENDASI: 3 saran spesifik untuk menghemat uang berdasarkan kategori terbesar
3. MOTIVASI: Pesan motivasi singkat berdasarkan streak dan level mereka
4. CHALLENGE SUGGESTION: Ide challenge baru yang sesuai dengan kebiasaan mereka

Format JSON:
{
  "prediction": "Prediksi saldo 3 bulan ke depan...",
  "recommendations": ["saran 1", "saran 2", "saran 3"],
  "motivation": "Pesan motivasi...",
  "challenge_suggestion": "Ide challenge..."
}`
}

// ─── Parse Response ─────────────────────────────────────────────────────────
function parseInsightResponse(text: string) {
  try {
    // Coba extract JSON dari text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('Failed to parse insight JSON:', e)
  }

  // Fallback: return raw text dengan struktur default
  return {
    prediction: 'Analisis sedang diproses...',
    recommendations: ['Coba pantau pengeluaran rutin', 'Buat budget mingguan', 'Gunakan cash untuk belanja'],
    motivation: 'Setiap langkah kecil membawa perubahan besar! 💪',
    challenge_suggestion: 'Challenge: Kurangi belanja online 1x minggu'
  }
}