const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const HOST = "127.0.0.1";
const PORT = 4175;

function candidatePaths() {
  const paths = [];
  const env = process.env;
  if (env.ProgramFiles) {
    paths.push(path.join(env.ProgramFiles, "Inkscape", "bin", "inkscape.exe"));
    paths.push(path.join(env.ProgramFiles, "Inkscape", "inkscape.exe"));
  }
  if (env["ProgramFiles(x86)"]) {
    paths.push(path.join(env["ProgramFiles(x86)"], "Inkscape", "bin", "inkscape.exe"));
    paths.push(path.join(env["ProgramFiles(x86)"], "Inkscape", "inkscape.exe"));
  }
  if (env.LOCALAPPDATA) {
    paths.push(path.join(env.LOCALAPPDATA, "Programs", "Inkscape", "bin", "inkscape.exe"));
    paths.push(path.join(env.LOCALAPPDATA, "Microsoft", "WindowsApps", "inkscape.exe"));
  }
  return paths;
}

function findInkscape() {
  for (const candidate of candidatePaths()) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json;charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

function getVersion(inkscapePath) {
  return new Promise((resolve) => {
    if (!inkscapePath) {
      resolve(null);
      return;
    }
    execFile(inkscapePath, ["--version"], { timeout: 3000 }, (error, stdout, stderr) => {
      if (error) {
        resolve(null);
        return;
      }
      resolve((stdout || stderr || "").trim() || null);
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }
  if (req.url !== "/status") {
    json(res, 404, { error: "Not found" });
    return;
  }
  const inkscapePath = findInkscape();
  const version = await getVersion(inkscapePath);
  json(res, 200, {
    found: Boolean(inkscapePath),
    path: inkscapePath,
    version,
    platform: os.platform()
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Inkscape helper running at http://${HOST}:${PORT}/status`);
});
