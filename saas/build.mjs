import {build} from 'esbuild';
import {readFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const staticAssets=[
  'index.html','diagnostics.html','style.css','brand-theme.css',
  'print-fix.css','official-print.css','print-responsive.css','print-readable.css',
  'print-pagination.css','print-adaptive.css','print-signatures-responsive.css',
  'auth-unified.css','staff-management.css',
  'config.js','print.js','kru-pasadu-icon.svg','garuda-memo.svg'
];
const root=process.cwd();
await mkdir(resolve(root,'dist'),{recursive:true});
for(const file of staticAssets){
  await copyFile(resolve(root,file),resolve(root,'dist',file));
}
// Swap remote top-level SDK import for a local build-time dependency.
// This keeps the original source compatible with direct static previews
// but ships a browser app with NO runtime CDN imports in production.
const source=await readFile(resolve(root,'app.js'),'utf8');
if(/^\s*async\s*$/m.test(source)){
  throw new Error('Standalone async identifier detected. Refusing to deploy a broken app.');
}

const marker="import {SUPABASE_URL,SUPABASE_KEY} from './config.js';";
const offset=source.indexOf(marker);
if(offset<0||!source.slice(0,offset).includes('loadSupabaseSdk')){
  throw new Error('Expected dynamic Supabase loader source was not found');
}
const bundledSource="import {createClient} from '@supabase/supabase-js';\n"+source.slice(offset);
await build({
  stdin:{contents:bundledSource,resolveDir:root,sourcefile:'app.js',loader:'js'},
  outfile:resolve(root,'dist','app.js'),
  format:'esm',
  platform:'browser',
  target:'es2022',
  bundle:true,
  minify:false,
  sourcemap:false,
  legalComments:'none',
  logLevel:'info',
  define:{'process.env.NODE_ENV':'"production"'}
});
console.log('Built self-hosted Kru Pasadu browser app and',staticAssets.length,'static files');
