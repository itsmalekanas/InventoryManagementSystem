'use strict';

// Coalesce rapid edits into one render per browser frame. Form values and save
// state remain synchronous; only the expensive invoice DOM render is deferred.
function frameUpdate(render, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame) {
  let pending = null;
  const update = () => {
    if (pending !== null) return;
    pending = requestFrame(() => {
      pending = null;
      render();
    });
  };
  update.flush = () => {
    if (pending === null) return;
    cancelFrame(pending);
    pending = null;
    render();
  };
  return update;
}
