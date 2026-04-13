/**
 * Custom Next.js production server — integrates the WebSocket server on the same port.
 *
 * Dev:  next dev (via npm run dev, no custom server needed)
 * Prod: NODE_ENV=production tsx server.ts
 */
import { createServer } from 'http'
import next from 'next'

const port = parseInt(process.env.PORT ?? '3000', 10)
const app = next({ dev: false })
const handle = app.getRequestHandler()

app.prepare().then(async () => {
  const { setupWebSocketServer } = await import('./lib/ws/server')

  const server = createServer((req, res) => {
    handle(req, res)
  })

  setupWebSocketServer(server)

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
