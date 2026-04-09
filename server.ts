/**
 * Custom Next.js server — integrates the WebSocket server on the same port.
 *
 * Dev:  NODE_OPTIONS='--max-http-header-size=32768' tsx server.ts
 * Prod: NODE_ENV=production tsx server.ts
 */
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '3000', 10)

const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(async () => {
  // Dynamic import ensures Next.js is fully initialized before loading handlers
  const { setupWebSocketServer } = await import('./lib/ws/server')

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  setupWebSocketServer(server)

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
    console.log(`> WebSocket: ${dev ? 'ws' : 'wss'}://localhost:${port}/ws/{orgId}`)
  })
})
