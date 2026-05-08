import { z } from 'zod'
import type { AgentTool, ToolContext } from '../../../shared/interfaces/agent.interfaces'
import type { BrowserService } from '../../browser/browser.service'

const openWebpageSchema = z.object({
  url: z.string().url().describe('The URL to load and extract text from'),
  maxLength: z.number().optional().default(8000).describe('Maximum characters of text to return'),
  includeScreenshot: z.boolean().optional().default(false).describe('Include a base64 screenshot'),
})

type OpenWebpageParams = z.infer<typeof openWebpageSchema>

function makeCamofoxOpenWebpageTool(browserService: BrowserService): AgentTool {
  return {
    name: 'open_webpage',
    description:
      'Load a public webpage and return the visible text content, optionally with a screenshot. Uses an anti-detection browser (Camofox) so sites blocking headless Chromium will work better. Use this for research, fact-checking, reading documentation, or checking published posts.',
    schema: openWebpageSchema,
    riskLevel: 1,

    async execute(params: OpenWebpageParams, context: ToolContext) {
      const tab = await browserService.createTab({
        userId: context.workspaceId,
        sessionKey: context.sessionId || 'open_webpage',
        url: params.url,
      })
      try {
        const snap = await browserService.snapshot(tab.id, context.workspaceId, false)

        // Extract text from snapshot.  The snapshot format from Camofox is an
        // accessibility tree — we pull out the leaf text nodes.
        const text = extractTextFromSnapshot(snap.snapshot)

        const result: any = {
          url: params.url,
          title: snap.snapshot?.split('\n')[0]?.trim() || 'Untitled',
          text: text.slice(0, params.maxLength),
          truncated: text.length > params.maxLength,
          length: text.length,
        }
        if (params.includeScreenshot) {
          const ss = await browserService.screenshot(tab.id, context.workspaceId)
          result.screenshot = ss.screenshot
          result.screenshotType = ss.type
        }
        return result
      } catch (err: any) {
        return { success: false, error: err.message || 'Camofox error', url: params.url }
      } finally {
        try {
          await browserService.closeTab(tab.id, context.workspaceId)
        } catch { /* ignore */ }
      }
    },
  }
}

function extractTextFromSnapshot(snapshot: string): string {
  // Snapshot is a plain-text accessibility tree with refs like [20] Text  "foo"
  // Strip refs and collect visible text.
  const lines = (snapshot || '').split('\n')
  const parts: string[] = []
  for (const line of lines) {
    const m = line.match(/^\s*\[\d+\]\s+\w+\s+"(.*)"\s*$/)
    if (m && m[1]) parts.push(m[1])
  }
  // Fallback: if no matches, just return the raw snapshot stripped of ref lines
  if (parts.length === 0) {
    return lines
      .filter((l) => !/^\s*\[\d+\]/.test(l))
      .join('\n')
      .replace(/\n+/g, '\n')
      .trim()
  }
  return parts.join('\n')
}

async function fallbackPlaywright(params: OpenWebpageParams): Promise<any> {
  const { chromium } = (await new Function('specifier', 'return import(specifier)')('playwright')) as any
  let browser: any
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    await page.setExtraHTTPHeaders({
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })
    await page.goto(params.url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })
    await page.waitForTimeout(1000)
    const text = await page.evaluate(() => {
      const document = (globalThis as any).document
      document.querySelectorAll('script, style, nav, header, footer, [aria-hidden="true"]').forEach((el: any) => el.remove())
      return document.body?.innerText || ''
    })
    return {
      url: params.url,
      title: await page.title().catch(() => ''),
      text: text.slice(0, params.maxLength),
      truncated: text.length > params.maxLength,
      length: text.length,
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Playwright error', url: params.url }
  } finally {
    if (browser) await browser.close()
  }
}

/**
 * Static fallback tool that uses Playwright directly.
 * If BrowserService is available in the NestJS DI container,
 * the ToolRegistryService should register the Camofox version
 * *after* this one (overwriting the same tool name) so agents
 * get the anti-detection path.
 */
export const openWebpageTool: AgentTool = {
  name: 'open_webpage',
  description:
    'Load a public webpage and return the visible text content. Uses Playwright as a fallback if Camofox is not configured.',
  schema: openWebpageSchema,
  riskLevel: 1,

  async execute(params: OpenWebpageParams, _context: ToolContext) {
    return fallbackPlaywright(params)
  },
}

export function createOpenWebpageTool(browserService: BrowserService): AgentTool {
  return makeCamofoxOpenWebpageTool(browserService)
}
