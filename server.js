'use strict';
if(!process.env.PLAYWRIGHT_BROWSERS_PATH)process.env.PLAYWRIGHT_BROWSERS_PATH='0';
const path=require('node:path');
const next=require('next');
const express=require('express');
const helmet=require('helmet');
const compression=require('compression');
const cookieSession=require('cookie-session');
const morgan=require('morgan');

const dev=process.env.NODE_ENV!=='production';
const nextApp=next({dev,dir:__dirname});
const handle=nextApp.getRequestHandler();

const config=require('./src/config');
const state=require('./src/state');
const {startDatabaseInitialization}=require('./src/init');
const {startBackupWorker}=require('./src/services/backups');
const {startApkResolverWorker}=require('./src/services/apk-resolver');
const {ensureToken}=require('./src/middleware/csrf');

function isAllowedUiPath(pathname){
  if(pathname==='/'||pathname==='/library'||pathname==='/library/add'||pathname==='/publishing'||pathname==='/updates'||pathname==='/r2/accounts'||pathname==='/r2/files'||pathname==='/settings')return true;
  return /^\/apps\/\d+$/.test(pathname);
}

async function main(){
  await nextApp.prepare();
  const app=express();
  if(config.trustProxy)app.set('trust proxy',1);
  app.set('view engine','ejs');
  app.set('views',path.join(__dirname,'views'));
  app.disable('x-powered-by');

  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],imgSrc:["'self'",'data:','blob:'],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'data:','https://fonts.gstatic.com'],scriptSrc:["'self'","'unsafe-inline'"],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"]}},crossOriginResourcePolicy:{policy:'cross-origin'}}));
  app.use(compression());
  app.use(morgan(config.nodeEnv==='production'?'combined':'dev'));
  app.use(express.urlencoded({extended:false,limit:'256kb'}));
  app.use(express.json({limit:'512kb'}));
  app.use(cookieSession({name:'appbit_session',keys:[config.sessionSecret||'development-only-change-me'],maxAge:7*24*60*60*1000,httpOnly:true,sameSite:'lax',secure:config.nodeEnv==='production'}));
  app.use(ensureToken);
  app.use(express.static(path.join(__dirname,'public'),{maxAge:0,etag:true}));
  app.use((req,res,nextMiddleware)=>{res.locals.user=req.session?.user||null;res.locals.active='';res.locals.state=state;res.locals.appVersion=config.appVersion;nextMiddleware()});

  // Next.js build assets must be public even before an authenticated Appbit session exists.
  app.use((req,res,nextMiddleware)=>{if(req.path.startsWith('/_next/static/')||req.path.startsWith('/_next/image'))return handle(req,res);nextMiddleware()});
  app.get('/api/version',(req,res)=>{res.setHeader('Cache-Control','no-store');res.json({ok:true,version:config.appVersion,buildId:config.buildId,framework:'nextjs'})});
  app.use(require('./src/routes/downloads'));
  app.use(require('./src/routes/health'));
  app.use(require('./src/routes/auth'));
  app.use('/api',require('./src/routes/api'));

  const {requireAuth,requireActiveUser}=require('./src/middleware/auth');
  const requireDb=require('./src/middleware/db-ready');
  app.use(requireDb,requireAuth,requireActiveUser);
  app.use((req,res,nextMiddleware)=>{if((req.path==='/settings'||/^\/r2(?:\/|$)/.test(req.path))&&req.currentUser?.role!=='admin')return res.redirect('/');nextMiddleware()});
  app.use((req,res)=>{
    if(req.path==='/r2')return res.redirect('/r2/accounts');
    if(!['GET','HEAD'].includes(req.method))return res.status(405).send('Method Not Allowed');
    if(!isAllowedUiPath(req.path))return res.redirect('/');
    return handle(req,res);
  });

  app.use((err,req,res,nextMiddleware)=>{
    console.error('[Appbit] Request error:',err);
    if(res.headersSent)return nextMiddleware(err);
    const status=Number(err.status||500),r2Request=req.originalUrl.startsWith('/api/r2/');
    if(req.originalUrl.startsWith('/api/')||req.path.startsWith('/api/')||req.accepts(['json','html'])==='json')return res.status(status).json({ok:false,error:status>=500&&config.nodeEnv==='production'&&!r2Request?'The request failed. Check Runtime Logs for details.':(err.message||'Request failed.')});
    return res.status(status).render('error',{title:'Error',active:'',message:status>=500&&config.nodeEnv==='production'?'The request failed. Check Appbit Health and Hostinger logs.':(err.message||'Request failed.')});
  });

  const server=app.listen(config.port,'0.0.0.0',()=>{
    console.log(`[Appbit] V${config.appVersion} (${config.buildId}) Next.js workspace listening on port ${config.port}`);
    startDatabaseInitialization();
    startBackupWorker();
    startApkResolverWorker();
  });
  server.requestTimeout=60*60*1000;
  server.headersTimeout=65*60*1000;
}

main().catch(err=>{console.error('[Appbit] Failed to start Next.js runtime:',err);process.exitCode=1});
