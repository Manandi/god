import {mkdir,copyFile,rm} from 'node:fs/promises';

// Vite's current client build lives under dist/client. Older builds emitted a
// second copy at the dist root; remove only those known stale outputs so the
// published archive and GitHub checkout do not carry every model twice.
const dist=new URL('../dist/',import.meta.url);
await Promise.all(['art/','assets/','characters/','index.html'].map(path=>rm(new URL(path,dist),{recursive:true,force:true})));
await mkdir(new URL('../dist/server/',import.meta.url),{recursive:true});
await mkdir(new URL('../dist/.openai/',import.meta.url),{recursive:true});
await copyFile(new URL('../worker/index.js',import.meta.url),new URL('../dist/server/index.js',import.meta.url));
await copyFile(new URL('../.openai/hosting.json',import.meta.url),new URL('../dist/.openai/hosting.json',import.meta.url));
