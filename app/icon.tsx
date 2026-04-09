import { readFile } from 'fs/promises'
import { join } from 'path'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default async function Icon() {
  const isDev = process.env.NODE_ENV === 'development'
  const filename = isDev ? 'favicon-dev.png' : 'icon-192.png'
  const imagePath = join(process.cwd(), 'public', filename)

  const imageBuffer = await readFile(imagePath)

  return new Response(imageBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': isDev ? 'no-cache' : 'public, max-age=31536000, immutable',
    },
  })
}
