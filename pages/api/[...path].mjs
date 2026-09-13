import backendModule from '../../src/next-api-app.js';

// This file is intentionally .mjs. The Appbit backend is CommonJS, while
// Next Pages API routes use ESM exports for route config. Keeping the boundary
// explicitly ESM avoids Hostinger/Node parsing the route as a CommonJS script.
const backend = backendModule?.default || backendModule;

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true
  }
};

export default function appbitApi(req, res) {
  return backend(req, res);
}
