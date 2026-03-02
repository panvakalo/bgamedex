import { Resend } from 'resend'

let resend: Resend | null = null

function getClient(): Resend | null {
  if (!resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) return null
    resend = new Resend(key)
  }
  return resend
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const client = getClient()
  if (!client) {
    console.warn('RESEND_API_KEY not set — skipping verification email')
    return
  }

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
  const verifyUrl = `${frontendUrl}/auth/verify?token=${token}`
  const from = process.env.EMAIL_FROM ?? 'Bgamedex <onboarding@resend.dev>'

  await client.emails.send({
    from,
    to,
    subject: 'Verify your Bgamedex email',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 700; color: #111; margin-bottom: 8px;">Welcome to Bgamedex</h1>
        <p style="font-size: 16px; color: #555; line-height: 1.5; margin-bottom: 24px;">
          Click the button below to verify your email address.
        </p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 32px; background-color: #6366f1; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Verify Email
        </a>
        <p style="font-size: 13px; color: #999; margin-top: 32px; line-height: 1.4;">
          This link expires in 24 hours. If you didn't create an account, you can ignore this email.
        </p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const client = getClient()
  if (!client) {
    console.warn('RESEND_API_KEY not set — skipping password reset email')
    return
  }

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
  const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}`
  const from = process.env.EMAIL_FROM ?? 'Bgamedex <onboarding@resend.dev>'

  await client.emails.send({
    from,
    to,
    subject: 'Reset your Bgamedex password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 700; color: #111; margin-bottom: 8px;">Reset your password</h1>
        <p style="font-size: 16px; color: #555; line-height: 1.5; margin-bottom: 24px;">
          Click the button below to set a new password for your account.
        </p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background-color: #6366f1; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Reset Password
        </a>
        <p style="font-size: 13px; color: #999; margin-top: 32px; line-height: 1.4;">
          This link expires in 1 hour. If you didn't request a password reset, you can ignore this email.
        </p>
      </div>
    `,
  })
}
