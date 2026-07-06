import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mode = process.argv[2] || 'development';
const sourceFile = path.resolve(__dirname, `../.env.${mode}`);
const targetFile = path.resolve(__dirname, '../.env');

if (fs.existsSync(sourceFile)) {
  fs.copyFileSync(sourceFile, targetFile);
  console.log(`\x1b[32mâœ“ Switched environment to ${mode} (Copied .env.${mode} to .env)\x1b[0m`);
} else {
  console.error(`\x1b[31mError: Environment file ${sourceFile} not found!\x1b[0m`);
  process.exit(1);
}
