import { randomUUID } from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.PORT ?? 4174);
const VALID_USERNAME = "lin";
const VALID_PASSWORD = process.env.E2E_VALID_PASSWORD ?? "correct-horse";
const VALID_NAME = "林晓";

const sessions = new Map();

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf("=");
        return eq === -1 ? [part, ""] : [part.slice(0, eq), decodeURIComponent(part.slice(eq + 1))];
      })
  );
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(body);
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { location, ...headers });
  res.end();
}

function loginPage(message = "") {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>星河协作台 - 登录</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: Arial, "Microsoft YaHei", sans-serif;
        background: #f5f7fb;
        color: #172033;
      }
      main {
        width: min(360px, calc(100vw - 40px));
        padding: 28px;
        border: 1px solid #d9e0ec;
        border-radius: 8px;
        background: #fff;
      }
      label {
        display: grid;
        gap: 6px;
        margin: 14px 0;
        font-size: 14px;
      }
      input {
        height: 38px;
        border: 1px solid #b8c2d1;
        border-radius: 6px;
        padding: 0 10px;
        font-size: 15px;
      }
      button {
        width: 100%;
        height: 40px;
        border: 0;
        border-radius: 6px;
        margin-top: 8px;
        background: #176b87;
        color: #fff;
        font-weight: 700;
      }
      [role="alert"] {
        min-height: 20px;
        color: #a52828;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>星河协作台</h1>
      <form method="post" action="/login">
        <label>用户名
          <input name="username" autocomplete="username" />
        </label>
        <label>密码
          <input name="password" type="password" autocomplete="current-password" />
        </label>
        <p role="alert">${message}</p>
        <button type="submit">登录</button>
      </form>
    </main>
  </body>
</html>`;
}

function dashboardPage(userName) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>星河协作台 - 仪表盘</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, "Microsoft YaHei", sans-serif;
        background: #eef3f7;
        color: #172033;
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 28px;
        background: #fff;
        border-bottom: 1px solid #d8e1ea;
      }
      main {
        padding: 28px;
      }
      section {
        max-width: 720px;
        display: grid;
        gap: 12px;
      }
    </style>
  </head>
  <body>
    <header>
      <strong>星河协作台</strong>
      <span data-testid="topbar-greeting">欢迎回来，${userName}</span>
    </header>
    <main>
      <section>
        <h1>项目仪表盘</h1>
        <p data-testid="dashboard-status">今日有 3 个待办事项。</p>
      </section>
    </main>
  </body>
</html>`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const cookies = parseCookies(req.headers.cookie);
  const session = cookies.session ? sessions.get(cookies.session) : null;

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    redirect(res, session ? "/dashboard" : "/login");
    return;
  }

  if (req.method === "GET" && url.pathname === "/login") {
    if (session) {
      redirect(res, "/dashboard");
      return;
    }
    send(res, 200, loginPage());
    return;
  }

  if (req.method === "POST" && url.pathname === "/login") {
    const params = new URLSearchParams(await readBody(req));
    const username = params.get("username");
    const password = params.get("password");

    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      const token = randomUUID();
      sessions.set(token, { name: VALID_NAME });
      redirect(res, "/dashboard", {
        "set-cookie": `session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`,
      });
      return;
    }

    send(res, 401, loginPage("用户名或密码不正确"));
    return;
  }

  if (req.method === "GET" && url.pathname === "/dashboard") {
    if (!session) {
      redirect(res, "/login");
      return;
    }
    send(res, 200, dashboardPage(session.name));
    return;
  }

  send(res, 404, "<h1>Not Found</h1>");
});

server.listen(PORT, () => {
  console.log(`fixture app listening on http://127.0.0.1:${PORT}`);
});
