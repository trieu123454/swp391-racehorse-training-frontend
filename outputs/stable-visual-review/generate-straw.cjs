const fs = require('node:fs');
const path = require('node:path');
let seed = 391;
const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
const colors = ['#c5a365', '#d1b477', '#e0c58a', '#ad8d53', '#eed7a0', '#b79c65'];
const shadows = [];
const fibers = [];
for (let i = 0; i < 1200; i++) {
  const x = random() * 512;
  const y = random() * 320;
  const length = 5 + random() * 24;
  // Local changes of direction create loose handfuls rather than uniform dashes.
  const angle = Math.sin(x / 65 + y / 47) * 1.8 + (random() - 0.5) * 3;
  const dx = Math.cos(angle) * length;
  const dy = Math.sin(angle) * length * 0.55;
  const bend = (random() - 0.5) * 4;
  const d = `M${x.toFixed(1)} ${y.toFixed(1)}q${(dx / 2).toFixed(1)} ${(dy / 2 + bend).toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)}`;
  const width = (0.35 + random() * 0.8).toFixed(2);
  shadows.push(`<path d="${d}" stroke-width="${Number(width) + 0.6}"/>`);
  fibers.push(`<path d="${d}" stroke="${colors[Math.floor(random() * colors.length)]}" stroke-width="${width}" opacity="${(0.45 + random() * 0.5).toFixed(2)}"/>`);
  if (i % 7 === 0) {
    const endX = x + dx * 0.72;
    const endY = y + dy * 0.72;
    fibers.push(`<path d="M${endX.toFixed(1)} ${endY.toFixed(1)}l${(-dy * 0.16).toFixed(1)} ${(dx * 0.08).toFixed(1)}" stroke="#f1daa0" stroke-width=".65" opacity=".6"/>`);
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320" viewBox="0 0 512 320"><g fill="none" stroke-linecap="round"><g stroke="#655035" opacity=".18" transform="translate(.5 .7)">${shadows.join('')}</g>${fibers.join('')}</g></svg>`;
const destination = path.join(process.cwd(), 'public/images/stable-straw.svg');
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, svg);
console.log('Generated layered straw texture.');
