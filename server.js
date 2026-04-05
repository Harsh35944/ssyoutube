const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// ✅ Multiple SearchAPI Keys
const SEARCHAPI_KEYS = [
  'FdJt9AxydYkGvJAK6SrUP3sJ'
];

const SEARCHAPI_BASE_URL = 'https://www.searchapi.io/api/v1/search';

// ✅ Multiple YouTube API Keys
const YOUTUBE_API_KEYS = [
  'AIzaSyCFBp9JWEN2DLD6xpUROTJtbhPy7XZ6PyA',
  'AIzaSyA1cMLjrnXTllaaEpT_5_20mNExCT6_3ew',
  'AIzaSyCHvBkkbRmxW6Vntv4Oh9A3qGIFQaM_FeE'
];

app.get('/', (req, res) => {
  res.json({ message: "Hello World" });
});

// ================= SEARCH API =================
app.get('/api/search', async (req, res) => {
  let query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required.' });
  }

  console.log(`🔍 Query: ${query}`);

  // ✅ Check if query is a YouTube URL or video ID → return single video directly
  const idMatch = query.match(/(?:youtube\.com\/watch\?.*[?&]v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/);
  const plainIdMatch = query.match(/^([\w-]{11})$/);

  if (idMatch || plainIdMatch) {
    const videoId = idMatch ? idMatch[1] : plainIdMatch[1];

    console.log(`🎯 Detected YouTube video ID: ${videoId}`);

    // Fetch video info via YouTube oEmbed API (no API key needed)
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );

      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        return res.json([{
          id: videoId,
          title: oembedData.title || 'YouTube Video',
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          channel: oembedData.author_name || '',
          views: '',
          length: '',
          published: ''
        }]);
      }
    } catch (err) {
      console.error('❌ oEmbed fetch failed:', err.message);
    }

    // Fallback: return video with basic info
    return res.json([{
      id: videoId,
      title: 'YouTube Video',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      channel: '',
      views: '',
      length: '',
      published: ''
    }]);
  }

  try {
    // ================= PRIMARY (SearchAPI multi-key) =================
    let searchAPIData = null;

    for (let i = 0; i < SEARCHAPI_KEYS.length; i++) {
      const key = SEARCHAPI_KEYS[i];

      const url = `${SEARCHAPI_BASE_URL}?engine=youtube&q=${encodeURIComponent(query)}&api_key=${key}`;
      console.log(`📡 SearchAPI Key ${i + 1}`);

      try {
        const response = await fetch(url);

        if (!response.ok) continue;

        const data = await response.json();

        if (data.videos && data.videos.length > 0) {
          console.log(`✅ SearchAPI success with key ${i + 1}`);
          searchAPIData = data;
          break;
        }

      } catch (err) {
        console.error(`❌ SearchAPI key ${i + 1} error:`, err.message);
      }
    }

    if (searchAPIData) {
      const results = searchAPIData.videos.map(v => ({
        id: v.id,
        title: v.title,
        thumbnail: v.thumbnail?.static || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        channel: v.channel?.title || '',
        views: v.views || '',
        length: v.length || '',
        published: v.published_time || ''
      }));

      return res.json(results);
    }

    console.warn("⚠️ All SearchAPI keys failed");

    // ================= SECONDARY API =================
    const apiUrl = `https://us-central1-ytmp3-tube.cloudfunctions.net/searchResult?q=${encodeURIComponent(query)}`;

    const response = await fetch(apiUrl);

    if (response.ok) {
      const data = await response.json();

      if (Array.isArray(data)) {
        const results = data.map(item => ({
          id: item.videoId,
          title: item.title,
          thumbnail: item.imgSrc,
          channel: '',
          views: '',
          length: '',
          published: ''
        }));

        return res.json(results);
      }
    }

    console.warn("⚠️ Secondary API failed");

    // ================= FALLBACK (YouTube multi-key) =================
    let ytData = null;

    for (let i = 0; i < YOUTUBE_API_KEYS.length; i++) {
      const key = YOUTUBE_API_KEYS[i];

      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=5&key=${key}`;

      console.log(`📡 YouTube Key ${i + 1}`);

      try {
        const resYT = await fetch(url);

        if (!resYT.ok) continue;

        const data = await resYT.json();

        if (data.items && data.items.length > 0) {
          console.log(`✅ YouTube success with key ${i + 1}`);
          ytData = data;
          break;
        }

      } catch (err) {
        console.error(`❌ YouTube key ${i + 1} error:`, err.message);
      }
    }

    if (!ytData) {
      throw new Error('All APIs failed');
    }

    const results = ytData.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium.url,
      channel: item.snippet.channelTitle || '',
      views: '',
      length: '',
      published: item.snippet.publishedAt || ''
    }));

    return res.json(results);

  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ================= MP3 IFRAME =================
app.get('/api/mp3-iframe', (req, res) => {
  const { videoId } = req.query;

  if (!videoId) return res.status(400).json({ error: 'videoId required' });

  res.json({
    iframeUrls: [
      `//mp3api.ytjar.info/?id=${videoId}`,
      `//mp3api.ytjar.info/?id=${videoId}&c=FF0000`
    ]
  });
});

// ================= MP4 IFRAME =================
app.get('/api/mp4-iframe', (req, res) => {
  const { videoId } = req.query;

  if (!videoId) return res.status(400).json({ error: 'videoId required' });

  res.json({
    iframeUrls: [
      `//mp4api.ytjar.info/?id=${videoId}`,
      `//mp4api.ytjar.info/?id=${videoId}&c=FF0000`
    ]
  });
});

// ================= DOWNLOAD =================
app.get('/api/download-mp3', (req, res) => {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: 'videoId required' });
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const output = path.join(__dirname, 'downloads', '%(title)s.%(ext)s');

  if (!fs.existsSync('downloads')) fs.mkdirSync('downloads');

  const ytdlp = spawn('yt-dlp', ['-x', '--audio-format', 'mp3', '-o', output, youtubeUrl]);

  ytdlp.on('close', () => {
    const files = fs.readdirSync('downloads').filter(f => f.endsWith('.mp3'));

    if (!files.length) {
      return res.status(500).json({ error: 'No file' });
    }

    const file = files[files.length - 1];
    const filePath = path.join('downloads', file);

    res.download(filePath, file, () => {
      fs.unlinkSync(filePath);
    });
  });
});

// ================= START =================
app.listen(port, () => {
  console.log(`🚀 Server running: http://localhost:${port}`);
});
