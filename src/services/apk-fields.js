'use strict';
// Source metadata extraction: keep a field's meaning separate from its value.
// Unrecognized or missing fields must not be inferred from unrelated page text.
const clean = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
const normalizeLabel = value => clean(value).toLowerCase().replace(/[:：*]+$/g, '').replace(/[\s_\-]+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
const ALIASES = {
  name:['app name','application name','game name','name','title'],
  developer:['developer','developer name','developed by','developer by','publisher','published by','author','creator','offered by','company','app developer','game developer'],
  version:['version','latest version','current version','app version','apk version','version number'],
  updated:['updated','updated on','last updated','last update','update date','date updated','release date','released','released on','date modified','modified','last update date','latest update','date of update'],
  size:['size','app size','apk size','file size','download size','package size','apk file size'],
  category:['category','app category','game category','genre','categories'],
  downloads:['downloads','download count','total downloads','downloaded','downloads count','total download','download times','downloaded times','installs','install count','installations'],
  views:['views','view count','total views','page views','visits','visit count','viewed','reached','reach','reached views'],
  package:['package','package name','package id','package identifier','application id','android package','bundle id'],
  android:['requires android','required android','android','android requirement','android version','minimum android','min android','minimum os','operating system'],
  architecture:['architecture','cpu architecture','supported abi','abi'],
  type:['apk type','type','mod type'],
  modInfo:['mod info','mod features','mod information','mod features info'],
  price:['price'],rating:['rating','user rating','average rating'],ratings:['ratings','rating count','review count','reviews'],
  language:['language','languages'],license:['license','licence'],
  playStore:['google play','play store','google play store','original app','original version'],
  website:['official website','website','developer website','homepage']
};
const canonical = new Map();
for (const [key, names] of Object.entries(ALIASES)) for (const name of names) canonical.set(normalizeLabel(name), key);
function validValue(value) {
  const v=clean(value);
  if(!v)return null;
  const missing=/^(?:n\/?a|n\.a\.|none|null|undefined|unknown|not (?:reported|available|provided|found)|--?|—|–)$/i;
  if(missing.test(v))return null;
  // Some compact stat cards collapse a label and a missing sentinel into one
  // text node (for example "Developer Not reported"). Do not promote that
  // wrapper text into a real metadata value.
  if(/^(?:developer|publisher|author|size|app size|apk size|file size|updated?|update date|downloads?|views?|reached)\s*[:\-]?\s*(?:n\/?a|n\.a\.|none|null|undefined|unknown|not (?:reported|available|provided|found)|--?|—|–)$/i.test(v))return null;
  return v;
}
function fieldKey(value) { return canonical.get(normalizeLabel(value)) || null; }
function validForKey(key,value) {
  const v=validValue(value);if(!v)return null;
  if(key==='size')return parseBytes(v)?v:null;
  if(key==='updated')return parseDate(v)?v:null;
  if(key==='downloads'||key==='views')return parseCount(v)!=null?v:null;
  if(key==='version')return /\d/.test(v)?v:null;
  return v;
}
function addLabel(map, label, value) {
  const key=fieldKey(label),v=validForKey(key,value);
  if(key && v && normalizeLabel(v)!==normalizeLabel(label) && v.length<=1000 && !map.has(key))map.set(key,v);
}
// LiteAPKs displays the app's primary facts in a six-column statistics row.
// Each cell has a label, a value and often a secondary caption (Latest, Total,
// Views, or a separate year). Read the value inside that same cell only.
// This also supports its compact/mobile markup without relying on CSS names.
const STAT_KEYS = new Set(['version','size','category','developer','views','updated','downloads']);
const STAT_CAPTIONS = /^(?:latest|total|views?|downloads?|installs?|current|new)$/i;
function sourceStatistics($) {
  const out=new Map();
  const selectors='span,small,strong,b,label,dt,th,[class*="label"],[class*="title"],h4,h5,h6';
  const accept=(key,value)=>{
    value=validValue(value);if(!value||out.has(key))return false;
    if(key==='updated'&&!parseDate(value))return false;
    if(key==='size'&&!parseBytes(value))return false;
    if((key==='views'||key==='downloads'||key==='version')&&!/\d/.test(value))return false;
    if(key==='developer'&&value.length>255)return false;
    out.set(key,value);return true;
  };
  // Current LiteAPKs detail pages render VERSION / SIZE / GENRE / DEVELOPER /
  // REACHED / UPDATED as compact stat cards. The label is often below the
  // value, so read every leaf label and then stay inside its nearest card.
  $('body *').each((_,el)=>{
    const node=$(el);if(node.children().length)return;
    const label=clean(node.text()),key=fieldKey(label);
    if(!STAT_KEYS.has(key)||node.closest('nav,footer,aside,[class*="recommend"],[class*="related"],[class*="old-version"],[class*="history"]').length)return;
    let group=node.parent();
    for(let depth=0;depth<5&&group.length;depth++,group=group.parent()){
      const text=clean(group.text());
      if(!text||text.length>220)continue;
      // Stop before a container that contains multiple independent stat labels.
      const keys=new Set();
      group.find('*').each((__,n)=>{if($(n).children().length===0){const k=fieldKey($(n).text());if(STAT_KEYS.has(k))keys.add(k)}});
      if(keys.size>1)continue;
      const pieces=[];
      // Preserve direct text values such as <b>Developer</b>Real Studio.
      // Element-only walks miss that common compact-card form and can then
      // climb too far, accidentally picking the app title as the developer.
      group.contents().each((__,n)=>{if(n.type==='text'||n.nodeType===3){const t=clean(n.data??n.nodeValue);if(t)pieces.push(t)}});
      group.find('*').addBack().each((__,n)=>{
        if($(n).children().length)return;
        const t=clean($(n).text());
        if(!t||normalizeLabel(t)===normalizeLabel(label)||STAT_CAPTIONS.test(t))return;
        if(fieldKey(t))return;
        pieces.push(t);
      });
      // Preserve order but remove duplicate nested fragments.
      const unique=[];for(const t of pieces)if(!unique.includes(t))unique.push(t);
      let value=clean(unique.join(' '));
      if(key==='updated'){
        const date=parseDate(value);if(date){out.set(key,value);break}
      }
      if(key==='size'){
        const m=value.match(/\b\d+(?:[.,]\d+)?\s*(?:bytes?|[kmgt]i?b)\b/i);if(m)value=m[0];
      }
      if(key==='views'||key==='downloads'){
        const m=value.match(/\b\d+(?:\.\d+)?\s*(?:k|m|b|thousand|million|billion)?\s*\+?/i);if(m)value=m[0];
      }
      if(key==='version'){
        const m=value.match(/\bv?\d+(?:\.\d+)+(?:[A-Za-z0-9._+-]*)?/);if(m)value=m[0];
      }
      if(accept(key,value))break;
    }
  });
  // Generic templates / older LiteAPKs markup.
  $(selectors).each((_,el)=>{
    const label=clean($(el).text()),key=fieldKey(label);
    if(!STAT_KEYS.has(key)||$(el).closest('nav,footer,aside,[class*="recommend"],[class*="related"],[class*="old-version"],[class*="history"]').length)return;
    let group=$(el).parent();
    for(let depth=0;depth<3&&group.length;depth++,group=group.parent()){
      const text=clean(group.text());
      if(!text||text.length>320)continue;
      const children=group.children();
      if(children.length<2||children.length>12)continue;
      const otherLabels=[];
      group.find(selectors).each((__,node)=>{if(node!==el){const other=fieldKey($(node).text());if(other&&other!==key&&STAT_KEYS.has(other))otherLabels.push(other)}});
      if(otherLabels.length)continue;
      const fragments=[];
      const walk=node=>{
        if(!node||node===el)return;
        if(node.type==='text'||node.nodeType===3){const value=clean(node.data??node.nodeValue);if(value)fragments.push(value);return}
        const tag=String(node.tagName||node.name||'').toLowerCase();
        if(['svg','script','style','noscript'].includes(tag)||$(node).attr('aria-hidden')==='true')return;
        for(const child of Array.from(node.childNodes||node.children||[]))walk(child);
      };
      for(const child of group.contents().toArray())walk(child);
      const value=clean(fragments.filter(x=>x!==label&&!STAT_CAPTIONS.test(x)).join(' '));
      if(accept(key,value))break;
    }
  });
  return out;
}
function visibleStatFallback($, map) {
  // Clear invalid early captures (for example SIZE => Total) so a later typed
  // source value can still win. Generic card parsing must never poison SIZE.
  if(map.has('size')&&!parseBytes(map.get('size')))map.delete('size');
  if(map.has('updated')&&!parseDate(map.get('updated')))map.delete('updated');
  if(map.has('downloads')&&parseCount(map.get('downloads'))==null)map.delete('downloads');
  if(map.has('views')&&parseCount(map.get('views'))==null)map.delete('views');
  // LiteAPKs can place the value above the label in a shared stats grid. In that
  // layout the nearest parent may contain several fields, so ordinary label/value
  // extraction deliberately skips it. Recover only strongly typed values adjacent
  // to a known stat label, never arbitrary numbers from the page.
  const specs={
    size:/\b\d+(?:[.,]\d+)?\s*(?:bytes?|[kmgt]i?b|[kmgt]bytes?)\b/i,
    version:/\bv?\d+(?:\.\d+)+(?:[A-Za-z0-9._+-]*)?/i,
    views:/\b\d+(?:\.\d+)?\s*(?:k|m|b|thousand|million|billion)?\s*\+?\b/i,
    downloads:/\b\d+(?:\.\d+)?\s*(?:k|m|b|thousand|million|billion)?\s*\+?\b/i
  };
  $('body *').each((_,el)=>{
    const node=$(el);if(node.children().length)return;
    const label=clean(node.text()),key=fieldKey(label);
    if(!STAT_KEYS.has(key)||map.has(key))return;
    if(node.closest('nav,footer,aside,[class*="recommend"],[class*="related"],[class*="old-version"],[class*="history"]').length)return;
    const candidates=[];
    const add=n=>{if(!n||!n.length)return;const v=clean(n.text());if(v&&normalizeLabel(v)!==normalizeLabel(label)&&!candidates.includes(v))candidates.push(v)};
    add(node.prev());add(node.next());
    const parent=node.parent();add(parent.prev());add(parent.next());
    parent.children().each((__,child)=>{if(child!==el)add($(child))});
    const grand=parent.parent();
    if(grand.length&&clean(grand.text()).length<320){
      const kids=grand.children();const idx=kids.index(parent);
      if(idx>0)add(kids.eq(idx-1));if(idx>=0&&idx+1<kids.length)add(kids.eq(idx+1));
    }
    for(let value of candidates){
      if(key==='updated'){const d=parseDate(value);if(d){map.set(key,value);break}continue}
      if(key==='developer'||key==='category'){
        if(validValue(value)&&value.length<=160&&!fieldKey(value)&&!/^(?:latest|total|views?|reached|version|size|updated?|downloads?|developer|category|genre|package(?:\s+(?:name|id))?|requires\s+android|android)\b/i.test(value)){map.set(key,value);break}
        continue;
      }
      const re=specs[key];if(!re)continue;const m=value.match(re);if(!m)continue;
      if(key==='size'&&!parseBytes(m[0]))continue;
      if((key==='views'||key==='downloads')&&parseCount(m[0])==null)continue;
      map.set(key,m[0]);break;
    }
  });
  // Final source-specific text patterns for the compact six-stat row. These
  // require both a recognized label and a typed value immediately around it.
  const text=clean($('body').text());
  const patterns={
    size:[/\b(\d+(?:[.,]\d+)?\s*(?:bytes?|[kmgt]i?b))\s+SIZE\b/i,/\bSIZE\s+(\d+(?:[.,]\d+)?\s*(?:bytes?|[kmgt]i?b))\b/i],
    views:[/\b(\d+(?:\.\d+)?\s*(?:K|M|B)?\s*\+?)\s+(?:Views?\s+)?REACHED\b/i,/\bREACHED\s+(\d+(?:\.\d+)?\s*(?:K|M|B)?\s*\+?)/i],
    downloads:[/\b(\d+(?:\.\d+)?\s*(?:K|M|B)?\s*\+?)\s+DOWNLOADS?\b/i,/\bDOWNLOADS?\s+(\d+(?:\.\d+)?\s*(?:K|M|B)?\s*\+?)/i]
  };
  for(const [key,res] of Object.entries(patterns))if(!map.has(key))for(const re of res){const m=text.match(re);if(m){map.set(key,m[1]);break}}
  return map;
}
function collectLabels($) {
  const map=sourceStatistics($);
  // Semantic tables and definition lists take priority over generic cards.
  $('tr').each((_,el)=>{const cells=$(el).children('th,td');if(cells.length>=2)addLabel(map,cells.eq(0).text(),cells.eq(1).text())});
  $('dt').each((_,el)=>{const next=$(el).next('dd');if(next.length)addLabel(map,$(el).text(),next.text())});
  // Source templates use many different card/grid names. Read leaf rows,
  // not whole parent panels, so one field cannot absorb its neighbours.
  const selector='li,p,div,section,article,dl,[class*="info"],[class*="meta"],[class*="detail"],[class*="stat"]';
  $(selector).each((_,el)=>{
    const node=$(el),text=clean(node.text());
    if(!text||text.length>1100)return;
    const children=node.children();
    if(children.length>=2 && children.length<=4){
      const first=children.eq(0),label=clean(first.text());
      if(fieldKey(label)){
        let value='';
        children.slice(1).each((__,child)=>{value+=' '+$(child).text()});
        addLabel(map,label,value);
      }
    }
    const labelNodes=node.children('strong,b,dt,label,[class*="label"],[class*="title"]');
    labelNodes.each((__,labelEl)=>{
      const label=clean($(labelEl).text());if(!fieldKey(label))return;
      const remainder=node.contents().toArray().filter(child=>child!==labelEl).map(child=>child.type==='text'?child.data:$(child).text()).join(' ');
      addLabel(map,label,remainder);
      if(!validValue(remainder))addLabel(map,label,$(labelEl).next().text());
    });
    if(text.length<=500){
      const m=text.match(/^([^:：\n]{2,45})\s*[:：]\s*(.+)$/s);
      if(m)addLabel(map,m[1],m[2]);
    }
    if(children.length===0 && fieldKey(text)){
      const sibling=node.next();if(sibling.length)addLabel(map,text,sibling.text());
    }
  });
  // Include source-specific statistic groups and ordinary aria/data labels.
  $('[data-label],[data-title],[aria-label]').each((_,el)=>{
    const node=$(el);for(const a of ['data-label','data-title','aria-label'])addLabel(map,node.attr(a),node.text());
  });
  // A few templates have a plain text label followed by a value in another
  // element. Restrict this to known labels and an immediately adjacent node.
  $('body').find('span,small,strong,b,label').each((_,el)=>{
    const label=clean($(el).text());if(!fieldKey(label))return;
    const sibling=$(el).next();if(sibling.length)addLabel(map,label,sibling.text());
  });
  visibleStatFallback($,map);
  return map;
}
function firstLabel(map,names){
  for(const name of names){const key=fieldKey(name)||normalizeLabel(name);const value=map.get(key)||map.get(normalizeLabel(name));if(validValue(value))return validValue(value)}
  return null;
}
function parseCount(value){
 if(typeof value==='number')return Number.isSafeInteger(value)&&value>=0?value:null;
 const raw=clean(value).replace(/[\u00a0\u202f]/g,' ');
 if(!raw)return null;
 // A count must be one number, optionally followed by a recognized scale.
 // Never interpret a version number such as 1.2.3 as a download count.
 const m=raw.match(/(?:^|[^\da-z.])((?:\d{1,3}(?:[ ,]\d{3})+)|(?:\d+(?:\.\d+)?))\s*(thousand|million|billion|k|m|b)?\s*\+?(?=$|[^a-z\d.])/i);
 if(!m)return null;
 const token=m[1].replace(/[ ,]/g,'');const n=Number(token);
 const unit=(m[2]||'').toLowerCase(),mult={k:1e3,thousand:1e3,m:1e6,million:1e6,b:1e9,billion:1e9}[unit]||1;
 const result=n*mult;return Number.isFinite(result)&&result>=0&&Number.isSafeInteger(Math.round(result))?Math.round(result):null;
}
function parseBytes(value){
 if(typeof value==='number')return Number.isSafeInteger(value)&&value>0?value:null;
 if(value&&typeof value==='object'){
  const n=value.value??value.amount??value.size??value.bytes;
  if(n!=null)return parseBytes(String(n)+' '+(value.unitText||value.unitCode||value.unit||'bytes'));
 }
 const raw=clean(value);if(!raw)return null;
 const m=raw.match(/((?:\d{1,3}(?:[ ,]\d{3})+|\d+)(?:[.,]\d+)?)\s*(bytes?|[kmgt]i?b|[kmgt]bytes?|kilo(?:byte)?s?|mega(?:byte)?s?|giga(?:byte)?s?|tera(?:byte)?s?)\b/i);
 if(!m)return null;
 let number=m[1].replace(/ /g,'');
 if(number.includes(',')&&number.includes('.'))number=number.replace(/,/g,'');
 else if(number.includes(',')&&/^\d{1,3}(?:,\d{3})+$/.test(number))number=number.replace(/,/g,'');
 else number=number.replace(',','.');
 const unit=m[2].toLowerCase();let power=0;
 if(/^(?:k|kilo)/.test(unit))power=1;else if(/^(?:m|mega)/.test(unit))power=2;else if(/^(?:g|giga)/.test(unit))power=3;else if(/^(?:t|tera)/.test(unit))power=4;
 const n=Number(number)*1024**power;
 return Number.isFinite(n)&&n>0&&Number.isSafeInteger(Math.round(n))?Math.round(n):null;
}
function structuredFileSize($){
 const candidates=[];
 const byteKeys=new Set(['filesizebytes','file_size_bytes','fileSizeBytes','contentlength','content_length']);
 const sizeKeys=new Set(['filesize','file_size','fileSize','downloadsize','download_size','downloadSize','apksize','apk_size','apkSize','appsize','app_size','appSize','packagesize','package_size','packageSize']);
 const add=(key,value)=>{
  if(value==null||value==='')return;
  const compact=String(key||'').replace(/[^a-z0-9_]/gi,'');
  let raw=value;
  if(byteKeys.has(key)||byteKeys.has(compact)||/bytes$/i.test(String(key||''))){if(typeof value==='number'||/^\d+$/.test(String(value).trim()))raw=String(value)+' bytes';}
  if(!(byteKeys.has(key)||byteKeys.has(compact)||sizeKeys.has(key)||sizeKeys.has(compact)))return;
  const bytes=parseBytes(raw);if(bytes)candidates.push({raw:typeof raw==='string'?clean(raw):String(bytes)+' bytes',bytes});
 };
 const walk=(value,depth=0,seen=new Set())=>{
  if(value==null||depth>14||typeof value!=='object'||seen.has(value))return;seen.add(value);
  if(Array.isArray(value)){for(const v of value)walk(v,depth+1,seen);return}
  for(const [key,val] of Object.entries(value)){
   add(key,val);
   if(val&&typeof val==='object')walk(val,depth+1,seen);
  }
 };
 $('script[type="application/ld+json"],script#__NEXT_DATA__,script[type="application/json"]').each((_,el)=>{const text=$(el).text();if(!text||text.length>3000000)return;try{walk(JSON.parse(text))}catch{}});
 return candidates[0]||null;
}
function parseDate(value,{now=new Date()}={}){
  if(value==null||value==='')return null;
  if(value instanceof Date)return Number.isNaN(value.getTime())?null:value.toISOString().slice(0,10);
  if(typeof value==='number'){
    const d=new Date(value<1e11?value*1000:value);return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10);
  }
  const raw=clean(value);if(!raw)return null;
  if(/^(today|yesterday)$/i.test(raw)){
    const d=new Date(now);if(/^yesterday$/i.test(raw))d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);
  }
  const relative=raw.match(/^(\d{1,3})\s+(days?|weeks?)\s+ago$/i);
  if(relative){const d=new Date(now);d.setUTCDate(d.getUTCDate()-Number(relative[1])*(/^week/i.test(relative[2])?7:1));return d.toISOString().slice(0,10)}
  let m=raw.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?=$|[^\d])/);
  if(!m){m=raw.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);if(m){const a=Number(m[1]),b=Number(m[2]);if(a>12)return checkedDate(Number(m[3]),b,a);if(b>12)return checkedDate(Number(m[3]),a,b);return null}}
  if(m)return checkedDate(Number(m[1]),Number(m[2]),Number(m[3]));
  if(!/[a-z]/i.test(raw))return null;
  const month=raw.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i);
  if(!month)return null;
  const monthNumbers={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  const day=raw.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if(!day)return null;
  const year=raw.match(/\b(20\d{2})\b/);
  const monthNumber=monthNumbers[month[1].slice(0,3).toLowerCase()];
  return checkedDate(year?Number(year[1]):new Date(now).getUTCFullYear(),monthNumber,Number(day[1]));
}
function checkedDate(y,m,d){const date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?date.toISOString().slice(0,10):null}
function normalizeVersion(value){const v=validValue(value);if(!v)return null;return v.replace(/^v(?=\d)/i,'').replace(/\s+\(.+$/,'').trim().slice(0,120)||null}
function personName(value){
  if(Array.isArray(value))return value.map(personName).find(Boolean)||null;
  if(value&&typeof value==='object')return validValue(value.name||value.legalName||value.alternateName||value.title)||null;
  return validValue(value);
}
function structuredCount(value){
  if(Array.isArray(value))return value.map(structuredCount).find(x=>x!=null)??null;
  if(value&&typeof value==='object')return parseCount(value.userInteractionCount??value.interactionCount??value.count);
  return parseCount(value);
}
function schemaType(value){return (Array.isArray(value)?value:[value]).some(t=>/(?:^|\/)\s*(?:SoftwareApplication|MobileApplication|WebApplication|GameApplication|VideoGame)$/i.test(String(t||'')))}
function softwareObjects($){
  const out=[],seen=new Set();
  function walk(value,depth=0){
    if(!value||depth>12||typeof value!=='object'||seen.has(value))return;seen.add(value);
    if(Array.isArray(value)){value.forEach(v=>walk(v,depth+1));return}
    if(schemaType(value['@type']))out.push(value);
    for(const key of ['@graph','mainEntity','mainEntityOfPage','itemListElement','item','about','application','softwareApplication','app'])if(value[key])walk(value[key],depth+1);
  }
  $('script[type="application/ld+json"]').each((_,el)=>{try{walk(JSON.parse($(el).text()))}catch{}});
  // Only parse explicit JSON state containers; never execute page JavaScript.
  $('script#__NEXT_DATA__,script[type="application/json"]').each((_,el)=>{
    const text=$(el).text();if(text.length>2e6)return;
    try{const root=JSON.parse(text);walk(root)}catch{}
  });
  return out;
}
function chooseSoftware(objects,packageId){
  if(!objects.length)return {};
  if(packageId){const found=objects.find(o=>String(o.identifier||o.packageName||'')===packageId);if(found)return found}
  return objects[0];
}
module.exports={clean,normalizeLabel,fieldKey,validValue,validForKey,collectLabels,sourceStatistics,firstLabel,parseCount,parseBytes,parseDate,normalizeVersion,personName,structuredCount,structuredFileSize,softwareObjects,chooseSoftware};
