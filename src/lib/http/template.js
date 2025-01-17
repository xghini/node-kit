export {fileSystem}
const fileSystem=`
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
            grid-template-columns: minmax(0, 1fr) auto;
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
        .dark-mode .file-list .fa-file {
            color: #808080;
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
            // 主题切换功能
            const body = document.body;
            const themeToggle = document.querySelector('.theme-toggle');
            const themeIcon = themeToggle.querySelector('i');
            // 从 localStorage 获取主题设置
            const isDarkMode = localStorage.getItem('darkMode') !== 'false'; // 默认为暗色主题
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
        </script>
`