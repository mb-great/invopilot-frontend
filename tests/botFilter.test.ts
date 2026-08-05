import { describe, it, expect } from 'vitest';
import { isBotOrScanner, resolveSource } from '../src/lib/tracking/botFilter';

describe('Bot & Email Scanner Filter', () => {
  it('should detect email security crawlers, antivirus sandboxes and image proxies', () => {
    expect(isBotOrScanner('GoogleImageProxy')).toBe(true);
    expect(isBotOrScanner('Mozilla/5.0 (compatible; Google-Safety/1.0)')).toBe(true);
    expect(isBotOrScanner('Proofpoint/1.0')).toBe(true);
    expect(isBotOrScanner('Mimecast-LinkProtect/1.0')).toBe(true);
    expect(isBotOrScanner('Barracuda-Email-Security/1.0')).toBe(true);
    expect(isBotOrScanner('Sophos-Web-Protection')).toBe(true);
    expect(isBotOrScanner('Mozilla/5.0 (compatible; Zoho-Link-Checker/1.0)')).toBe(true);
    expect(isBotOrScanner('Kaspersky Lab Scan Engine')).toBe(true);
    expect(isBotOrScanner('Mozilla/5.0 (compatible; TelegramBot/1.0)')).toBe(true);
    expect(isBotOrScanner('facebookexternalhit/1.1')).toBe(true);
    expect(isBotOrScanner('WhatsApp/2.21.12.21')).toBe(true);
    expect(isBotOrScanner('Slackbot-LinkExpanding 1.0')).toBe(true);
    expect(isBotOrScanner('Twitterbot/1.0')).toBe(true);
  });

  it('should detect prefetch and preview headers', () => {
    const headers = new Headers();
    headers.set('Purpose', 'prefetch');
    expect(isBotOrScanner('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', headers)).toBe(true);

    const secHeaders = new Headers();
    secHeaders.set('Sec-Purpose', 'prefetch');
    expect(isBotOrScanner('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', secHeaders)).toBe(true);
  });

  it('should allow legitimate human browsers without prefetch', () => {
    const chromeUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    const safariUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1';
    
    expect(isBotOrScanner(chromeUA)).toBe(false);
    expect(isBotOrScanner(safariUA)).toBe(false);
  });
});

describe('Source Resolver with Referer Fallback', () => {
  it('should prioritize explicit ?src query parameter', () => {
    expect(resolveSource('whatsapp', 'https://mail.google.com')).toBe('whatsapp');
    expect(resolveSource('mail', undefined)).toBe('mail');
  });

  it('should detect major webmail referers including Zoho and Outlook', () => {
    expect(resolveSource(undefined, 'https://mail.google.com/mail/u/0/')).toBe('mail');
    expect(resolveSource(undefined, 'https://mail.zoho.com/zm/')).toBe('mail');
    expect(resolveSource(undefined, 'https://mail.zoho.in/zm/')).toBe('mail');
    expect(resolveSource(undefined, 'https://outlook.live.com/mail/')).toBe('mail');
    expect(resolveSource(undefined, 'https://outlook.office.com/mail/')).toBe('mail');
    expect(resolveSource(undefined, 'https://mail.proton.me/')).toBe('mail');
  });

  it('should detect custom work domain webmails (Roundcube, Zimbra, cPanel, webmail.company.com)', () => {
    expect(resolveSource(undefined, 'https://webmail.acme-corp.com/')).toBe('mail');
    expect(resolveSource(undefined, 'https://mail.mybusiness.org/roundcube/')).toBe('mail');
    expect(resolveSource(undefined, 'https://server.agency.io:2096/cpsess12345/webmail/')).toBe('mail');
    expect(resolveSource(undefined, 'https://zimbra.enterprise.com/')).toBe('mail');
  });

  it('should detect messaging app referers', () => {
    expect(resolveSource(undefined, 'https://web.whatsapp.com/')).toBe('whatsapp');
    expect(resolveSource(undefined, 'https://web.telegram.org/')).toBe('telegram');
    expect(resolveSource(undefined, 'https://app.slack.com/client/')).toBe('slack');
  });

  it('should default to directlink if no src and no referer', () => {
    expect(resolveSource(undefined, undefined)).toBe('directlink');
    expect(resolveSource('', '')).toBe('directlink');
  });
});
