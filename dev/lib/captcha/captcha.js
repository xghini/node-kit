export { captcha, captcha2 };
import sharp from "sharp"; //sharp降级到v0.32.6，这是最后一个不需要新指令集支持的稳定版本
const DEFAULT_CONFIG = {
  width: 120,
  height: 40,
  length: 4,
  padding: 0.12, //小于1的时候为宽的比例，大于1为px
  fontSize: 0.66, //小于1的时候为高的比例，大于1为px
};
/** svg跟明文差不多，容易暴露，使用sharp转换为png */
async function captcha2(options) {
  options = { ...DEFAULT_CONFIG, ...options };
  options.fontSize = Math.round(options.fontSize * 1.136 * 100) / 100; //Sharp (基于 librsvg) 的渲染机制和浏览器不太一样,字体偏小,所以稍微放大保持一致性
  const { svg, code } = captcha(options);
  // 将 SVG 转换为 PNG
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return {
    png,
    code,
  };
}
function captcha(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const { width, height, length } = config;
  const code = verifyCode(length);
  // 生成干扰线元素
  const interferenceLines = svgInterferenceLines(width, height)
    .map(
      (path) =>
        `<path d="${path}" stroke="${randomColor(
          170,
          230
        )}" stroke-width="1.3" fill="none"/>`
    )
    .join("");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#f7f7f7"/>
      ${svgChars(code, config)}
      ${interferenceLines}
      ${svgNoiseDots(width, height)}
    </svg>
  `;
  // console.log(svg);
  return {
    svg,
    code,
  };
}
function randomColor(min, max) {
  const r = Math.floor(Math.random() * (max - min) + min);
  const g = Math.floor(Math.random() * (max - min) + min);
  const b = Math.floor(Math.random() * (max - min) + min);
  return `rgb(${r},${g},${b})`;
}

// 生成验证码字符
function verifyCode(length) {
  const characters = "23457ACDFGHJKLPQRSTUVWXY23457";
  let result = "";
  const len = characters.length;
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * len);
    result += characters[idx];
  }
  return result;
}

// 生成干扰线路径
function svgInterferenceLines(width, height) {
  const basic = [
    [
      [0.05, 0.2, 0.95, 0.8],
      [0.05, 0.3, 0.95, 0.7],
      [0.05, 0.8, 0.95, 0.2],
    ],
    [
      [0.05, 0.2, 0.95, 0.8],
      [0.05, 0.7, 0.95, 0.3],
      [0.05, 0.8, 0.95, 0.2],
    ],
    [
      [0.05, 0.2, 0.95, 0.8],
      [0.35, 0.2, 0.65, 0.8],
      [0.05, 0.8, 0.95, 0.2],
    ],
    [
      [0.05, 0.2, 0.95, 0.8],
      [0.35, 0.8, 0.65, 0.2],
      [0.05, 0.8, 0.95, 0.2],
    ],
    [
      [0.05, 0.2, 0.95, 0.8],
      [0.35, 0.2, 0.65, 0.8],
      [0.35, 0.8, 0.65, 0.2],
    ],
    [
      [0.05, 0.8, 0.95, 0.2],
      [0.35, 0.2, 0.65, 0.8],
      [0.35, 0.8, 0.65, 0.2],
    ],
  ];
  const randomPattern = basic[Math.floor(Math.random() * 6)];
  return randomPattern.map((item) => {
    const x1 = (item[0] + Math.random() * 0.1) * width;
    const y1 = (item[1] + Math.random() * 0.3 - 0.15) * height;
    const x2 = (item[2] - Math.random() * 0.1) * width;
    const y2 = (item[3] + Math.random() * 0.3 - 0.15) * height;
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  });
}

// 生成干扰点
function svgNoiseDots(width, height) {
  const dots = [];
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    dots.push(
      `<circle cx="${x}" cy="${y}" r="1" fill="${randomColor(150, 230)}"/>`
    );
  }
  return dots.join("");
}
/**
* 生成字符元素
* [修改后] 
* 1. 去掉 dominant-baseline="middle"
* 2. 增加 dy="0.33em" (向下偏移0.33倍字号，实现居中)
* 3. 建议将 font-family="Arial" 改为 sans-serif，Linux服务器可能没有Arial导致回退字体差异
 */
function svgChars(code, config) {
  let { width, height, length, padding, fontSize } = config;
  if (padding < 1) padding *= width;
  if (fontSize < 1) fontSize *= height;
  const charWidth = (width - padding * 2) / length;
  const offsetX = charWidth / 2;
  return code
    .split("")
    .map((char, i) => {
      const rotate =
        (0.4 + Math.random() * 0.7) * (Math.round(Math.random()) * 2 - 1);
      const x = padding + i * charWidth + offsetX;
      const y = height / 2;
      return `
      <g transform="translate(${x},${y}) rotate(${rotate * 57.3})">
        <text 
          x="-${fontSize / 3}"
          y="0"
          dy="0.33em" 
          fill="${randomColor(100, 150)}"
          font-family="sans-serif"
          font-weight="bold"
          font-size="${fontSize}px"
        >${char}</text>
      </g>`;
    })
    .join("");
}
