import { NextRequest, NextResponse } from 'next/server';

type HealthSnapshot = {
  healthScore: number;
  biologicalAge: number;
  realAge: number;
  name?: string;
};

type TimeCapsuleRequest = {
  email?: string;
  message?: string;
  sendAt?: string;
  deliverNow?: boolean;
  healthSnapshot?: HealthSnapshot;
};

export async function POST(req: NextRequest) {
  try {
    const { email, message, sendAt, deliverNow = false, healthSnapshot } = (await req.json()) as TimeCapsuleRequest;

    if (!email || !message || (!deliverNow && !sendAt)) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }

    const now = new Date();
    const sendDate = deliverNow ? now : new Date(sendAt as string);

    if (!deliverNow && (Number.isNaN(sendDate.getTime()) || sendDate <= now)) {
      return NextResponse.json({ error: 'Date must be in the future' }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'The server cannot see RESEND_API_KEY. Add it to .env.local, then restart the Next.js server.'
        },
        { status: 500 }
      );
    }

    const formattedDate = formatDate(sendDate);
    const safeMessage = escapeHtml(message.trim()).replace(/\n/g, '<br />');
    const safeName = healthSnapshot?.name ? escapeHtml(healthSnapshot.name) : '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const from = process.env.RESEND_FROM_EMAIL || 'FutureMe <onboarding@resend.dev>';

    const emailPayload: Record<string, unknown> = {
      from,
      to: [email.trim()],
      subject: deliverNow
        ? 'A message from your present self'
        : `A message from your past self - delivered on ${formattedDate}`,
      html: buildEmailHtml({
        messageHtml: safeMessage,
        formattedDate,
        deliverNow,
        appUrl,
        safeName,
        healthSnapshot
      })
    };

    if (!deliverNow) {
      emailPayload.scheduled_at = sendDate.toISOString();
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    const data = (await response.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null;

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.message || data?.name || 'Failed to schedule message' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    console.error('Time capsule error:', err);
    return NextResponse.json({ error: 'Failed to schedule message' }, { status: 500 });
  }
}

function buildEmailHtml({
  messageHtml,
  formattedDate,
  deliverNow,
  appUrl,
  safeName,
  healthSnapshot
}: {
  messageHtml: string;
  formattedDate: string;
  deliverNow: boolean;
  appUrl: string;
  safeName: string;
  healthSnapshot?: HealthSnapshot;
}) {
  const writtenDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>A message from your past self</title>
</head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:rgba(0,163,137,0.15);border:1px solid rgba(0,163,137,0.3);margin-bottom:16px;">
        <span style="font-size:24px;">&infin;</span>
      </div>
      <p style="color:#00a389;font-size:12px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;margin:0;">FutureMe</p>
      <h1 style="color:#ffffff;font-size:28px;font-weight:700;margin:12px 0 0;line-height:1.3;">
        A message from your past self
      </h1>
      <p style="color:#64748b;font-size:14px;margin:8px 0 0;">
        Written on ${writtenDate} &middot; Delivered today
      </p>
    </div>

    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-left:4px solid #00a389;border-radius:16px;padding:32px;margin-bottom:24px;">
      <p style="color:#94a3b8;font-size:12px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 16px;">Your message</p>
      <p style="color:#e2e8f0;font-size:17px;line-height:1.7;margin:0;">${messageHtml}</p>
    </div>

    ${healthSnapshot ? `
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="color:#64748b;font-size:12px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 20px;">Your health snapshot when you wrote this</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div style="text-align:center;background:rgba(0,163,137,0.08);border:1px solid rgba(0,163,137,0.2);border-radius:12px;padding:16px;">
          <p style="color:#00a389;font-size:32px;font-weight:700;margin:0;line-height:1;">${healthSnapshot.healthScore}</p>
          <p style="color:#64748b;font-size:11px;margin:6px 0 0;text-transform:uppercase;letter-spacing:0.1em;">Health score</p>
        </div>
        <div style="text-align:center;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">
          <p style="color:#ffffff;font-size:32px;font-weight:700;margin:0;line-height:1;">${healthSnapshot.biologicalAge}</p>
          <p style="color:#64748b;font-size:11px;margin:6px 0 0;text-transform:uppercase;letter-spacing:0.1em;">Biological age</p>
        </div>
      </div>
      ${safeName ? `<p style="color:#475569;font-size:13px;margin:16px 0 0;text-align:center;">Profile: ${safeName}, age ${healthSnapshot.realAge}</p>` : ''}
    </div>
    ` : ''}

    <div style="text-align:center;margin-bottom:32px;">
      <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 20px;">
        How does your life compare to what you imagined?<br>Check your current health snapshot on FutureMe.
      </p>
      <a href="${appUrl}/dashboard"
         style="display:inline-block;background:#00a389;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:100px;font-weight:600;font-size:15px;">
        See my health today &rarr;
      </a>
    </div>

    <p style="color:#334155;font-size:12px;text-align:center;margin:0;">
      ${deliverNow ? 'Sent immediately' : `Scheduled for ${formattedDate}`} with care by FutureMe
    </p>
  </div>
</body>
</html>
  `;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
