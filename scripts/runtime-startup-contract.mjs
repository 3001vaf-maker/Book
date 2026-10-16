export function authenticatedRuntime(coreSource) {
  const source = String(coreSource || '');
  const start = source.indexOf('async function renderAuthenticated');
  if (start < 0) return '';
  const end = source.indexOf('\nfunction renderLogin', start);
  return end > start ? source.slice(start, end) : source.slice(start);
}

function awaitedPromiseAllBodies(source) {
  return [...source.matchAll(/await\s+Promise\.all\s*\(\s*\[([\s\S]*?)\]\s*\)/g)]
    .map((match) => match[1]);
}

export function isStartupCallAwaitedBeforeWorkspaceRender(coreSource, callExpression) {
  const runtime = authenticatedRuntime(coreSource);
  const renderIndex = runtime.indexOf('renderWorkspace()');
  if (renderIndex < 0) return false;

  const beforeRender = runtime.slice(0, renderIndex);
  const call = String(callExpression || '').trim();
  if (!call) return false;
  if (beforeRender.includes(`await ${call}`)) return true;

  const awaitedGroups = awaitedPromiseAllBodies(beforeRender);
  if (awaitedGroups.some((body) => body.includes(call))) return true;

  const escapedCall = call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const assignment = new RegExp(`(?:const|let)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*[\\s\\S]{0,600}?${escapedCall}`)
    .exec(beforeRender);
  if (!assignment) return false;
  const promiseName = assignment[1];
  return awaitedGroups.some((body) => new RegExp(`\\b${promiseName}\\b`).test(body));
}
