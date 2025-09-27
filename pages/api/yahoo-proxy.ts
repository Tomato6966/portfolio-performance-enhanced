import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    res.setHeader('Access-Control-Max-Age', '86400')
    res.status(204).end()
    return
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    // Extract the target URL from query parameters
    const { url: targetUrl } = req.query

    if (!targetUrl || typeof targetUrl !== 'string') {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.status(400).json({ error: 'URL parameter is required' })
      return
    }

    // Security: Only allow Yahoo Finance API calls
    if (!targetUrl.startsWith('https://query1.finance.yahoo.com/') &&
        !targetUrl.startsWith('https://query2.finance.yahoo.com/')) {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.status(403).json({ error: 'Only Yahoo Finance API is allowed' })
      return
    }

    console.log(`[Yahoo Proxy] Fetching: ${targetUrl}`)

    // Make the request to Yahoo Finance - simple passthrough
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://finance.yahoo.com/',
        'Origin': 'https://finance.yahoo.com',
      },
    })

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Set CORS headers and return the data
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-cache') // No caching for development

    res.status(200).json(data)

  } catch (error) {
    console.error('[Yahoo Proxy] Error:', error)

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(500).json({
      error: 'Proxy error',
      message: error instanceof Error ? error.message : 'Unknown error',
      target: req.query.url
    })
  }
}
