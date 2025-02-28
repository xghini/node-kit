import kit from "@ghini/kit/dev";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { WebSocketServer } from "ws"; // 需要安装: npm install ws
kit.cs(6);

const app = await kit.hs();

function liveload(){
  
}
// 创建WebSocket服务器并附加到HTTP服务器
const wss = new WebSocketServer({ server: app });
// 热重载管理器
const liveReload = {
  clients: new Set(),
  fileCache: new Map(),
  addClient(ws) {
    this.clients.add(ws);
    ws.on("close", () => this.clients.delete(ws));
    ws.on("error", () => this.clients.delete(ws));
    console.log("热重载客户端已连接，当前连接数:", this.clients.size);
  },
  broadcast(message) {
    this.clients.forEach(client => {
      if (client.readyState === 1) { // OPEN
        client.send(JSON.stringify(message));
      }
    });
  },
  async getFileHash(filePath) {
    try {
      const content = await fs.promises.readFile(filePath);
      return crypto.createHash('md5').update(content).digest('hex');
    } catch (err) {
      return null;
    }
  },
  async fileChanged(filePath) {
    const newHash = await this.getFileHash(filePath);
    if (!newHash) return false;
    
    const oldHash = this.fileCache.get(filePath);
    if (oldHash !== newHash) {
      this.fileCache.set(filePath, newHash);
      return true;
    }
    return false;
  },
  async handleFileChange(filePath) {
    if (!await this.fileChanged(filePath)) return;
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.css') {
      this.broadcast({ type: 'css-update', path: filePath });
    } else {
      this.broadcast({ type: 'full-reload' });
    }
    console.log(`检测到文件变更: ${filePath}`);
  }
};
// WebSocket连接处理
wss.on('connection', (ws, req) => {
  // 只处理热重载连接
  if (req.url === '/live-reload') {
    liveReload.addClient(ws);
  } else {
    ws.close();
  }
});
// 文件监视器
function setupWatcher(dir, ignorePatterns = [/node_modules/, /\.git/]) {
  // 初始化文件缓存
  async function initCache(directory) {
    try {
      const files = await fs.promises.readdir(directory, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(directory, file.name);
        
        if (ignorePatterns.some(pattern => pattern.test(fullPath))) {
          continue;
        }
        
        if (file.isDirectory()) {
          await initCache(fullPath);
        } else {
          const hash = await liveReload.getFileHash(fullPath);
          liveReload.fileCache.set(fullPath, hash);
        }
      }
    } catch (err) {
      console.error("缓存初始化错误:", err);
    }
  }
  // 初始化缓存
  initCache(dir);
  // 防抖函数
  const debounce = (fn, delay) => {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };
  // 防抖处理文件变更
  const debouncedHandleChange = debounce((filePath) => {
    liveReload.handleFileChange(filePath);
  }, 100);
  // 设置文件监视
  fs.watch(dir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    const fullPath = path.join(dir, filename);
    if (ignorePatterns.some(pattern => pattern.test(fullPath))) {
      return;
    }
    debouncedHandleChange(fullPath);
  });
  console.log(`开始监视目录: ${dir}`);
}
// 注入客户端脚本
function injectLiveReloadScript(html) {
  const liveReloadScript = `
    <script>
      (function() {
        function connect() {
          const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
          const ws = new WebSocket(protocol + '//' + location.host + '/live-reload');
          ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            console.log('收到更新通知:', data);
            if (data.type === 'css-update') {
              const links = document.getElementsByTagName('link');
              for (let i = 0; i < links.length; i++) {
                const link = links[i];
                if (link.rel === 'stylesheet') {
                  const href = link.href.split('?')[0];
                  link.href = href + '?t=' + new Date().getTime();
                }
              }
              console.log('样式已更新');
            } else if (data.type === 'full-reload') {
              console.log('页面重新加载');
              location.reload();
            }
          };
          
          ws.onclose = function() {
            console.log('热重载连接已断开，尝试重连...');
            setTimeout(connect, 1000);
          };
          
          ws.onerror = function(err) {
            console.error('热重载连接错误:', err);
            ws.close();
          };
        }
        
        connect();
      })();
    </script>
  `;
  
  if (html.includes('</body>')) {
    return html.replace('</body>', `${liveReloadScript}</body>`);
  } else {
    return html + liveReloadScript;
  }
}

// 主页路由
app.addr("/", (gold) => {
  let html = kit.rf("./index.html");
  html = injectLiveReloadScript(html);
  return gold.html(html);
});
// 启动文件监视
setupWatcher('./');

console.log("✓ 开发服务器已启动，支持增强型热重载 http://127.0.0.1:3000");