/**
 * Custom Next.js server — integrates the WebSocket server on the same port.
 *
 * Dev:  next dev (no custom server needed)
 * Prod: NODE_ENV=production node server.ts
 */
import { createServer } from 'http'
import next from 'next'

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '3000', 10)

// In dev mode, use Next.js built-in server (no custom server to avoid memory issues)
if (dev) {
  const app = next({ dev })
  app.prepare().then(() => {
    app
      .getRequestHandler()
      .createServer({ port })
      .listen(port, () => {
        console.log(`> Ready on http://localhost:${port}`)
      })
  })
} else {
  // In production, use custom server with WebSocket support
  const app = next({ dev })
  const handle = app.getRequestHandler()

  app.prepare().then(async () => {
    // Dynamic import ensures Next.js is fully initialized before loading handlers
    const { setupWebSocketServer } = await import('./lib/ws/server')

    const server = createServer((req, res) => {
      handle(req, res)
    })

    setupWebSocketServer(server)

    server.listen(port, () => {
      console.log(`> Ready on http://localhost:${port}`)
    })
  })
}
