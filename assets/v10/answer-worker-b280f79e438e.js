// The existing public-note engine runs locally, away from scrolling and input.
// No question, answer, or conversation is stored or sent to a server.
let engine;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    engine = import(data.src).then(mod => mod.createKnowledgeEngine(data.data));
    // Observe an initialization rejection even before the first question arrives.
    engine.catch(() => {});
    return;
  }
  if (data.type !== 'answer') return;
  try {
    const result = (await engine).answer(data.question, data.context);
    self.postMessage({ id: data.id, result });
  } catch {
    self.postMessage({ id: data.id, error: 'Public notes could not be loaded' });
  }
};
