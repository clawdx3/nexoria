import { z } from 'zod'
import type { AgentTool } from '../../interfaces/agent-tool.interface'
import { Injectable } from '@nestjs/common'

/**
 * Browser tool for agents.
 * Uses Playwright to open a webpage and extract text content.
 * This is a SAFE tool — it only reads, never clicks or submits forms.
 * Each invocation creates an ephemeral browser context that is destroyed afterwards.
 */

const openWebpageSchema = z.object({
  url: z.string().url().describe('The URL to load and extract text from'),
  maxLength: z.number().optional().default(8000).describe('Maximum characters of text to return'),
})

export const openWebpageTool: AgentTool<typeof openWebpageSchema> = {
  name: 'open_webpage',
  description:
    'Load a public webpage and return the visible text content. Use this for research, fact-checking, reading documentation, or checking published posts. Cannot access sites requiring login unless cookies are pre-configured.',
  schema: openWebpageSchema,
  riskLevel: 'safe',

  async execute(params, context) {
    // Lazy-load playwright to avoid startup cost when tool isn't used
    const { chromium } = await import('playwright')

    let browser
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })

      const page = await browser.newPage()

      // Set a realistic user agent so sites don't block headless browsers
      await page.setExtraHTTPHeaders({
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      })

      // Navigate with timeout
      await page.goto(params.url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      })

      // Wait a moment for JS hydration on SPA sites
      await page.waitForTimeout(1000)

      // Extract visible text (strips scripts, styles, nav, etc.)
      const text = await page.evaluate(() => {
        // Remove hidden elements
        document.querySelectorAll('script, style, nav, header, footer, [aria-hidden="true"]').forEach((el) => el.remove())
        return document.body?.innerText || ''
      })

      return {
        url: params.url,
        title: await page.title().catch(() => ''),
        text: text.slice(0, params.maxLength),
        truncated: text.length > params.maxLength,
        length: text.length,
      }
    } finally {
      if (browser) await browser.close()
    }
  },
}
