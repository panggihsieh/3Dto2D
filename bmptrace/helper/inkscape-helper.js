const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile, spawn } = require("child_process");

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

function findOnPath(names) {
  const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function findInkscape() {
  for (const candidate of candidatePaths()) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return findOnPath(os.platform() === "win32" ? ["inkscape.exe"] : ["inkscape"]);
}

function findPotrace() {
  return findOnPath(os.platform() === "win32" ? ["potrace.exe"] : ["potrace"]);
}

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json;charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

function getVersion(commandPath) {
  return new Promise((resolve) => {
    if (!commandPath) {
      resolve(null);
      return;
    }
    execFile(commandPath, ["--version"], { timeout: 3000 }, (error, stdout, stderr) => {
      if (error) {
        resolve(null);
        return;
      }
      resolve((stdout || stderr || "").trim() || null);
    });
  });
}

function openPowerShell() {
  if (os.platform() !== "win32") return false;
  const launcherScript = `
$target = Start-Process -FilePath "powershell.exe" -ArgumentList @(
  "-NoExit",
  "-NoProfile",
  "-Command",
  "$Host.UI.RawUI.WindowTitle='BMPTrace Potrace Install'; Write-Host '已開啟 BMPTrace Potrace 安裝 PowerShell。請貼上網頁剛複製的安裝命令後按 Enter。' -ForegroundColor Yellow"
) -WindowStyle Normal -PassThru
$signature = '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);'
Add-Type -MemberDefinition $signature -Name NativeWindow -Namespace Win32
for ($i = 0; $i -lt 40 -and ($null -eq $target -or $target.MainWindowHandle -eq 0); $i++) {
  Start-Sleep -Milliseconds 100
  $target = Get-Process -Id $target.Id -ErrorAction SilentlyContinue
}
if ($target -and $target.MainWindowHandle -ne 0) {
  [Win32.NativeWindow]::SetWindowPos($target.MainWindowHandle, [IntPtr]::new(-1), 0, 0, 0, 0, 0x0001 -bor 0x0002 -bor 0x0040) | Out-Null
  [Win32.NativeWindow]::SetForegroundWindow($target.MainWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 400
  [Win32.NativeWindow]::SetWindowPos($target.MainWindowHandle, [IntPtr]::new(-2), 0, 0, 0, 0, 0x0001 -bor 0x0002 -bor 0x0040) | Out-Null
}
`;
  const child = spawn("powershell.exe", [
    "-NoProfile",
    "-WindowStyle",
    "Hidden",
    "-Command",
    launcherScript
  ], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  return true;
}

function bringWindowToFront(pid) {
  const script = `
$signature = '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);'
Add-Type -MemberDefinition $signature -Name NativeWindow -Namespace Win32
$process = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
for ($i = 0; $i -lt 30 -and ($null -eq $process -or $process.MainWindowHandle -eq 0); $i++) {
  Start-Sleep -Milliseconds 100
  $process = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
}
if ($process -and $process.MainWindowHandle -ne 0) {
  [Win32.NativeWindow]::SetWindowPos($process.MainWindowHandle, [IntPtr]::new(-1), 0, 0, 0, 0, 0x0001 -bor 0x0002 -bor 0x0040) | Out-Null
  [Win32.NativeWindow]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 250
  [Win32.NativeWindow]::SetWindowPos($process.MainWindowHandle, [IntPtr]::new(-2), 0, 0, 0, 0, 0x0001 -bor 0x0002 -bor 0x0040) | Out-Null
}
`;
  const child = spawn("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", script], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }
  if (req.url === "/open-powershell" && req.method === "POST") {
    const opened = openPowerShell();
    json(res, opened ? 200 : 400, {
      opened,
      platform: os.platform()
    });
    return;
  }
  if (req.url !== "/status") {
    json(res, 404, { error: "Not found" });
    return;
  }
  const inkscapePath = findInkscape();
  const potracePath = findPotrace();
  const inkscapeVersion = await getVersion(inkscapePath);
  const potraceVersion = await getVersion(potracePath);
  json(res, 200, {
    found: Boolean(inkscapePath),
    path: inkscapePath,
    version: inkscapeVersion,
    inkscape: {
      found: Boolean(inkscapePath),
      path: inkscapePath,
      version: inkscapeVersion
    },
    potrace: {
      found: Boolean(potracePath),
      path: potracePath,
      version: potraceVersion
    },
    platform: os.platform()
  });
});

server.listen(PORT, HOST, () => {
  console.log(`BMPTrace helper running at http://${HOST}:${PORT}/status`);
});
