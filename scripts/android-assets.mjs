import { cp, mkdir, rm } from 'node:fs/promises';
const destination = new URL('../android/app/src/main/assets/public/', import.meta.url);
await rm(destination, {recursive: true, force: true});
await mkdir(destination, {recursive: true});
await cp(new URL('../dist/', import.meta.url), destination, {recursive: true});
console.log('Bundled Vite assets copied into Android app.');
