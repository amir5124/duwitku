// supabase/functions/check-pro-status/index.ts
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

    // ─── CEK STATUS PRO ─────────────────────────────────────────────────────
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('is_pro, pro_expires_at')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const isPro = data?.is_pro === true && 
                  (!data?.pro_expires_at || new Date(data.pro_expires_at) > new Date())

    // ─── HITUNG SISA HARI ──────────────────────────────────────────────────
    let daysRemaining = null
    if (isPro && data?.pro_expires_at) {
      const diff = new Date(data.pro_expires_at).getTime() - new Date().getTime()
      daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24))
    }

    return new Response(
      JSON.stringify({
        is_pro: isPro,
        pro_expires_at: data?.pro_expires_at || null,
        days_remaining: daysRemaining,
        is_expired: !isPro && data?.is_pro === true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Check pro status error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})