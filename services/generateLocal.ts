// Local (WebGPU) Generate — proof of concept.
//
// Runs SD-Turbo entirely client-side via onnxruntime-web's WebGPU execution
// provider — no server call, no per-generation cost. Ported from Microsoft's
// own reference example (onnxruntime-inference-examples/js/sd-turbo), which
// is the one confirmed genuinely WebGPU-compatible SD-Turbo ONNX export we
// found — the models under the huggingface.co/onnxruntime org are Olive/CUDA-
// optimized and explicitly do NOT run on WebGPU, CPU, or DirectML, so that
// was a dead end ruled out during research.
//
// Pipeline: CLIP tokenize (via @huggingface/transformers' AutoTokenizer,
// which is genuinely good at this despite the package having no diffusion
// support of its own) -> text encoder -> single-step UNet denoise (this is
// what "Turbo" buys us — no 20-50 step loop) -> a minimal Euler-ish scheduler
// step -> VAE decode -> render to canvas -> data URL, which is exactly the
// string RightPanel's imageUrl contract expects, same as every other source.

import ort from 'onnxruntime-web/webgpu';
import { AutoTokenizer } from '@huggingface/transformers';
import { isLocalGenerationSupported as checkWebGpuSupport } from './webgpuSupport';

const MODEL_BASE = 'https://huggingface.co/schmuell/sd-turbo-ort-web/resolve/main';
const TOKENIZER_ID = 'Xenova/clip-vit-base-patch16';
const CACHE_NAME = 'herokit-onnx-v1';

// Fixed scheduler constants for SD-Turbo's single-step config — not tunable,
// these are specific to the model/scheduler pairing, not generation params.
const SIGMA = 14.6146;
const GAMMA = 0;
const VAE_SCALING_FACTOR = 0.18215;

// Keep in sync with the onnxruntime-web version in package.json — ORT needs
// its own WASM glue served from somewhere even when running the WebGPU EP.
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;

interface ModelSpec {
  url: string;
  opt: Record<string, unknown>;
}

const MODEL_SPECS = {
  text_encoder: {
    url: 'text_encoder/model.onnx',
    opt: { freeDimensionOverrides: { batch_size: 1 } },
  },
  unet: {
    url: 'unet/model.onnx',
    opt: { freeDimensionOverrides: { batch_size: 1, num_channels: 4, height: 64, width: 64, sequence_length: 77 } },
  },
  vae_decoder: {
    url: 'vae_decoder/model.onnx',
    opt: { freeDimensionOverrides: { batch_size: 1, num_channels_latent: 4, height_latent: 64, width_latent: 64 } },
  },
} satisfies Record<string, ModelSpec>;

type ModelName = keyof typeof MODEL_SPECS;

const SESSION_OPTS_BASE = {
  executionProviders: ['webgpu'],
  enableMemPattern: false,
  enableCpuMemArena: false,
  extra: {
    session: {
      disable_prepacking: '1',
      use_device_allocator_for_initializers: '1',
      use_ort_model_bytes_directly: '1',
      use_ort_model_bytes_for_initializers: '1',
    },
  },
};

let sessions: Partial<Record<ModelName, ort.InferenceSession>> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tokenizer: any = null;

/** Cache API (not localStorage — see App.tsx/LooksPanel.tsx's own notes on why
 * binary blobs don't belong there) so multi-hundred-MB model files persist
 * across sessions without hitting a quota wall. */
async function fetchAndCache(url: string): Promise<ArrayBuffer> {
  try {
    const cache = await caches.open(CACHE_NAME);
    let cached = await cache.match(url);
    if (!cached) {
      await cache.add(url);
      cached = await cache.match(url);
    }
    return await cached!.arrayBuffer();
  } catch {
    const res = await fetch(url);
    return await res.arrayBuffer();
  }
}

async function loadSessions(onProgress?: (msg: string) => void): Promise<Record<ModelName, ort.InferenceSession>> {
  if (sessions) return sessions as Record<ModelName, ort.InferenceSession>;
  const loaded: Partial<Record<ModelName, ort.InferenceSession>> = {};
  for (const name of Object.keys(MODEL_SPECS) as ModelName[]) {
    const spec = MODEL_SPECS[name];
    onProgress?.(`Downloading ${name.replace('_', ' ')}… (first time only, cached after)`);
    const bytes = await fetchAndCache(`${MODEL_BASE}/${spec.url}`);
    onProgress?.(`Loading ${name.replace('_', ' ')}…`);
    const opt = { ...SESSION_OPTS_BASE, ...spec.opt } as Record<string, unknown>;
    if (name === 'text_encoder') {
      opt.preferredOutputLocation = { last_hidden_state: 'gpu-buffer' };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loaded[name] = await ort.InferenceSession.create(bytes, opt as any);
  }
  sessions = loaded;
  return loaded as Record<ModelName, ort.InferenceSession>;
}

function randnLatents(shape: number[], noiseSigma: number): Float32Array {
  const size = shape.reduce((a, b) => a * b, 1);
  const data = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    // Box-Muller transform
    const u = Math.random(), v = Math.random();
    data[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * noiseSigma;
  }
  return data;
}

function scaleModelInputs(t: ort.Tensor): ort.Tensor {
  const divisor = Math.sqrt(SIGMA ** 2 + 1);
  const src = t.data as Float32Array;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i] / divisor;
  return new ort.Tensor(out, t.dims);
}

/** Minimal single-step Euler-ish scheduler update — SD-Turbo only ever needs
 * one step, so this is the whole scheduler, not a simplification of a loop. */
function eulerStep(modelOutput: ort.Tensor, sample: ort.Tensor): ort.Tensor {
  const sigmaHat = SIGMA * (GAMMA + 1);
  const mo = modelOutput.data as Float32Array;
  const sd = sample.data as Float32Array;
  const out = new Float32Array(mo.length);
  for (let i = 0; i < mo.length; i++) {
    const predOriginal = sd[i] - sigmaHat * mo[i];
    const derivative = (sd[i] - predOriginal) / sigmaHat;
    out[i] = (sd[i] + derivative * (0 - sigmaHat)) / VAE_SCALING_FACTOR;
  }
  return new ort.Tensor(out, modelOutput.dims);
}

export async function generateImageLocally(prompt: string, onProgress?: (msg: string) => void): Promise<string> {
  const supported = await checkWebGpuSupport();
  if (!supported) {
    throw new Error('Local generation needs a WebGPU browser with fp16 shader support (recent Chrome or Edge) — not available in this browser.');
  }

  onProgress?.('Preparing model…');
  const models = await loadSessions(onProgress);

  if (!tokenizer) {
    onProgress?.('Loading tokenizer…');
    tokenizer = await AutoTokenizer.from_pretrained(TOKENIZER_ID);
    tokenizer.pad_token_id = 0;
  }

  onProgress?.('Generating…');
  // padding:true alone means "pad to the longest in the batch" — a no-op
  // for a single string, unlike the older @xenova/transformers behavior the
  // Microsoft reference example was written against. The UNet's ONNX graph
  // has sequence_length hard-pinned to 77 (see freeDimensionOverrides
  // above), so it needs an explicit fixed-length pad, not dynamic padding.
  const tokenized = await tokenizer(prompt, { padding: 'max_length', max_length: 77, truncation: true, return_tensor: false });
  // return_tensor:false can hand back either a flat array or a single-row
  // batch [number[]] depending on tokenizer version — handle both.
  const ids: number[] = Array.isArray(tokenized.input_ids[0]) ? tokenized.input_ids[0] : tokenized.input_ids;

  const textEncoderOut = await models.text_encoder.run({
    input_ids: new ort.Tensor('int32', Int32Array.from(ids), [1, ids.length]),
  });
  const lastHiddenState = textEncoderOut.last_hidden_state;

  const latentShape = [1, 4, 64, 64];
  const latent = new ort.Tensor(randnLatents(latentShape, SIGMA), latentShape);
  const latentModelInput = scaleModelInputs(latent);

  const unetOut = await models.unet.run({
    sample: latentModelInput,
    timestep: new ort.Tensor('int64', BigInt64Array.from([999n]), [1]),
    encoder_hidden_states: lastHiddenState,
  });

  const newLatents = eulerStep(unetOut.out_sample, latent);

  const vaeOut = await models.vae_decoder.run({ latent_sample: newLatents });
  const sample = vaeOut.sample;

  // GPU-resident tensor we asked ORT to keep on-device (preferredOutputLocation) — dispose explicitly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (lastHiddenState as any).dispose?.();

  onProgress?.('Rendering…');
  const pix = sample.data as Float32Array;
  for (let i = 0; i < pix.length; i++) {
    let x = pix[i] / 2 + 0.5;
    if (x < 0) x = 0;
    if (x > 1) x = 1;
    pix[i] = x;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageData = (sample as any).toImageData({ tensorLayout: 'NCWH', format: 'RGB' }) as ImageData;
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);

  onProgress?.('Done.');
  return canvas.toDataURL('image/png');
}
