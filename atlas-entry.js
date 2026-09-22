// The company page keeps its existing deep links; a plain visit opens Atlas.
(() => {
  if (!['/', '/index.html'].includes(location.pathname) || location.hash) return;
  location.replace('/atlas/' + location.search);
})();
