import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const require=createRequire(join(process.argv[2],'package.json'))
const Hypercore=require('hypercore')
const work=mkdtempSync(join(tmpdir(),'core-clear-check-'))
let a,b,left,right
try{
 a=new Hypercore(join(work,'a'));await a.ready();await a.append(['a','b','c','d','e','f','g','h']);await a.clear(1);await a.clear(7)
 b=new Hypercore(join(work,'b'),a.key);await b.ready()
 left=a.replicate(true);right=b.replicate(false);left.on('error',e=>console.log('source replication:',e.code||e.message));right.on('error',e=>console.log('recipient replication:',e.code||e.message));left.pipe(right).pipe(left)
 for(const i of [0,6,3]){const block=await b.get(i,{timeout:3000});if(block.toString()!==String.fromCharCode(97+i))throw Error('Incorrect block');console.log('PASS remaining block',i)}
 console.log('PASS: remaining blocks can replicate after clear()')
}catch(e){console.log('FAIL:',e.code||e.message);process.exitCode=1}
finally{left?.destroy();right?.destroy();await Promise.allSettled([a?.close(),b?.close()]);rmSync(work,{recursive:true,force:true})}
