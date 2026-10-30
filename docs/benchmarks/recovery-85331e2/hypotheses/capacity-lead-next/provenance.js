import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync(new URL('./manifest.json',import.meta.url),'utf8'));
for(const [file,hash] of Object.entries(manifest.hashes)){if(createHash('sha256').update(readFileSync(new URL(file,import.meta.url))).digest('hex')!==hash)throw Error('Experimental source changed: '+file);}
export const experimentalProvenance={baseRuntime:'85331e2',stage:'unconfirmed public-capacity lead model',hashes:manifest.hashes};
