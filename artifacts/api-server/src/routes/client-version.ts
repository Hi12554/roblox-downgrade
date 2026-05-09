import { Router } from "express";
import { GetClientVersionQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/client-version", async (req, res) => {
  const parsed = GetClientVersionQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { binaryType, channel = "LIVE" } = parsed.data;
  const channelPath =
    channel === "LIVE" ? "LIVE" : channel.toLowerCase();

  const url = `https://clientsettings.roblox.com/v2/client-version/${binaryType}/channel/${channelPath}`;

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      res
        .status(502)
        .json({ error: `Roblox returned ${upstream.status}` });
      return;
    }
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch client version");
    res.status(500).json({ error: "Failed to reach Roblox API" });
  }
});

export default router;
