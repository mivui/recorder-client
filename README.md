# recorder-client

### audio recording client

[![npm version](https://img.shields.io/npm/v/recorder-client.svg?style=flat-square)](https://www.npmjs.com/package/recorder-client)
[![Alt](https://img.shields.io/npm/dt/recorder-client?style=flat-square)](https://npmcharts.com/compare/recorder-client?minimal=true)
![Alt](https://img.shields.io/github/license/mivui/recorder-client?style=flat-square)

### install

```shell
npm i recorder-client
```

### API

|  property  |  type  |                                 description                                 |  default  |
| :--------: | :----: | :-------------------------------------------------------------------------: | :-------: |
| sampleRate | number |                             audio sampling rate                             | undefined |
| chunkSize  | number | number of samples in the audio data block (length of the audio buffer zone) | undefined |
|    vad     |  Vad   |          determine whether the audio clip contains spoken content           | undefined |

### Event

|    property     |           type            |     description      |
| :-------------: | :-----------------------: | :------------------: |
| ondataavailable | (pcm: Int16Array) => void | real-time audio data |
|     onpause     |        () => void         |     pause event      |
|    onresume     |        () => void         |     resume event     |
|     onstart     |        () => void         |     start event      |
|     onstop      | (pcm: Int16Array) => void |      stop event      |
|      pause      |        () => void         |     audio pause      |
|     resume      |        () => void         |     audio resume     |
|      start      |        () => void         |     audio start      |
|      stop       |        () => void         |      audio stop      |

### Helper

| property |                     type                      |              description              |
| :------: | :-------------------------------------------: | :-----------------------------------: |
| pcmMerge |      (pcms: Int16Array[]) => Int16Array       |      merge multiple pcm streams       |
| pcmToWav | (pcm: Int16Array, sampleRate: number) => Blob |          convert PCM to WAV           |
| parseWav |        (buffer: ArrayBuffer) => object        | obtain information about the wav file |

### Example

> simple example

```ts
import { Recorder } from 'recorder-client';

const recorder = new Recorder({
  sampleRate: 16000,
  chunkSize: 1900,
});

recorder.onstart = () => {};
recorder.onpause = () => {};
recorder.onresume = () => {};
recorder.onstop = (pcm) => {};
recorder.ondataavailable = (pcm) => {};

const onClick = () => {
  recorder.pause();
  recorder.resume();
  recorder.start();
  recorder.stop();
};
```

> VAD

```ts
import { Recorder } from 'recorder-client';

type VadScene =
  | 'extreme-noise'
  | 'high-noise'
  | 'live-stream'
  | 'normal-indoor'
  | 'quiet-studio'
  | 'voice-assistant';

const recorder = new Recorder({
  sampleRate: 16000,
  chunkSize: 1900,
  vad: 'normal-indoor',
});
// custom
const recorder = new Recorder({
  sampleRate: 16000,
  chunkSize: 1900,
  vad: {
    noiseCoefficient: 2.3,
    voiceRatioThreshold: 0.5,
    noiseFrameCount: 5,
    frameDurationMs: 20,
  },
});
```

> pcmMerge

```ts
import { Recorder } from 'recorder-client';

const recorder = new Recorder({
  sampleRate: 16000,
  chunkSize: 1900,
});

const pcms: Int16Array[] = [];

recorder.ondataavailable = (pcm) => {
  pcms.push(pcm);
};

const onMerge = () => {
  const data = Recorder.pcmMerge(pcms);
};
```

> pcmToWav

```ts
import { Recorder } from 'recorder-client';

const recorder = new Recorder({
  sampleRate: 16000,
  chunkSize: 1900,
});

recorder.onstop = (pcm) => {
  const blob = pcmToWav(pcm, 16000);
};
```

> parseWav

```ts
import { Recorder } from 'recorder-client';

interface Wav {
  numChannels: number;
  sampleRate: number;
  byteRate: number;
  fileSize: number;
  audioFormat: number;
}

const getWav = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const wav: Wav = Recorder.parseWav(buffer);
};
```
