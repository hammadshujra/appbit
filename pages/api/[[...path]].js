const backend=require('../../src/next-api-app');

// Let Express parse request bodies itself. This is also required for streamed
// and large R2/file requests so Next does not buffer or truncate them first.
export const config={
  api:{
    bodyParser:false,
    responseLimit:false,
    externalResolver:true
  }
};

export default function appbitApi(req,res){
  return backend(req,res);
}
