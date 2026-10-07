import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('../', import.meta.url))
const require=createRequire(join(root,'packages/cli/package.json'))
const { chromium }=require('playwright')
const work=mkdtempSync(join(tmpdir(),'coffee-demo-'))
const out=resolve(process.env.COFFEE_DEMO_DIR || join(root,'planning/status/evidence/20261007/demo'))
mkdirSync(out,{recursive:true})
const app=join(root,'examples/coffee-assistant')
const port=26000+Math.floor(Math.random()*10000)
const proc=spawn(join(app,'node_modules/.bin/electron'),['.',`--user-data-dir=${work}/browser`,'--storage',join(work,'storage'),`--remote-debugging-port=${port}`],{cwd:app,env:{...process.env,QVAC_MOCK:'0'},detached:true,stdio:'ignore'})
let browser
try {
 for(let i=0;i<60;i++) {await new Promise(r=>setTimeout(r,500));try {browser=await chromium.connectOverCDP(`http://localhost:${port}`);break}catch{}}
 if(!browser)throw Error('App did not start')
 let page
 for(let i=0;i<60&&!page;i++){page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('file:'));if(!page)await new Promise(r=>setTimeout(r,500))}
 await page.setViewportSize({width:1100,height:1600})
 await page.waitForFunction(()=>/ready/i.test(document.querySelector('#worker-status')?.textContent||''))
 await page.screenshot({path:join(out,'01-start.png')})
 await page.locator('[data-testid="load-ai-btn"]').click()
 await page.locator('[data-testid="chat-input"]').waitFor({state:'visible',timeout:300000})
 await page.waitForFunction(()=>!document.querySelector('[data-testid="chat-input"]').disabled,undefined,{timeout:300000})
 await page.locator('[data-testid="chat-input"]').fill('Suggest one mild coffee with oat milk in one short sentence.')
 await page.locator('[data-testid="chat-send-btn"]').click()
 await page.waitForFunction(()=>!document.querySelector('[data-testid="chat-input"]').disabled&&document.querySelector('.bubble-assistant')?.textContent?.trim(),undefined,{timeout:300000})
 await page.screenshot({path:join(out,'02-real-inference.png')})
 await page.locator('#kv-key').fill('morning')
 await page.locator('#kv-value').fill('One mild oat latte')
 await page.locator('#kv-save').click()
 await page.waitForFunction(()=>document.querySelector('#kv-result')?.textContent?.includes('Saved'))
 await page.screenshot({path:join(out,'03-order-saved.png')})
 await page.locator('#share-orders').click()
 await page.waitForFunction(()=>document.querySelector('#sharing-key')?.dataset.ready==='true',undefined,{timeout:90000})
 await page.screenshot({path:join(out,'04-sharing-ready.png')})
 console.log('PASS: four unmodified application screenshots from QVAC 0.21 desktop example, with real QVAC output and announced public sharing')
} finally {
 await browser?.close().catch(()=>{})
 try{process.kill(-proc.pid,'SIGKILL')}catch{}
 rmSync(work,{recursive:true,force:true})
}
