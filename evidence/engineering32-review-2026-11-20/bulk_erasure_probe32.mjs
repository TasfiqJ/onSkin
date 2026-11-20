import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const file='../c16-candidate/apps/mobile/src/lib/storage/privateAsyncStorage.web.ts';
const source=readFileSync(file,'utf8'),body=source.match(/multiRemove: async \(keys: readonly string\[\]\) => \{([^]*?)\n  \},/);
// The initial one-line body ends with }, on the same line.
const method=body?.[1]??source.match(/multiRemove: async \(keys: readonly string\[\]\) => \{(.*?)\},/)[1];
let release,pendingSettled=false,slowErasureFinished=false;
const hold=new Promise(resolve=>release=resolve),failure=new Error('synthetic one erasure rejected');
const storage={removeItem:async key=>{if(key==='reject')throw failure;await hold;slowErasureFinished=true}};
const remove=new Function('storage','keys',`return (async()=>{${method}})()`);
const pending=remove(storage,['reject','pending']).then(()=>{pendingSettled=true},error=>{assert.equal(error,failure);pendingSettled=true});
await new Promise(resolve=>setTimeout(resolve,0));
const settledBeforeOtherErasure=pendingSettled;release();await pending;
console.log(JSON.stringify({sourceSha256:createHash('sha256').update(source).digest('hex'),settledBeforeOtherErasure,slowErasureFinished}));
assert.equal(settledBeforeOtherErasure,false,'Cleanup must retain its fence until every dispatched erasure settles, including after another rejection');
