import Head from 'next/head';

export default function AppbitShell({ appVersion }) {
  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <meta name="description" content="Appbit Android APK publishing workspace." />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href={`/ui/app.css?v=${encodeURIComponent(appVersion)}`} />
        <title>Appbit — APK Publishing Workspace</title>
      </Head>
      <div id="app"><div className="boot">Loading Appbit…</div></div>
      <script src={`/ui/app.js?v=${encodeURIComponent(appVersion)}`} defer></script>
    </>
  );
}

export async function getServerSideProps() {
  const release = require('../src/version');
  return { props: { appVersion: release.version } };
}
