import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";
import { getClientVersion } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, RefreshCw, Link2, ChevronRight } from "lucide-react";

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
  log(`[+] Fetching manifest for ${versionPath.split("/").pop()}@${channel}...`);

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
  log(`[+] Found ${packages.length} packages`);

  const zip = new JSZip();
  zip.file("AppSettings.xml", APP_SETTINGS_XML);

  let completed = 0;
  await Promise.all(
    packages.map(async (pkg) => {
      log(`[↓] ${pkg}`);
      const blobData = await fetchBinary(versionPath + pkg);

      if (!(pkg in extractRoots)) {
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
        log(`[✓] ${pkg} (${++completed}/${packages.length})`);
      }
    })
  );

  log(`[+] Assembling ${outputFileName}...`);
  if (compressZip) log(`[!] Compressing at level ${compressionLevel}/9...`);

  const outputData = await zip.generateAsync({
    type: "arraybuffer",
    compression: compressZip ? "DEFLATE" : "STORE",
    compressionOptions: { level: compressionLevel },
  });

  triggerDownload(outputFileName, outputData);
  log(`[✓] Done — ${outputFileName}`);
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
      addLog(`[+] ${binaryType} @ ${ch} → ${data.version}`);
    } catch (err) {
      addLog(`[!] Failed to fetch version: ${err}`);
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
    addLog("[+] Link copied to clipboard");
  }

  async function startDownload() {
    const ch = channel.trim() || "LIVE";
    let version = versionHash.trim().toLowerCase();
    if (!version) {
      addLog("[!] Enter a version hash or use the refresh button to fetch the latest.");
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
        const zipFileName = binaryType === "MacPlayer" ? "RobloxPlayer.zip" : "RobloxStudioApp.zip";
        addLog(`[+] Fetching ${zipFileName}...`);
        const zipData = await fetchBinary(versionPath + zipFileName);
        triggerDownload(outputFileName, zipData);
        addLog(`[✓] Done — ${outputFileName}`);
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
  const busy = isDownloading || isFetchingVersion;

  return (
    <div
      className="min-h-[100dvh] text-white flex flex-col"
      style={{
        background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(56,189,248,0.08) 0%, transparent 70%), #06060a",
      }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "rgba(56,189,248,0.12)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-7 w-7 rounded flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }}
          >
            <Download className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold tracking-widest text-sm uppercase text-white/90">Roblox Downgrader</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          {/* Hero */}
          <div className="text-center flex flex-col items-center gap-3 mb-2">
            <h1
              className="text-5xl font-black tracking-tight"
              style={{
                background: "linear-gradient(135deg, #fff 30%, #7dd3fc 70%, #818cf8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              RBX Downgrader
            </h1>
            <p className="text-sm text-white/40 tracking-widest uppercase font-medium">
              Download any Roblox build directly from CDN
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-6 flex flex-col gap-5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(56,189,248,0.15)",
              boxShadow: "0 0 40px rgba(14,165,233,0.04), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {/* Row 1: Binary Type + Arch */}
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="Binary Type">
                <Select value={binaryType} onValueChange={(v) => handleBinaryTypeChange(v as BinaryTypeName)}>
                  <SelectTrigger className="zenon-input font-mono text-sm" data-testid="select-binary-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-mono">
                    <SelectItem value="WindowsPlayer">WindowsPlayer</SelectItem>
                    <SelectItem value="WindowsStudio64">WindowsStudio64</SelectItem>
                    <SelectItem value="MacPlayer">MacPlayer</SelectItem>
                    <SelectItem value="MacStudio">MacStudio</SelectItem>
                  </SelectContent>
                </Select>
              </FieldGroup>

              <FieldGroup label="Architecture">
                <Select value={arch} onValueChange={setArch} disabled={archOptions.length <= 1}>
                  <SelectTrigger className="zenon-input font-mono text-sm" data-testid="select-arch">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-mono">
                    {archOptions.map(a => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldGroup>
            </div>

            {/* Row 2: Channel + Version */}
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="Channel">
                <Input
                  value={channel}
                  onChange={e => setChannel(e.target.value)}
                  placeholder="LIVE"
                  className="zenon-input font-mono text-sm"
                  data-testid="input-channel"
                />
              </FieldGroup>

              <FieldGroup label="Version Hash">
                <div className="flex gap-2">
                  <Input
                    value={versionHash}
                    onChange={e => setVersionHash(e.target.value)}
                    placeholder="version-xxxxxxxxxxxxxxxx"
                    className="zenon-input font-mono text-sm flex-1 min-w-0"
                    data-testid="input-version"
                  />
                  <button
                    onClick={fetchLatestVersion}
                    disabled={busy}
                    title="Fetch latest version"
                    data-testid="button-get-latest"
                    className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                    style={{
                      background: "rgba(14,165,233,0.1)",
                      border: "1px solid rgba(14,165,233,0.25)",
                      color: "#38bdf8",
                    }}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isFetchingVersion ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </FieldGroup>
            </div>

            {/* Compression (Windows only) */}
            {!isMac(binaryType) && (
              <div
                className="rounded-xl px-4 py-3 flex flex-col gap-3"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="compress"
                    checked={compressZip}
                    onCheckedChange={v => setCompressZip(!!v)}
                    data-testid="checkbox-compress"
                    className="border-white/20 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500"
                  />
                  <label htmlFor="compress" className="text-sm text-white/70 cursor-pointer select-none">
                    Compress output zip
                  </label>
                  {compressZip && (
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-white/40">Level</span>
                      <Input
                        type="number"
                        min={1}
                        max={9}
                        value={compressionLevel}
                        onChange={e => setCompressionLevel(Number(e.target.value))}
                        className="zenon-input w-16 font-mono text-sm text-center"
                        data-testid="input-compression-level"
                      />
                      <span className="text-xs text-white/40">/9</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={startDownload}
                disabled={busy}
                data-testid="button-download"
                className="flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: busy
                    ? "rgba(14,165,233,0.3)"
                    : "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
                  boxShadow: busy ? "none" : "0 0 24px rgba(14,165,233,0.3)",
                  color: "#fff",
                }}
              >
                {isDownloading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download Build
                  </>
                )}
              </button>

              <button
                onClick={copyPermLink}
                disabled={busy}
                data-testid="button-copy-link"
                className="h-11 px-5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                <Link2 className="h-4 w-4" />
                Copy Link
              </button>
            </div>
          </div>

          {/* Log console */}
          {logs.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(56,189,248,0.12)" }}
            >
              <div
                className="flex items-center gap-2 px-4 py-2 border-b"
                style={{
                  background: "rgba(14,165,233,0.05)",
                  borderColor: "rgba(56,189,248,0.12)",
                }}
              >
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="text-xs font-mono text-white/30 ml-2 tracking-widest uppercase">Output</span>
              </div>
              <pre
                ref={logRef}
                className="p-4 font-mono text-xs leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap"
                style={{
                  background: "rgba(0,0,0,0.5)",
                  color: "#4ade80",
                }}
                data-testid="log-output"
              >
                {logs.map((line, i) => {
                  const isError = line.startsWith("[!");
                  const isInfo = line.startsWith("[*");
                  return (
                    <span
                      key={i}
                      style={{
                        color: isError ? "#f87171" : isInfo ? "#facc15" : "#4ade80",
                        display: "block",
                      }}
                    >
                      <span style={{ color: "#38bdf8", opacity: 0.5 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {"  "}
                      {line}
                    </span>
                  );
                })}
              </pre>
            </div>
          )}

          {/* Footer hint */}
          <p className="text-center text-xs text-white/20 flex items-center justify-center gap-1.5">
            <ChevronRight className="h-3 w-3" />
            Fetches packages directly from Roblox CDN and assembles the build in your browser
          </p>
        </div>
      </div>

      <style>{`
        .zenon-input {
          background: rgba(255,255,255,0.04) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: rgba(255,255,255,0.85) !important;
          height: 36px !important;
        }
        .zenon-input::placeholder {
          color: rgba(255,255,255,0.2) !important;
        }
        .zenon-input:focus {
          border-color: rgba(14,165,233,0.5) !important;
          box-shadow: 0 0 0 2px rgba(14,165,233,0.1) !important;
          outline: none !important;
        }
        .zenon-input:disabled {
          opacity: 0.4 !important;
        }
      `}</style>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
        {label}
      </Label>
      {children}
    </div>
  );
}
