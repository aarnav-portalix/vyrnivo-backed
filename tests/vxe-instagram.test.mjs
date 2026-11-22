import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPublicVideo,downloadPublicInstagram} from '../hosting/vxe-instagram.mjs';
test('extracts public video from Open Graph metadata',()=>{
 assert.equal(extractPublicVideo('<meta property="og:video" content="https://scontent.cdninstagram.com/a.mp4?x=1&amp;y=2">'),'https://scontent.cdninstagram.com/a.mp4?x=1&y=2');
});
test('does not invent a media URL when metadata is absent',()=>assert.equal(extractPublicVideo('<html><title>Private</title></html>'),null));
test('rejects media on unrelated hosts',async()=>{
 const fetchImpl=async url=>url.includes('instagram.com/reel')?new Response('<meta property="og:video" content="https://example.com/video.mp4">',{headers:{'content-type':'text/html'}}):new Response('oops');
 await assert.rejects(downloadPublicInstagram({url:'https://www.instagram.com/reel/ABCDEF/'},'/tmp',{fetchImpl}),/untrusted media host/);
});
