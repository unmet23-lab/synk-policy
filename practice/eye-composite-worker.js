// Composes the closed-eye frame away from the page, so scrolling never waits for a few hundred milliseconds of
// pixel work while the demo comes into view (2026-10-01, qa/perf-20261001). It runs the same composeEyeOnly on the
// same images; blink-demo.js composes on the page, as before, when this cannot run.
const search=new URL(import.meta.url).search;
const load=url=>fetch(url).then(response=>{if(!response.ok)throw new Error('Image unavailable');return response.blob();}).then(blob=>createImageBitmap(blob));
self.onmessage=async({data:{base,closed,manifest}})=>{
  try{
    const {composeEyeOnly}=await import('./eye-composite.js'+search);
    const [baseImage,closedImage]=await Promise.all([load(base),load(closed)]);
    const frames=composeEyeOnly(baseImage,closedImage,manifest);
    baseImage.close();closedImage.close();
    self.postMessage(frames,[frames.open.data.buffer,frames.closed.data.buffer]);
  }catch(error){self.postMessage({error:error.message});}
};
