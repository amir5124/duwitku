// supabase/functions/create-payment/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Konfigurasi LinkQu ──────────────────────────────────────────────────────
const LINKQU_CONFIG = {
  clientId: Deno.env.get('LINKQU_CLIENT_ID') || '',
  clientSecret: Deno.env.get('LINKQU_CLIENT_SECRET') || '',
  username: Deno.env.get('LINKQU_USERNAME') || '',
  pin: Deno.env.get('LINKQU_PIN') || '',
  serverKey: Deno.env.get('LINKQU_SERVER_KEY') || '',
  baseUrl: Deno.env.get('LINKQU_BASE_URL') || 'https://api.linkqu.id/linkqu-partner',
}

// ─── AMBIL WEBHOOK URL DARI ENV ─────────────────────────────────────────────
const WEBHOOK_URL = Deno.env.get('PAYMENT_WEBHOOK_URL') || 
                    `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook`

console.log(`🔗 Webhook URL: ${WEBHOOK_URL}`)

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// ─── Helper: Generate Signature ──────────────────────────────────────────────
async function generateSignature(path: string, method: string, data: Record<string, any>, serverKey: string): Promise<string> {
  const rawValue = Object.values(data).join('') + LINKQU_CONFIG.clientId
  const cleaned = rawValue.replace(/[^0-9a-zA-Z]/g, "").toLowerCase()
  
  const message = path + method + cleaned
  
  const encoder = new TextEncoder()
  const keyData = encoder.encode(serverKey)
  const msgData = encoder.encode(message)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  const hashArray = Array.from(new Uint8Array(signature))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  return hashHex
}

// ─── Helper: Format expired dengan Timezone WIB ─────────────────────────────
function formatExpiredWIB(date: Date): string {
  const wibDate = new Date(date.getTime() + 7 * 60 * 60 * 1000)
  
  const year = wibDate.getFullYear()
  const month = String(wibDate.getMonth() + 1).padStart(2, '0')
  const day = String(wibDate.getDate()).padStart(2, '0')
  const hours = String(wibDate.getHours()).padStart(2, '0')
  const minutes = String(wibDate.getMinutes()).padStart(2, '0')
  const seconds = String(wibDate.getSeconds()).padStart(2, '0')
  
  return `${year}${month}${day}${hours}${minutes}${seconds}`
}

// ─── Helper: Format Phone ────────────────────────────────────────────────────
function formatPhone(phone: string): string {
  let formatted = phone.replace(/[^0-9]/g, '')
  if (formatted.startsWith('0')) {
    formatted = '+62' + formatted.substring(1)
  } else if (formatted.startsWith('8')) {
    formatted = '+62' + formatted
  } else if (formatted.startsWith('62') && !formatted.startsWith('+')) {
    formatted = '+' + formatted
  } else if (!formatted.startsWith('+')) {
    formatted = '+62' + formatted
  }
  if (formatted.length < 10) formatted = '+628123456789'
  return formatted
}

// ─── Main Handler ────────────────────────────────────────────────────────────
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

    const { plan, paymentMethod = 'VA', bankCode = '014' } = await req.json()

    if (!plan || !['monthly', 'yearly'].includes(plan)) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan. Choose monthly or yearly' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── HITUNG HARGA ──────────────────────────────────────────────────────
    const amount = plan === 'monthly' ? 49000 : 399000

    // ─── DAPATKAN DATA USER ────────────────────────────────────────────────
    const { data: userData, error: userDataError } = await supabaseAdmin
      .from('users')
      .select('full_name, email, phone')
      .eq('id', user.id)
      .single()

    if (userDataError) {
      console.warn('User data error:', userDataError)
    }

    const customerName = (userData?.full_name || user.email || 'Customer').substring(0, 30)
    const customerEmail = user.email || 'customer@duwitku.com'
    const formattedPhone = formatPhone(userData?.phone || '08123456789')

    // ─── PREPARE PAYLOAD ──────────────────────────────────────────────────
    const partner_reff = `DUWITKU-${Date.now()}-${user.id.substring(0, 8)}`
    
    const expiredDate = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const expiredStr = formatExpiredWIB(expiredDate)

    // ─── AMBIL WEBHOOK URL DARI ENV ──────────────────────────────────────
    const url_callback = WEBHOOK_URL  // ← AMBIL DARI ENV

    const commonData = {
      amount,
      expired: expiredStr,
      partner_reff,
      customer_id: formattedPhone,
      customer_name: customerName,
      customer_email: customerEmail,
    }

    // ─── BUILD PAYLOAD ──────────────────────────────────────────────────────
    let endpoint = '/transaction/create/va'
    let payload: any = {
      ...commonData,
      username: LINKQU_CONFIG.username,
      pin: LINKQU_CONFIG.pin,
      url_callback,  // ← PAKAI DARI ENV
    }

    if (paymentMethod === 'VA') {
      payload.bank_code = bankCode
      const signatureData = {
        amount,
        expired: expiredStr,
        bank_code: bankCode,
        partner_reff,
        customer_id: formattedPhone,
        customer_name: customerName,
        customer_email: customerEmail,
      }
      payload.signature = await generateSignature(endpoint, 'POST', signatureData, LINKQU_CONFIG.serverKey)
    } else {
      endpoint = '/transaction/create/qris'
      payload.signature = await generateSignature(endpoint, 'POST', commonData, LINKQU_CONFIG.serverKey)
    }

    console.log(`🚀 [LINKQU] Creating payment for user ${user.id}`)
    console.log(`📦 Payload:`, JSON.stringify(payload))

    // ─── CALL LINKQU API ──────────────────────────────────────────────────
    const response = await fetch(`${LINKQU_CONFIG.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-id': LINKQU_CONFIG.clientId,
        'client-secret': LINKQU_CONFIG.clientSecret,
      },
      body: JSON.stringify(payload),
    })

    const linkquData = await response.json()
    console.log(`✅ [LINKQU] Response:`, JSON.stringify(linkquData))

    if (!response.ok) {
      throw new Error(`LinkQu error: ${linkquData.response_desc || linkquData.message || JSON.stringify(linkquData)}`)
    }

    if (linkquData.status !== 'SUCCESS') {
      throw new Error(`LinkQu failed: ${linkquData.response_desc || 'Unknown error'}`)
    }

    const vaNumber = linkquData.virtual_account || linkquData.va_number || linkquData.data?.va_number
    const qrisImage = linkquData.imageqris || linkquData.qr_url || linkquData.data?.qr_url

    if (!vaNumber && !qrisImage) {
      throw new Error(`Gagal mendapatkan instruksi pembayaran: ${JSON.stringify(linkquData)}`)
    }

    // ─── SAVE TO DATABASE ──────────────────────────────────────────────────
    const { error: insertError } = await supabaseAdmin
      .from('payment_transactions')
      .insert({
        user_id: user.id,
        order_id: partner_reff,
        plan: plan,
        amount: amount,
        payment_method: paymentMethod === 'VA' ? `VA-${bankCode}` : 'QRIS',
        va_number: vaNumber,
        qris_url: qrisImage,
        payment_status: 'PENDING',
        payment_reff: partner_reff,
        expired_at: expiredDate.toISOString(),
      })

    if (insertError) {
      console.error('Insert payment error:', insertError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: partner_reff,
        plan: plan,
        amount: amount,
        payment_method: paymentMethod,
        va_number: vaNumber,
        qris_url: qrisImage,
        expired_at: expiredDate.toISOString(),
        instructions: paymentMethod === 'VA' 
          ? `Bayar ke rekening virtual ${vaNumber} sebesar Rp${amount.toLocaleString()}`
          : 'Scan QRIS untuk melakukan pembayaran',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('❌ Payment creation error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})