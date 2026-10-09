// supabase/functions/check-usage/index.ts (update)
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

const FREE_LIMITS = {
  voice: 5,
  scan: 3,
  kalku: 3,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, feature } = await req.json()
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const featureName = feature || 'voice'
    const today = new Date().toISOString().split('T')[0]
    const freeLimit = FREE_LIMITS[featureName as keyof typeof FREE_LIMITS] || 5

    // ─── CEK PRO STATUS ──────────────────────────────────────────────────
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('is_pro, pro_expires_at')
      .eq('id', userId)
      .maybeSingle()

    if (userError) {
      console.error('User check error:', userError)
    }

    const isPro = userData?.is_pro === true && 
                  (userData?.pro_expires_at === null || 
                   new Date(userData.pro_expires_at) > new Date())

    // ─── PRO USER → UNLIMITED ────────────────────────────────────────────
    if (isPro) {
      return new Response(
        JSON.stringify({
          userId,
          feature: featureName,
          date: today,
          free_limit: freeLimit,
          used_count: 0,
          remaining: null,
          is_pro: true,
          allowed: true,
          pro_expires_at: userData?.pro_expires_at,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── FREE USER → CEK USAGE ──────────────────────────────────────────
    const { data, error } = await supabaseAdmin
      .from('feature_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('feature', featureName)
      .eq('usage_date', today)
      .maybeSingle()

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const usedCount = data?.count || 0
    const remaining = freeLimit - usedCount

    return new Response(
      JSON.stringify({
        userId,
        feature: featureName,
        date: today,
        free_limit: freeLimit,
        used_count: usedCount,
        remaining: remaining,
        is_pro: false,
        allowed: remaining > 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Check usage error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})