// site-v10/answer-worker.js
var engine;
self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    engine = import(data.src).then((mod) => mod.createKnowledgeEngine(data.data));
    engine.catch(() => {
    });
    return;
  }
  if (data.type !== "answer") return;
  try {
    const result = (await engine).answer(data.question, data.context);
    self.postMessage({ id: data.id, result });
  } catch {
    self.postMessage({ id: data.id, error: "Public notes could not be loaded" });
  }
};
