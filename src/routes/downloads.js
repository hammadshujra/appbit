'use strict';
const express=require('express');
const {Readable}=require('node:stream');
const r2=require('../services/r2');
const router=express.Router();

function disposition(name){const safe=String(name||'download').replace(/["\\\r\n]/g,'_');return`attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(String(name||'download'))}`}
async function sendStream(out,res,next,head=false){
  try{
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
async function serveToken(req,res,next,head=false){try{return sendStream(await r2.streamByToken(req.params.token,{range:req.get('range')||'',head}),res,next,head)}catch(e){next(e)}}
async function servePath(req,res,next,head=false){try{return sendStream(await r2.streamByPath(req.params[0]||req.path.replace(/^\//,''),{range:req.get('range')||'',head}),res,next,head)}catch(e){next(e)}}

// Backward compatibility for links copied by Appbit V2.17 and earlier.
router.get('/d/:token',(req,res,next)=>serveToken(req,res,next,false));
router.head('/d/:token',(req,res,next)=>serveToken(req,res,next,true));

// Filename-only public links for the custom server runtime. Legacy folder/path URLs stay readable. Hostinger's native
// Next.js runtime performs the same resolution in pages/[[...path]].jsx.
router.use(async(req,res,next)=>{
  if(!['GET','HEAD'].includes(req.method))return next();
  if(req.path.startsWith('/api/')||req.path.startsWith('/_next/')||req.path.startsWith('/ui/'))return next();
  const host=String(req.get('host')||'').replace(/:\d+$/,'').toLowerCase();
  const dedicated=await r2.isActiveDownloadHost(host).catch(()=>false);
  const filenameLike=/\.[a-z0-9]{1,16}$/i.test(req.path.split('/').pop()||'');
  if(!dedicated&&!filenameLike)return next();
  const key=decodeURIComponent(req.path.replace(/^\//,''));
  try{return await sendStream(await r2.streamByPath(key,{range:req.get('range')||'',head:req.method==='HEAD'}),res,next,req.method==='HEAD')}
  catch(e){
    if(dedicated||filenameLike){
      const status=Number(e?.status||404);res.status(status).setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.end(status===404?'File not found.':'Download failed.');
    }
    return next(e)
  }
});

module.exports=router;
