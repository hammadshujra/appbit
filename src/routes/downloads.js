'use strict';
const express=require('express');
const {Readable}=require('node:stream');
const r2=require('../services/r2');
const router=express.Router();

function disposition(name){const safe=String(name||'download').replace(/["\\\r\n]/g,'_');return`attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(String(name||'download'))}`}
async function serve(req,res,next,head=false){
  try{
    const out=await r2.streamByToken(req.params.token,{range:req.get('range')||'',head});
    const upstream=out.response;
    res.status(upstream.status);
    for(const h of ['content-length','content-range','accept-ranges','etag','last-modified','cache-control']){const v=upstream.headers.get(h);if(v)res.setHeader(h,v)}
    res.setHeader('Content-Type',out.contentType||'application/octet-stream');
    res.setHeader('Content-Disposition',disposition(out.filename));
    res.setHeader('X-Content-Type-Options','nosniff');
    if(head)return res.end();
    if(!upstream.body)return res.end();
    Readable.fromWeb(upstream.body).on('error',next).pipe(res);
  }catch(e){next(e)}
}
router.get('/d/:token',(req,res,next)=>serve(req,res,next,false));
router.head('/d/:token',(req,res,next)=>serve(req,res,next,true));
module.exports=router;
