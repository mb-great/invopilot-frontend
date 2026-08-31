/**
 * Bot and Enterprise Security Scanner Detection Helper
 * Prevents automated security prefetchers, email link checkers, and antivirus sandboxes
 * (Proofpoint, Mimecast, Defender, Barracuda, Zoho, Sophos, Google, etc.)
 * from inflating human view metrics.
 */

const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /slurp/i,
  /facebookexternalhit/i,
  /whatsapp/i,
  /telegrambot/i,
  /slackbot/i,
  /twitterbot/i,
  /linkedinbot/i,
  /discordbot/i,
  // Google Security & Proxies
  /google-safety/i,
  /safebrowsing/i,
  /googleimageproxy/i,
  /google-read-aloud/i,
  /feedfetcher/i,
  // Corporate & Custom Domain Email Security / Antivirus Scanners
  /proofpoint/i,
  /mimecast/i,
  /barracuda/i,
  /ironport/i,
  /talos/i,
  /cisco/i,
  /sophos/i,
  /trendmicro/i,
  /fortinet/i,
  /fortimail/i,
  /crowdstrike/i,
  /wildfire/i,
  /paloalto/i,
  /checkpoint/i,
  /sandblast/i,
  /avanan/i,
  /symantec/i,
  /messagelabs/i,
  /kaspersky/i,
  /bitdefender/i,
  /eset/i,
  /avast/i,
  /avg/i,
  /defender/i,
  /smartscreen/i,
  /fireeye/i,
  /forcepoint/i,
  /spamexperts/i,
  /zoho-link-checker/i,
  /zohomailbot/i,
  // Automated Tools / Headless Browsers
  /headlesschrome/i,
  /phantomjs/i,
  // T6 (audit 1.4): the driver frameworks, not just the headless build string.
  // A Playwright or Puppeteer run drives a NORMAL Chrome whose UA contains no
  // "HeadlessChrome" — so every automated visit this project makes was being
  // counted as a person. This repo ships Playwright, so that was our own traffic.
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /webdriver/i,
  /chrome-lighthouse/i,
  /lighthouse/i,
  /preview/i,
  /urlscan/i,
  /virustotal/i,
  /metainspector/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /axios/i,
  /httpclient/i,
  /go-http-client/i,
];

export function isBotOrScanner(userAgent: string | null | undefined, headers?: Headers): boolean {
  if (!userAgent) return true;

  // 1. Check prefetch / prerender headers (sent by email scanners and browsers)
  if (headers) {
    const purpose = headers.get('purpose') || headers.get('sec-purpose') || headers.get('x-purpose') || headers.get('x-moz');
    if (purpose && (purpose.toLowerCase().includes('prefetch') || purpose.toLowerCase().includes('preview'))) {
      return true;
    }
  }

  // 2. Check User-Agent against bot & scanner patterns
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

/**
 * Resolves source channel with HTTP Referer fallback when ?src is omitted or stripped.
 * Supports public providers (Gmail, Outlook, Yahoo, Proton, Zoho) and custom domain work webmails.
 */
export function resolveSource(src?: string | null, referer?: string | null): string {
  if (src && src.trim()) return src.trim().toLowerCase();

  if (referer) {
    const ref = referer.toLowerCase();

    // 1. Major Webmail Providers (Gmail, Outlook, Zoho, Yahoo, Proton, Apple iCloud, Fastmail)
    if (
      ref.includes('mail.google.com') ||
      ref.includes('outlook.live.com') ||
      ref.includes('outlook.office.com') ||
      ref.includes('office365.com') ||
      ref.includes('mail.zoho.') ||
      ref.includes('zoho.com/mail') ||
      ref.includes('mail.yahoo.com') ||
      ref.includes('mail.proton.me') ||
      ref.includes('protonmail.com') ||
      ref.includes('icloud.com') ||
      ref.includes('fastmail.com')
    ) {
      return 'mail';
    }

    // 2. Custom Domain Work Email (e.g. webmail.company.com, mail.company.com, Roundcube, Zimbra, cPanel)
    if (
      ref.includes('webmail.') ||
      ref.includes('/webmail') ||
      ref.includes('mail.') ||
      ref.includes('email.') ||
      ref.includes('roundcube') ||
      ref.includes('squirrelmail') ||
      ref.includes('horde') ||
      ref.includes('zimbra') ||
      ref.includes('/cpsess')
    ) {
      return 'mail';
    }

    // 3. Messaging Apps (WhatsApp, Telegram, Slack, LinkedIn, Twitter/X)
    if (ref.includes('whatsapp') || ref.includes('wa.me')) {
      return 'whatsapp';
    }
    if (ref.includes('telegram') || ref.includes('t.me')) {
      return 'telegram';
    }
    if (ref.includes('slack.com')) {
      return 'slack';
    }
    if (ref.includes('linkedin.com')) {
      return 'linkedin';
    }
    if (ref.includes('twitter.com') || ref.includes('x.com')) {
      return 'twitter';
    }
  }

  return 'directlink';
}
