import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {discover,readKeyboard,readMouse,writeKeyboard,writeMouse,previewKeyboard,previewKeyboardBatch,assertKeyboardWritable,assertMouseReadable,conflicts,serialized,dataDirectory} from './lib/devices.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.INPUT_STUDIO_PORT || 17849);
if(!Number.isInteger(PORT)||PORT<1024||PORT>65535)throw new Error('Invalid local port');
const origin=`http://127.0.0.1:${PORT}`,token=crypto.randomBytes(32).toString('hex');
const unlocked=new Set();
const server=http.createServer(async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if(req.headers.host!==`127.0.0.1:${PORT}` || (req.headers.origin&&req.headers.origin!==origin)){send(403,{error:'Local origin required'});return;}
  try{
    if(req.method==='GET'&&req.url==='/health'){send(200,{application:'input-studio-local',version:'0.1.0'});return;}
    if(req.method==='GET'&&req.url==='/assets/mouse.svg'){
      const image=await fs.readFile(path.join(root,'public','assets','mouse.svg'));
      res.writeHead(200,{'Content-Type':'image/svg+xml'});res.end(image);return;
    }
    if(req.method==='GET'&&['/keyboard-trigger.mjs','/keyboard-trigger.css'].includes(req.url)){
      const script=req.url.endsWith('.mjs');
      const file=script?'keyboard-trigger.mjs':'keyboard-trigger.css';
      res.writeHead(200,{'Content-Type':script?'text/javascript; charset=utf-8':'text/css; charset=utf-8'});
      res.end(await fs.readFile(path.join(root,'public',file),'utf8'));return;
    }
    if(req.method==='GET'&&req.url==='/keyboard-workflow.mjs'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(await fs.readFile(path.join(root,'public','keyboard-workflow.mjs'),'utf8'));return;}
    if(req.method==='GET'&&['/','/app.mjs','/style.css','/keyboard-editor.mjs','/keyboard-model.mjs','/keyboard-editor.css'].includes(req.url)){
      const names={'/':['index.html','text/html; charset=utf-8'],'/app.mjs':['app.mjs','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/keyboard-editor.mjs':['keyboard-editor.mjs','text/javascript; charset=utf-8'],'/keyboard-model.mjs':['keyboard-model.mjs','text/javascript; charset=utf-8'],'/keyboard-editor.css':['keyboard-editor.css','text/css; charset=utf-8']};
      const [name,type]=names[req.url];let data=await fs.readFile(path.join(root,'public',name),'utf8');if(name==='index.html')data=data.replace('__TOKEN__',token);res.writeHead(200,{'Content-Type':type});res.end(data);return;
    }
    if(!req.url.startsWith('/api/')||req.headers['x-input-token']!==token){send(403,{error:'Session token required'});return;}
    if(req.method==='GET'&&req.url==='/api/devices'){send(200,{devices:discover(),unlocked:[...unlocked],dataDirectory});return;}
    if(req.method==='GET'&&req.url==='/api/controllers'){const [mouse,keyboard]=await Promise.all([conflicts('mouse'),conflicts('keyboard')]);send(200,{mouse:[...new Set(mouse)],keyboard:[...new Set(keyboard)]});return;}
    if(req.method!=='POST'){send(405,{error:'POST required'});return;}
    let body='';for await(const chunk of req){body+=chunk;if(body.length>(req.url==='/api/preview-batch'?64000:16000)){send(413,{error:'Request too large'});return;}}
    const input=JSON.parse(body||'{}');
    if(!['mouse','keyboard'].includes(input.device))throw new Error('Unknown device');
    if(req.url==='/api/lock'){unlocked.delete(input.device);send(200,{ok:true});return;}
    if(req.url==='/api/preview-batch'){
      if(input.device!=='keyboard')throw new Error('Груповий план підтримує лише клавіатуру.');
      const result=await serialized(()=>previewKeyboardBatch(input.operations,input.revision));send(200,result);return;
    }
    if(req.url==='/api/preview'){
      if(input.device!=='keyboard')throw new Error('Попередній план підтримує лише клавіатуру.');
      const result=await serialized(()=>previewKeyboard(input.action,input.value,input.revision));send(200,result);return;
    }
    if(req.url==='/api/unlock'){
      if(input.confirmation!=='ENABLE')throw new Error('Explicit consent required');
      if(input.device==='keyboard')assertKeyboardWritable();
      else assertMouseReadable();
      const other=await conflicts(input.device);if(other.length)throw new Error('Close other controllers first: '+other.join(', '));
      unlocked.add(input.device);send(200,{ok:true});return;
    }
    if(req.url==='/api/read'){const result=await serialized(()=>input.device==='mouse'?readMouse():readKeyboard());send(200,result);return;}
    if(req.url==='/api/write'){
      if(!unlocked.has(input.device))throw new Error('Read-only mode. Enable changes explicitly first.');
      try{
        const result=await serialized(async()=>{const other=await conflicts(input.device);if(other.length)throw new Error('Another controller is running: '+other.join(', '));return input.device==='mouse'?writeMouse(input.action,input.value):writeKeyboard(input.action,input.value,input.revision);});send(200,result);
      }catch(error){unlocked.delete(input.device);throw error;}return;
    }
    send(404,{error:'Not found'});
  }catch(error){send(400,{error:error.message});}
});
server.requestTimeout=60000;server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(PORT,'127.0.0.1',()=>console.log(`Input Studio 0.1 · ${origin}\nRead-only until explicit consent. Data: ${dataDirectory}\nClose this console to stop.`));
