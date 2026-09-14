'use strict';
// Hostinger's managed Next.js runtime may execute bundled server modules from
// .next/server without copying loose project metadata files beside them.
// Keep release identity inside the module so SSR/API bundles never depend on
// runtime filesystem reads of loose release metadata.
module.exports=Object.freeze({
  version:'2.24',
  buildId:'2.24-unified-ui-sidebar-app-icon-folders'
});
