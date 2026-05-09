import { Router } from "express";
import { ListVersionsQueryParams } from "@workspace/api-zod";

const router = Router();

interface RobloxVersion {
  versionHash: string;
  versionNumber: string | null;
  type: string;
  deployedAt: string;
  fileVersion: string | null;
}

let cachedVersions: RobloxVersion[] | null = null;
let cacheTime: number | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchDeployHistory(): Promise<RobloxVersion[]> {
  if (cachedVersions && cacheTime && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedVersions;
  }

  const response = await fetch("https://setup.rbxcdn.com/DeployHistory.txt");
  if (!response.ok) {
    throw new Error(`Failed to fetch deploy history: ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split("\n").filter((l) => l.trim());

  const versions: RobloxVersion[] = [];

  for (const line of lines) {
    const match = line.match(
      /^New\s+(\S+)\s+(version-[a-f0-9]+)\s+at\s+(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)(?:,\s+file version:\s*([\d,\s]+?))?\.{3}/i
    );
    if (!match) continue;

    const [, type, versionHash, dateStr, fileVersionRaw] = match;

    let deployedAt: string;
    try {
      deployedAt = new Date(dateStr.trim()).toISOString();
    } catch {
      continue;
    }

    let fileVersion: string | null = null;
    let versionNumber: string | null = null;

    if (fileVersionRaw) {
      const fileVersionParts = fileVersionRaw
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      fileVersion = fileVersionParts.join(".");
      if (fileVersionParts.length >= 4) {
        versionNumber = `${fileVersionParts[0]}.${fileVersionParts[1]}.${fileVersionParts[2]}.${fileVersionParts[3]}`;
      }
    }

    versions.push({
      versionHash,
      versionNumber,
      type,
      deployedAt,
      fileVersion,
    });
  }

  versions.reverse();

  cachedVersions = versions;
  cacheTime = Date.now();
  return versions;
}

router.get("/versions", async (req, res) => {
  const parsed = ListVersionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { type, search, page = 1, pageSize = 50 } = parsed.data;

  try {
    let versions = await fetchDeployHistory();

    if (type) {
      versions = versions.filter(
        (v) => v.type.toLowerCase() === type.toLowerCase()
      );
    }

    if (search) {
      const q = search.toLowerCase();
      versions = versions.filter(
        (v) =>
          v.versionHash.toLowerCase().includes(q) ||
          (v.versionNumber && v.versionNumber.toLowerCase().includes(q)) ||
          (v.fileVersion && v.fileVersion.toLowerCase().includes(q))
      );
    }

    const total = versions.length;
    const start = (page - 1) * pageSize;
    const paginated = versions.slice(start, start + pageSize);

    res.json({ versions: paginated, total, page, pageSize });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch versions");
    res.status(500).json({ error: "Failed to fetch Roblox version history" });
  }
});

router.get("/versions/latest", async (req, res) => {
  try {
    const versions = await fetchDeployHistory();
    const latestByType = new Map<string, RobloxVersion>();
    for (const v of versions) {
      if (!latestByType.has(v.type)) {
        latestByType.set(v.type, v);
      }
    }
    res.json(Array.from(latestByType.values()));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch latest versions");
    res.status(500).json({ error: "Failed to fetch Roblox version history" });
  }
});

export default router;
