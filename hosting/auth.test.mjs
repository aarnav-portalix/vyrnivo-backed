import test from 'node:test';
import assert from 'node:assert/strict';
import {isDownloadAuthorized as authorized} from './auth.mjs';
const path='/api/downloads', env={DOWNLOAD_API_TOKEN:'secret'};
const req=(method,headers)=>({method,headers:{host:'vyrnivo-downloads.onrender.com','x-forwarded-proto':'https',...headers}});
test('server-to-server requests require the secret',()=>{
 assert.equal(authorized(req('POST',{authorization:'Bearer secret'}),path,env),true);
 assert.equal(authorized(req('POST',{authorization:'Bearer wrong'}),path,env),false);
});
test('same-origin app can upload and request status without exposing the secret',()=>{
 assert.equal(authorized(req('POST',{origin:'https://vyrnivo-downloads.onrender.com','sec-fetch-site':'same-origin'}),path+'/upload',env),true);
 assert.equal(authorized(req('GET',{'sec-fetch-site':'same-origin'}),path+'/status',env),true);
});
test('cross-site requests are rejected, including spoofed origin with cross-site metadata',()=>{
 assert.equal(authorized(req('POST',{origin:'https://evil.example','sec-fetch-site':'cross-site'}),path,env),false);
 assert.equal(authorized(req('POST',{origin:'https://vyrnivo-downloads.onrender.com','sec-fetch-site':'cross-site'}),path,env),false);
 assert.equal(authorized(req('POST',{}),path,env),false);
});
test('unguessable, expiring file links can be shared',()=>{
 const id='01234567-89ab-4cde-8f01-23456789abcd';
 assert.equal(authorized(req('GET',{}),path+'/'+id+'/file',env),true);
 assert.equal(authorized(req('GET',{}),path+'/not-an-id/file',env),false);
 assert.equal(authorized(req('POST',{}),path+'/'+id+'/file',env),false);
});
test('local development works without a configured token',()=>{
 const local={host:'localhost:10000',origin:'http://localhost:10000','sec-fetch-site':'same-origin'};
 assert.equal(authorized({method:'POST',headers:local},path,{}),true);
});
