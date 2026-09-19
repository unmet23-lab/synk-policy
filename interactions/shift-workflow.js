/* The complete process remains readable until the tab interaction is ready. */
(() => {
  document.querySelectorAll('[data-shift-workflow]').forEach((workflow) => {
    const tablist = workflow.querySelector('[data-workflow-tabs]');
    const tabs = [...workflow.querySelectorAll('[data-workflow-tab]')];
    const panels = [...workflow.querySelectorAll('[data-workflow-panel]')];
    if (!tablist || tabs.length !== 4 || panels.length !== tabs.length ||
        tabs.some((tab, index) => tab.hash !== `#${panels[index].id}`)) return;

    const select = (index, focus = false) => {
      tabs.forEach((tab, position) => {
        const selected = position === index;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[position].hidden = !selected;
      });
      workflow.dataset.workflowStep = String(index + 1);
      workflow.querySelector('[data-blink-demo]')?.dispatchEvent(new Event('previewvisibilitychange'));
      if (focus) tabs[index].focus({ preventScroll: true });
    };

    tablist.setAttribute('role', 'tablist');
    tabs.forEach((tab, index) => {
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panels[index].id);
      panels[index].setAttribute('role', 'tabpanel');
      panels[index].tabIndex = 0;
      tab.addEventListener('click', (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        select(index);
      });
      tab.addEventListener('keydown', (event) => {
        const destinations = {
          ArrowRight: (index + 1) % tabs.length,
          ArrowLeft: (index + tabs.length - 1) % tabs.length,
          Home: 0,
          End: tabs.length - 1,
        };
        if (event.key === ' ') {
          event.preventDefault();
          select(index);
        } else if (Object.hasOwn(destinations, event.key)) {
          event.preventDefault();
          select(destinations[event.key], true);
        }
      });
    });
    workflow.dataset.workflowReady = '';
    const requested = panels.findIndex((panel) => `#${panel.id}` === location.hash);
    select(requested < 0 ? 0 : requested);
    window.addEventListener('hashchange', () => {
      const destination = panels.findIndex(panel => `#${panel.id}` === location.hash);
      if (destination >= 0) select(destination);
    });
    const version = new URL(import.meta.url).search;
    import('/practice/copy-request.js' + version).then(module => module.initRequestEditors(workflow));
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      import('/practice/blink-demo.js' + version).then(module => module.initBlinkDemo(workflow.querySelector('[data-blink-demo]'))).catch(() => {
        const status = workflow.querySelector('[data-blink-status]');
        if (status) status.textContent = '움직임을 불러오지 못해 원본을 보여드립니다.';
      });
    }, {rootMargin: '120px'});
    observer.observe(workflow);
  });
})();
