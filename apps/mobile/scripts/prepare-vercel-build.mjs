import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const distDirectory = new URL('../dist/', import.meta.url);
const bundledAssetsDirectory = new URL('./assets/node_modules/', distDirectory);
const deployableAssetsDirectory = new URL('./assets/vendor/', distDirectory);

const config = {
  cleanUrls: true,
  rewrites: [
    { source: '/plans/:id', destination: '/plans/%5Bid%5D' },
    { source: '/chats/:planId', destination: '/chats/%5BplanId%5D' },
  ],
};

await writeFile(
  new URL('./vercel.json', distDirectory),
  `${JSON.stringify(config, null, 2)}\n`,
);

// Vercel excludes deployed files whose path contains `node_modules`. Expo's web
// export puts bundled fonts and navigation images under that path, so move them
// to a normal static directory and update generated references before upload.
await mkdir(deployableAssetsDirectory, { recursive: true });
await cp(bundledAssetsDirectory, deployableAssetsDirectory, { recursive: true });

async function rewriteGeneratedAssetPaths(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    const itemUrl = new URL(entry.name, directory);
    if (entry.isDirectory()) {
      await rewriteGeneratedAssetPaths(new URL(`${entry.name}/`, directory));
      return;
    }

    if (!/\.(?:css|html|js|json)$/.test(entry.name)) return;

    const source = await readFile(itemUrl, 'utf8');
    const updated = source.replaceAll('assets/node_modules/', 'assets/vendor/');
    if (updated !== source) await writeFile(itemUrl, updated);
  }));
}

await rewriteGeneratedAssetPaths(distDirectory);
