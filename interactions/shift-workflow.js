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
  });
})();
