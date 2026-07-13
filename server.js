const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const PYTHON_SCRIPT = path.join(ROOT, "python", "analyze.py");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const MAX_BODY_BYTES = 1024 * 1024;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function pythonInvocation() {
  const configured = process.env.PYTHON;
  if (configured) {
    const parts = configured.split(" ").filter(Boolean);
    return { command: parts[0], args: parts.slice(1) };
  }

  return {
    command: process.platform === "win32" ? "python" : "python3",
    args: []
  };
}

function nativeExecutablePath() {
  const executable = process.platform === "win32" ? "stats_worker.exe" : "stats_worker";
  return path.join(ROOT, "build", executable);
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  response.end(body);
}

async function readRequestBody(request) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function parsePythonError(stderr) {
  const trimmed = stderr.trim();
  if (!trimmed) {
    return "Python analyzer failed without an error message.";
  }

  try {
    const parsed = JSON.parse(trimmed);
    return parsed.error || trimmed;
  } catch {
    return trimmed;
  }
}

function runAnalyzer(payload) {
  return new Promise((resolve, reject) => {
    const invocation = pythonInvocation();
    const child = spawn(invocation.command, [...invocation.args, PYTHON_SCRIPT], {
      cwd: ROOT,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      reject(new Error(`Could not start Python analyzer: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(parsePythonError(stderr)));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Python analyzer returned invalid JSON: ${error.message}`));
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

async function handleAnalyze(request, response) {
  const rawBody = await readRequestBody(request);
  let payload;

  try {
    payload = JSON.parse(rawBody || "{}");
  } catch {
    sendJson(response, 400, { error: "Request body must be valid JSON." });
    return;
  }

  try {
    const result = await runAnalyzer(payload);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
}

async function handleHealth(response) {
  const nativePath = nativeExecutablePath();
  let nativeBuilt = false;

  try {
    await fs.access(nativePath);
    nativeBuilt = true;
  } catch {
    nativeBuilt = false;
  }

  sendJson(response, 200, {
    ok: true,
    nativeBuilt,
    nativePath,
    python: pythonInvocation().command
  });
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const decodedPath = decodeURIComponent(pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, decodedPath));
  const publicRoot = PUBLIC_DIR.endsWith(path.sep) ? PUBLIC_DIR : `${PUBLIC_DIR}${path.sep}`;

  if (!filePath.startsWith(publicRoot)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "content-type": MIME_TYPES[extension] || "application/octet-stream",
      "content-length": data.length
    });
    response.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/api/analyze") {
      await handleAnalyze(request, response);
      return;
    }

    if (request.method === "GET" && request.url === "/api/health") {
      await handleHealth(response);
      return;
    }

    if (request.method === "GET") {
      await serveStatic(request, response);
      return;
    }

    response.writeHead(405, { allow: "GET, POST" });
    response.end("Method not allowed");
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  const displayHost = HOST === "127.0.0.1" ? "localhost" : HOST;
  console.log(`LIDER Rebate Dashboard running at http://${displayHost}:${PORT}`);
});
