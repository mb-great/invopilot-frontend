import { describe, it, expect } from 'vitest';
import { isBotOrScanner } from './botFilter';

/**
 * T6 (audit 1.4) — "Bots and crawlers are inflating People seen".
 *
 * The filter existed but had never been tested against the task's three stated
 * cases. The middle one failed: Playwright, Puppeteer, Selenium, WebDriver and
 * Lighthouse drive a normal Chrome, so their user-agent carries no
 * "HeadlessChrome" marker and every automated run counted as a visitor.
 */
describe('T6 · a known bot user-agent produces no counted event', () => {
  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'facebookexternalhit/1.1',
    'Slackbot-LinkExpanding 1.0',
    'curl/8.4.0',
    'python-requests/2.31.0',
  ])('filters %s', (ua) => expect(isBotOrScanner(ua)).toBe(true));
});

describe('T6 · headless and automated browsers are excluded', () => {
  it.each([
    'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Unknown; Linux x86_64) PhantomJS/2.1.1',
    'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Puppeteer',
    'Mozilla/5.0 (X11; Linux x86_64) Playwright/1.40 Chrome/120.0.0.0',
    'Mozilla/5.0 selenium/4.16.0',
    'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 webdriver',
    'Mozilla/5.0 Chrome-Lighthouse',
  ])('filters %s', (ua) => expect(isBotOrScanner(ua)).toBe(true));
});

describe('T6 · prerender and preview hits are not counted', () => {
  it.each(['purpose', 'sec-purpose', 'x-purpose', 'x-moz'])('honours the %s header', (h) => {
    const headers = new Headers({ [h]: 'prefetch' });
    expect(isBotOrScanner('Mozilla/5.0 (Macintosh) Chrome/120 Safari/537.36', headers)).toBe(true);
  });

  it('treats a missing user-agent as a bot, not a person', () => {
    expect(isBotOrScanner(null)).toBe(true);
    expect(isBotOrScanner(undefined)).toBe(true);
  });
});

describe('T6 · real people still count', () => {
  it.each([
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 Version/17.1 Mobile/15E148 Safari/604.1',
  ])('does not filter %s', (ua) => expect(isBotOrScanner(ua)).toBe(false));
});
