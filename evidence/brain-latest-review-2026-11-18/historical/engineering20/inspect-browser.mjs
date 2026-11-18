import { writeFileSync } from 'node:fs';
const tabs=await(await fetch('http://127.0.0.1:9500/json/list')).json();
for(const tab of tabs.filter(t=>t.type==='page')){
 const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 const responses=new Map();let id=0;ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id)responses.get(m.id)?.(m.result);};
 const send=(method,params={})=>new Promise(r=>{responses.set(++id,r);ws.send(JSON.stringify({id,method,params}));});
 const timer=setTimeout(()=>{console.log('Inspection timed out',tab.url);ws.close();},10000);
 const data=await send('Runtime.evaluate',{expression:'JSON.stringify({url:location.href,text:document.body.innerText})',returnByValue:true});
 console.log(data.result?.value);const shot=await send('Page.captureScreenshot',{format:'png'});
 if(shot?.data)writeFileSync(new URL('./browser-inspection.png',import.meta.url),Buffer.from(shot.data,'base64'));clearTimeout(timer);ws.close();
}
