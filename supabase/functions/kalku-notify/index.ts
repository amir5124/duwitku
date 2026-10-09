// supabase/functions/kalku-notify/index.ts
// Edge Function: kirim FCM push notification proaktif dari KalKu
// Deploy: npx supabase functions deploy kalku-notify --project-ref dvrsgbshhbblfiazhkrb

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Get Google Access Token via Service Account ────────────────────────────────
async function getGoogleAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const toSign = `${headerB64}.${payloadB64}`;

  const privateKey = serviceAccount.private_key
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PRIVATE KEY-----\n', '')
    .replace('\n-----END PRIVATE KEY-----\n', '')
    .replace(/\n/g, '');

  const keyData = Uint8Array.from(atob(privateKey), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(toSign)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const jwt = `${headerB64}.${payloadB64}.${sigB64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

// ── Kirim FCM message via HTTP v1 API ─────────────────────────────────────────
async function sendFCMMessage(params: {
  fcmToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  projectId: string;
  accessToken: string;
}): Promise<boolean> {
  const { fcmToken, title, body, data, projectId, accessToken } = params;

  // Build payload data dengan deep link
  const payloadData = {
    ...data,
    screen: data?.screen || 'home',
    action: data?.action || 'open',
    url: `duwitku://${data?.screen || 'home'}`,
    timestamp: Date.now().toString(),
  };

  const message = {
    message: {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: payloadData,
      android: {
        priority: 'high',
        notification: {
          sound: 'notification', // tanpa ekstensi
          channelId: 'kalku_proactive_v3', // ← samakan dengan app.json
          icon: 'ic_notification',
          color: '#3b6ef5',
          tag: `notification_${Date.now()}`,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'notification.mp3', // iOS custom sound dengan ekstensi
            badge: 1,
            'content-available': 1,
          },
        },
      },
    },
  };

  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('[kalku-notify] FCM error:', err);

      // Parse error untuk detail
      try {
        const errorJson = JSON.parse(err);
        console.error('[kalku-notify] Error code:', errorJson.error?.code);
        console.error('[kalku-notify] Error message:', errorJson.error?.message);
      } catch (e) {
        // ignore
      }
      return false;
    }

    console.log('[kalku-notify] FCM sent successfully ✅');
    return true;
  } catch (error) {
    console.error('[kalku-notify] Send error:', error);
    return false;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, title, body, data, type, screen } = await req.json();

    console.log('[kalku-notify] Received request:', { userId, title, type, screen });

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'userId, title, body wajib diisi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ambil service account dari secrets
    const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountStr) {
      console.error('[kalku-notify] FIREBASE_SERVICE_ACCOUNT not set');
      return new Response(
        JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceAccount = JSON.parse(serviceAccountStr);
    const projectId = serviceAccount.project_id;
    console.log('[kalku-notify] Project ID:', projectId);

    // Ambil FCM token user dari database
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('user_fcm_tokens')
      .select('token, platform')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (tokenError) {
      console.error('[kalku-notify] Token query error:', tokenError);
    }

    if (!tokenData || tokenData.length === 0) {
      console.error('[kalku-notify] No FCM token found for user:', userId);
      return new Response(
        JSON.stringify({ error: 'FCM token tidak ditemukan untuk user ini' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[kalku-notify] Found', tokenData.length, 'tokens');

    // Get Google access token
    const accessToken = await getGoogleAccessToken(serviceAccount);
    console.log('[kalku-notify] Got access token');

    // Kirim ke semua device user
    const results = await Promise.allSettled(
      tokenData.map((row: any) =>
        sendFCMMessage({
          fcmToken: row.token,
          title,
          body,
          data: {
            ...data,
            type: type ?? 'general',
            userId,
            screen: screen || 'home',
          },
          projectId,
          accessToken,
        })
      )
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    console.log('[kalku-notify] Success count:', successCount, 'of', tokenData.length);

    // Log notifikasi ke database
    try {
      await supabaseAdmin.from('kalku_notifications_log').insert({
        user_id: userId,
        title,
        body,
        type: type ?? 'general',
        screen: screen || 'home',
        sent_at: new Date().toISOString(),
        success: successCount > 0,
      });
    } catch (logError) {
      console.warn('[kalku-notify] Log error (ignored):', logError);
    }

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        sent: successCount,
        total: tokenData.length,
        screen: screen || 'home',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[kalku-notify] Error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});