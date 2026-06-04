import { Hono } from "hono"
import { nanoid } from "nanoid"

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

type LayoutProps = {
  children: any
}

function Layout({ children }: LayoutProps) {
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Short URL</title>
      </head>
      <body>
        <main
          style={{
            maxWidth: "640px",
            margin: "48px auto",
            padding: "0 16px",
            fontFamily:
              "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  )
}

function HomePage() {
  return (
    <Layout>
      <h1>Short URL</h1>

      <form method="post" action="/urls">
        <div>
          <label>
            URL
            <input
              name="url"
              type="url"
              placeholder="https://example.com"
              required
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                padding: "8px",
                marginTop: "8px",
              }}
            />
          </label>
        </div>

        <button
          type="submit"
          style={{
            marginTop: "16px",
            padding: "8px 12px",
          }}
        >
          短縮する
        </button>
      </form>
    </Layout>
  )
}

function CreatedPage({ shortUrl }: { shortUrl: string }) {
  return (
    <Layout>
      <h1>作成しました</h1>

      <p>短縮URL:</p>

      <p>
        <a href={shortUrl}>{shortUrl}</a>
      </p>

      <p>
        <a href="/">もう一つ作る</a>
      </p>
    </Layout>
  )
}

app.get("/", (c) => {
  return c.html(<HomePage />)
})

app.post("/urls", async (c) => {
  const form = await c.req.formData()
  const rawUrl = form.get("url")

  if (typeof rawUrl !== "string" || rawUrl.length === 0) {
    return c.text("url is required", 400)
  }

  let longUrl: URL

  try {
    longUrl = new URL(rawUrl)
  } catch {
    return c.text("invalid url", 400)
  }

  if (!["http:", "https:"].includes(longUrl.protocol)) {
    return c.text("only http and https are allowed", 400)
  }

  const code = nanoid(8)

  await c.env.DB.prepare(
    `
    INSERT INTO urls (short_code, long_url)
    VALUES (?, ?)
    `
  )
    .bind(code, longUrl.toString())
    .run()

  const shortUrl = new URL(`/${code}`, c.req.url).toString()

  return c.html(<CreatedPage shortUrl={shortUrl} />)
})

app.get("/:code", async (c) => {
  const code = c.req.param("code")

  const row = await c.env.DB.prepare(
    `
    SELECT long_url
    FROM urls
    WHERE short_code = ?
    `
  )
    .bind(code)
    .first<{ long_url: string }>()

  if (!row) {
    return c.text("Not found", 404)
  }

  await c.env.DB.prepare(
    `
    UPDATE urls
    SET click_count = click_count + 1
    WHERE short_code = ?
    `
  )
    .bind(code)
    .run()

  return c.redirect(row.long_url, 302)
})

export default app

