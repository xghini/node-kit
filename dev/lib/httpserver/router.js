export { router_find_resolve,addr,_404 };
const METHOD_ARRAY = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
  "CONNECT",
  "TRACE",
];
function addr(...argv) {
  // addr('/a',hd_a)
  // addr('/a','get','',hd_a)
  // 第一个/开头字符串 或 正则表达式 re instanceof RegExp
  // 第一个 Method 没有则为*
  // 第一个 Content-Type 没有则为*
  // 第一个 函数 fn_end
  // 第二个 函数 fn_data
  // 第一个 object
  let path,
    method,
    ct,
    fn_end,
    fn_data,
    config = {};
  argv.forEach((item) => {
    if (typeof item === "string") {
      if (item.startsWith("/")) path = item;
      else if (METHOD_ARRAY.includes(item.toUpperCase()))
        method = item.toUpperCase();
      else if (item.includes("/")) ct = item;
    } else if (item instanceof RegExp) path = item;
    else if (typeof item === "function") {
      if (!fn_end) fn_end = item;
      else fn_data = item;
    } else if (typeof item === "object") config = item;
  });
  if (!path) {
    console.error("path is required,以'/'开头的精确路径string 或 regexp");
    return;
  }
  if (!method) method = "*";
  if (!ct) ct = "*";
  if (!fn_end) fn_end = hd_default;
  const index = this.routes.findIndex((row) => {
    return (
      row[0].toString() === path.toString() &&
      row[1] === method &&
      row[2] === ct
    );
  });
  if (index > -1) {
    this.routes[index][3] = fn_end;
    this.routes[index][4] = fn_data;
    this.routes[index][5] = config;
    return;
  }
  this.routes.push([path, method, ct, fn_end, fn_data, config]);
}
function router_find_resolve(server, stream, gold) {
  let arr,
    arr0 = [],
    arr1 = [];
  // 先找path string 再找path regexp
  server.routes.forEach((row) => {
    if (gold.path === row[0]) {
      arr0.push(row);
    } else if (
      arr0.length === 0 &&
      row[0] instanceof RegExp &&
      row[0].test(gold.path)
    ) {
      arr1.push(row);
    }
  });
  if (arr0.length > 0) {
    arr = arr0;
  } else if (arr1.length > 0) {
    arr = arr1;
  } else {
    server._404(gold);
    return;
  }
  // 找method 再找*
  arr0 = [];
  arr1 = [];
  arr.forEach((row) => {
    if (row[1] === gold.method) {
      arr0.push(row);
    } else if (arr0.length === 0 && row[1] === "*") {
      arr1.push(row);
    }
  });
  if (arr0.length > 0) {
    arr = arr0;
  } else if (arr1.length > 0) {
    arr = arr1;
  } else {
    server._404(gold);
    return;
  }
  // 找ct 再找* 无ct就匹配*
  arr0 = undefined;
  arr1 = undefined;
  for (const row of arr) {
    if (gold.ct?.startsWith(row[2])) {
      // 这里改为startsWith，因为gold.ct可能是"text/html;charset=UTF-8"，或"multipart/from-data;xxx"等
      arr0 = row;
    } else if (row[2] === "*") {
      arr1 = row;
    }
  }
  let router_target;
  if (arr0) {
    router_target = arr0;
  } else if (arr1) {
    router_target = arr1;
  } else {
    server._404(gold);
    return;
  }
  gold.config = { ...gold.config, ...router_target.at(-1) };
  let chunks = [],
    length = 0,
    notresponded = true,
    maxbody = gold.config.MAX_BODY || 4 * 1024 * 1024;
  stream.on("data", async (chunk) => {
    try {
      length += chunk.length;
      if (notresponded && length > maxbody) {
        notresponded = false;
        gold.err(
          { msg: "Payload Too Large", maxBody: `${maxbody / 1048576}MB` },
          413
        );
        // stream.respond();
        // stream.end(`Request body larger than ${gold.config.MAX_BODY}B`);
      }
      // 服务器接收一般用不上流,但还是留一个接口处理特殊情况
      // router_target[4]是否函数,如果是,接管流处理
      if (typeof router_target[4] === "function") {
        await router_target[4](gold, chunk, chunks);
      } else {
        chunks.push(chunk);
      }
    } catch (err) {
      console.error(err);
      gold.err();
    }
  });
  stream.on("end", async () => {
    try {
      gold.body = Buffer.concat(chunks).toString();
      // 结合ct将body处理为data
      gold.data = body2data(gold);
      await router_target[3](gold);
    } catch (err) {
      console.error(err.message);
      gold.err();
    }
  });
}
function body2data(gold) {
  let data;

  if (gold.ct === "application/json") {
    data = JSON.parse(gold.body);
  }
  // 已经过测试
  else if (gold.ct === "application/x-www-form-urlencoded") {
    data = {};
    const params = new URLSearchParams(gold.body);
    for (const [key, value] of params) {
      data[key] = value;
    }
  } else if (gold.ct?.startsWith("multipart/form-data")) {
    data = {};
    const boundaryMatch = gold.ct.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      throw new Error("Boundary not found in Content-Type");
    }
    const boundary = boundaryMatch[1];
    const parts = gold.body.split(`--${boundary}`);

    for (let part of parts) {
      part = part.trim();
      if (!part || part === "--") continue; // Skip empty parts and closing boundary

      const [rawHeaders, ...rest] = part.split("\r\n\r\n");
      const content = rest.join("\r\n\r\n").replace(/\r\n$/, "");
      const headers = rawHeaders.split("\r\n");

      let name = null;
      let filename = null;
      let contentType = null;

      // Extract headers
      headers.forEach((header) => {
        const nameMatch = header.match(/name="([^"]+)"/);
        if (nameMatch) {
          name = nameMatch[1];
        }
        const filenameMatch = header.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
        const ctMatch = header.match(/Content-Type:\s*(.+)/i);
        if (ctMatch) {
          contentType = ctMatch[1];
        }
      });

      if (!name) continue; // Skip if no field name is found

      if (filename) {
        // Handle file fields
        const fileObj = {
          filename: filename,
          content: content,
          contentType: contentType || "application/octet-stream", // Default if not provided
        };

        if (data[name]) {
          if (Array.isArray(data[name])) {
            data[name].push(fileObj);
          } else {
            data[name] = [data[name], fileObj];
          }
        } else {
          data[name] = fileObj;
        }
      } else {
        // Handle regular text fields
        if (data[name] !== undefined) {
          if (Array.isArray(data[name])) {
            data[name].push(content);
          } else {
            data[name] = [data[name], content];
          }
        } else {
          data[name] = content;
        }
      }
    }

    // Convert single-item arrays back to single values if desired
    for (const key in data) {
      if (Array.isArray(data[key]) && data[key].length === 1) {
        data[key] = data[key][0];
      }
    }
  }
  return data;
}

function _404(gold) {
  gold.err(404);
}
