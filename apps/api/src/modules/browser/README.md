# Browser Agent Tools

These tools give agents anti-detection browser capabilities via [Camofox](https://github.com/jo-inc/camofox-browser). No Playwright / raw HTML knowledge needed — the LLM sees compact accessibility snapshots and interacts with element refs.

## How it works

1. LLM calls `browser_create_tab` with a URL  
2. Agent receives a `tabId`  
3. LLM calls `browser_snapshot` to see the page as `[button e1] Submit  [link e2] Learn more`  
4. LLM reasons about the snapshot, then calls `browser_type` / `browser_click` / etc.  
5. When done, LLM calls `browser_close_tab` to free resources

## Available Tools

| Tool | Purpose | Risk |
|------|---------|------|
| `browser_create_tab` | Open a new tab, navigate to URL, return tabId | 1 |
| `browser_close_tab` | Close a tab | 1 |
| `browser_snapshot` | Accessibility snapshot with element refs | 1 |
| `browser_click` | Click an element by ref (e.g. `e1`) | 2 |
| `browser_type` | Type text into an element + optional Enter | 2 |
| `browser_press_key` | Press a keyboard key | 1 |
| `browser_scroll` | Scroll up/down/left/right | 1 |
| `browser_navigate` | Go to URL or a search macro (`@google_search`) | 1 |
| `browser_screenshot` | Base64 PNG screenshot for approvals / debugging | 1 |
| `browser_extract` | Structured data extraction using JSON Schema | 1 |
| `browser_get_links` | Extract all hyperlinks from page | 1 |
| `browser_get_images` | Extract image sources, optionally inline data URLs | 1 |
| `browser_wait` | Wait for selector or fixed timeout | 1 |
| `browser_go_back` / `browser_go_forward` / `browser_refresh` | Navigation controls | 1 |
| `browser_import_cookies` | Inject cookies for authenticated sites | 2 |
| `browser_search_google` | Shortcut for Google search macro | 1 |
| `browser_search_youtube` | Shortcut for YouTube search macro | 1 |
| `browser_youtube_transcript` | Extract captions from a YouTube video | 1 |

## Cookie Import (Authenticated Browsing)

To browse sites that require login (LinkedIn, Facebook Ad Manager, MailerLite dashboard):

1. Export cookies from your real browser as Netscape format e.g. `linkedin.txt`
2. Place in `~/.camofox/cookies/linkedin.txt` inside the Camofox container
3. Agent calls `browser_import_cookies` with the cookie objects
4. Subsequent tabs to that domain are authenticated

## Example Agent Flow: Facebook Post

```text
Agent: browser_create_tab {"url":"https://business.facebook.com/","sessionKey":"post-dinner-deals"}
→ { tabId: "T_a1b2c3" }

Agent: browser_import_cookies {"cookies":[...]}
→ { success: true }

Agent: browser_navigate {"tabId":"T_a1b2c3","url":"https://business.facebook.com/creatorstudio/?tab=posts"}
→ { success: true }

Agent: browser_snapshot {"tabId":"T_a1b2c3"}
→ { snapshot: "[button e1] Create post  [link e2] Drafts ..." }

Agent: browser_click {"tabId":"T_a1b2c3","ref":"e1"}
→ { success: true }

Agent: browser_wait {"tabId":"T_a1b2c3","selector":"[role=dialog]"}
→ { success: true }

Agent: browser_snapshot {"tabId":"T_a1b2c3"}
→ { snapshot: "[textarea e3] What's on your mind?  [button e4] Share" }

Agent: browser_type {"tabId":"T_a1b2c3","ref":"e3","text":"🍝 New dinner menu launching Friday! Book your table via link in bio.\n
#italian #restaurant #dinner"}
→ { success: true }

Agent: browser_screenshot {"tabId":"T_a1b2c3"}
→ { screenshot: "base64...", type: "image/png" }

(Human approval gate happens in Nexoria dashboard)

Approved → Agent: browser_click {"tabId":"T_a1b2c3","ref":"e4"}
→ { success: true }

Agent: browser_close_tab {"tabId":"T_a1b2c3"}
→ { success: true }
```

## Architecture

```
┌────────────────────────┐
│  AgentExecutor (LLM)   │
│  calls tools via JSON  │
└──────┬─────────────────┘
       │
┌──────▼───────────────────────────────────┐
│  ToolRegistryService                       │
│  maps tool name → zod schema + execute() │
└──────┬───────────────────────────────────┘
       │ BrowserService (HTTP client to Camofox)
       │
┌──────▼──────────────────────────────────────┐
│  Camofox container (http://camofox:9377)      │
│  C++ anti-detect Firefox fork                 │
│  Returns accessibility snapshots (not HTML)   │
└───────────────────────────────────────────────┘
```

## Configuration

All config lives in environment variables (no hardcoded secrets):

| Variable | Default | Description |
|----------|---------|-------------|
| `CAMOFOX_URL` | — | Internal URL, e.g. `http://camofox:9377` |
| `CAMOFOX_ACCESS_KEY` | — | Bearer token protecting the API |
| `PROXY_STRATEGY` | — | `backconnect` for rotating sticky sessions |
| `PROXY_BACKCONNECT_HOST` | — | Residential proxy gateway |
| `PROXY_USERNAME` / `PASSWORD` | — | Proxy auth |
