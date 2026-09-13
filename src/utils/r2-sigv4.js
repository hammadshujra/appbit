'use strict';
const crypto=require('node:crypto');

function rfc3986(value){return encodeURIComponent(String(value)).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}
function canonicalQuery(searchParams){
  const pairs=[];
  if(searchParams instanceof URLSearchParams){for(const [k,v] of searchParams.entries())pairs.push([k,v])}
  else if(searchParams&&typeof searchParams==='object'){for(const [k,v] of Object.entries(searchParams)){if(Array.isArray(v)){for(const item of v)pairs.push([k,item])}else if(v!==undefined&&v!==null)pairs.push([k,v])}}
  return pairs.map(([k,v])=>[rfc3986(k),rfc3986(v)]).sort((a,b)=>a[0]===b[0]?a[1].localeCompare(b[1]):a[0].localeCompare(b[0])).map(([k,v])=>`${k}=${v}`).join('&');
}
function canonicalPath(pathname){return String(pathname||'/').split('/').map((segment,i)=>i===0?'':rfc3986(decodeURIComponent(segment||''))).join('/')||'/'}
function sha256Hex(data=''){return crypto.createHash('sha256').update(data).digest('hex')}
function hmac(key,value,encoding){return crypto.createHmac('sha256',key).update(value).digest(encoding)}
function signingKey(secret,date,region,service='s3'){const kDate=hmac(Buffer.from('AWS4'+secret,'utf8'),date);const kRegion=hmac(kDate,region);const kService=hmac(kRegion,service);return hmac(kService,'aws4_request')}
function normalizeHeaderValue(v){return String(v??'').trim().replace(/\s+/g,' ')}
function amzNow(dateObj=new Date()){const iso=dateObj.toISOString().replace(/[:-]|\.\d{3}/g,'');return{amzDate:iso,date:iso.slice(0,8)}}
function signRequest({method='GET',url,accessKeyId,secretAccessKey,region='auto',service='s3',headers={},payloadHash,now=new Date()}){
  const u=new URL(url);const {amzDate,date}=amzNow(now);const lower={};
  for(const [k,v] of Object.entries(headers||{}))if(v!==undefined&&v!==null)lower[String(k).toLowerCase()]=normalizeHeaderValue(v);
  lower.host=u.host;lower['x-amz-date']=amzDate;lower['x-amz-content-sha256']=payloadHash||sha256Hex('');
  const signedNames=Object.keys(lower).filter(k=>k==='host'||k.startsWith('x-amz-')||k==='content-md5').sort();
  const canonicalHeaders=signedNames.map(k=>`${k}:${lower[k]}\n`).join('');
  const signedHeaders=signedNames.join(';');
  const canonicalRequest=[String(method).toUpperCase(),canonicalPath(u.pathname),canonicalQuery(u.searchParams),canonicalHeaders,signedHeaders,lower['x-amz-content-sha256']].join('\n');
  const scope=`${date}/${region}/${service}/aws4_request`;
  const stringToSign=`AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256Hex(canonicalRequest)}`;
  const signature=hmac(signingKey(secretAccessKey,date,region,service),stringToSign,'hex');
  const authorization=`AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const out={...headers,'x-amz-date':amzDate,'x-amz-content-sha256':lower['x-amz-content-sha256'],Authorization:authorization};
  return{headers:out,canonicalRequest,stringToSign,signature,signedHeaders};
}
module.exports={rfc3986,canonicalQuery,canonicalPath,sha256Hex,signingKey,signRequest,amzNow};
