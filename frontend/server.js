import http from 'http'
import { createReadStream } from 'fs'
import { readFile, stat } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = Number(process.env.PORT || 4288)
const BACKEND_ORIGIN = process.env.API_TARGET || 'http://127.0.0.1:4286'
const DIST_DIR = path.join(__dirname, 'dist')

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
])

const STATIC_EXTENSIONS = new Set([
  '.css',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.js',
  '.json',
  '.map',
  '.png',
  '.svg',
  '.txt',
  '.woff',
  '.woff2',
  '.webp',
  '.xml',
])

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8'
    case '.css': return 'text/css; charset=utf-8'
    case '.js': return 'application/javascript; charset=utf-8'
    case '.mjs': return 'application/javascript; charset=utf-8'
    case '.json': return 'application/json; charset=utf-8'
    case '.svg': return 'image/svg+xml'
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.gif': return 'image/gif'
    case '.webp': return 'image/webp'
    case '.ico': return 'image/x-icon'
    case '.woff': return 'font/woff'
    case '.woff2': return 'font/woff2'
    default: return 'application/octet-stream'
  }
}

function hasHtmlAcceptHeader(request) {
  const accept = request.headers.accept || ''
  return request.method === 'GET' && accept.includes('text/html')
}

function isApiPath(pathname) {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/clubs/') ||
    pathname.startsWith('/dept/') ||
    pathname.startsWith('/guest/') ||
    pathname.startsWith('/hod/') ||
    pathname.startsWith('/image-templates') ||
    pathname.startsWith('/participants/') ||
    pathname.startsWith('/principal/') ||
    pathname.startsWith('/role-presets') ||
    pathname.startsWith('/students/') ||
    pathname.startsWith('/tutor/') ||
    pathname.startsWith('/templates/') ||
    pathname.startsWith('/certificates/') ||
    pathname.startsWith('/storage/') ||
    pathname === '/health' ||
    pathname === '/docs' ||
    pathname === '/openapi.json' ||
    pathname.startsWith('/verify/')
  )
}

async function proxyRequest(request, response) {
  const targetUrl = new URL(request.url, BACKEND_ORIGIN)
  const headers = new Headers()

  for (const [key, value] of Object.entries(request.headers)) {
    if (!value) continue
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue
    headers.set(key, Array.isArray(value) ? value.join(',') : value)
  }

  const options = {
    method: request.method,
    headers,
    redirect: 'manual',
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    options.body = Buffer.concat(chunks)
  }

  const upstream = await fetch(targetUrl, options)

  response.writeHead(
    upstream.status,
    Object.fromEntries(
      [...upstream.headers.entries()].filter(([key]) => !HOP_BY_HOP_HEADERS.has(key.toLowerCase())),
    ),
  )

  if (!upstream.body) {
    response.end()
    return
  }

  const body = Buffer.from(await upstream.arrayBuffer())
  response.end(body)
}

async function serveStaticFile(request, response, filePath) {
  try {
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) {
      throw new Error('Not a file')
    }

    response.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Content-Length': fileStat.size,
      'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    })

    createReadStream(filePath).pipe(response)
  } catch {
    if (request.method === 'GET' && hasHtmlAcceptHeader(request)) {
      const indexPath = path.join(DIST_DIR, 'index.html')
      try {
        const html = await readFile(indexPath)
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
        response.end(html)
      } catch {
        response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
        response.end('Frontend build not found. Run `npm run build` first.')
      }
      return
    }

    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
    const pathname = decodeURIComponent(requestUrl.pathname)

    if (isApiPath(pathname) && !(pathname.startsWith('/verify/') && hasHtmlAcceptHeader(request))) {
      await proxyRequest(request, response)
      return
    }

    const filePath = path.normalize(path.join(DIST_DIR, pathname))
    const staysInsideDist = filePath.startsWith(DIST_DIR)
    const hasStaticExtension = STATIC_EXTENSIONS.has(path.extname(pathname).toLowerCase())

    if (pathname === '/' || (staysInsideDist && hasStaticExtension)) {
      const targetFile = pathname === '/' ? path.join(DIST_DIR, 'index.html') : filePath
      await serveStaticFile(request, response, targetFile)
      return
    }

    if (request.method === 'GET' && hasHtmlAcceptHeader(request)) {
      await serveStaticFile(request, response, path.join(DIST_DIR, 'index.html'))
      return
    }

    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  } catch (error) {
    console.error('[server] request failed:', error)
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Internal server error')
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] frontend listening on http://0.0.0.0:${PORT}`)
  console.log(`[server] proxying API requests to ${BACKEND_ORIGIN}`)
})
