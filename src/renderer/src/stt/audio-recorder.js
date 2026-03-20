// Records audio from the microphone and produces a WAV ArrayBuffer
// suitable for whisper.cpp (16-bit PCM, 16kHz mono)

const TARGET_SAMPLE_RATE = 16000;

export default class AudioRecorder {
  constructor() {
    this.stream = null;
    this.ctx = null;
    this.source = null;
    this.processor = null;
    this.chunks = [];
    this.recording = false;
  }

  async start(deviceId) {
    this.chunks = [];
    const constraints = {
      channelCount: 1,
      sampleRate: TARGET_SAMPLE_RATE,
      echoCancellation: true,
      noiseSuppression: true,
    };
    if (deviceId) constraints.deviceId = { exact: deviceId };
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: constraints,
    });

    this.ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    this.source = this.ctx.createMediaStreamSource(this.stream);

    // Use ScriptProcessorNode for raw PCM capture
    // (AudioWorklet would be better but requires more setup)
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (!this.recording) return;
      const data = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(data));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.ctx.destination);
    this.recording = true;
  }

  stop() {
    this.recording = false;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }

    // Combine chunks and convert to WAV
    return this._toWav();
  }

  _toWav() {
    if (this.chunks.length === 0) return null;

    // Concatenate all float32 chunks
    let totalLength = 0;
    for (const chunk of this.chunks) totalLength += chunk.length;
    const pcm = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      pcm.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to 16-bit PCM
    const int16 = new Int16Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      const s = Math.max(-1, Math.min(1, pcm[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Build WAV header
    const wavBuffer = new ArrayBuffer(44 + int16.length * 2);
    const view = new DataView(wavBuffer);

    // RIFF header
    this._writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + int16.length * 2, true);
    this._writeString(view, 8, "WAVE");

    // fmt chunk
    this._writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, TARGET_SAMPLE_RATE, true);
    view.setUint32(28, TARGET_SAMPLE_RATE * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample

    // data chunk
    this._writeString(view, 36, "data");
    view.setUint32(40, int16.length * 2, true);

    // Write PCM data
    const wavBytes = new Uint8Array(wavBuffer);
    const pcmBytes = new Uint8Array(int16.buffer);
    wavBytes.set(pcmBytes, 44);

    return wavBuffer;
  }

  _writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
}
