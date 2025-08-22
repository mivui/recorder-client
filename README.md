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

|    property     |           type            |                                 description                                 |  default  |
| :-------------: | :-----------------------: | :-------------------------------------------------------------------------: | :-------: |
|   sampleRate    |          number           |                             audio sampling rate                             | undefined |
|    chunkSize    |          number           | number of samples in the audio data block (length of the audio buffer zone) | undefined |
|   ignoreMute    |          boolean          |                                 ignore mute                                 | undefined |
| ondataavailable | (pcm: Int16Array) => void |                            real-time audio data                             | undefined |
|     onpause     |        () => void         |                                 pause event                                 | undefined |
|    onresume     |        () => void         |                                resume event                                 | undefined |
|     onstart     |        () => void         |                                 start event                                 | undefined |
|     onstop      |    (wav: Blob) => void    |                                 stop event                                  | undefined |
|      pause      |        () => void         |                                 audio pause                                 | undefined |
|     resume      |        () => void         |                                audio resume                                 | undefined |
|      start      |        () => void         |                                 audio start                                 | undefined |
|      stop       |        () => void         |                                 audio stop                                  | undefined |

### Helper

|  property  |                       type                       |              description              |
| :--------: | :----------------------------------------------: | :-----------------------------------: |
|  pcmMerge  | (pcms: Int16Array[]) => Int16Array<ArrayBuffer>  |      merge multiple pcm streams       |
|  pcmToWav  |  (pcm: Int16Array, sampleRate: number) => Blob   |          convert PCM to WAV           |
|  parseWav  |         (buffer: ArrayBuffer) => object          | obtain information about the wav file |
| isSpeaking | (pcm: Int16Array, sampleRate: number) => boolean | check if there is any input of audio  |

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
recorder.onstop = (blob) => {};
recorder.ondataavailable = (pcm) => {};

const onClick = () => {
  recorder.pause();
  recorder.resume();
  recorder.start();
  recorder.stop();
};
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
  return Recorder.pcmMerge(pcms);
};
```

> pcmToWav

```ts
import { Recorder } from 'recorder-client';

const recorder = new Recorder({
  sampleRate: 16000,
  chunkSize: 1900,
});

recorder.ondataavailable = (pcm) => {
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

> isSpeaking

```ts
import { Recorder } from 'recorder-client';

const recorder = new Recorder({
  sampleRate: 16000,
  chunkSize: 1900,
});

recorder.ondataavailable = (pcm) => {
  const flag = Recorder.isSpeaking(pcm, 16000);
};
```
