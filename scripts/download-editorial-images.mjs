import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CARDS_DIR = path.join(ROOT_DIR, 'public', 'cards');

fs.mkdirSync(CARDS_DIR, { recursive: true });

// Curated high-resolution editorial travel photography (Real, Licensed, Authentic, Zero AI Composites)
const EDITORIAL_SOURCES = {
  // 1. Popular Flights (Authentic Real Destination Photography — UI provides flight badge & CMB->DXB)
  'flight-dubai.jpg': {
    url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'Panoramic golden hour view of Burj Khalifa and the Downtown Dubai skyline',
    desc: 'Dubai Downtown skyline golden hour'
  },
  'flight-male.jpg': {
    url: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'Aerial perspective of turquoise coral atolls and calm lagoons in the Maldives',
    desc: 'Maldives aerial turquoise atolls'
  },
  'flight-bangkok.jpg': {
    url: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'Bangkok cityscape and Chao Phraya riverfront illuminated at sunset',
    desc: 'Bangkok riverfront skyline sunset'
  },
  'flight-london.jpg': {
    url: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'London city skyline along the River Thames and Tower Bridge during golden hour',
    desc: 'London River Thames and skyline golden hour'
  },

  // 2. Visa Assistance (Sophisticated Authentic Destination Photography — UI provides visa badge & document icon)
  'visa-uae.jpg': {
    url: 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'Iconic architectural landmark Burj Al Arab along the Dubai coastline',
    desc: 'Dubai Burj Al Arab coastline landmark'
  },
  'visa-uk.jpg': {
    url: 'https://images.unsplash.com/photo-1529655683826-aba9b3e77383?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'Historic Palace of Westminster and Big Ben clock tower viewed across Westminster Bridge',
    desc: 'London Big Ben and Westminster Palace'
  },
  'visa-thailand.jpg': {
    url: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'Historic riverside temple Wat Arun in Bangkok bathed in warm morning light',
    desc: 'Bangkok Wat Arun riverside temple'
  },
  'visa-singapore.jpg': {
    url: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'Modern waterfront architecture of Marina Bay Sands in Singapore at dusk',
    desc: 'Singapore Marina Bay Sands waterfront'
  },

  // 3. Holiday Packages (Highly Aspirational Editorial Real Travel Photography)
  'package-maldives.jpg': {
    url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'Aspirational Maldives luxury holiday resort with overwater bungalows and turquoise lagoon boardwalk',
    desc: 'Maldives luxury overwater bungalows and lagoon'
  },
  'package-dubai.jpg': {
    url: 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'Vibrant Dubai Marina waterfront promenade with luxury yachts and illuminated towers at dusk',
    desc: 'Dubai Marina luxury promenade and yachts'
  },
  'package-thailand.jpg': {
    url: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'Iconic limestone karst islands rising from emerald waters in Phang Nga Bay Thailand',
    desc: 'Thailand Phang Nga Bay limestone karsts and emerald sea'
  },

  // 4. Sightseeing Tours (Genuine Landmarks & Heritage Perspectives)
  'sightseeing-dubai.jpg': {
    url: 'https://images.unsplash.com/photo-1526495124232-a04e1849168c?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'High-altitude panoramic view looking out over Downtown Dubai from an observation deck',
    desc: 'Dubai observation sky deck panoramic vista'
  },
  'sightseeing-bangkok.jpg': {
    url: 'https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'Historic Grand Palace complex in Bangkok showcasing golden stupas and ornate temple roofs',
    desc: 'Bangkok Grand Palace golden stupas'
  },
  'sightseeing-london.jpg': {
    url: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'Iconic London Tower Bridge spanning the River Thames under clear skies',
    desc: 'London Tower Bridge iconic landmark'
  },

  // 5. Cars & Transfers / Cruises (Believable Professional Mobility & Vessels)
  'transfer-dubai.jpg': {
    url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'Executive black luxury sedan arrival transfer at modern terminal curb',
    desc: 'Dubai executive black sedan arrival transfer'
  },
  'cruise-dubai.jpg': {
    url: 'https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=1200&h=800&q=82',
    alt: 'Grand luxury ocean cruise liner docked at port in morning light',
    desc: 'Dubai Cruise Terminal grand ocean liner'
  }
};

async function downloadImage(name, info) {
  const dest = path.join(CARDS_DIR, name);
  console.log(`Downloading ${name} (${info.desc})...`);
  const res = await fetch(info.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to download ${info.url}: HTTP ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(dest, buffer);
  console.log(`  ✓ Saved ${name}: ${buffer.length} bytes`);
}

async function run() {
  for (const [name, info] of Object.entries(EDITORIAL_SOURCES)) {
    try {
      await downloadImage(name, info);
    } catch (err) {
      console.error(`  ✗ Error downloading ${name}:`, err.message);
    }
  }
  console.log('\nFinished downloading curated editorial travel photography.');
}

run();
