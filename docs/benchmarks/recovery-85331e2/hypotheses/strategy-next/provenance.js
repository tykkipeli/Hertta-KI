import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync(new URL('./manifest.json',import.meta.url),'utf8'));
for(const [file,expected] of Object.entries(manifest.hashes)){
 const actual=createHash('sha256').update(readFileSync(new URL(file,import.meta.url))).digest('hex');
 if(actual!==expected)throw Error('Experimental source changed: '+file);
}
export const experimentalProvenance={baseRuntime:manifest.baseRuntime,stage:'unconfirmed research',hashes:manifest.hashes};
