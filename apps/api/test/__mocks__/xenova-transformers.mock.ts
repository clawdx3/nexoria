export async function pipeline() {
  return async function embed() {
    return { data: new Float32Array(384) };
  };
}
export type FeatureExtractionPipeline = any;
