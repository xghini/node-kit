export { fn_static };
import kit from "../../main.js";
import { extname } from "path";
import { createReadStream } from "fs";

// Configuration
const MAX_PREVIEW_SIZE = 2 * 1024 * 1024; // 2MB max for text preview (reduced from 10MB)
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for streaming large files

// Define media file types that should be handled in a specific way
const MEDIA_EXTENSIONS = {
  // Images
  ".jpg": true,
  ".jpeg": true,
  ".png": true,
  ".gif": true,
  ".webp": true,
  ".svg": true,
  ".ico": true,
  ".bmp": true,
  ".tiff": true,
  ".tif": true,
  ".heic": true,
  ".avif": true,

  // Videos
  ".mp4": true,
  ".webm": true,
  ".avi": true,
  ".mov": true,
  ".wmv": true,
  ".flv": true,
  ".mkv": true,
  ".mpeg": true,
  ".mpg": true,
  ".m4v": true,
  ".3gp": true,
  ".ts": true,
  ".asf": true,
  ".mts": true,
  ".m2ts": true,

  // Audio
  ".mp3": true,
  ".wav": true,
  ".ogg": true,
  ".m4a": true,
  ".flac": true,
  ".aac": true,
  ".wma": true,
  ".mid": true,
  ".midi": true,
  ".opus": true,
  ".aiff": true,
  ".alac": true,
  ".amr": true,
  ".ape": true,
};
/**
 * 静态页面，将定义的url往后的都当作静态资源解析
 * @param {*} url
 * @param {*} path
 * @param {*} view 是否有视图界面 {html}|true|false
 */
function fn_static(url, path = ".", view = false) {
  let reg;
  if (url === "/") reg = new RegExp(`^/(.*)?$`);
  else reg = new RegExp(`^${url}(\/.*)?$`);
  this.addr(reg, "get", async (g) => {
    let filePath = kit.xpath(g.path.slice(url.length).replace(/^\//, ""), path);
    try {
      if (await kit.aisdir(filePath)) {
        if (view) {
          if (view.html) return g.html(view.html);
          else await handleDirectory(g, filePath, url);
        } else g.raw("not found");
      } else if (await kit.aisfile(filePath)) {
        await handleFile(g, filePath);
      } else {
        g.server._404(g);
      }
    } catch (error) {
      console.error("Error handling request:", error);
      g.err(500, "Server error processing request");
    }
  });
}

async function handleDirectory(g, filePath, url) {
  let files = await kit.adir(filePath);
  let html = fileSystem;
  if (url != g.path) {
    let parentPath = g.path.split("/").slice(0, -1).join("/") || "/";
    html += `<a href="${parentPath}" class="parent-link"><i class="fas fa-arrow-left"></i> 返回上级目录 (Parent Directory)</a>`;
  }
  html += `<ul class="file-list">`;
  // Sort files: directories first, then regular files
  let directories = [];
  let regularFiles = [];
  for (let file of files) {
    let fullPath = kit.xpath(file, filePath);
    let isDir = await kit.aisdir(fullPath);
    if (isDir) {
      directories.push(file);
    } else {
      regularFiles.push(file);
    }
  }
  directories.sort((a, b) => a.localeCompare(b));
  regularFiles.sort((a, b) => a.localeCompare(b));
  const sortedFiles = [...directories, ...regularFiles];
  // Process each file
  for (let file of sortedFiles) {
    let fullPath = kit.xpath(file, filePath);
    let isDir = await kit.aisdir(fullPath);
    let link = g.path === "/" ? "/" + file : g.path + "/" + file;
    let icon = isDir ? "fa-folder" : "fa-file";
    let fileName = file;
    let fileSize = "";
    // Get file size for regular files
    if (!isDir) {
      try {
        const stats = await kit.astat(fullPath);
        fileSize = formatFileSize(stats.size);
        // Set appropriate icon based on file type
        const ext = extname(fileName).toLowerCase();
        if (ext) {
          if (MEDIA_EXTENSIONS[ext]) {
            if (ext === ".mp4" || ext === ".webm") {
              icon = "fa-file-video";
            } else if (ext === ".mp3" || ext === ".wav") {
              icon = "fa-file-audio";
            } else {
              icon = "fa-file-image";
            }
          } else if (ext === ".pdf") {
            icon = "fa-file-pdf";
          } else if ([".doc", ".docx"].includes(ext)) {
            icon = "fa-file-word";
          } else if ([".xls", ".xlsx"].includes(ext)) {
            icon = "fa-file-excel";
          } else if ([".ppt", ".pptx"].includes(ext)) {
            icon = "fa-file-powerpoint";
          } else if ([".zip"].includes(ext)) {
            icon = "fa-file-archive";
          } else if (
            [".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".json"].includes(
              ext
            )
          ) {
            icon = "fa-file-code";
          } else if ([".txt", ".md", ".markdown"].includes(ext)) {
            icon = "fa-file-alt";
          }
        }
      } catch (error) {
        fileSize = "Unknown size";
      }
    }
    let displayName;
    if (isDir) {
      displayName = `<span class="file-name">
            <span class="file-name-main">${fileName}</span>
            <span class="file-name-ext">/</span>
        </span>`;
    } else {
      // Split filename and extension
      let lastDotIndex = fileName.lastIndexOf(".");
      let nameMain =
        lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
      let nameExt = lastDotIndex > 0 ? fileName.slice(lastDotIndex) : "";
      displayName = `<span class="file-name">
            <span class="file-name-main">${nameMain}</span>
            <span class="file-name-ext">${nameExt}</span>
        </span>`;
    }
    html += `
        <li>
            <a href="${link}">
                <i class="fas ${icon}"></i>
                ${displayName}
            </a>`;
    if (!isDir) {
      html += `
            <span class="file-size">${fileSize}</span>
            <button onclick="window.location.href='${link}?download=1'" 
                    class="download-btn" 
                    title="下载文件"
                    type="button">
                <i class="fas fa-download"></i>
            </button>`;
    }
    html += `</li>`;
  }
  html += `</ul></div></body></html>`;
  g.respond({
    ":status": 200,
    "content-type": "text/html; charset=utf-8",
  });
  g.end(html);
}

async function handleFile(g, filePath) {
  // Check if this is a download request
  const isDownload = g.query && g.query.download === "1";
  const ext = extname(filePath).toLowerCase();
  const contentType = getContentType(ext);

  try {
    // Get file stats to determine size
    const stats = await kit.astat(filePath);
    const fileSize = stats.size;

    // Determine how to handle the file based on type and size
    const isMediaFile = MEDIA_EXTENSIONS[ext];

    // Headers with appropriate content-type
    const headers = {
      ":status": 200,
      "content-type": contentType,
      "content-length": fileSize,
    };

    // Disable caching for all files
    headers["cache-control"] = "no-store, no-cache, must-revalidate, max-age=0";
    headers["pragma"] = "no-cache";
    headers["expires"] = "0";

    // Force download in these cases:
    // 1. Explicit download request
    // 2. Non-media files that are too large for text preview
    // 3. Binary files that aren't media or text
    // Check if this is a code/script file that should be treated as text
    const isCodeFile = [
      ".php",
      ".py",
      ".java",
      ".js",
      ".ts",
      ".jsx",
      ".tsx",
      ".html",
      ".css",
      ".c",
      ".cpp",
      ".cs",
      ".go",
      ".rb",
      ".rs",
      ".swift",
      ".sh",
      ".bash",
      ".pl",
      ".lua",
      ".kt",
      ".xml",
      ".json",
      ".yaml",
      ".yml",
      ".vue",
      ".md",
      ".sql",
      ".ini",
      ".conf",
      ".toml",
    ].includes(ext);

    const forceDownload =
      isDownload ||
      (!isMediaFile && !isCodeFile && fileSize > MAX_PREVIEW_SIZE) ||
      (!isMediaFile &&
        !isCodeFile &&
        !contentType.startsWith("text/") &&
        contentType !== "application/json");

    if (forceDownload) {
      const fileName = filePath.split("/").pop();
      headers[
        "content-disposition"
      ] = `attachment; filename="${encodeURIComponent(fileName)}"`;
    }

    g.respond(headers);

    // Use streaming for files over a certain size
    if (fileSize > CHUNK_SIZE) {
      // Stream the file in chunks
      const stream = createReadStream(filePath, { highWaterMark: CHUNK_SIZE });

      stream.on("data", (chunk) => {
        g.write(chunk);
      });

      stream.on("end", () => {
        g.end();
      });

      stream.on("error", (error) => {
        console.error("Stream error:", error);
        g.end(); // End the response on error
      });
    } else {
      // For smaller files, read the entire file at once
      const content = await kit.arf(filePath, null);
      g.end(content);
    }
  } catch (error) {
    console.error("Error serving file:", error);
    g.err(500, "Error serving file");
  }
}

function formatFileSize(size) {
  if (size < 1024) return size + " B";
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
  if (size < 1024 * 1024 * 1024)
    return (size / (1024 * 1024)).toFixed(1) + " MB";
  return (size / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

function getContentType(ext) {
  const mimeTypes = {
    // Text and document formats
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".pdf": "application/pdf",
    ".json": "application/json; charset=utf-8",
    ".jsonc": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    // Image formats
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".heic": "image/heic",
    ".avif": "image/avif",

    // Audio formats
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
    ".wma": "audio/x-ms-wma",
    ".mid": "audio/midi",
    ".midi": "audio/midi",
    ".opus": "audio/opus",
    ".aiff": "audio/aiff",
    ".alac": "audio/alac",
    ".amr": "audio/amr",
    ".ape": "audio/ape",

    // Video formats
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".wmv": "video/x-ms-wmv",
    ".flv": "video/x-flv",
    ".mkv": "video/x-matroska",
    ".mpeg": "video/mpeg",
    ".mpg": "video/mpeg",
    ".m4v": "video/mp4",
    ".3gp": "video/3gpp",
    ".ts": "video/mp2t",
    ".asf": "video/x-ms-asf",
    ".mts": "video/mp2t",
    ".m2ts": "video/mp2t",

    // Archive formats
    ".zip": "application/zip",
    // Source code and configuration files
    ".yaml": "text/plain; charset=utf-8",
    ".yml": "text/plain; charset=utf-8",
    ".php": "text/plain; charset=utf-8",
    ".java": "text/plain; charset=utf-8",
    ".py": "text/plain; charset=utf-8",
    ".c": "text/plain; charset=utf-8",
    ".cpp": "text/plain; charset=utf-8",
    ".h": "text/plain; charset=utf-8",
    ".hpp": "text/plain; charset=utf-8",
    ".cs": "text/plain; charset=utf-8",
    ".go": "text/plain; charset=utf-8",
    ".rs": "text/plain; charset=utf-8",
    ".rb": "text/plain; charset=utf-8",
    ".swift": "text/plain; charset=utf-8",
    ".kt": "text/plain; charset=utf-8",
    ".ts": "text/plain; charset=utf-8",
    ".jsx": "text/plain; charset=utf-8",
    ".tsx": "text/plain; charset=utf-8",
    ".vue": "text/plain; charset=utf-8",
    ".md": "text/plain; charset=utf-8",
    ".markdown": "text/plain; charset=utf-8",
    ".xml": "text/plain; charset=utf-8",
    ".sh": "text/plain; charset=utf-8",
    ".bash": "text/plain; charset=utf-8",
    ".csv": "text/plain; charset=utf-8",
    ".sql": "text/plain; charset=utf-8",
    ".log": "text/plain; charset=utf-8",
    ".ini": "text/plain; charset=utf-8",
    ".toml": "text/plain; charset=utf-8",
    ".conf": "text/plain; charset=utf-8",
    ".config": "text/plain; charset=utf-8",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

const fileSystem = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>文件系统 | File System</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            transition: background-color 0.3s, color 0.3s;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.4;
            padding: 1.5rem;
        }

        body.dark-mode {
            background: #1a1a1a;
            color: #e0e0e0;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 1rem;
        }

        .header-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #eee;
        }

        .dark-mode .header-container {
            border-bottom-color: #333;
        }

        h1 {
            font-size: 1.8rem;
            color: #2c3e50;
            margin: 0;
        }

        .dark-mode h1 {
            color: #e0e0e0;
        }

        .theme-toggle {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1.5rem;
            color: #2c3e50;
            padding: 0.5rem;
        }

        .dark-mode .theme-toggle {
            color: #e0e0e0;
        }

        .file-list {
            list-style: none;
        }

        .file-list li {
            padding: 0.3rem 0.5rem;
            transition: background-color 0.2s;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto auto;
            align-items: center;
            gap: 1rem;
            height: 32px;
            min-width: 0;
        }

        .file-list li:hover {
            background-color: #f5f5f5;
        }

        .dark-mode .file-list li:hover {
            background-color: #2d2d2d;
        }

        .file-list a {
            display: flex;
            align-items: center;
            text-decoration: none;
            color: #2c3e50;
            height: 100%;
            min-width: 0;
            width: 100%;
        }
        
        .file-name {
            display: flex;
            white-space: nowrap;
            min-width: 0;
            max-width: 100%;
        }
        
        .file-name-main {
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 10px;
        }
        
        .file-name-ext {
            flex-shrink: 0;
        }

        .dark-mode .file-list a {
            color: #e0e0e0;
        }

        .file-list i {
            margin-right: 1rem;
            font-size: 1.2rem;
            line-height: 1;
        }

        .file-list .fa-folder {
            color: #f8d775;
        }

        .file-list .fa-file {
            color: #a0a0a0;
        }
        
        .file-list .fa-file-image {
            color: #5cb3cc;
        }
        
        .file-list .fa-file-video {
            color: #ff7e67;
        }
        
        .file-list .fa-file-audio {
            color: #9580ff;
        }
        
        .file-list .fa-file-pdf {
            color: #ff5252;
        }
        
        .file-list .fa-file-word {
            color: #4b89dc;
        }
        
        .file-list .fa-file-excel {
            color: #51bf87;
        }
        
        .file-list .fa-file-powerpoint {
            color: #ff6d4a;
        }
        
        .file-list .fa-file-archive {
            color: #fbc02d;
        }
        
        .file-list .fa-file-code {
            color: #42a5f5;
        }
        
        .file-list .fa-file-alt {
            color: #78909c;
        }

        .dark-mode .file-list .fa-file {
            color: #808080;
        }
        
        .file-size {
            color: #666;
            font-size: 0.85rem;
            white-space: nowrap;
        }
        
        .dark-mode .file-size {
            color: #aaa;
        }

        .download-btn {
            color: #666;
            cursor: pointer;
            border: none;
            background: none;
            transition: color 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 2rem;
            height: 100%;
            padding: 0;
        }

        .dark-mode .download-btn {
            color: #888;
        }

        .download-btn:hover {
            color: #2c3e50;
        }

        .dark-mode .download-btn:hover {
            color: #e0e0e0;
        }

        .parent-link {
            margin-bottom: 1rem;
            display: inline-block;
            padding: 0.5rem 1rem;
            background: #e9ecef;
            border-radius: 4px;
            text-decoration: none;
            color: #495057;
        }

        .dark-mode .parent-link {
            background: #2d2d2d;
            color: #e0e0e0;
        }

        .parent-link:hover {
            background: #dee2e6;
        }

        .dark-mode .parent-link:hover {
            background: #3d3d3d;
        }
        
        .file-too-large {
            text-align: center;
            padding: 2rem;
            background: #f8f9fa;
            border-radius: 8px;
            margin: 2rem auto;
            max-width: 600px;
        }
        
        .dark-mode .file-too-large {
            background: #2a2a2a;
        }
        
        .file-too-large h2 {
            margin-bottom: 1rem;
            color: #343a40;
        }
        
        .dark-mode .file-too-large h2 {
            color: #e0e0e0;
        }
        
        .file-too-large p {
            margin-bottom: 1.5rem;
            color: #495057;
        }
        
        .dark-mode .file-too-large p {
            color: #adb5bd;
        }
        
        .file-too-large .btn {
            display: inline-block;
            padding: 0.5rem 1rem;
            background: #007bff;
            color: white;
            border-radius: 4px;
            text-decoration: none;
            transition: background-color 0.2s;
        }
        
        .file-too-large .btn:hover {
            background: #0069d9;
        }

        @media (max-width: 768px) {
            body {
                padding: 1rem;
            }
            .container {
                padding: 0.5rem;
            }
            h1 {
                font-size: 1.2rem;
            }
            .file-list li {
                padding: 0.3rem;
                gap: 0.5rem;
            }
            .file-list i {
                margin-right: 0.5rem;
                font-size: 1rem;
            }
            .file-size {
                display: none;
            }
            .download-btn {
                width: 1.5rem;
            }
        }
    </style>
</head>
<body class="dark-mode">
    <div class="container">
        <div class="header-container">
            <h1>文件目录 Directory</h1>
            <button class="theme-toggle" aria-label="Toggle dark mode">
                <i class="fas fa-sun"></i>
            </button>
        </div>

        <script>
            // Theme toggle functionality
            const body = document.body;
            const themeToggle = document.querySelector('.theme-toggle');
            const themeIcon = themeToggle.querySelector('i');

            // Get theme settings from localStorage
            const isDarkMode = localStorage.getItem('darkMode') !== 'false'; // Default to dark theme
            body.classList.toggle('dark-mode', isDarkMode);
            updateThemeIcon(isDarkMode);

            themeToggle.addEventListener('click', () => {
                const isDark = body.classList.toggle('dark-mode');
                localStorage.setItem('darkMode', isDark);
                updateThemeIcon(isDark);
            });

            function updateThemeIcon(isDark) {
                themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
            }
            
            // Add file size display info
            document.addEventListener('DOMContentLoaded', function() {
                // Auto-download very large files
                const urlParams = new URLSearchParams(window.location.search);
                const autoDownload = urlParams.get('auto_download');
                
                if (autoDownload === '1') {
                    const downloadUrl = window.location.pathname + '?download=1';
                    window.location.href = downloadUrl;
                }
            });
        </script>
`;
