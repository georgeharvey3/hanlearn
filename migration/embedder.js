/**
 * The sentence embedding adapter of write-distractors.js (#601). The model is
 * pinned by name and revision, so two runs on the same sentences give the
 * same vectors, and so the same distractor file.
 *
 * The first run downloads the model (about 600 MB) to the cache of
 * @huggingface/transformers. It runs on the CPU, with no API key.
 */

const MODEL = {
  name: 'Alibaba-NLP/gte-modernbert-base',
  revision: 'e7f32e3c00f91d699e8c43b53106206bcc72bb22',
};

/** The texts of one call of the model. */
const BATCH = 64;

/**
 * An embed function: async (texts) => one unit vector (Float32Array) for each
 * text, in order. The model pools by its CLS token, as its sentence
 * transformers configuration says.
 */
async function createEmbedder({ onProgress = () => {} } = {}) {
  const { pipeline } = await import('@huggingface/transformers');
  const extract = await pipeline('feature-extraction', MODEL.name, {
    revision: MODEL.revision,
    dtype: 'fp32',
  });
  return async (texts) => {
    // Texts of a similar length in one batch pad less.
    const order = texts.map((_, i) => i).sort((a, b) => texts[a].length - texts[b].length);
    const vectors = new Array(texts.length);
    for (let start = 0; start < order.length; start += BATCH) {
      const batch = order.slice(start, start + BATCH);
      const output = await extract(
        batch.map((i) => texts[i]),
        { pooling: 'cls', normalize: true },
      );
      const [, size] = output.dims;
      batch.forEach((i, row) => {
        vectors[i] = Float32Array.from(output.data.subarray(row * size, (row + 1) * size));
      });
      onProgress(Math.min(start + BATCH, order.length), order.length);
    }
    return vectors;
  };
}

module.exports = { MODEL, createEmbedder };
