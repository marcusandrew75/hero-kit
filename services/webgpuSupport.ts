// Deliberately dependency-free — checked on every RightPanel mount to decide
// whether to show the Generate toggle at all, so it must NOT pull in
// onnxruntime-web/@huggingface/transformers (services/generateLocal.ts,
// ~48MB of WASM assets between them) just to answer "is this supported."
// That heavier module is only ever dynamically imported once the user
// actually clicks Generate.

/** WebGPU + fp16 shader support — SD-Turbo's ONNX export needs both. */
export async function isLocalGenerationSupported(): Promise<boolean> {
  if (!('gpu' in navigator)) return false;
  try {
    const gpu = (navigator as unknown as { gpu: { requestAdapter(): Promise<{ features: { has(name: string): boolean } } | null> } }).gpu;
    const adapter = await gpu.requestAdapter();
    return !!adapter?.features?.has('shader-f16');
  } catch {
    return false;
  }
}
