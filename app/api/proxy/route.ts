import { NextRequest, NextResponse } from 'next/server'

/**
 * Converts a Tableau Public URL to its embeddable format.
 * e.g. /app/profile/.../viz/Name/Sheet -> /views/Name/Sheet?:embed=y&:showVizHome=no
 */
function toTableauEmbedUrl(url: string): string {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('tableau.com')) return url
    // /app/profile/.../viz/WorkbookName/SheetName
    const match = u.pathname.match(/\/viz\/([^/]+)\/([^/]+)/)
    if (match) {
      return `https://public.tableau.com/views/${match[1]}/${match[2]}?:embed=y&:showVizHome=no&:toolbar=no`
    }
    // Already a /views/ URL, just add embed params
    if (u.pathname.startsWith('/views/')) {
      u.searchParams.set(':embed', 'y')
      u.searchParams.set(':showVizHome', 'no')
      u.searchParams.set(':toolbar', 'no')
      return u.toString()
    }
  } catch { /* fall through */ }
  return url
}

/**
 * Converts a PowerBI URL to its embeddable format if possible.
 */
function toPowerBIEmbedUrl(url: string): string {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('powerbi.com')) return url

    // Publish to Web format: /view?r=...
    if (u.pathname === '/view' && u.searchParams.has('r')) {
      return u.toString()
    }

    // Standard report format: /groups/{groupId}/reports/{reportId}/...
    const reportMatch = u.pathname.match(/\/groups\/([^/]+)\/reports\/([^/]+)/)
    if (reportMatch) {
      const groupId = reportMatch[1]
      const reportId = reportMatch[2]
      return `https://app.powerbi.com/reportEmbed?reportId=${reportId}&groupId=${groupId}&autoAuth=true`
    }

    // App format: /groups/{groupId}/apps/{appId}/reports/{reportId}/...
    const appReportMatch = u.pathname.match(/\/groups\/([^/]+)\/apps\/([^/]+)\/reports\/([^/]+)/)
    if (appReportMatch) {
      const groupId = appReportMatch[1]
      const reportId = appReportMatch[3]
      return `https://app.powerbi.com/reportEmbed?reportId=${reportId}&groupId=${groupId}&autoAuth=true`
    }
  } catch { /* fall through */ }
  return url
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get('url')

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Validate URL format
  let parsedUrl: URL
  try {
    parsedUrl = new URL(targetUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  // Convert URLs to embeddable format
  let fetchUrl = toTableauEmbedUrl(parsedUrl.toString())
  fetchUrl = toPowerBIEmbedUrl(fetchUrl)

  try {
    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SignageHub/1.0; +https://signagehub.io)',
        'Accept': request.headers.get('accept') || 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.statusText}` },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || 'text/html'
    const body = await response.arrayBuffer()

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      // Strip all frame-blocking headers
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': '',
      'X-Content-Security-Policy': '',
      'Cache-Control': 'public, max-age=60',
    }

    return new NextResponse(body, { status: 200, headers })
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json({ error: 'Failed to fetch the URL' }, { status: 500 })
  }
}
