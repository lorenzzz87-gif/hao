const dynamicRoutePatterns = [
  { pattern: /^\/plans\/[^/]+\/?$/, asset: '/plans/[id].html' },
  { pattern: /^\/chats\/[^/]+\/?$/, asset: '/chats/[planId].html' },
];

async function fetchAsset(request, env, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return env.ASSETS.fetch(new Request(url, request));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    for (const route of dynamicRoutePatterns) {
      if (route.pattern.test(url.pathname)) return fetchAsset(request, env, route.asset);
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== 'GET') return response;
    return fetchAsset(request, env, '/+not-found.html');
  },
};
