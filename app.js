const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  res.json({ message: "SSYouTube backend running" });
});

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
    const apiUrl = `https://us-central1-ytmp3-tube.cloudfunctions.net/searchResult?q=${encodeURIComponent(
      query
    )}`;
    console.log(`📡 Calling primary API: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json"
      }
    });

    console.log(`📥 Primary API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("⚠️ Primary API error body:", errorText);
      console.warn("⚠️ Primary API failed. Trying fallback...");

      const apiKey = "AIzaSyBroZLzFmEnzoatDROyaDIMBT-iXk28eLk";
      if (!apiKey) {
        return res.status(500).json({
          error:
            "Primary API failed and YOUTUBE_API_KEY is missing for fallback.",
          details: errorText
        });
      }

      const fallbackUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(
        query
      )}&maxResults=5&key=${apiKey}`;
      console.log("📡 Calling fallback API");

      const fallbackResponse = await fetch(fallbackUrl);
      console.log(`📥 Fallback API response status: ${fallbackResponse.status}`);

      if (!fallbackResponse.ok) {
        const fbErrText = await fallbackResponse.text();
        console.warn("❌ Fallback API error body:", fbErrText);
        throw new Error("Both primary and fallback APIs failed");
      }

      const fallbackData = await fallbackResponse.json();

      const videoResults = fallbackData.items.map((item) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail:
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url
      }));

      return res.json(videoResults);
    }

    const data = await response.json();
    console.log("✅ Primary API response received");

    if (Array.isArray(data)) {
      const videoResults = data.map((item) => ({
        id: item.videoId,
        title: item.title,
        thumbnail: item.imgSrc
      }));
      return res.json(videoResults);
    }

    console.warn("❗ Unexpected format from primary API:", data);
    return res
      .status(500)
      .json({ error: "Unexpected response format from primary API" });
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

