from pathlib import Path
p=Path(__file__).resolve().parents[1]/'src/services/apk-fields.js'
s=p.read_text()
s=s.replace("'app name','application name','game name','name','title'","'app name','application name','game name','name','title'")
s=s.replace("'creator','offered by','company'","'creator','offered by','company','app developer','game developer'")
s=s.replace("'viewed'],","'viewed','reached','reach','reached views'],")
s=s.replace("'requires android','required android','android requirement'","'requires android','required android','android','android requirement'")
# Do not accept unrelated descriptive words or entire page panels as values.
anchor='function collectLabels($) {'
patch=r'''// LiteAPKs displays the app's primary facts in a six-column statistics row.
// Each cell has a label, a value and often a secondary caption (Latest, Total,
// Views, or a separate year). Read the value inside that same cell only.
// This also supports its compact/mobile markup without relying on CSS names.
const STAT_KEYS = new Set(['version','size','category','developer','views','updated','downloads']);
const STAT_CAPTIONS = /^(?:latest|total|views?|downloads?|installs?|current|new)$/i;
function sourceStatistics($) {
  const out=new Map();
  const selectors='span,small,strong,b,label,dt,th,[class*="label"],[class*="title"],h4,h5,h6';
  $(selectors).each((_,el)=>{
    const label=clean($(el).text()),key=fieldKey(label);
    if(!STAT_KEYS.has(key))return;
    let group=$(el).parent();
    for(let depth=0;depth<3&&group.length;depth++,group=group.parent()){
      const text=clean(group.text());
      if(!text||text.length>320)continue;
      const children=group.children();
      if(children.length<2||children.length>12)continue;
      const otherLabels=[];
      group.find(selectors).each((__,node)=>{
        if(node===el)return;
        const other=fieldKey($(node).text());
        if(other&&other!==key&&STAT_KEYS.has(other))otherLabels.push(other);
      });
      if(otherLabels.length)continue;
      const fragments=[];
      // Prefer the complete value node; ignore the label and decorative icons.
      group.contents().each((__,node)=>{
        if(node===el)return;
        if(node.type==='text'){const v=clean(node.data);if(v)fragments.push(v);return;}
        const n=$(node);if(n.find('svg').length&&n.find('span,b,strong,a,time').length===0)return;
        if(n.attr('aria-hidden')==='true')return;
        const value=clean(n.text());if(value&&value!==label)fragments.push(value);
      });
      // The label may be nested in an icon/label wrapper. Collect leaf text
      // only when the direct-child extraction has not found a real value.
      if(!fragments.length||fragments.every(x=>x===label)){
        group.find('span,small,strong,b,a,time').each((__,node)=>{
          if(node===el||$(node).find('span,small,strong,b,a,time').length)return;
          const value=clean($(node).text());if(value&&value!==label)fragments.push(value);
        });
      }
      const value=clean(fragments.filter(x=>x!==label&&!STAT_CAPTIONS.test(x)).join(' '));
      if(!value||value===label)continue;
      if(key==='updated'&&!parseDate(value))continue;
      if(key==='size'&&!parseBytes(value))continue;
      if(key==='views'&&!/\d/.test(value))continue;
      if(key==='downloads'&&!/\d/.test(value))continue;
      if(key==='version'&&!/\d/.test(value))continue;
      if(key==='developer'&&value.length>255)continue;
      if(!out.has(key))out.set(key,value);
      break;
    }
  });
  return out;
}
'''
s=s.replace(anchor,patch+anchor)
s=s.replace('  const map=new Map();\n  // Semantic tables','  const map=sourceStatistics($);\n  // Semantic tables')
# The source statistics block is authoritative over generic parent panels.
s=s.replace("  $('body').find('span,small,strong,b,label').each", "  $('body').find('span,small,strong,b,label').each")
s=s.replace('module.exports={clean,normalizeLabel,fieldKey,validValue,collectLabels,','module.exports={clean,normalizeLabel,fieldKey,validValue,collectLabels,sourceStatistics,')
p.write_text(s)

p=Path(__file__).resolve().parents[1]/'src/services/apk-resolver.js'
s=p.read_text()
s=s.replace("    .replace(/\\s+(?:MOD\\s+APK|APK\\s+MOD|Premium\\s+APK).*$/i, '')", "    .replace(/\\s+v?\\d+(?:\\.\\d+){1,}[0-9A-Za-z._+-]*\\s+(?:APK|XAPK|APKS)\\b.*$/i, '')\n    .replace(/\\s+(?:MOD\\s+APK|APK\\s+MOD|Premium\\s+APK).*$/i, '')")
s=s.replace("    [app?.dateModified,'schema:dateModified'],", "    [firstLabel(labels,['updated','last updated','update date','release date']),'source:updated'],\n    [app?.dateModified,'schema:dateModified'],")
s=s.replace("    [firstLabel(labels,['updated','last updated','update date','release date']),'source:updated']\n  ];", "    [metadataContent($,['meta[property=\"software:release_date\"]','meta[name=\"dateModified\"]','meta[itemprop=\"dateModified\"]']),'meta:dateModified']\n  ];")
s=s.replace("  const match=String(pageText||'').match(/(?:last\\s+updated|updated(?:\\s+on)?|update\\s+date|release\\s+date)", "  const match=String(pageText||'').match(/(?:last\\s+updated|updated(?:\\s+on)?|update\\s+date|release\\s+date)")
s=s.replace("  const title=stripTitleNoise(fields.validValue(app.name)||firstLabel(labels,['app name','application name','game name'])||metadataContent($,['h1','meta[property=\"og:title\"]','meta[name=\"twitter:title\"]','title']));", "  const title=stripTitleNoise(fields.validValue(app.name)||firstLabel(labels,['app name','application name','game name'])||metadataContent($,['h1','meta[property=\"og:title\"]','meta[name=\"twitter:title\"]','title']));")
s=s.replace("  const version=normalizeVersion(app.softwareVersion||app.version||firstLabel(labels,['version','latest version','current version'])||(pageText.match", "  const version=normalizeVersion(firstLabel(labels,['version','latest version','current version'])||app.softwareVersion||app.version||(pageText.match")
s=s.replace("  const sizeRaw=app.fileSize??firstLabel(labels,['size','file size','apk size','app size']);", "  const sizeRaw=firstLabel(labels,['size','file size','apk size','app size'])??app.fileSize;")
s=s.replace("  const downloadCount=fields.structuredCount(app.downloadCount??app.numDownloads??downloadStat)??parseCount(downloadLabel);", "  const downloadCount=parseCount(downloadLabel)??fields.structuredCount(app.downloadCount??app.numDownloads??downloadStat);")
s=s.replace("  const viewCount=fields.structuredCount(viewStat)??parseCount(firstLabel(labels,['views','view count']));", "  const viewCount=parseCount(firstLabel(labels,['views','view count','reached']))??fields.structuredCount(viewStat);")
# Only source-provided fields may be marked verified. A source view count is
# never used to populate Downloads, which is a different metric.
needle='  const result={\n'
replacement="""  const missingFields=[['developer',developer],['version',version],['size',parseBytes(sizeRaw)],['updated',updated.value],['downloads',downloadCount]].filter(([,value])=>value==null||value==='').map(([key])=>key);
  const fieldSources={developer:developer?'source-page':null,version:version?'source-page':null,size:parseBytes(sizeRaw)!=null?'source-page':null,updated:updated.source,downloads:downloadCount!=null?'source-page':null,views:viewCount!=null?'source-page':null};
  const result={
"""
assert needle in s
s=s.replace(needle,replacement,1)
s=s.replace('    looksLikeAppPage:looksLike,internalPackageId:', '    looksLikeAppPage:looksLike,missingFields,fieldSources,internalPackageId:',1)
s=s.replace("      source:'LiteAPKs',sourcePageUrl", "      source:'LiteAPKs',fieldSources,missingFields,sourcePageUrl",1)
# Keep both source metadata and the saved data's provenance available to UI.
p.write_text(s)
