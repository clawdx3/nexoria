import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TabSnapshot {
  snapshot: string;
  screenshot?: string;
  screenshotType?: string;
}

export interface CreateTabOptions {
  userId: string;
  sessionKey: string;
  url: string;
  trace?: boolean;
  proxyCountry?: string;
  proxyState?: string;
}

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
}

@Injectable()
export class BrowserService {
  private readonly baseUrl: string;
  private readonly accessKey: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.getOrThrow<string>('CAMOFOX_URL');
    this.accessKey = this.config.getOrThrow<string>('CAMOFOX_ACCESS_KEY');
  }

  private async fetch(path: string, opts: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.accessKey ? { Authorization: `Bearer ${this.accessKey}` } : {}),
      ...(opts.headers as Record<string, string> || {}),
    };

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...opts,
      headers,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new HttpException(`Camofox error: ${body}`, res.status);
    }

    // Some Camofox endpoints return 204 or binary, so handle gracefully
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json();
    }
    return res.text();
  }

  // ── Tab lifecycle ────────────────────────────────────────────────

  async createTab(opts: CreateTabOptions): Promise<{ id: string }> {
    return this.fetch('/tabs', {
      method: 'POST',
      body: JSON.stringify(opts),
    });
  }

  async listTabs(userId: string): Promise<any[]> {
    return this.fetch(`/tabs?userId=${encodeURIComponent(userId)}`);
  }

  async closeTab(tabId: string, userId: string): Promise<void> {
    await this.fetch(`/tabs/${tabId}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  }

  async closeSession(userId: string): Promise<void> {
    await this.fetch(`/sessions/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  }

  // ── Page interaction ─────────────────────────────────────────────

  async snapshot(tabId: string, userId: string, includeScreenshot?: boolean, offset?: number): Promise<TabSnapshot> {
    const qs = new URLSearchParams({ userId });
    if (includeScreenshot) qs.set('includeScreenshot', 'true');
    if (offset !== undefined) qs.set('offset', String(offset));
    return this.fetch(`/tabs/${tabId}/snapshot?${qs.toString()}`);
  }

  async click(tabId: string, userId: string, ref: string): Promise<void> {
    await this.fetch(`/tabs/${tabId}/click`, {
      method: 'POST',
      body: JSON.stringify({ userId, ref }),
    });
  }

  async type(tabId: string, userId: string, ref: string, text: string, pressEnter?: boolean): Promise<void> {
    await this.fetch(`/tabs/${tabId}/type`, {
      method: 'POST',
      body: JSON.stringify({ userId, ref, text, pressEnter }),
    });
  }

  async pressKey(tabId: string, userId: string, key: string): Promise<void> {
    await this.fetch(`/tabs/${tabId}/press`, {
      method: 'POST',
      body: JSON.stringify({ userId, key }),
    });
  }

  async scroll(tabId: string, userId: string, direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
    await this.fetch(`/tabs/${tabId}/scroll`, {
      method: 'POST',
      body: JSON.stringify({ userId, direction }),
    });
  }

  async navigate(tabId: string, userId: string, url: string): Promise<void> {
    await this.fetch(`/tabs/${tabId}/navigate`, {
      method: 'POST',
      body: JSON.stringify({ userId, url }),
    });
  }

  async navigateMacro(tabId: string, userId: string, macro: string, query?: string): Promise<void> {
    await this.fetch(`/tabs/${tabId}/navigate`, {
      method: 'POST',
      body: JSON.stringify({ userId, macro, query }),
    });
  }

  async waitFor(tabId: string, userId: string, selector?: string, timeout?: number): Promise<void> {
    await this.fetch(`/tabs/${tabId}/wait`, {
      method: 'POST',
      body: JSON.stringify({ userId, selector, timeout }),
    });
  }

  async screenshot(tabId: string, userId: string): Promise<{ screenshot: string; type: string }> {
    return this.fetch(`/tabs/${tabId}/screenshot?userId=${encodeURIComponent(userId)}`);
  }

  async goBack(tabId: string, userId: string): Promise<void> {
    await this.fetch(`/tabs/${tabId}/back`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async goForward(tabId: string, userId: string): Promise<void> {
    await this.fetch(`/tabs/${tabId}/forward`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async refresh(tabId: string, userId: string): Promise<void> {
    await this.fetch(`/tabs/${tabId}/refresh`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async getLinks(tabId: string, userId: string): Promise<any> {
    return this.fetch(`/tabs/${tabId}/links?userId=${encodeURIComponent(userId)}`);
  }

  async getImages(tabId: string, userId: string, includeData?: boolean, limit?: number, maxBytes?: number): Promise<any> {
    const qs = new URLSearchParams({ userId });
    if (includeData) qs.set('includeData', 'true');
    if (limit) qs.set('limit', String(limit));
    if (maxBytes) qs.set('maxBytes', String(maxBytes));
    return this.fetch(`/tabs/${tabId}/images?${qs.toString()}`);
  }

  async getDownloads(tabId: string, userId: string, includeData?: boolean, consume?: boolean, maxBytes?: number): Promise<any> {
    const qs = new URLSearchParams({ userId });
    if (includeData) qs.set('includeData', 'true');
    if (consume) qs.set('consume', 'true');
    if (maxBytes) qs.set('maxBytes', String(maxBytes));
    return this.fetch(`/tabs/${tabId}/downloads?${qs.toString()}`);
  }

  // ── Extract (schema-driven scraping) ─────────────────────────────

  async extract(tabId: string, userId: string, schema: Record<string, any>): Promise<any> {
    return this.fetch(`/tabs/${tabId}/extract`, {
      method: 'POST',
      body: JSON.stringify({ userId, schema }),
    });
  }

  // ── Cookies & sessions ────────────────────────────────────────────

  async addCookies(userId: string, cookies: Cookie[]): Promise<void> {
    await this.fetch(`/sessions/${encodeURIComponent(userId)}/cookies`, {
      method: 'POST',
      body: JSON.stringify({ cookies }),
    });
  }

  async getStorageState(userId: string): Promise<any> {
    return this.fetch(`/sessions/${encodeURIComponent(userId)}/storage_state`);
  }

  // ── Search macros ──────────────────────────────────────────────────

  async googleSearch(tabId: string, userId: string, query: string): Promise<void> {
    return this.navigateMacro(tabId, userId, '@google_search', query);
  }

  async youtubeSearch(tabId: string, userId: string, query: string): Promise<void> {
    return this.navigateMacro(tabId, userId, '@youtube_search', query);
  }

  async redditSearch(tabId: string, userId: string, query: string): Promise<void> {
    return this.navigateMacro(tabId, userId, '@reddit_search', query);
  }

  async linkedinSearch(tabId: string, userId: string, query: string): Promise<void> {
    return this.navigateMacro(tabId, userId, '@linkedin_search', query);
  }

  async instagramSearch(tabId: string, userId: string, query: string): Promise<void> {
    return this.navigateMacro(tabId, userId, '@instagram_search', query);
  }

  async twitterSearch(tabId: string, userId: string, query: string): Promise<void> {
    return this.navigateMacro(tabId, userId, '@twitter_search', query);
  }

  // ── YouTube transcript ────────────────────────────────────────────

  async youtubeTranscript(url: string, languages?: string[]): Promise<any> {
    return this.fetch('/youtube/transcript', {
      method: 'POST',
      body: JSON.stringify({ url, languages: languages ?? ['en'] }),
    });
  }

  // ── Health ────────────────────────────────────────────────────────

  async health(): Promise<any> {
    return this.fetch('/health');
  }
}
