const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

require("dotenv").config();

const app = express();

const SEARCHAPI_KEY = "FdJt9AxydYkGvJAK6SrUP3sJ";
const SEARCHAPI_BASE_URL =
  process.env.SEARCHAPI_BASE_URL || "https://www.searchapi.io/api/v1/search";

app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  res.json({ message: "SSYouTube backend running" });
});

function normalizeViews(v) {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "number") return new Intl.NumberFormat("en-US").format(v);
  return String(v);
}

function extractSearchApiVideos(payload) {
  if (!payload || typeof payload !== "object") return [];
  const maybe =
    payload.videos ||
    payload.video_results ||
    payload.videoResults ||
    payload.results?.videos ||
    payload.data?.videos;
  return Array.isArray(maybe) ? maybe : [];
}

function toAppVideo(v) {
  const id = v?.id || v?.video_id || v?.videoId;
  const title = v?.title || v?.name;
  if (!id || !title) return null;

  const thumb =
    (typeof v?.thumbnail === "string" && v.thumbnail) ||
    v?.thumbnail?.static ||
    v?.thumbnail?.rich ||
    v?.thumbnail?.url ||
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

  return {
    id: String(id),
    title: String(title),
    thumbnail: String(thumb),
    channel: v?.author || v?.channel?.title || v?.channelTitle || "",
    views: normalizeViews(v?.views),
    length:
      v?.length ||
      v?.duration ||
      v?.length_text ||
      v?.lengthSeconds ||
      v?.length_seconds ||
      "",
    published: v?.published_time || v?.publishedAt || v?.published || ""
  };
}

app.get("/api/search", async (req, res) => {
  console.log("✅ Received search request:", req.query);

  let query = req.query.q;
  if (!query) {
    console.error("❌ Missing query parameter 'q'");
    return res.status(400).json({ error: 'Query parameter "q" is required.' });
  }

  console.log(`🔍 Original query: ${query}`);

  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/;
  const match = query.match(youtubeRegex);
  if (match && match[1]) {
    query = match[1];
    console.log(`🎯 Extracted video ID: ${query}`);
  }

  try {
    // Primary: SearchAPI.io (reliable, avoids YouTube quota surprises)
    if (SEARCHAPI_KEY) {
      const searchUrl = new URL(SEARCHAPI_BASE_URL);
      searchUrl.searchParams.set("engine", "youtube");
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("api_key", SEARCHAPI_KEY);

      console.log("📡 Calling SearchAPI.io (engine=youtube)");
      const r = await fetch(searchUrl.toString(), {
        method: "GET",
        headers: { Accept: "application/json" }
      });
      console.log(`📥 SearchAPI.io response status: ${r.status}`);

      if (r.ok) {
        const payload = await r.json();
        const rawVideos = extractSearchApiVideos(payload);
        const videos = rawVideos.map(toAppVideo).filter(Boolean);
        if (videos.length) return res.json(videos);
        console.warn("⚠️ SearchAPI.io returned no videos; falling back…");
      } else {
        const text = await r.text().catch(() => "");
        console.warn("⚠️ SearchAPI.io error body:", text);
      }
    } else {
      console.warn("⚠️ SEARCHAPI_KEY missing; skipping SearchAPI.io");
    }

    // Fallback: YouTube Data API v3 (requires YOUTUBE_API_KEY + quota)
    const apiKey = "AIzaSyBroZLzFmEnzoatDROyaDIMBT-iXk28eLk";
    if (!apiKey) {
      return res.status(500).json({
        error: "Missing API keys",
        details: "Set SEARCHAPI_KEY (recommended) or YOUTUBE_API_KEY (fallback)."
      });
    }

    const fallbackUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(
      query
    )}&maxResults=5&key=${apiKey}`;
    console.log("📡 Calling YouTube Data API fallback");

    const fallbackResponse = await fetch(fallbackUrl);
    console.log(`📥 Fallback API response status: ${fallbackResponse.status}`);

    if (!fallbackResponse.ok) {
      const fbErrText = await fallbackResponse.text().catch(() => "");
      console.warn("❌ Fallback API error body:", fbErrText);
      throw new Error("SearchAPI and YouTube fallback failed");
    }

    const fallbackData = await fallbackResponse.json();
    const items = Array.isArray(fallbackData?.items) ? fallbackData.items : [];
    const videoResults = items
      .map((item) => ({
        id: item?.id?.videoId,
        title: item?.snippet?.title,
        thumbnail:
          item?.snippet?.thumbnails?.medium?.url ||
          item?.snippet?.thumbnails?.default?.url,
        channel: item?.snippet?.channelTitle || "",
        views: "",
        length: "",
        published: item?.snippet?.publishedAt || ""
      }))
      .filter((v) => v.id && v.title && v.thumbnail);

    return res.json(videoResults);
  } catch (error) {
    console.error("❌ Error in /api/search:", error);
    res.status(500).json({
      error: "Error fetching search results",
      details: error.message,
      message: "Please try again later or use a different search term"
    });
  }
});

app.get("/api/mp3-iframe", (req, res) => {
  const videoId = req.query.videoId;
  if (!videoId) {
    return res.status(400).json({ error: 'Query parameter "videoId" is required.' });
  }

  const iframeUrls = [
    `//mp3api.ytjar.info/?id=${videoId}`,
    `//mp3api.ytjar.info/?id=${videoId}&c=FF0000&b=EEEEEE`,
    `//mp3api.ytjar.info/?id=${videoId}&c=FF0000&b=EEEEEE&t`
  ];

  res.json({ iframeUrls });
});

app.get("/api/mp4-iframe", (req, res) => {
  const videoId = req.query.videoId;
  if (!videoId) {
    return res.status(400).json({ error: 'Query parameter "videoId" is required.' });
  }

  const iframeUrls = [
    `//mp4api.ytjar.info/?id=${videoId}`,
    `//mp4api.ytjar.info/?id=${videoId}&c=FF0000&b=EEEEEE&t&h=40px`,
    `//mp4api.ytjar.info/?id=${videoId}&c=FF0000&b=EEEEEE&t&h=40px&cb=FFFFFF&cc=FF0000&br=FF0000`
  ];

  res.json({ iframeUrls });
});

app.get("/api/download-mp3", (req, res) => {
  if (process.env.VERCEL) {
    return res.status(501).json({
      error:
        "This endpoint is not supported on Vercel (yt-dlp + file downloads require a non-serverless host)."
    });
  }

  const videoId = req.query.videoId;
  if (!videoId) {
    return res.status(400).json({ error: 'Query parameter "videoId" is required.' });
  }

  console.log(`Backend received download request for video ID: ${videoId}`);

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const downloadDir = path.join(__dirname, "downloads");
  const outputTemplate = path.join(downloadDir, "%(title)s.%(ext)s");

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const ytdlp = spawn("yt-dlp", ["-x", "--audio-format", "mp3", "-o", outputTemplate, youtubeUrl]);
  let responded = false;

  const safeJson = (status, payload) => {
    if (responded || res.headersSent) return;
    responded = true;
    res.status(status).json(payload);
  };

  ytdlp.stdout.on("data", (data) => {
    console.log(`yt-dlp stdout: ${data}`);
  });

  ytdlp.stderr.on("data", (data) => {
    console.error(`yt-dlp stderr: ${data}`);
  });

  ytdlp.on("error", (error) => {
    console.error(`Failed to start yt-dlp process: ${error}`);
    if (error.code === "ENOENT") {
      safeJson(500, {
        error: "yt-dlp command not found. Please install yt-dlp and add it to PATH."
      });
    } else {
      safeJson(500, { error: "Failed to start download process." });
    }
  });

  ytdlp.on("close", (code) => {
    console.log(`yt-dlp process exited with code ${code}`);

    if (responded || res.headersSent) return;
    if (code !== 0) {
      return safeJson(500, { error: `Download and conversion failed with code ${code}.` });
    }

    fs.readdir(downloadDir, (err, files) => {
      if (err) {
        console.error("Error reading download directory:", err);
        return safeJson(500, { error: "Error finding downloaded file." });
      }

      const mp3Files = files.filter((f) => f.toLowerCase().endsWith(".mp3"));
      if (mp3Files.length === 0) {
        return safeJson(500, { error: "Downloaded file not found." });
      }

      mp3Files.sort((a, b) => {
        const fileA = fs.statSync(path.join(downloadDir, a)).mtime.getTime();
        const fileB = fs.statSync(path.join(downloadDir, b)).mtime.getTime();
        return fileB - fileA;
      });

      const fileToSend = mp3Files[0];
      const filePath = path.join(downloadDir, fileToSend);

      res.download(filePath, fileToSend, (sendErr) => {
        if (sendErr) {
          console.error("Error sending file:", sendErr);
          return safeJson(500, { error: "Error sending file." });
        }

        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting file:", unlinkErr);
        });
      });
    });
  });
});

module.exports = app;

