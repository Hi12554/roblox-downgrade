import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";
import { getClientVersion } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, RefreshCw, Link, Terminal } from "lucide-react";

const HOST_PATH = "https://setup-aws.rbxcdn.com";

const BINARY_TYPES = {
  WindowsPlayer:   { blobDirs: { "x86-64": "/" } as Record<string, string> },
  WindowsStudio64: { blobDirs: { "x86-64": "/" } as Record<string, string> },
  MacPlayer:       { defaultArch: "arm64", blobDirs: { "arm64": "/mac/arm64/", "x86-64": "/mac/" } as Record<string, string> },
  MacStudio:       { defaultArch: "arm64", blobDirs: { "arm64": "/mac/arm64/", "x86-64": "/mac/" } as Record<string, string> },
} as const;

type BinaryTypeName = keyof typeof BINARY_TYPES;

const EXTRACT_ROOTS_PLAYER: Record<string, string> = {
  "RobloxApp.zip": "",
  "redist.zip": "",
  "shaders.zip": "shaders/",
  "ssl.zip": "ssl/",
  "WebView2.zip": "",
  "WebView2RuntimeInstaller.zip": "WebView2RuntimeInstaller/",
  "content-avatar.zip": "content/avatar/",
  "content-configs.zip": "content/configs/",
  "content-fonts.zip": "content/fonts/",
  "content-sky.zip": "content/sky/",
  "content-sounds.zip": "content/sounds/",
  "content-textures2.zip": "content/textures/",
  "content-models.zip": "content/models/",
  "content-platform-fonts.zip": "PlatformContent/pc/fonts/",
  "content-platform-dictionaries.zip": "PlatformContent/pc/shared_compression_dictionaries/",
  "content-terrain.zip": "PlatformContent/pc/terrain/",
  "content-textures3.zip": "PlatformContent/pc/textures/",
  "extracontent-luapackages.zip": "ExtraContent/LuaPackages/",
  "extracontent-translations.zip": "ExtraContent/translations/",
  "extracontent-models.zip": "ExtraContent/models/",
  "extracontent-textures.zip": "ExtraContent/textures/",
  "extracontent-places.zip": "ExtraContent/places/",
};

const EXTRACT_ROOTS_STUDIO: Record<string, string> = {
  "RobloxStudio.zip": "",
  "RibbonConfig.zip": "RibbonConfig/",
  "redist.zip": "",
  "Libraries.zip": "",
  "LibrariesQt5.zip": "",
  "WebView2.zip": "",
  "WebView2RuntimeInstaller.zip": "",
  "shaders.zip": "shaders/",
  "ssl.zip": "ssl/",
  "Qml.zip": "Qml/",
  "Plugins.zip": "Plugins/",
  "StudioFonts.zip": "StudioFonts/",
  "BuiltInPlugins.zip": "BuiltInPlugins/",
  "ApplicationConfig.zip": "ApplicationConfig/",
  "BuiltInStandalonePlugins.zip": "BuiltInStandalonePlugins/",
  "content-qt_translations.zip": "content/qt_translations/",
  "content-sky.zip": "content/sky/",
  "content-fonts.zip": "content/fonts/",
  "content-avatar.zip": "content/avatar/",
  "content-models.zip": "content/models/",
  "content-sounds.zip": "content/sounds/",
  "content-configs.zip": "content/configs/",
  "content-api-docs.zip": "content/api_docs/",
  "content-textures2.zip": "content/textures/",
  "content-studio_svg_textures.zip": "content/studio_svg_textures/",
  "content-platform-fonts.zip": "PlatformContent/pc/fonts/",
  "content-platform-dictionaries.zip": "PlatformContent/pc/shared_compression_dictionaries/",
  "content-terrain.zip": "PlatformContent/pc/terrain/",
  "content-textures3.zip": "PlatformContent/pc/textures/",
  "extracontent-translations.zip": "ExtraContent/translations/",
  "extracontent-luapackages.zip": "ExtraContent/LuaPackages/",
  "extracontent-textures.zip": "ExtraContent/textures/",
  "extracontent-scripts.zip": "ExtraContent/scripts/",
  "extracontent-models.zip": "ExtraContent/models/",
  "studiocontent-models.zip": "StudioContent/models/",
  "studiocontent-textures.zip": "StudioContent/textures/",
};

const APP_SETTINGS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Settings>
\t<ContentFolder>content</ContentFolder>
\t<BaseUrl>http://www.roblox.com</BaseUrl>
</Settings>
`;

function getBinaryTypeInfo(binaryType: BinaryTypeName) {
  return BINARY_TYPES[binaryType];
}

function getArchOptions(binaryType: BinaryTypeName): string[] {
  return Object.keys(getBinaryTypeInfo(binaryType).blobDirs);
}

function getDefaultArch(binaryType: BinaryTypeName): string {
  const info = getBinaryTypeInfo(binaryType);
  return (info as { defaultArch?: string }).defaultArch ?? Object.keys(info.blobDirs)[0];
}

function isMac(binaryType: BinaryTypeName) {
  return binaryType === "MacPlayer" || binaryType === "MacStudio";
}

function buildChannelPath(channel: string) {
  const ch = channel.trim() || "LIVE";
  return ch === "LIVE" ? HOST_PATH : `${HOST_PATH}/channel/${ch.toLowerCase()}`;
}

async function fetchBinary(url: string): Promise<ArrayBuffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} @ ${url}`);
  return resp.arrayBuffer();
}

export default function Home() {
  const [binaryType, setBinaryType] = useState<BinaryTypeName>("WindowsPlayer");
  const [arch, setArch] = useState<string>("x86-64");
  const [channel, setChannel] = useState("LIVE");
  const [versionHash, setVersionHash] = useState("");
  const [compressZip, setCompressZip] = useState(false);
  const [compressionLevel, setCompressionLevel] = useState(5);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFetchingVersion, setIsFetchingVersion] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLPreElement>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, msg]);
    setTimeout(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
    }, 0);
  }, []);

  function handleBinaryTypeChange(val: BinaryTypeName) {
    setBinaryType(val);
    setArch(getDefaultArch(val));
  }

  async function fetchLatestVersion() {
    setIsFetchingVersion(true);
    try {
      const ch = channel.trim() || "LIVE";
      const data = await getClientVersion({ binaryType, channel: ch });
      setVersionHash(data.version);
      addLog(`[+] Latest version for ${binaryType}@${ch}: ${data.version}`);
    } catch (err) {
      addLog(`[!] Failed to fetch latest version: ${err}`);
    } finally {
      setIsFetchingVersion(false);
    }
  }

  function copyPermLink() {
    const ch = channel.trim() || "LIVE";
    const hash = versionHash.trim();
    const archDefault = getDefaultArch(binaryType);
    let qs = `?channel=${encodeURIComponent(ch)}&binaryType=${encodeURIComponent(binaryType)}`;
    if (arch !== archDefault) qs += `&arch=${encodeURIComponent(arch)}`;
    if (hash) qs += `&version=${encodeURIComponent(hash)}`;
    if (compressZip) qs += `&compressZip=true&compressionLevel=${compressionLevel}`;
    navigator.clipboard.writeText(window.location.origin + qs);
    addLog("[+] Permanent link copied to clipboard");
  }

  async function startDownload() {
    const ch = channel.trim() || "LIVE";
    let version = versionHash.trim().toLowerCase();
    if (!version) {
      addLog("[!] No version hash provided. Use 'Get Latest' to fetch the current version first.");
      return;
    }
    if (!version.startsWith("version-")) version = "version-" + version;

    const blobDir = getBinaryTypeInfo(binaryType).blobDirs[arch];
    const channelPath = buildChannelPath(ch);
    const versionPath = `${channelPath}${blobDir}${version}-`;
    const outputFileName = `${ch}-${binaryType}-${version}.zip`;

    setIsDownloading(true);
    setLogs([]);

    try {
      if (isMac(binaryType)) {
        const zipFileName =
          binaryType === "MacPlayer" ? "RobloxPlayer.zip" : "RobloxStudioApp.zip";
        addLog(`[+] Fetching Mac archive: ${zipFileName}`);
        addLog(`[+] Downloading ${outputFileName}...`);
        const zipData = await fetchBinary(versionPath + zipFileName);
        triggerDownload(outputFileName, zipData);
        addLog(`[+] Done! ${outputFileName} downloaded.`);
      } else {
        await downloadWindowsBuild(versionPath, binaryType, outputFileName, ch, addLog, compressZip, compressionLevel);
      }
    } catch (err) {
      addLog(`[!] Error: ${err}`);
    } finally {
      setIsDownloading(false);
    }
  }

  const archOptions = getArchOptions(binaryType);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-20 flex flex-col gap-10">

        {/* Header */}
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-center text-primary">
              <Download className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-mono font-bold tracking-tight">RDD</h1>
          </div>
          <p className="text-muted-foreground max-w-xl leading-relaxed">
            Roblox Deployment Downloader. Assembles Roblox client and studio builds directly from Roblox's CDN — no server needed.
          </p>
          <p className="text-xs text-muted-foreground/60 font-mono">
            Based on{" "}
            <a href="https://github.com/latte-soft/rdd" target="_blank" rel="noopener noreferrer" className="text-primary/70 hover:text-primary underline underline-offset-2">
              latte-soft/rdd
            </a>
            {" "}— MIT License
          </p>
        </header>

        {/* Form */}
        <div className="border border-border rounded-xl bg-card p-6 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Binary Type */}
            <div className="flex flex-col gap-2">
              <Label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Binary Type</Label>
              <Select value={binaryType} onValueChange={(v) => handleBinaryTypeChange(v as BinaryTypeName)}>
                <SelectTrigger className="font-mono bg-muted/20 border-border/60" data-testid="select-binary-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WindowsPlayer" className="font-mono">WindowsPlayer</SelectItem>
                  <SelectItem value="WindowsStudio64" className="font-mono">WindowsStudio64</SelectItem>
                  <SelectItem value="MacPlayer" className="font-mono">MacPlayer</SelectItem>
                  <SelectItem value="MacStudio" className="font-mono">MacStudio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Arch */}
            <div className="flex flex-col gap-2">
              <Label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Architecture</Label>
              <Select value={arch} onValueChange={setArch}>
                <SelectTrigger className="font-mono bg-muted/20 border-border/60" data-testid="select-arch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {archOptions.map(a => (
                    <SelectItem key={a} value={a} className="font-mono">{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Channel */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="channel" className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Channel</Label>
              <Input
                id="channel"
                value={channel}
                onChange={e => setChannel(e.target.value)}
                placeholder="LIVE"
                className="font-mono bg-muted/20 border-border/60"
                data-testid="input-channel"
              />
            </div>

            {/* Version Hash */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="version" className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Version Hash</Label>
              <div className="flex gap-2">
                <Input
                  id="version"
                  value={versionHash}
                  onChange={e => setVersionHash(e.target.value)}
                  placeholder="version-xxxxxxxxxxxxxxxx"
                  className="font-mono bg-muted/20 border-border/60 flex-1 min-w-0"
                  data-testid="input-version"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchLatestVersion}
                  disabled={isFetchingVersion || isDownloading}
                  title="Get latest version"
                  className="shrink-0"
                  data-testid="button-get-latest"
                >
                  <RefreshCw className={`h-4 w-4 ${isFetchingVersion ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/60 font-mono">Click the refresh icon to auto-fill the latest version</p>
            </div>
          </div>

          {/* Compression options (Windows only) */}
          {!isMac(binaryType) && (
            <div className="flex flex-col gap-3 border-t border-border/50 pt-4">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Output Options</p>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="compress"
                  checked={compressZip}
                  onCheckedChange={v => setCompressZip(!!v)}
                  data-testid="checkbox-compress"
                />
                <Label htmlFor="compress" className="text-sm cursor-pointer">Compress output zip</Label>
              </div>
              {compressZip && (
                <div className="flex items-center gap-3 pl-7">
                  <Label htmlFor="level" className="text-sm text-muted-foreground whitespace-nowrap">Level (1–9):</Label>
                  <Input
                    id="level"
                    type="number"
                    min={1}
                    max={9}
                    value={compressionLevel}
                    onChange={e => setCompressionLevel(Number(e.target.value))}
                    className="w-20 font-mono bg-muted/20 border-border/60"
                    data-testid="input-compression-level"
                  />
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 border-t border-border/50 pt-4">
            <Button
              onClick={startDownload}
              disabled={isDownloading || isFetchingVersion}
              className="font-mono gap-2"
              data-testid="button-download"
            >
              <Download className="h-4 w-4" />
              {isDownloading ? "Downloading..." : "Download"}
            </Button>
            <Button
              variant="outline"
              onClick={copyPermLink}
              disabled={isDownloading}
              className="font-mono gap-2"
              data-testid="button-copy-link"
            >
              <Link className="h-4 w-4" />
              Copy Link
            </Button>
          </div>
        </div>

        {/* Log console */}
        {logs.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
              <Terminal className="h-3.5 w-3.5" />
              Output
            </div>
            <pre
              ref={logRef}
              className="bg-black/40 border border-border/60 rounded-xl p-4 font-mono text-xs text-green-400 leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap"
              data-testid="log-output"
            >
              {logs.join("\n")}
            </pre>
          </div>
        )}

        {/* Info box */}
        <div className="border border-border/40 rounded-xl bg-muted/10 p-5 flex flex-col gap-3 text-sm text-muted-foreground">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground/70">How it works</p>
          <ul className="list-disc list-inside space-y-1.5 text-sm leading-relaxed">
            <li>Select your binary type, architecture, and channel (default: LIVE)</li>
            <li>Click the refresh icon next to Version Hash to auto-fill the latest version</li>
            <li>Or paste any historical version hash manually</li>
            <li>Hit Download — your browser fetches all packages directly from Roblox's CDN and assembles the zip locally</li>
            <li>For Windows: produces an installable zip with all content extracted to the correct paths</li>
            <li>For Mac: downloads the DMG/zip archive directly</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function triggerDownload(filename: string, data: ArrayBuffer) {
  const blob = new Blob([data], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function downloadWindowsBuild(
  versionPath: string,
  binaryType: BinaryTypeName,
  outputFileName: string,
  channel: string,
  log: (msg: string) => void,
  compressZip: boolean,
  compressionLevel: number
) {
  log(`[+] Fetching rbxPkgManifest for ${versionPath.split("/").pop()}@${channel}...`);

  let manifestResp = await fetch(versionPath + "rbxPkgManifest.txt");
  if (!manifestResp.ok) {
    const fallbackPath = versionPath.replace(
      "https://setup-aws.rbxcdn.com",
      "https://setup-aws.rbxcdn.com/channel/common"
    );
    log(`[*] Trying /channel/common/ fallback...`);
    manifestResp = await fetch(fallbackPath + "rbxPkgManifest.txt");
  }
  if (!manifestResp.ok) {
    throw new Error(`Failed to fetch rbxPkgManifest (${manifestResp.status})`);
  }

  const manifestBody = await manifestResp.text();
  const lines = manifestBody.split("\n").map(l => l.trim());

  if (lines[0] !== "v0") {
    throw new Error(`Unknown manifest format: "${lines[0]}"`);
  }

  let extractRoots: Record<string, string>;
  if (lines.includes("RobloxApp.zip")) {
    if (binaryType === "WindowsStudio64") throw new Error("BinaryType mismatch: expected Studio but got Player manifest");
    extractRoots = EXTRACT_ROOTS_PLAYER;
  } else if (lines.includes("RobloxStudio.zip")) {
    if (binaryType === "WindowsPlayer") throw new Error("BinaryType mismatch: expected Player but got Studio manifest");
    extractRoots = EXTRACT_ROOTS_STUDIO;
  } else {
    throw new Error("Unrecognized rbxPkgManifest — cannot determine binary type");
  }

  const packages = lines.filter(l => l.endsWith(".zip"));
  log(`[+] Found ${packages.length} packages in manifest`);

  const zip = new JSZip();
  zip.file("AppSettings.xml", APP_SETTINGS_XML);

  let completed = 0;
  await Promise.all(
    packages.map(async (pkg) => {
      log(`[+] Fetching "${pkg}"...`);
      const blobData = await fetchBinary(versionPath + pkg);

      if (!(pkg in extractRoots)) {
        log(`[*] "${pkg}" not in extract roots, placing at root`);
        zip.file(pkg, blobData);
      } else {
        const extractRoot = extractRoots[pkg];
        const packageZip = await JSZip.loadAsync(blobData);
        const filePromises: Promise<void>[] = [];
        packageZip.forEach((path, obj) => {
          if (path.endsWith("\\") || path.endsWith("/")) return;
          const fixedPath = path.replace(/\\/g, "/");
          filePromises.push(
            obj.async("arraybuffer").then(data => {
              zip.file(extractRoot + fixedPath, data);
            })
          );
        });
        await Promise.all(filePromises);
        log(`[+] Extracted "${pkg}" (${++completed}/${packages.length})`);
      }
    })
  );

  log(`[+] Assembling ${outputFileName}...`);
  if (compressZip) log(`[!] Compressing (level ${compressionLevel}/9), this may take a while...`);

  const outputData = await zip.generateAsync({
    type: "arraybuffer",
    compression: compressZip ? "DEFLATE" : "STORE",
    compressionOptions: { level: compressionLevel },
  });

  triggerDownload(outputFileName, outputData);
  log(`[+] Done! ${outputFileName} downloaded.`);
}
