export function v2ModalPortalGeometry(hostRect = {}, viewport = {}) {
  const viewportLeft = Number(viewport.offsetLeft ?? 0);
  const viewportTop = Number(viewport.offsetTop ?? 0);
  const viewportWidth = Math.max(0, Number(viewport.width ?? 0));
  const viewportHeight = Math.max(0, Number(viewport.height ?? 0));
  const viewportRight = viewportLeft + viewportWidth;
  const viewportBottom = viewportTop + viewportHeight;

  const hostLeft = Number(hostRect.left ?? viewportLeft);
  const hostTop = Number(hostRect.top ?? viewportTop);
  const hostWidth = Math.max(0, Number(hostRect.width ?? 0));
  const hostRight = Number(hostRect.right ?? (hostLeft + hostWidth));

  const left = Math.max(viewportLeft, hostLeft);
  const right = Math.min(viewportRight, hostRight);
  const top = Math.max(viewportTop, hostTop);
  const width = Math.max(0, right - left);
  const height = Math.max(0, viewportBottom - top);

  return { left, top, width, height, bottom: top + height };
}
