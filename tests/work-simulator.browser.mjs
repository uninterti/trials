import { spawn } from 'node:child_process';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
const profile=await mkdtemp('/tmp/trials-management-browser-');
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--remote-debugging-port=9238',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let socket,evaluate;

try {
 let info;
 for(let i=0;i<60;i++){try{info=await(await fetch('http://127.0.0.1:9238/json/version')).json();break;}catch{await wait(150);}}
 assert.ok(info);
 socket=new WebSocket(info.webSocketDebuggerUrl);
 await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
 let nextId=0,sessionId;const pending=new Map();const errors=[]; const mutations=[]; let track=false;
 socket.addEventListener('message',event=>{const r=JSON.parse(event.data);if(r.id){const task=pending.get(r.id);pending.delete(r.id);r.error?task.reject(new Error(JSON.stringify(r.error))):task.resolve(r.result);}else if(r.method==='Network.requestWillBeSent' && track && !['GET','HEAD','OPTIONS'].includes(r.params.request.method))mutations.push(r.params.request.url);else if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails);});
 const send=(method,params={},session=sessionId)=>new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})}));});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 sessionId=(await send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
 await send('Network.enable');await send('Page.enable');await send('Runtime.enable');
 evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await wait(100);}throw new Error('Timed out: '+expression);};
 const screenshot=async path=>writeFile(path,Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:5173/interface.html'});
 await until("document.readyState==='complete' && typeof loadWorkManagement==='function'");
 await evaluate("document.querySelector('#loginUser').value='professor';document.querySelector('#loginPassword').value='admin';document.querySelector('#loginForm').requestSubmit()");
 await until("!document.querySelector('#app').classList.contains('hidden')");
 await evaluate("document.querySelector('#navWorkManagement').click()");
 await until("managementLoaded && document.querySelector('#managedWorksList').textContent.includes('W-A1')");

 track=true;
 await evaluate("document.querySelector('[data-simulate-work=W-A1]').click()");
 await until("activeWorkAttempt?.simulation && document.querySelector('#workQuiz').classList.contains('active')");
 assert.equal(await evaluate("document.querySelectorAll('#workQuizQuestions fieldset').length"),10);
 assert.equal(await evaluate("document.querySelectorAll('#workQuizQuestions input').length"),40);
 assert.equal(await evaluate("activeWorkAttempt.questions.some(q=>'correct' in q)"),false);
 assert.equal(await evaluate("document.querySelector('#workQuizForm').checkValidity()"),false);
 const markup=await evaluate("document.querySelector('#workQuizQuestions').innerHTML");
 await evaluate("activeWorkAttempt.simulation=false;renderWorkAttempt()");
 assert.equal(await evaluate("document.querySelector('#workQuizQuestions').innerHTML"),markup,'identical student question renderer');
 await evaluate("activeWorkAttempt.simulation=true;renderWorkAttempt()");
 for(const score of [7,0,10]){
   const prior=await evaluate("activeWorkAttempt.questions.map(q=>q.id)");
   await evaluate(`workSimulationDefinition.questions.forEach((q,i)=>{document.querySelector('input[name="'+q.id+'"][value="'+(i<${score}?q.correct:(q.correct+1)%4)+'"]').checked=true});document.querySelector('#workQuizForm').requestSubmit()`);
   await until("Boolean(activeWorkAttempt?.submittedAt)");
   assert.equal(await evaluate('activeWorkAttempt.score'),score);
   assert.equal(await evaluate("document.querySelectorAll('.work-review').length"),10);
   assert.equal(await evaluate("document.querySelectorAll('.work-review.correct').length"),score);
   assert.equal(await evaluate("document.querySelector('#workQuizResult').textContent.includes('Não salvo')"),true);
   if(score===7){
     await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
     assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),true);
     await screenshot('/tmp/trials-simulator-mobile.png');
   }
   await evaluate("document.querySelector('[data-restart-simulation]').click()");
   await until("activeWorkAttempt?.simulation && !activeWorkAttempt.submittedAt");
   assert.notDeepEqual(await evaluate('activeWorkAttempt.questions.map(q=>q.id)'),prior);
   assert.equal(await evaluate("document.querySelectorAll('#workQuizQuestions input:checked').length"),0);
 }
 await evaluate("document.querySelector('#workQuizBack').click()");
 assert.equal(await evaluate('activeWorkAttempt===null && workSimulationDefinition===null'),true);
 await evaluate("document.querySelector('[data-simulate-work=W-A1]').click()");
 await until('Boolean(activeWorkAttempt?.simulation)');
 await send('Page.reload');
 await until("document.readyState==='complete' && typeof workSimulationDefinition!=='undefined' && currentUser?.role==='professor'");
 assert.equal(await evaluate('activeWorkAttempt===null && workSimulationDefinition===null'),true);
 assert.deepEqual(mutations,[],'simulation must never send a mutation request');
 assert.deepEqual(errors,[]);
 console.log('PASS: identical student questions, validation, grades 0/7/10, answer key, shuffled retakes, mobile layout, navigation/reload cleanup, zero mutation requests and zero browser errors.');
} finally {
 socket?.close();chrome.kill('SIGTERM');
 await new Promise(resolve=>chrome.once('exit',resolve));
 await rm(profile,{recursive:true,force:true});
}
