// Renders the default social share card -> public/og-image.png (1200x630) and public/logo.png (512x512). Run: node scripts/og-image.mjs
// Uses the site's palette + Fraunces/Inter (must be installed locally for exact type; falls back to serif/sans).
import sharp from 'sharp';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
 <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f2a3a"/><stop offset="1" stop-color="#1d6f8c"/></linearGradient></defs>
 <rect width="1200" height="630" fill="url(#g)"/>
 <text x="600" y="285" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="800" font-size="128" fill="#fff" letter-spacing="-2">Monterey <tspan fill="#9fd8e0" font-style="italic">Daily</tspan></text>
 <text x="600" y="365" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="36" fill="#e6f4f6">Monterey County headlines from local newsrooms,</text>
 <text x="600" y="413" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="36" fill="#e6f4f6">linked to the original reporting.</text>
 <path d="M0 520 Q150 480 300 520 T600 520 T900 520 T1200 520 V630 H0Z" fill="#f6f1e7" opacity=".45"/>
 <path d="M0 545 Q150 505 300 545 T600 545 T900 545 T1200 545 V630 H0Z" fill="#f6f1e7"/>
 <text x="600" y="600" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="600" font-size="26" fill="#0f2a3a">calvickauer.github.io/monterey-daily</text>
</svg>`;
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile('public/og-image.png');
console.log('wrote public/og-image.png');
// Square logo for Organization structured data (from the favicon artwork).
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="512" height="512"><rect width="32" height="32" rx="6" fill="#0f2a3a"/><path d="M2 20q7-6 14 0t14 0v10H2z" fill="#9fd8e0"/></svg>`;
await sharp(Buffer.from(logo)).png({ compressionLevel: 9 }).toFile('public/logo.png');
console.log('wrote public/logo.png');
