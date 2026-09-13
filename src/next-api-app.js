'use strict';

const express=require('express');
const cookieSession=require('cookie-session');
const compression=require('compression');
const helmet=require('helmet');
const morgan=require('morgan');
const config=require('./config');
const state=require('./state');
const {startDatabaseInitialization}=require('./init');
const {startBackupWorker}=require('./services/backups');
const {ensureToken}=require('./middleware/csrf');

// Hostinger's Next.js preset starts Next itself, so server.js is not the
// process entry point there. This adapter mounts the existing Express API
// stack inside a Pages API route and starts the long-lived Appbit workers once
// per Node process.
const app=express();
if(config.trustProxy)app.set('trust proxy',1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy:false,
  crossOriginResourcePolicy:{policy:'cross-origin'}
}));
app.use(compression());
app.use(morgan(config.nodeEnv==='production'?'combined':'dev'));
app.use(express.urlencoded({extended:false,limit:'256kb'}));
app.use(express.json({limit:'512kb'}));
app.use(cookieSession({
  name:'appbit_session',
  keys:[config.sessionSecret||'development-only-change-me'],
  maxAge:7*24*60*60*1000,
  httpOnly:true,
  sameSite:'lax',
  secure:config.nodeEnv==='production'
}));
app.use(ensureToken);
app.use((req,res,next)=>{
  res.locals.user=req.session?.user||null;
  res.locals.active='';
  res.locals.state=state;
  res.locals.appVersion=config.appVersion;
  next();
});

let workersStarted=false;
function startWorkersOnce(){
  if(workersStarted)return;
  workersStarted=true;
  startDatabaseInitialization();
  startBackupWorker();
  console.log(`[Appbit] V${config.appVersion} (${config.buildId}) native Next.js API runtime initialized.`);
}
// Start only on a real runtime request; Next may import route modules at build time.
app.use((req,res,next)=>{startWorkersOnce();next();});

// Small unauthenticated endpoint used by the Next login page to obtain the
// cookie-session CSRF token before submitting credentials. Keep this before
// the protected /api router.
app.get('/api/session/csrf',(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.json({ok:true,csrfToken:req.session.csrfToken,version:config.appVersion});
});

// Reuse the existing authentication POST handlers under an API-safe prefix.
// Keep them before the protected /api router so unauthenticated sign-in can
// reach the login handler.
app.use('/api/auth',require('./routes/auth'));

// Public R2 opaque download path is internally rewritten by Next to this
// namespace, then handed to the existing streaming implementation. It must
// remain public and therefore precede the protected API router.
app.use('/api/_download',require('./routes/downloads'));

// Existing protected JSON API (App Library, Publishing, Update Center, R2).
app.use('/api',require('./routes/api'));

// Health route remains available as JSON in /api/health via routes/api.js.
app.use((req,res)=>res.status(404).json({ok:false,error:'Not found.'}));
app.use((err,req,res,next)=>{
  console.error('[Appbit Next API] Request error:',err);
  if(res.headersSent)return next(err);
  const status=Number(err.status||500);
  const isR2=req.originalUrl.startsWith('/api/r2/');
  const message=status>=500&&config.nodeEnv==='production'&&!isR2
    ?'The request failed. Check Hostinger Runtime Logs for details.'
    :(err.message||'Request failed.');
  res.status(status).json({ok:false,error:message});
});

module.exports=app;
