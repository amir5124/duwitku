// supabase/functions/challenges/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
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
    const body = await req.json().catch(() => ({}))

    // ─── GET: List Challenges ──────────────────────────────────────────────
    if (req.method === 'GET' && path === 'challenges') {
      const { data: challenges, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Ambil progress user
      const { data: progress } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .single()

      return new Response(JSON.stringify({ 
        challenges, 
        progress: progress || { level: 1, total_points: 0, streak_days: 0 }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── POST: Create Challenge ────────────────────────────────────────────
    if (req.method === 'POST' && path === 'challenges') {
      const { title, description, type, target_amount, end_date, reward_points } = body

      const { data: challenge, error } = await supabase
        .from('challenges')
        .insert({
          user_id: user.id,
          title,
          description,
          type,
          target_amount,
          end_date,
          reward_points: reward_points || 10,
          start_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ challenge }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── POST: Update Progress ─────────────────────────────────────────────
    if (req.method === 'POST' && path === 'progress') {
      const { challenge_id, amount } = body

      // Update challenge progress
      const { data: challenge, error: challengeError } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challenge_id)
        .eq('user_id', user.id)
        .single()

      if (challengeError) throw challengeError

      const newAmount = (challenge.current_amount || 0) + amount
      const status = newAmount >= challenge.target_amount ? 'completed' : 'active'

      const { data: updated, error: updateError } = await supabase
        .from('challenges')
        .update({
          current_amount: newAmount,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', challenge_id)
        .select()
        .single()

      if (updateError) throw updateError

      // Jika selesai, tambahkan poin
      if (status === 'completed') {
        await addPointsToUser(supabase, user.id, challenge.reward_points)
      }

      return new Response(JSON.stringify({ challenge: updated }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── POST: Daily Check-in ──────────────────────────────────────────────
    if (req.method === 'POST' && path === 'checkin') {
      const today = new Date().toISOString().split('T')[0]

      // Cek apakah sudah check-in hari ini
      const { data: existing } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', user.id)
        .eq('checkin_date', today)
        .single()

      if (existing) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Already checked in today' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Tambah check-in
      const { error: checkinError } = await supabase
        .from('daily_checkins')
        .insert({
          user_id: user.id,
          checkin_date: today,
          points_earned: 5,
        })

      if (checkinError) throw checkinError

      // Update streak
      const { data: progress } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .single()

      let streak = (progress?.streak_days || 0) + 1

      // Jika ada gap, reset streak
      if (progress?.last_activity_date) {
        const lastDate = new Date(progress.last_activity_date)
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        if (lastDate < yesterday) {
          streak = 1
        }
      }

      await supabase
        .from('user_progress')
        .upsert({
          user_id: user.id,
          streak_days: streak,
          total_points: (progress?.total_points || 0) + 5,
          last_activity_date: today,
          updated_at: new Date().toISOString(),
        })

      return new Response(JSON.stringify({ 
        success: true, 
        streak, 
        points_earned: 5 
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

// ─── Helper: Add Points ──────────────────────────────────────────────────────
async function addPointsToUser(supabase: any, userId: string, points: number) {
  const { data: progress } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .single()

  const totalPoints = (progress?.total_points || 0) + points
  const newLevel = Math.floor(totalPoints / 100) + 1

  await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      total_points: totalPoints,
      level: newLevel,
      updated_at: new Date().toISOString(),
    })
}