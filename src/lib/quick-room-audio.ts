/** Constraints requested from the browser when a ZikaChat microphone starts. */
export function microphoneConstraints(noiseReduction: boolean): MediaTrackConstraints {
  return {
    echoCancellation: true,
    noiseSuppression: noiseReduction,
    autoGainControl: true,
  };
}
