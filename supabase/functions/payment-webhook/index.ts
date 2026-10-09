// supabase/functions/payment-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── PERBAIKAN: Hapus authorization dari CORS headers ──────────────────────
// Webhook tidak butuh Authorization header

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// ─── Helper: Verifikasi Signature LinkQu ────────────────────────────────────
async function verifySignature(payload: any, signature: string, serverKey: string): Promise<boolean> {
  try {
    // Implementasi verifikasi signature sesuai dokumentasi LinkQu
    // Untuk sementara return true, tapi sebaiknya diimplementasikan
    // jika LinkQu menyediakan signature verification
    
    // Contoh implementasi sederhana:
    // const raw = Object.values(payload).join('') + serverKey
    // const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
    // const computed = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
    // return computed === signature
    
    return true // Sementara true untuk testing
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

// ─── Helper: Send Notification ──────────────────────────────────────────────
async function sendNotification(userId: string, payload: { title: string; body: string; type: string; screen: string }) {
  try {
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/kalku-notify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          userId,
          title: payload.title,
          body: payload.body,
          type: payload.type,
          screen: payload.screen,
        }),
      }
    )
    return await response.json()
  } catch (error) {
    console.error('Send notification error:', error)
    return null
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  // ─── CORS ──────────────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ─── READ BODY ──────────────────────────────────────────────────────────
    let body
    try {
      body = await req.json()
    } catch (parseError) {
      console.error('❌ [WEBHOOK] Invalid JSON:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📥 [WEBHOOK] Incoming:', JSON.stringify(body, null, 2))

    // ─── EKSTRAK DATA ──────────────────────────────────────────────────────
    // Sesuaikan dengan format webhook dari LinkQu
    const { partner_reff, status, response_code, signature } = body

    if (!partner_reff) {
      console.warn('⚠️ [WEBHOOK] Missing partner_reff')
      return new Response(
        JSON.stringify({ error: 'partner_reff required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── VERIFIKASI SIGNATURE (Opsional tapi disarankan) ──────────────────
    if (signature) {
      const isValid = await verifySignature(body, signature, Deno.env.get('LINKQU_SERVER_KEY') || '')
      if (!isValid) {
        console.warn('⚠️ [WEBHOOK] Invalid signature')
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ─── CEK STATUS ─────────────────────────────────────────────────────────
    const statusUpper = (status || '').toUpperCase()
    const isSuccess = ['SUCCESS', 'SETTLED', 'PAID'].includes(statusUpper) || 
                      response_code === '00' || 
                      response_code === '0'

    if (!isSuccess) {
      console.log(`⏳ [WEBHOOK] Status: ${statusUpper} (${response_code}) - ignored`)
      return new Response(
        JSON.stringify({ 
          message: 'Ignored - not success',
          status: statusUpper,
          response_code: response_code 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ [WEBHOOK] Payment SUCCESS for ${partner_reff}`)

    // ─── GET PAYMENT TRANSACTION ──────────────────────────────────────────
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payment_transactions')
      .select('*')
      .eq('order_id', partner_reff)
      .maybeSingle()

    if (paymentError) {
      console.error('❌ [WEBHOOK] DB error:', paymentError)
      return new Response(
        JSON.stringify({ error: paymentError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!payment) {
      console.warn(`⚠️ [WEBHOOK] Payment not found: ${partner_reff}`)
      return new Response(
        JSON.stringify({ error: 'Payment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── CEK DUPLIKAT ──────────────────────────────────────────────────────
    if (payment.payment_status === 'SUCCESS') {
      console.log(`⚠️ [WEBHOOK] Already processed: ${partner_reff}`)
      return new Response(
        JSON.stringify({ message: 'Already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── UPDATE PAYMENT STATUS ────────────────────────────────────────────
    const { error: updatePaymentError } = await supabaseAdmin
      .from('payment_transactions')
      .update({
        payment_status: 'SUCCESS',
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', partner_reff)

    if (updatePaymentError) {
      console.error('❌ [WEBHOOK] Update payment error:', updatePaymentError)
      return new Response(
        JSON.stringify({ error: updatePaymentError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── ACTIVATE PRO USER ─────────────────────────────────────────────────
    const now = new Date()
    let expiresAt = new Date(now)
    
    if (payment.plan === 'monthly') {
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    } else if (payment.plan === 'yearly') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    } else {
      // Default: 1 bulan
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    }

    // ─── UPDATE USER ──────────────────────────────────────────────────────
    const { error: updateUserError } = await supabaseAdmin
      .from('users')
      .update({
        is_pro: true,
        pro_expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', payment.user_id)

    if (updateUserError) {
      console.error('❌ [WEBHOOK] Update user error:', updateUserError)
      
      // Rollback payment status jika gagal
      await supabaseAdmin
        .from('payment_transactions')
        .update({
          payment_status: 'PENDING',
          updated_at: now.toISOString(),
        })
        .eq('order_id', partner_reff)
      
      return new Response(
        JSON.stringify({ error: updateUserError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── SYNC TO AUTH USERS ──────────────────────────────────────────────
    try {
      await supabaseAdmin.auth.admin.updateUserById(
        payment.user_id,
        {
          user_metadata: {
            is_pro: true,
            pro_expires_at: expiresAt.toISOString(),
          }
        }
      )
    } catch (authError) {
      console.warn('⚠️ [WEBHOOK] Auth sync error:', authError)
      // Tidak perlu rollback karena user sudah di-update
    }

    // ─── SEND NOTIFICATION ─────────────────────────────────────────────────
    try {
      await sendNotification(payment.user_id, {
        title: '🎉 Upgrade Pro Berhasil!',
        body: `Pro aktif sampai ${expiresAt.toLocaleDateString('id-ID')}. Nikmati semua fitur premium!`,
        type: 'upgrade_success',
        screen: '/profile',
      })
    } catch (notifyError) {
      console.warn('⚠️ [WEBHOOK] Notification error:', notifyError)
      // Tidak perlu rollback, notifikasi bisa gagal
    }

    console.log(`✅ [WEBHOOK] User ${payment.user_id} upgraded to Pro until ${expiresAt.toISOString()}`)

    return new Response(
      JSON.stringify({
        success: true,
        user_id: payment.user_id,
        pro_expires_at: expiresAt.toISOString(),
        message: `Pro aktif sampai ${expiresAt.toLocaleDateString('id-ID')}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('❌ [WEBHOOK] Error:', err)
    return new Response(
      JSON.stringify({ 
        error: String(err),
        message: 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})