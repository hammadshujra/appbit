import backendModule from '../../src/next-api-app.js';

// Standard Next.js Pages API route. This source file intentionally uses the
// module syntax documented by Next.js. package.json does not force .js files
// into CommonJS mode, so Hostinger/webpack can compile this route normally.
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
