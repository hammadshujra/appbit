const state=require('../state');
module.exports=function requireDb(req,res,next){
  if(state.dbReady)return next();
  const isApi=req.path.startsWith('/api/')||req.originalUrl.startsWith('/api/')||req.baseUrl==='/api';
  if(isApi)return res.status(503).json({ok:false,error:state.dbError||'Database is not ready yet. Check Hostinger environment variables and retry.'});
  return res.status(503).render('db-unavailable',{title:'Setup required',state,layout:false});
};
