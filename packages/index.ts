//参考 AudioWorkletProcessor 单声道 音频采样率是16000 使用pcm 1.9kb发送一次数据
function audioProcessorJs() {
  const code = `
class AudioProcessor extends AudioWorkletProcessor {
  constructor({ processorOptions }) {
    super();
    this.pcmBuffer = new Int16Array(0);
    this.chunkSize = processorOptions.chunkSize;
    this.port.onmessage = (event) => {
      const { data } = event;
      if (data === 'pause') {
        this.isPaused = true;
      } else if (data === 'resume') {
        this.isPaused = false;
      } else if (data === 'stop') {
        this.isPaused = true;
      }
    };
  }

  process(inputs, outputs, parameters) {
    if (this.isPaused) {
      return true;
    }
    const input = inputs[0]; // 单声道输入
    const buffer = input[0]; // Float32Array
    const length = buffer.length;

    // 转换为 16 位 PCM
    const pcm = new Int16Array(length);
    for (let i = 0; i < length; i++) {
      pcm[i] = Math.min(1, buffer[i]) * 32767; // 量化到 Int16
    }

    // 累积数据
    const newLength = this.pcmBuffer.length + length;
    const newBuffer = new Int16Array(newLength);
    newBuffer.set(this.pcmBuffer);
    newBuffer.set(pcm, this.pcmBuffer.length);
    this.pcmBuffer = newBuffer;

    // 检查是否达到目标大小
    if (this.pcmBuffer.byteLength >= this.chunkSize) {
      // 提取指定之前的数据
      const dataToSent = this.pcmBuffer.slice(0, this.chunkSize / 2); // 1900 字节 = 950 个 Int16
      this.port.postMessage({ e: 'data', data: dataToSent });
      // 保留剩余数据
      this.pcmBuffer = this.pcmBuffer.slice(this.chunkSize / 2);
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
`;
  const blob = new Blob([code], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}

export interface RecorderConstructor {
  sampleRate: number; //音频采样率
  chunkSize: number; //音频数据块的样本数（即音频缓冲区的长度）
  ignoreMute?: boolean; //是否忽略静音
}

export class Recorder {
  private _stream?: MediaStream;
  private _audioContext?: AudioContext;
  private _source?: MediaStreamAudioSourceNode;
  private _workletNode?: AudioWorkletNode;
  private _pcmData: Int16Array[];
  private readonly _options: RecorderConstructor;

  public ondataavailable?: (data: Int16Array) => void;
  public onpause?: () => void;
  public onresume?: () => void;
  public onstart?: () => void;
  public onstop?: (data: Int16Array) => void;

  constructor(options: RecorderConstructor) {
    this._options = options;
    this._pcmData = [];
  }

  public async start() {
    const { sampleRate, chunkSize, ignoreMute } = this._options;
    this._stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    this._audioContext = new AudioContext({ sampleRate });
    this._source = this._audioContext.createMediaStreamSource(this._stream);
    await this._audioContext.audioWorklet.addModule(audioProcessorJs(), { credentials: 'include' });
    this._workletNode = new AudioWorkletNode(this._audioContext, 'audio-processor', {
      channelCount: 1, //单声道
      channelCountMode: 'explicit', //输出通道数由 channelCount 显式指定
      channelInterpretation: 'discrete', //通道是独立的音频流，没有特定方向（适合单声道处理）
      processorOptions: { chunkSize },
    });
    this._source.connect(this._workletNode);
    this._workletNode.connect(this._audioContext.destination);
    this._workletNode.port.onmessage = (event) => {
      const { e, data } = event.data;
      if (e === 'data') {
        if (ignoreMute) {
          if (Recorder.isSpeak(data, sampleRate)) {
            this._pcmData.push(data);
            this.ondataavailable?.(data);
          }
        } else {
          this._pcmData.push(data);
          this.ondataavailable?.(data);
        }
      }
    };
    this.onstart?.();
  }

  public pause() {
    this._workletNode?.port.postMessage('pause');
    this.onpause?.();
  }

  public resume() {
    this._workletNode?.port.postMessage('resume');
    this.onresume?.();
  }

  public stop() {
    this._workletNode?.port.postMessage('stop');
    this._stream?.getTracks().forEach((track) => {
      track.stop();
    });
    this._source?.disconnect();
    this._workletNode?.disconnect();
    this._stream = undefined;
    this._source = undefined;
    this._workletNode = undefined;
    this._audioContext = undefined;
    this.onstop?.(Recorder.pcmMerge(this._pcmData));
    this._pcmData = [];
  }

  public static pcmMerge(arrays: Int16Array[]) {
    // 计算总长度
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    // 创建合并后的 Int16Array
    const merged = new Int16Array(totalLength);

    let offset = 0;
    for (const arr of arrays) {
      // 将当前数组复制到目标数组的 offset 位置
      merged.set(arr, offset);
      offset += arr.length;
    }

    return merged as Int16Array;
  }

  public static pcmToWav(data: Int16Array, sampleRate: number) {
    function writeString(view: DataView, offset: number, type: string) {
      for (let i = 0; i < type.length; i++) {
        view.setUint8(offset + i, type.charCodeAt(i));
      }
    }
    const numChannels = 1; // 单声道
    const bytesPerSample = 2; // 16 位
    const dataLength = data.length;

    // 计算总文件大小
    const fileSize = 44 + dataLength * bytesPerSample;

    // 创建 ArrayBuffer
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // 写入 RIFF 头
    writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize - 8, true); // 文件总长度 - 8
    writeString(view, 8, 'WAVE');

    // 写入 fmt 子块
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // 子块大小
    view.setUint16(20, 1, true); // 音频格式 (PCM)
    view.setUint16(22, numChannels, true); // 通道数
    view.setUint32(24, sampleRate, true); // 采样率
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // 字节率
    view.setUint16(32, numChannels * bytesPerSample, true); // 块对齐
    view.setUint16(34, bytesPerSample * 8, true); // 位深度 (16 位)

    // 写入 data 子块
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength * bytesPerSample, true); // 数据大小

    // 写入 PCM 数据
    for (let i = 0; i < dataLength; i++) {
      view.setInt16(44 + i * bytesPerSample, data[i], true); // 小端序
    }
    const wavBlob = new Blob([buffer], { type: 'audio/wav' });
    return wavBlob;
  }

  public static isSpeak(int16Array: Int16Array, sampleRate: number) {
    const frameSize = Math.floor(0.02 * sampleRate); // 20ms 帧长度
    const threshold = 0.01; // 能量阈值（需根据实际调整）
    let speakingFrames = 0;
    const frameCount = Math.ceil(int16Array.length / frameSize);

    for (let i = 0; i < frameCount; i++) {
      const start = i * frameSize;
      const end = Math.min(start + frameSize, int16Array.length);
      const frame = int16Array.slice(start, end);

      let sum = 0;
      for (let j = 0; j < frame.length; j++) {
        const sample = frame[j] / 32768; // 归一化到 [-1, 1]
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / frame.length);

      if (rms > threshold) {
        speakingFrames++;
      }
    }

    // 如果超过 50% 的帧有语音，认为在说话
    return speakingFrames / frameCount > 0.5;
  }

  public static parseWav(buffer: ArrayBuffer) {
    // 将32位无符号整数转换为4字节字符串
    function uint32ToChars(uint32: number) {
      return String.fromCharCode(
        (uint32 >> 24) & 0xff,
        (uint32 >> 16) & 0xff,
        (uint32 >> 8) & 0xff,
        (uint32 >> 0) & 0xff,
      );
    }
    const dataView = new DataView(buffer);
    let offset = 0;

    // 1. 验证RIFF头
    const riff = dataView.getUint32(offset, false); // 大端序
    if (riff !== 0x52494646) {
      // 'RIFF' in hex
      throw new Error('Not a RIFF file');
    }
    offset += 4;

    const fileSize = dataView.getUint32(offset, true); // 小端序
    offset += 4;

    const wave = dataView.getUint32(offset, false); // 大端序
    if (wave !== 0x57415645) {
      // 'WAVE' in hex
      throw new Error('Not a WAVE file');
    }
    offset += 4;

    // 2. 遍历块，查找'fmt '块
    while (offset < buffer.byteLength) {
      const chunkId = dataView.getUint32(offset, false); // 大端序
      const chunkSize = dataView.getUint32(offset + 4, true); // 小端序
      const chunkIdStr = uint32ToChars(chunkId);

      if (chunkIdStr === 'fmt ') {
        // 3. 解析'fmt '块数据
        const audioFormat = dataView.getUint16(offset + 8, true); // 小端序
        const numChannels = dataView.getUint16(offset + 10, true);
        const sampleRate = dataView.getUint32(offset + 12, true);
        const byteRate = dataView.getUint32(offset + 16, true);
        return { numChannels, sampleRate, byteRate, fileSize, audioFormat };
      }

      // 移动到下一个块
      offset += 8 + chunkSize;
    }

    throw new Error('fmt chunk not found');
  }
}
