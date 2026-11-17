import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createPrivateConversionApi,privateApiAllowed,validWebhookUrl,signedWebhook} from './private-api.mjs';

const token='private-123';
const authorized={'authorization':'Bearer '+token};
const request=async(api,path,{method='GET',headers={}}={})=>{
 let status=0,body=null;
 const res={writeHead(n){status=n},end(s){body=s?JSON.parse(s):null}};
 await api.handle({method,headers},res,path);
 return {status,body};
};
test('private endpoint demands its server-only token and rejects unknown paths',async()=>{
 const called=[];
 const api=createPrivateConversionApi({token,converter:{handle:async(req,res,path)=>{called.push(path);res.writeHead(202);res.end('{"state":"processing"}')}}});
 assert.equal(api.enabled,true);
 assert.equal((await request(api,'/api/private/status')).status,401);
 assert.equal((await request(api,'/api/private/status',{headers:{authorization:'Bearer wrong'}})).status,401);
 const status=await request(api,'/api/private/status',{headers:authorized});
 assert.equal(status.status,200);
 assert.deepEqual(status.body.formats,['MP4','MP3']);
 assert.equal((await request(api,'/api/private/conversions',{method:'POST',headers:authorized})).status,202);
 assert.equal(called[0],'/api/converter');
 const uuid='123e4567-e89b-42d3-a456-426614174010';
 await request(api,'/api/private/conversions/'+uuid,{headers:authorized});
 assert.equal(called[1],'/api/converter/'+uuid);
 assert.equal((await request(api,'/api/private/conversions/forged',{headers:authorized})).status,404);
});
test('private endpoints are disabled without a secret',async()=>{
 const api=createPrivateConversionApi({token:'',converter:{handle:()=>{throw Error('must not run')}}});
 assert.equal(api.enabled,false);
 assert.equal((await request(api,'/api/private/status',{headers:authorized})).status,404);
 assert.equal(privateApiAllowed(authorized,''),false);
});
test('webhook destinations must be HTTPS public hostnames with no embedded credentials or custom ports',()=>{
 assert.equal(validWebhookUrl('https://hooks.example.org/vyrnivo'),true);
 for(const url of ['http://hooks.example.org','https://127.0.0.1/callback','https://localhost/callback','https://metadata.google.internal/latest','https://user:pass@hooks.example.org','https://hooks.example.org:444/callback','file:///etc/hosts']){
  assert.equal(validWebhookUrl(url),false,url);
 }
});
test('webhook signs exactly the timestamp and JSON payload without exposing the signing key',async()=>{
 const output=[];
 const api=createPrivateConversionApi({
  token,webhookUrl:'https://hooks.example.org/conversions',webhookSecret:'only-server-secret',
  fetchImpl:async(url,init)=>{output.push({url,init});return new Response(null,{status:204})},
  converter:{handle:()=>{}}
 });
 assert.equal(api.webhookEnabled,true);
 const event={id:'some-job-id',state:'ready',bytes:2048,completedAt:10000,method:'stream-copy'};
 await api.notify(event);
 assert.equal(output.length,1);
 assert.equal(output[0].url,'https://hooks.example.org/conversions');
 assert.equal(output[0].init.redirect,'error');
 const {headers,body}=output[0].init;
 const expected=createHmac('sha256','only-server-secret').update(headers['x-vyrnivo-timestamp']+'.'+body).digest('hex');
 assert.equal(headers['x-vyrnivo-signature'],'sha256='+expected);
 assert.deepEqual(JSON.parse(body),{type:'conversion.completed',...event});
 assert.ok(!body.includes('only-server-secret'));
 const signed=signedWebhook({test:true},'secret',12345);
 assert.equal(signed.timestamp,'12345');
});
