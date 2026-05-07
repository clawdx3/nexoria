import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { z } from 'zod';
import { BrowserService } from './browser.service';
import { ToolRegistryService } from '../agent-runtime/tool-registry/tool-registry.service';

@Injectable()
export class BrowserToolsProvider implements OnModuleInit {
  private readonly logger = new Logger(BrowserToolsProvider.name);

  constructor(
    private readonly browserService: BrowserService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    const registry = this.moduleRef.get(ToolRegistryService, { strict: false });
    if (!registry) {
      this.logger.warn('ToolRegistryService not available — browser tools will not be registered');
      return;
    }

    const b = this.browserService;

    /* ── 1. Create tab ───────────────────────────────────────────── */
    registry.register({
      name: 'browser_create_tab',
      description: 'Open a new anti-detection browser tab and navigate to a URL. Returns a tabId used for subsequent interactions.',
      schema: z.object({
        url: z.string().describe('The URL to open'),
        sessionKey: z.string().optional().describe('Arbitrary session grouping key (defaults to the agent run id)'),
        trace: z.boolean().optional().describe('Enable Playwright trace recording for debugging'),
        proxyCountry: z.string().optional(),
        proxyState: z.string().optional(),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        const res = await b.createTab({
          userId: ctx.workspaceId,
          sessionKey: args.sessionKey || ctx.sessionId || 'default',
          url: args.url,
          trace: args.trace,
          proxyCountry: args.proxyCountry,
          proxyState: args.proxyState,
        });
        return { success: true, tabId: res.id };
      },
    });

    /* ── 2. Snapshot ─────────────────────────────────────────────── */
    registry.register({
      name: 'browser_snapshot',
      description: 'Get a compact accessibility snapshot of the current page with element refs (e.g. [button e1] Submit). Much smaller than raw HTML. Pass the snapshot text to the LLM for reasoning.',
      schema: z.object({
        tabId: z.string().describe('Tab ID returned by browser_create_tab'),
        includeScreenshot: z.boolean().optional().describe('Also return a base64 PNG screenshot'),
        offset: z.number().optional().describe('Pagination offset for very large pages'),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        return b.snapshot(args.tabId, ctx.workspaceId, args.includeScreenshot, args.offset);
      },
    });

    /* ── 3. Click ─────────────────────────────────────────────────── */
    registry.register({
      name: 'browser_click',
      description: 'Click an element by its ref from a snapshot (e.g. "e1" or "e2").',
      schema: z.object({
        tabId: z.string(),
        ref: z.string().describe('Element reference from snapshot (e.g. e1, e2)'),
      }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        await b.click(args.tabId, ctx.workspaceId, args.ref);
        return { success: true };
      },
    });

    /* ── 4. Type ──────────────────────────────────────────────────── */
    registry.register({
      name: 'browser_type',
      description: 'Type text into an input field by its ref. Optionally press Enter afterwards.',
      schema: z.object({
        tabId: z.string(),
        ref: z.string().describe('Element reference from snapshot'),
        text: z.string(),
        pressEnter: z.boolean().optional(),
      }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        await b.type(args.tabId, ctx.workspaceId, args.ref, args.text, args.pressEnter);
        return { success: true };
      },
    });

    /* ── 5. Press key ──────────────────────────────────────────────── */
    registry.register({
      name: 'browser_press_key',
      description: 'Press a single keyboard key (e.g. "Enter", "Tab", "Escape", "ArrowDown").',
      schema: z.object({
        tabId: z.string(),
        key: z.string(),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        await b.pressKey(args.tabId, ctx.workspaceId, args.key);
        return { success: true };
      },
    });

    /* ── 6. Scroll ─────────────────────────────────────────────────── */
    registry.register({
      name: 'browser_scroll',
      description: 'Scroll the page in a direction: up, down, left, right.',
      schema: z.object({
        tabId: z.string(),
        direction: z.enum(['up', 'down', 'left', 'right']),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        await b.scroll(args.tabId, ctx.workspaceId, args.direction);
        return { success: true };
      },
    });

    /* ── 7. Navigate ─────────────────────────────────────────────── */
    registry.register({
      name: 'browser_navigate',
      description: 'Navigate the current tab to a URL or use a search macro such as @google_search, @youtube_search, @reddit_search, @linkedin_search, @instagram_search, @twitter_search.',
      schema: z.object({
        tabId: z.string(),
        url: z.string().optional().describe('Direct URL to navigate to'),
        macro: z.string().optional().describe('Search macro like @google_search'),
        query: z.string().optional().describe('Query string when using a macro'),
      }).refine((d) => d.url || d.macro, { message: 'Provide either url or macro' }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        if (args.macro) {
          await b.navigateMacro(args.tabId, ctx.workspaceId, args.macro, args.query);
        } else {
          await b.navigate(args.tabId, ctx.workspaceId, args.url!);
        }
        return { success: true };
      },
    });

    /* ── 8. Screenshot ───────────────────────────────────────────── */
    registry.register({
      name: 'browser_screenshot',
      description: 'Take a screenshot of the current page and return it as a base64 PNG. Use for human-in-the-loop approvals or when the LLM cannot reason from text alone.',
      schema: z.object({
        tabId: z.string(),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        const res = await b.screenshot(args.tabId, ctx.workspaceId);
        return { success: true, screenshot: res.screenshot, type: res.type };
      },
    });

    /* ── 9. Extract structured data ──────────────────────────────── */
    registry.register({
      name: 'browser_extract',
      description: 'Extract structured data from the current page using a JSON Schema. Useful for scraping leads, prices, or article metadata. Returns an object matching the schema.',
      schema: z.object({
        tabId: z.string(),
        schema: z.record(z.any()).describe('JSON Schema object with properties mapped to snapshot refs via x-ref'),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        const res = await b.extract(args.tabId, ctx.workspaceId, args.schema);
        return { success: true, data: res };
      },
    });

    /* ── 10. Get links ───────────────────────────────────────────── */
    registry.register({
      name: 'browser_get_links',
      description: 'Extract all hyperlinks from the current page. Returns a list of {href, text}.',
      schema: z.object({
        tabId: z.string(),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        return b.getLinks(args.tabId, ctx.workspaceId);
      },
    });

    /* ── 11. Get images ────────────────────────────────────────────── */
    registry.register({
      name: 'browser_get_images',
      description: 'Extract image URLs and alt text from the page. Optionally returns inline base64 data URLs.',
      schema: z.object({
        tabId: z.string(),
        includeData: z.boolean().optional(),
        limit: z.number().optional(),
        maxBytes: z.number().optional(),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        return b.getImages(args.tabId, ctx.workspaceId, args.includeData, args.limit, args.maxBytes);
      },
    });

    /* ── 12. Wait for element ────────────────────────────────────── */
    registry.register({
      name: 'browser_wait',
      description: 'Wait for a CSS selector to appear on the page, or wait a fixed number of milliseconds.',
      schema: z.object({
        tabId: z.string(),
        selector: z.string().optional(),
        timeout: z.number().optional(),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        await b.waitFor(args.tabId, ctx.workspaceId, args.selector, args.timeout);
        return { success: true };
      },
    });

    /* ── 13. Go back / forward / refresh ─────────────────────────── */
    registry.register({
      name: 'browser_go_back',
      description: 'Click the browser back button.',
      schema: z.object({ tabId: z.string() }),
      riskLevel: 1,
      execute: async (args, ctx) => { await b.goBack(args.tabId, ctx.workspaceId); return { success: true }; },
    });

    registry.register({
      name: 'browser_go_forward',
      description: 'Click the browser forward button.',
      schema: z.object({ tabId: z.string() }),
      riskLevel: 1,
      execute: async (args, ctx) => { await b.goForward(args.tabId, ctx.workspaceId); return { success: true }; },
    });

    registry.register({
      name: 'browser_refresh',
      description: 'Refresh the current page.',
      schema: z.object({ tabId: z.string() }),
      riskLevel: 1,
      execute: async (args, ctx) => { await b.refresh(args.tabId, ctx.workspaceId); return { success: true }; },
    });

    /* ── 14. Import cookies ──────────────────────────────────────── */
    registry.register({
      name: 'browser_import_cookies',
      description: 'Import cookies into the browser session so the agent can browse authenticated sites (e.g. LinkedIn, Facebook). Pass an array of cookie objects.',
      schema: z.object({
        cookies: z.array(z.object({
          name: z.string(),
          value: z.string(),
          domain: z.string(),
          path: z.string(),
          expires: z.number().optional(),
          httpOnly: z.boolean().optional(),
          secure: z.boolean().optional(),
        })),
      }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        await b.addCookies(ctx.workspaceId, args.cookies);
        return { success: true };
      },
    });

    /* ── 15. YouTube transcript ──────────────────────────────────── */
    registry.register({
      name: 'browser_youtube_transcript',
      description: 'Extract captions/transcript from a YouTube video URL. No API key required.',
      schema: z.object({
        url: z.string().url(),
        languages: z.array(z.string()).optional().describe('Preferred languages, e.g. ["en", "de"]'),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        return b.youtubeTranscript(args.url, args.languages);
      },
    });

    /* ── 16. Close tab ───────────────────────────────────────────── */
    registry.register({
      name: 'browser_close_tab',
      description: 'Close a browser tab and free its resources. Always close tabs when done to avoid hitting tab limits.',
      schema: z.object({
        tabId: z.string(),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        await b.closeTab(args.tabId, ctx.workspaceId);
        return { success: true };
      },
    });

    /* ── 17. Search shortcuts ────────────────────────────────────── */
    registry.register({
      name: 'browser_search_google',
      description: 'Navigate to Google search results for a query.',
      schema: z.object({
        tabId: z.string(),
        query: z.string(),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        await b.googleSearch(args.tabId, ctx.workspaceId, args.query);
        return { success: true };
      },
    });

    registry.register({
      name: 'browser_search_youtube',
      description: 'Navigate to YouTube search results for a query.',
      schema: z.object({
        tabId: z.string(),
        query: z.string(),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        await b.youtubeSearch(args.tabId, ctx.workspaceId, args.query);
        return { success: true };
      },
    });

    this.logger.log(`Registered 19 browser tools in ToolRegistryService`);
  }
}
