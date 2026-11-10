import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp.resend.com',
  port: 465,
  secure: true,
  auth: {
    user: 'resend',
    pass: process.env.RESEND_API_KEY ?? '',
  },
})

export async function sendBriefEmail(opts: {
  to: string
  gameweek: number
  appUrl: string
}): Promise<void> {
  const { to, gameweek, appUrl } = opts
  const briefUrl = `${appUrl}/brief`

  await transporter.sendMail({
    from: `Final Ball <briefs@${process.env.EMAIL_FROM_DOMAIN ?? 'finalball.manavpkothari.dev'}>`,
    to,
    subject: `Your GW${gameweek} brief is ready`,
    text: [
      `Your Final Ball brief for Gameweek ${gameweek} is ready.`,
      ``,
      `View it here: ${briefUrl}`,
      ``,
      `--`,
      `Final Ball is an independent tool and is not affiliated with the Premier League or Fantasy Premier League.`,
    ].join('\n'),
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <p style="font-size: 16px; color: #111; margin: 0 0 20px;">
          Your Final Ball brief for <strong>Gameweek ${gameweek}</strong> is ready.
        </p>
        <a href="${briefUrl}"
           style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
          View your brief
        </a>
        <p style="margin-top: 32px; font-size: 12px; color: #888;">
          Final Ball is an independent tool and is not affiliated with the Premier League or Fantasy Premier League.
        </p>
      </div>
    `,
  })
}
