import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createPresence} from './presence.mjs';

const a='123e4567-e89b-42d3-a456-426614174000';
const b='123e4567-e89b-42d3-a456-426614174001';
async function request(presence,path,id){
 const req=id===undefined?{method:'GET'}:Readable.from([Buffer.from(JSON.stringify({id}))]);
 if(id!==undefined)req.method='POST';
 let data;
 const res={writeHead(code,headers){this.status=code;this.headers=headers},end(body){data=JSON.parse(body)}};
 await presence.handle(req,res,path);
 return {status:res.status,data,headers:res.headers};
}
test('presence counts unique active browsers, not repeat heartbeats',async()=>{
 let now=100000;const p=createPresence({now:()=>now});
 let x=await request(p,'/api/presence/status');
 assert.equal(x.data.online,0);
 x=await request(p,'/api/presence/heartbeat',a);
 assert.equal(x.status,200);assert.equal(x.data.online,1);
 assert.equal(x.headers['cache-control'],'no-store');
 now+=25000;
 x=await request(p,'/api/presence/heartbeat',a);
 assert.equal(x.data.online,1);
 now+=25001;
 x=await request(p,'/api/presence/heartbeat',b);
 assert.equal(x.data.online,2);
 now+=50001;
 x=await request(p,'/api/presence/status');
 assert.equal(x.data.online,1,'inactive first visitor should expire while recently refreshed second visitor remains');
 now+=25000;
 x=await request(p,'/api/presence/status');
 assert.equal(x.data.online,0);
 assert.equal(x.data.approximate,true);
 assert.equal(x.data.activeWindowSeconds,75);
});
test('presence rejects malformed and oversized IDs without counting',async()=>{
 const p=createPresence();
 assert.equal((await request(p,'/api/presence/heartbeat','not-a-uuid')).status,400);
 assert.equal((await request(p,'/api/presence/heartbeat','x'.repeat(300))).status,413);
 assert.equal((await request(p,'/api/presence/status')).data.online,0);
 assert.equal((await request(p,'/api/presence/invalid')).status,404);
});
