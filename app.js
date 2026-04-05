// // backend/server.js

// const express = require('express');
// const cors = require('cors');
// const fetch = require('node-fetch');
// const { spawn } = require('child_process');
// const path = require('path');
// const fs = require('fs');

// const app = express();
// const port = 5000;

// // SearchAPI.io Configuration
// const SEARCHAPI_KEY = 'FdJt9AxydYkGvJAK6SrUP3sJ';
// // const SEARCHAPI_KEY = 'AIzaSyB8py6ho6eKgkEJ9m1RVQUBGGEQAvTgo-Q';
// const SEARCHAPI_BASE_URL = 'https://www.searchapi.io/api/v1/search';

// app.use(cors());
// app.use(express.json());

// app.get('/', async (req, res) => {
//   res.json({ message: "Hello World" });
// });

// // Search API with SearchAPI.io integration
// app.get('/api/search', async (req, res) => {
//   console.log("✅ Received search request:", req.query);
  
//   let query = req.query.q;
  
//   if (!query) {
//     console.error("❌ Missing query parameter 'q'");
//     return res.status(400).json({ error: 'Query parameter "q" is required.' });
//   }

//   console.log(`🔍 Original query: ${query}`);

//   // Extract YouTube video ID if present
//   const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/;
//   const match = query.match(youtubeRegex);
//   if (match && match[1]) {
//     query = match[1];
//     console.log(`🎯 Extracted video ID: ${query}`);
//   }

//   try {
//     // Primary API - SearchAPI.io for YouTube search
//     const searchAPIUrl = `${SEARCHAPI_BASE_URL}?engine=youtube&q=${encodeURIComponent(query)}&api_key=${SEARCHAPI_KEY}`;
//     console.log(`📡 Calling SearchAPI.io: ${searchAPIUrl.replace(SEARCHAPI_KEY, '***API_KEY***')}`);

//     const searchAPIResponse = await fetch(searchAPIUrl, {
//       method: 'GET',
//       headers: {
//         'Accept': 'application/json'
//       }
//     });

//     console.log(`📥 SearchAPI.io response status: ${searchAPIResponse.status}`);

//     if (searchAPIResponse.ok) {
//       const searchAPIData = await searchAPIResponse.json();
//       console.log("✅ SearchAPI.io data received");

//       // Check if we have videos in response
//       if (searchAPIData.videos && Array.isArray(searchAPIData.videos) && searchAPIData.videos.length > 0) {
//         // Transform SearchAPI.io format to our format
//         const videoResults = searchAPIData.videos.map(video => ({
//           id: video.id,
//           title: video.title,
//           thumbnail: video.thumbnail?.static || video.thumbnail?.rich || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
//           channel: video.channel?.title || 'Unknown Channel',
//           views: video.views || '',
//           length: video.length || '',
//           published: video.published_time || ''
//         }));

//         console.log(`✅ Returning ${videoResults.length} videos from SearchAPI.io`);
//         return res.json(videoResults);
//       }
//     }

//     // If SearchAPI.io fails, try secondary API
//     console.warn("⚠️ SearchAPI.io failed or returned no results. Trying secondary API...");

//     // Secondary API - Original ytmp3-tube
//     const apiUrl = `https://us-central1-ytmp3-tube.cloudfunctions.net/searchResult?q=${encodeURIComponent(query)}`;
//     console.log(`📡 Calling secondary API: ${apiUrl}`);

//     const response = await fetch(apiUrl, {
//       headers: {
//         'User-Agent': 'Mozilla/5.0',
//         'Accept': 'application/json',
//         'Origin': 'http://localhost:3000'
//       }
//     });

//     console.log(`📥 Secondary API response status: ${response.status}`);

//     if (!response.ok) {
//       const errorText = await response.text();
//       console.warn("⚠️ Secondary API error body:", errorText);
//       console.warn('⚠️ Secondary API failed. Trying fallback...');

//       // Fallback to YouTube Data API v3
//       const apiKey = 'AIzaSyC33DvcVRmKM7cEM9LPmShJkUNNFffnDtE';
//       const fallbackUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=5&key=${apiKey}`;
//       console.log(`📡 Calling fallback API: ${fallbackUrl}`);

//       const fallbackResponse = await fetch(fallbackUrl);
//       console.log(`📥 Fallback API response status: ${fallbackResponse.status}`);

//       if (!fallbackResponse.ok) {
//         const fbErrText = await fallbackResponse.text();
//         console.warn("❌ Fallback API error body:", fbErrText);
//         throw new Error('All APIs (SearchAPI, Primary, and YouTube) failed');
//       }

//       const fallbackData = await fallbackResponse.json();
//       console.log("✅ Fallback data received:", fallbackData);

//       const videoResults = fallbackData.items.map(item => ({
//         id: item.id.videoId,
//         title: item.snippet.title,
//         thumbnail: item.snippet.thumbnails.medium.url,
//         channel: item.snippet.channelTitle || 'Unknown Channel',
//         views: '',
//         length: '',
//         published: item.snippet.publishedAt || ''
//       }));

//       return res.json(videoResults);
//     }

//     // Success: secondary API worked
//     const data = await response.json();
//     console.log("✅ Secondary API response received:", data);

//     if (Array.isArray(data)) {
//       const videoResults = data.map((item) => ({
//         id: item.videoId,
//         title: item.title,
//         thumbnail: item.imgSrc,
//         channel: '',
//         views: '',
//         length: '',
//         published: ''
//       }));
//       return res.json(videoResults);
//     } else {
//       console.warn("❗ Unexpected format from secondary API:", data);
//       return res.status(500).json({ error: 'Unexpected response format from secondary API' });
//     }

//   } catch (error) {
//     console.error("❌ Error in /api/search:", error);
//     res.status(500).json({
//       error: 'Error fetching search results',
//       details: error.message,
//       message: 'Please try again later or use a different search term'
//     });
//   }
// });

// // MP3 iframe endpoint
// app.get('/api/mp3-iframe', (req, res) => {
//   const videoId = req.query.videoId;
//   if (!videoId) {
//     return res.status(400).json({ error: 'Query parameter "videoId" is required.' });
//   }

//   const iframeUrls = [
//     `//mp3api.ytjar.info/?id=${videoId}`,
//     `//mp3api.ytjar.info/?id=${videoId}&c=FF0000&b=EEEEEE`,
//     `//mp3api.ytjar.info/?id=${videoId}&c=FF0000&b=EEEEEE&t`
//   ];

//   res.json({ iframeUrls });
// });

// // MP4 iframe endpoint
// app.get('/api/mp4-iframe', (req, res) => {
//   const videoId = req.query.videoId;
//   if (!videoId) {
//     return res.status(400).json({ error: 'Query parameter "videoId" is required.' });
//   }

//   const iframeUrls = [
//     `//mp4api.ytjar.info/?id=${videoId}`,
//     `//mp4api.ytjar.info/?id=${videoId}&c=FF0000&b=EEEEEE&t&h=40px`,
//     `//mp4api.ytjar.info/?id=${videoId}&c=FF0000&b=EEEEEE&t&h=40px&cb=FFFFFF&cc=FF0000&br=FF0000`
//   ];

//   res.json({ iframeUrls });
// });

// // Download MP3 endpoint
// app.get('/api/download-mp3', (req, res) => {
//   const videoId = req.query.videoId;
//   if (!videoId) {
//     return res.status(400).json({ error: 'Query parameter "videoId" is required.' });
//   }

//   console.log(`Backend received download request for video ID: ${videoId}`);

//   const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
//   const outputTemplate = path.join(__dirname, 'downloads', '%(title)s.%(ext)s');

//   const downloadDir = path.join(__dirname, 'downloads');
//   if (!fs.existsSync(downloadDir)) {
//     fs.mkdirSync(downloadDir);
//   }

//   const ytdlp = spawn('yt-dlp', ['-x', '--audio-format', 'mp3', '-o', outputTemplate, youtubeUrl]);

//   let downloadFilePath = null;

//   ytdlp.stdout.on('data', (data) => {
//     console.log(`yt-dlp stdout: ${data}`);

//     const match = data.toString().match(/Destination:\s+(.+)\.mp3/);
//     if (match && match[1]) {
//       downloadFilePath = `${match[1]}.mp3`;
//       console.log(`Detected potential download path: ${downloadFilePath}`);
//     }

//     const convertingMatch = data.toString().match(/\[ExtractAudio]\s+Destination:\s+(.+)/);
//     if (convertingMatch && convertingMatch[1]) {
//       downloadFilePath = convertingMatch[1];
//       console.log(`Detected conversion destination: ${downloadFilePath}`);
//     }
//   });

//   ytdlp.stderr.on('data', (data) => {
//     console.error(`yt-dlp stderr: ${data}`);
//   });

//   ytdlp.on('error', (error) => {
//     console.error(`Failed to start yt-dlp process: ${error}`);

//     if (error.code === 'ENOENT') {
//       res.status(500).json({ error: 'yt-dlp command not found. Please ensure yt-dlp is installed and in your system\'s PATH.' });
//     } else {
//       res.status(500).json({ error: 'Failed to start download process.' });
//     }
//   });

//   ytdlp.on('close', (code) => {
//     console.log(`yt-dlp process exited with code ${code}`);
//     if (code === 0) {
//       fs.readdir(downloadDir, (err, files) => {
//         if (err) {
//           console.error("Error reading download directory:", err);
//           return res.status(500).json({ error: 'Error finding downloaded file.' });
//         }

//         const mp3Files = files.filter(f => f.endsWith('.mp3'));
//         if (mp3Files.length > 0) {
//           mp3Files.sort((a, b) => {
//             const fileA = fs.statSync(path.join(downloadDir, a)).mtime.getTime();
//             const fileB = fs.statSync(path.join(downloadDir, b)).mtime.getTime();
//             return fileB - fileA;
//           });

//           const fileToSend = mp3Files[0];
//           const filePath = path.join(downloadDir, fileToSend);
//           console.log(`Sending file: ${filePath}`);

//           res.download(filePath, fileToSend, (err) => {
//             if (err) {
//               console.error("Error sending file:", err);
//               if (!res.headersSent) {
//                 res.status(500).json({ error: 'Error sending file.' });
//               }
//             } else {
//               console.log("File sent successfully.");
//               fs.unlink(filePath, (unlinkErr) => {
//                 if (unlinkErr) console.error("Error deleting file:", unlinkErr);
//                 else console.log("File deleted:", filePath);
//               });
//             }
//           });
//         } else {
//           console.error("No mp3 file found in download directory after yt-dlp finished.");
//           res.status(500).json({ error: 'Downloaded file not found.' });
//         }
//       });
//     } else {
//       console.error(`yt-dlp failed with code ${code}`);
//       res.status(500).json({ error: `Download and conversion failed with code ${code}.` });
//     }
//   });
// });

// app.listen(port, () => {
//   console.log(`Backend server running on port ${port}`);
//   console.log(`API endpoints available at http://localhost:${port}/api/`);
// });




// working code start 
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
// AIzaSyD3Qbz14hwDQ8OPUDk6X3Sh6cfRLjyFU6M
// AIzaSyB9sgCGaNiJnKqLxMLvKm4mjYWALtbrSng
// AIzaSyBL5qxucKJ7j5Sk3y_4FkyxywQVuS77QRg
const YOUTUBE_API_KEYS = [
  'AIzaSyAJuygLF9ew9VwIKWUqWpa1yxEKeI0LIjc',
  'AIzaSyB9sgCGaNiJnKqLxMLvKm4mjYWALtbrSng',
  'AIzaSyBL5qxucKJ7j5Sk3y_4FkyxywQVuS77QRg'
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

  // Extract YouTube ID
  const match = query.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (match) query = match[1];

  try {
    // ================= PRIMARY (SearchAPI multi-key) =================
    let searchAPIData = null;

    for (let i = 0; i < SEARCHAPI_KEYS.length; i++) {
      const key = SEARCHAPI_KEYS[i];

      const url = `${SEARCHAPI_BASE_URL}?engine=youtube&q=${encodeURIComponent(query)}&api_key=${key}`;
      console.log(`📡 SearchAPI Key ${i + 1}`);

      try {
        const resnse = await fetch(url);

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

module.exports = app;




// new code notification 

// const express = require('express');
// const cors = require('cors');
// const fetch = require('node-fetch');
// const { spawn } = require('child_process');
// const path = require('path');
// const fs = require('fs');
// const admin = require('firebase-admin');

// const app = express();
// const port = 5000;

// app.use(cors());
// app.use(express.json());

// // ✅ Firebase credentials embedded directly (no external file)
// const serviceAccount = {
//   "type": "service_account",
//   "project_id": "flvto-fd504",
//   "private_key_id": "ba2b2bb0016d179a1cd06accb0ecc26d137f3159",
//   "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC61VMnItqudI71\nrK5jjzaxyCraAX/TDo8JyKr1jleG7iahroeg3lUDibrSTE+uR3nygoUctViiiV4s\nNYx35IiX1Y9BQH1qjBfhtEnwS3k9jaQ+RYFHtENRrCxTieLDDAIRFvek6PXEShCl\n8QNLjDaBpSIvxmjt42BPCsISkZ4pgV76rlRI3PvhUVJeVwoB4wf35BrMBsDlZqm7\nA9ISWbsaFMOpZv+fDOzDGHX0tmtgivGYV5zPpLgSihhhnVOH225pvbzcx37mDNCL\nglju6Lza0UbOekjPeMkJ7wnBjUTZGv7nai2O8Jas+5Atnyg3ev2AWw19SrSTF5q+\neCxjKyE9AgMBAAECggEADY6IodnwLcFPP/QyKY8SVtdG2rpJ9OiFHbPgnyr0tBmo\nQR+e/5/aYdnBg1xzr1pINuixxs9BhEu87a7LXPC+2OuaC+VQJGYlc88coAcjSpbc\n8ILOb8OcsJAHyF5Z5LFvSJ+sGQcpZtSWqCqDRMetYH4Oa2fgJHDVA8SXUqMb1k2J\nGmlXXf+GMUUNGZCoax3WP8XRlKIS+WtNdiJ2IaY9A8/YxAHWMLREgaMa23c5GgAq\n9oKE6VBPSM3NbzpzkZDLprkfMZuX4gfggmkebDDSUq+wQ5TV902kt/sQ1YJI1XZS\n0C+o6W2WEj8vPIbagEEJHiY8O2pUzlkrpLQM/tpuuQKBgQDuHbPDQEIqBHrjzqP0\nd6eVlPzaUrfgJz2hG1xhtI8gs1ni+Mzuh5WhnqNkpdH8Y+cEOHOEU+ubLshnu/86\nzAEJTsuEfBaTONou8ZRMZUoUP0Li3dtl52Rq/tgDKjVi080gtVMpqsPlZ25O2JHf\nSeTuUuLKa0Ua7jJLRYghvYs7VQKBgQDI3ZnRR2XzHIE/ZH90URZ754piPlD+eiUX\nozc3zKw1uKPwxX4ctV/7N+4UrrKpNqrK/zUPjSz2H6DI9ul82XW0uCNn7DBypL7T\nGDPaVtnKEbKGMwTKUvtyIUNQS0LsW13CyPWVepbsc9bUDp6cac8jdVYTQh5aAgdY\n1lUiZ/ZeSQKBgHwLcyNLLWywKsjUVGs9jksJc3PU1b9rEdsE4upvYoSZikEIddHp\nRhUNDHeZPrwp2yZCtkMAaOPNyk7oC/04W23a44DgF+6YFmmQJj5qId5MWm7PPsVm\ndtSacDOt4GPcjKb2bx1svWKbsEZY4h0dZKqW+ViT60stPXwi+9j/4jGFAoGBALG+\nbqOjY5LKsZBwFNzP+G5ySKGA9VkKqxIMqwskgWsUVXX0vREYarO6HWKN6KkWJ/Jz\n/Pci/Rtah4PuAlUpdSATJbmLZp+8KuRPcWsPGa/XEzvvn5iN79Vhm9hMkQ7oFsML\n401/6leYdgy2VyKf+t0sspteEc+iJfA10aYdiwSJAoGBAMh/WGVveOdEIrqICr+X\nMlbKMPhlhszuYE2eUW29wOBY88SBIU6cVV8MU7xtQZAEOtxgL0CTC1tWQzNsPyAL\nVt3RG27kXvQfvyKkZQPQPyC0OT5Ep8jhcq4rcYaumGtfV8b6Mz4Dqvpg0t5YoeI4\nUZbRmPbi8gSHPfJ+1L+nSwZc\n-----END PRIVATE KEY-----\n",
//   "client_email": "firebase-adminsdk-fbsvc@flvto-fd504.iam.gserviceaccount.com",
//   "client_id": "107472800721495604557",
//   "auth_uri": "https://accounts.google.com/o/oauth2/auth",
//   "token_uri": "https://oauth2.googleapis.com/token",
//   "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
//   "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40flvto-fd504.iam.gserviceaccount.com",
//   "universe_domain": "googleapis.com"
// };

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// // ✅ FCM Token embedded directly
// const DEVICE_FCM_TOKEN = 'eAue2xikSnGAIEfpTAU_S9:APA91bGYIZZEVEokO6kx9O4DjAAlMnQtK892ewlg62Tesixq1lvLxIuG4tJG5Ty9Y8Ukw7Y9ucUSyPlmZzL0__ZDsTlKeLI83G0r7oFKRAbvraW256amb6U';

// // ================= SEND NOTIFICATION FUNCTION =================
// async function sendErrorNotification(title, body, data = {}) {
//   const message = {
//     notification: { title, body },
//     data,
//     token: DEVICE_FCM_TOKEN
//   };

//   try {
//     const response = await admin.messaging().send(message);
//     console.log(`📤 Notification sent! ID: ${response}`);
//     return true;
//   } catch (error) {
//     console.error('❌ Error sending notification:', error.message);
//     return false;
//   }
// }

// // ================= HOME =================
// app.get('/', (req, res) => {
//   res.json({ 
//     message: "🚀 YouTube MP3 Server Running",
//     notification_status: '✅ Ready to send notifications'
//   });
// });

// // ================= SEARCH API WITH ERROR NOTIFICATIONS =================
// app.get('/api/search', async (req, res) => {
//   let query = req.query.q;

//   if (!query) {
//     return res.status(400).json({ error: 'Query parameter "q" is required.' });
//   }

//   console.log(`🔍 Query: ${query}`);

//   const match = query.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
//   if (match) query = match[1];

//   try {
//     // ================= PRIMARY (SearchAPI) =================
//     let searchAPIData = null;
//     const SEARCHAPI_KEYS = ['FdJt9AxydYkGvJAK6SrUP3sJ'];
//     const SEARCHAPI_BASE_URL = 'https://www.searchapi.io/api/v1/search';

//     for (let i = 0; i < SEARCHAPI_KEYS.length; i++) {
//       const key = SEARCHAPI_KEYS[i];
//       const url = `${SEARCHAPI_BASE_URL}?engine=youtube&q=${encodeURIComponent(query)}&api_key=${key}`;
      
//       console.log(`📡 Trying SearchAPI Key ${i + 1}`);

//       try {
//         const response = await fetch(url);
//         if (!response.ok) continue;

//         const data = await response.json();
//         if (data.videos && data.videos.length > 0) {
//           console.log(`✅ SearchAPI success`);
//           searchAPIData = data;
//           break;
//         }
//       } catch (err) {
//         console.error(`❌ SearchAPI error:`, err.message);
//       }
//     }

//     if (searchAPIData) {
//       const results = searchAPIData.videos.map(v => ({
//         id: v.id,
//         title: v.title,
//         thumbnail: v.thumbnail?.static || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
//         channel: v.channel?.title || '',
//         views: v.views || '',
//         length: v.length || '',
//         published: v.published_time || ''
//       }));

//       return res.json(results);
//     }

//     console.warn("⚠️ SearchAPI failed");

//     // ================= SECONDARY API =================
//     const apiUrl = `https://us-central1-ytmp3-tube.cloudfunctions.net/searchResult?q=${encodeURIComponent(query)}`;

//     try {
//       console.log(`📡 Trying Secondary API`);
//       const response = await fetch(apiUrl);

//       if (response.ok) {
//         const data = await response.json();

//         if (Array.isArray(data)) {
//           const results = data.map(item => ({
//             id: item.videoId,
//             title: item.title,
//             thumbnail: item.imgSrc,
//             channel: '',
//             views: '',
//             length: '',
//             published: ''
//           }));

//           return res.json(results);
//         }
//       }
//     } catch (err) {
//       console.error('❌ Secondary API error:', err.message);
//     }

//     console.warn("⚠️ Secondary API failed");

//     // ================= FALLBACK (YouTube API) =================
//     const YOUTUBE_API_KEYS = [
//       'AIzaSyBUOrd65clk1o-_20PU_C9HpLA5HvH8ILM',
//       'AIzaSyB9sgCGaNiJnKqLxMLvKm4mjYWALtbrSng',
//       'AIzaSyBL5qxucKJ7j5Sk3y_4FkyxywQVuS77QRg'
//     ];

//     let ytData = null;

//     for (let i = 0; i < YOUTUBE_API_KEYS.length; i++) {
//       const key = YOUTUBE_API_KEYS[i];
//       const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=5&key=${key}`;

//       console.log(`📡 Trying YouTube Key ${i + 1}`);

//       try {
//         const resYT = await fetch(url);
//         if (!resYT.ok) continue;

//         const data = await resYT.json();
//         if (data.items && data.items.length > 0) {
//           console.log(`✅ YouTube success with key ${i + 1}`);
//           ytData = data;
//           break;
//         }
//       } catch (err) {
//         console.error(`❌ YouTube key ${i + 1} error:`, err.message);
//       }
//     }

//     if (!ytData) {
//       console.error("❌ ALL APIS FAILED FOR QUERY:", query);
      
//       const sent = await sendErrorNotification(
//         '❌ Search Failed',
//         `Could not find: "${query}"`,
//         {
//           query,
//           timestamp: new Date().toISOString(),
//           errorType: 'SEARCH_FAILED'
//         }
//       );

//       return res.status(500).json({ 
//         error: 'All APIs failed',
//         notification_sent: sent
//       });
//     }

//     const results = ytData.items.map(item => ({
//       id: item.id.videoId,
//       title: item.snippet.title,
//       thumbnail: item.snippet.thumbnails.medium.url,
//       channel: item.snippet.channelTitle || '',
//       views: '',
//       length: '',
//       published: item.snippet.publishedAt || ''
//     }));

//     return res.json(results);

//   } catch (error) {
//     console.error("❌ Server Error:", error.message);
    
//     await sendErrorNotification(
//       '⚠️ Server Error',
//       error.message,
//       {
//         error: error.message,
//         timestamp: new Date().toISOString()
//       }
//     );

//     res.status(500).json({ error: 'Search failed' });
//   }
// });

// // ================= MP3 IFRAME =================
// app.get('/api/mp3-iframe', (req, res) => {
//   const { videoId } = req.query;
//   if (!videoId) return res.status(400).json({ error: 'videoId required' });

//   res.json({
//     iframeUrls: [
//       `//mp3api.ytjar.info/?id=${videoId}`,
//       `//mp3api.ytjar.info/?id=${videoId}&c=FF0000`
//     ]
//   });
// });

// // ================= MP4 IFRAME =================
// app.get('/api/mp4-iframe', (req, res) => {
//   const { videoId } = req.query;
//   if (!videoId) return res.status(400).json({ error: 'videoId required' });

//   res.json({
//     iframeUrls: [
//       `//mp4api.ytjar.info/?id=${videoId}`,
//       `//mp4api.ytjar.info/?id=${videoId}&c=FF0000`
//     ]
//   });
// });

// // ================= DOWNLOAD MP3 WITH ERROR NOTIFICATIONS =================
// app.get('/api/download-mp3', async (req, res) => {
//   const { videoId } = req.query;

//   if (!videoId) {
//     return res.status(400).json({ error: 'videoId required' });
//   }

//   const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
//   const output = path.join(__dirname, 'downloads', '%(title)s.%(ext)s');

//   if (!fs.existsSync('downloads')) fs.mkdirSync('downloads');

//   const ytdlp = spawn('yt-dlp', ['-x', '--audio-format', 'mp3', '-o', output, youtubeUrl]);

//   ytdlp.on('close', async () => {
//     const files = fs.readdirSync('downloads').filter(f => f.endsWith('.mp3'));

//     if (!files.length) {
//       console.error('❌ Download conversion failed for:', videoId);
//       await sendErrorNotification(
//         '❌ Download Failed',
//         `Could not convert: ${videoId}`,
//         { videoId, errorType: 'DOWNLOAD_FAILED' }
//       );

//       return res.status(500).json({ error: 'No file' });
//     }

//     const file = files[files.length - 1];
//     const filePath = path.join('downloads', file);

//     res.download(filePath, file, () => {
//       fs.unlinkSync(filePath);
//     });
//   });
// });

// // ================= START SERVER =================
// app.listen(port, () => {
//   console.log(`🚀 Server running: http://localhost:${port}`);
//   console.log('✅ FCM Token set - notifications ready!');
//   console.log(`📲 Token: ${DEVICE_FCM_TOKEN.substring(0, 30)}...\n`);
// });

// end code notification

