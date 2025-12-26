import { createFileRoute } from '@tanstack/react-router'
import { Hono } from 'hono'
import { S3Client } from 'bun'

const s3 = new S3Client({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION,
  bucket: process.env.S3_BUCKET,
  endpoint: process.env.S3_ENDPOINT,
})

const app = new Hono().basePath('/api')

app.get('/files', async (c) => {
  const files = await s3.list()
  return c.json(files)
})

app.post('/files', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']
  let folder = (body['folder'] as string) || ''

  if (file instanceof File) {
    if (folder) {
      folder = folder.endsWith('/') ? folder : `${folder}/`
      folder = folder.startsWith('/') ? folder.slice(1) : folder
    }
    const key = `${folder}${file.name}`

    await s3.file(key).write(file)
    return c.json({ success: true })
  }

  return c.json({ error: 'No file uploaded' }, 400)
})

app.delete('/files/:key', async (c) => {
  const key = c.req.param('key')
  await s3.file(key).delete()
  return c.json({ success: true })
})

app.post('/files/:key/presign', async (c) => {
  const key = c.req.param('key')
  const body = await c.req.parseBody()
  const expiresIn = Number(body['expiresIn']) || 3600 // Default 1 hour

  // Max 7 days (604800 seconds)
  const maxExpires = 604800
  const finalExpires = Math.min(expiresIn, maxExpires)

  const url = s3.presign(key, { expiresIn: finalExpires })
  return c.json({ success: true, url })
})

app.get('/config', (c) => {
  return c.json({
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    region: process.env.S3_REGION || '',
    bucket: process.env.S3_BUCKET || '',
    endpoint: process.env.S3_ENDPOINT || '',
  })
})

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        return app.fetch(request)
      },
    },
  },
})
