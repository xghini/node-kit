export { captcha, fnv1a };
const DEFAULT_CONFIG = {
    width: 120,
    height: 40,
    length: 4,
};
function captcha(options = {}) {
    const config = { ...DEFAULT_CONFIG, ...options };
    const { width, height, length } = config;
    const code = verifyCode(length);
    const interferenceLines = svgInterferenceLines(width, height)
        .map((path) => `<path d="${path}" stroke="${randomColor(170, 230)}" stroke-width="1.3" fill="none"/>`)
        .join("");
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#f7f7f7"/>
      ${svgChars(code, config)}
      ${interferenceLines}
      ${svgNoiseDots(width, height)}
    </svg>
  `;
    return {
        svg,
        code,
    };
}
function fnv1a(code) {
    const h = Array.from(code).reduce((h, c) => ((h ^ c.charCodeAt(0)) * 16777619) >>> 0, 2166136261);
    return h.toString(36);
}
function randomColor(min, max) {
    const r = Math.floor(Math.random() * (max - min) + min);
    const g = Math.floor(Math.random() * (max - min) + min);
    const b = Math.floor(Math.random() * (max - min) + min);
    return `rgb(${r},${g},${b})`;
}
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
function svgNoiseDots(width, height) {
    const dots = [];
    for (let i = 0; i < 100; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        dots.push(`<circle cx="${x}" cy="${y}" r="1" fill="${randomColor(150, 230)}"/>`);
    }
    return dots.join("");
}
function svgChars(code, config) {
    const { width, height, length } = config;
    const fontSize = Math.floor(height * 0.65);
    const charWidth = width / length;
    const offsetX = charWidth / 2;
    return code
        .split("")
        .map((char, i) => {
        const rotate = (0.4 + Math.random() * 0.7) * (Math.round(Math.random()) * 2 - 1);
        const x = (i + 1) * charWidth - offsetX;
        const y = height / 2;
        return `
      <g transform="translate(${x},${y}) rotate(${rotate * 57.3})">
        <text 
          x="-${fontSize / 3}"
          y="0"
          fill="${randomColor(100, 150)}"
          font-family="Arial"
          font-weight="bold"
          font-size="${fontSize}px"
          dominant-baseline="middle"
        >${char}</text>
      </g>`;
    })
        .join("");
}
