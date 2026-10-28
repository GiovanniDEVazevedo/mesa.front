type AssetsEnv = { ASSETS: { fetch(request: Request): Promise<Response> } };

// Only the UI crosses the internal binding; API authorization stays on mesa-back.
export default {
  fetch(request: Request, env: AssetsEnv): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
};
