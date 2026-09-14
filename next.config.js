/** @type {import('next').NextConfig} */
const nextConfig={
  pageExtensions:['js','jsx'],
  poweredByHeader:false,
  reactStrictMode:false,
  compress:true,
  serverExternalPackages:['bcryptjs','cheerio','compression','cookie-session','ejs','express','express-rate-limit','helmet','morgan','mysql2','playwright'],
  async rewrites(){
    return [
      // Preserve the public opaque R2 link shape while serving it through the
      // native Next.js API runtime on Hostinger.
      {source:'/d/:token',destination:'/api/_download/d/:token'}
    ];
  }
};
module.exports=nextConfig;
