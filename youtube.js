// Latest videos from the CFP YouTube channel, read from its public RSS feed at build time.
// If the feed can't be reached (offline build), the site falls back to a link to the channel.
export function parseFeed(xml) {
  const entries = xml.split("<entry>").slice(1);
  const pick = (s, re) => (s.match(re) || [])[1] || "";
  const unescape = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return entries.map((e) => {
    const id = pick(e, /<yt:videoId>([^<]+)<\/yt:videoId>/);
    return {
      id,
      title: unescape(pick(e, /<title>([^<]*)<\/title>/)),
      date: new Date(pick(e, /<published>([^<]+)<\/published>/)),
      url: `https://www.youtube.com/watch?v=${id}`,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }).filter((v) => v.id);
}

export async function fetchVideos(channelId, limit = 8) {
  if (!channelId || process.env.SKIP_YOUTUBE) return [];
  if (process.env.YOUTUBE_TEST_FEED) { const fs = await import("node:fs"); return parseFeed(fs.readFileSync(process.env.YOUTUBE_TEST_FEED, "utf8")).slice(0, limit); }
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseFeed(await res.text()).slice(0, limit);
  } catch (err) {
    console.warn(`[youtube] could not load videos (${err.message}); showing channel link only`);
    return [];
  }
}
