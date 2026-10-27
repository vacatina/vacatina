import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const brandDir = path.join(ROOT_DIR, 'public', 'brand');
const webDir = path.join(brandDir, 'web');

// Web-optimized lossless cropped full logos
const primaryFullWeb = fs.readFileSync(path.join(webDir, 'Vacatina_Logo_Primary_FullColor.web.png')).toString('base64');
const reverseFullWeb = fs.readFileSync(path.join(webDir, 'Vacatina_Logo_Reverse_SpaceCadet.web.png')).toString('base64');
const oneColorWeb = fs.readFileSync(path.join(webDir, 'Vacatina_Logo_OneColor_SpaceCadet.web.png')).toString('base64');

// Official standalone marks
const markSpaceCadetWeb = fs.readFileSync(path.join(webDir, 'Vacatina_Mark_SpaceCadet.web.png')).toString('base64');
const markFrenchBlue = fs.readFileSync(path.join(brandDir, 'marks', 'Vacatina_Mark_FrenchBlue.png')).toString('base64');
const markBlack = fs.readFileSync(path.join(brandDir, 'marks', 'Vacatina_Mark_Black.png')).toString('base64');

// 32x32 Favicon icon
const favicon32 = fs.readFileSync(path.join(ROOT_DIR, 'public', 'icons', 'icon-32.png')).toString('base64');

const tsContent = `/* Auto-generated canonical Base64 Vacatina Official Logo Assets (v3 Web-Optimized)
 * Full Logos: 1:1 lossless crop of transparent padding, preserving artwork, aspect ratio, and mandatory tagline.
 * Standalone Marks: Proportional derivatives of official aircraft ascent & contrail emblem.
 */
export const LOGO_PRIMARY_FULL_COLOR = "data:image/png;base64,${primaryFullWeb}";
export const LOGO_REVERSE_SPACE_CADET = "data:image/png;base64,${reverseFullWeb}";
export const LOGO_ONE_COLOR_SPACE_CADET = "data:image/png;base64,${oneColorWeb}";
export const MARK_SPACE_CADET = "data:image/png;base64,${markSpaceCadetWeb}";
export const MARK_FRENCH_BLUE = "data:image/png;base64,${markFrenchBlue}";
export const MARK_BLACK = "data:image/png;base64,${markBlack}";
export const FAVICON_32 = "data:image/png;base64,${favicon32}";
`;

fs.writeFileSync(path.join(ROOT_DIR, 'src', 'components', 'brand', 'logo-assets.ts'), tsContent, 'utf8');
console.log('Generated logo-assets.ts with web-optimized assets successfully!');
