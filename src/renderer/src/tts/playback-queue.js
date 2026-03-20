// Gapless Web Audio API playback of raw 16-bit PCM buffers
// with inline amplitude extraction for mouth sync

const SAMPLE_RATE = 22050;
const AMPLITUDE_FPS = 30;

export default class PlaybackQueue {
  constructor({ onStart, onEnd, onAmplitude }) {
    this.onStart = onStart;
    this.onEnd = onEnd;
    this.onAmplitude = onAmplitude;
    this.ctx = null;
    this.analyser = null;
    this.queue = [];
    this.playing = false;
    this.currentSource = null;
    this.amplitudeTimer = null;
    this.analyserData = null;
  }

  _ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;
      this.analyser.connect(this.ctx.destination);
      this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);
    }
    // Resume if suspended (autoplay policy)
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  _pcmToAudioBuffer(pcmArrayBuffer) {
    // 16-bit signed PCM → Float32
    const int16 = new Int16Array(pcmArrayBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }
    const audioBuffer = this.ctx.createBuffer(1, float32.length, SAMPLE_RATE);
    audioBuffer.getChannelData(0).set(float32);
    return audioBuffer;
  }

  _startAmplitudeLoop() {
    if (this.amplitudeTimer) return;
    const interval = 1000 / AMPLITUDE_FPS;
    this.amplitudeTimer = setInterval(() => {
      if (!this.analyser || !this.playing) return;
      this.analyser.getByteTimeDomainData(this.analyserData);
      // Compute RMS amplitude normalized to 0-1
      let sum = 0;
      for (let i = 0; i < this.analyserData.length; i++) {
        const v = (this.analyserData[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / this.analyserData.length);
      // Scale up for better range (RMS of speech is typically 0.05-0.3)
      const amplitude = Math.min(1, rms * 3);
      this.onAmplitude?.(amplitude);
    }, interval);
  }

  _stopAmplitudeLoop() {
    if (this.amplitudeTimer) {
      clearInterval(this.amplitudeTimer);
      this.amplitudeTimer = null;
    }
    this.onAmplitude?.(0);
  }

  _playNext() {
    if (this.queue.length === 0) {
      this.playing = false;
      this.currentSource = null;
      this._stopAmplitudeLoop();
      this.onEnd?.();
      return;
    }

    const pcm = this.queue.shift();
    this._ensureContext();

    const audioBuffer = this._pcmToAudioBuffer(pcm);
    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.analyser);
    this.currentSource = source;

    source.onended = () => {
      this.currentSource = null;
      this._playNext();
    };

    source.start();
  }

  enqueue(pcmArrayBuffer) {
    this._ensureContext();
    this.queue.push(pcmArrayBuffer);

    if (!this.playing) {
      this.playing = true;
      this.onStart?.();
      this._startAmplitudeLoop();
      this._playNext();
    }
  }

  clear() {
    this.queue = [];
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        /* may already be stopped */
      }
      this.currentSource = null;
    }
    this.playing = false;
    this._stopAmplitudeLoop();
  }
}
