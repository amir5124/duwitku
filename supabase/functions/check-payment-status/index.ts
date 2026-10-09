// supabase/functions/check-payment-status/index.ts
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { order_id } = await req.json()

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── GET PAYMENT STATUS ──────────────────────────────────────────────────
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payment_transactions')
      .select('*')
      .eq('order_id', order_id)
      .eq('user_id', user.id)
      .single()

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Payment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── CEK APAKAH PRO SUDAH AKTIF ──────────────────────────────────────
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('is_pro, pro_expires_at')
      .eq('id', user.id)
      .single()

    return new Response(
      JSON.stringify({
        order_id: payment.order_id,
        payment_status: payment.payment_status,
        is_pro: userData?.is_pro || false,
        pro_expires_at: userData?.pro_expires_at || null,
        plan: payment.plan,
        amount: payment.amount,
        va_number: payment.va_number,
        qris_url: payment.qris_url,
        expired_at: payment.expired_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('❌ Check status error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})