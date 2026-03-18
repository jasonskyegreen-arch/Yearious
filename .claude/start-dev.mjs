import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const yeariousDir = path.resolve(__dirname, '..', 'yearious');

process.chdir(yeariousDir);

const viteEntry = path.join(yeariousDir, 'node_modules', 'vite', 'bin', 'vite.js');
await import(pathToFileURL(viteEntry).href);
