import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {
  AudioUploadWorkspace,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_SEC,
  canAccessAudioUpload,
  executeAudioUpload,
  runSingleFlight,
  validateAudioDuration,
  validateAudioFile,
  type AudioUploadDependencies,
  type AudioUploadPhase,
} from '../src/components/audio/AudioUploadWorkspace';
import type {AudioAsset, UploadGrant} from '../src/services/audioService';

const audio: AudioAsset = {
  id: 'audio-1',
  chapterId: 'chapter-1',
  partNumber: 1,
  title: 'Tập 1',
  processingStatus: 'PENDING',
  status: 'DRAFT',
  isPrimary: false,
  sourceType: 'HUMAN',
};

const confirmedAudio: AudioAsset = {...audio, processingStatus: 'READY'};
const file = {name: 'tap-01.mp3', size: 1024, type: 'audio/mpeg'} as File;
const grant: UploadGrant = {uploadUrl: 'https://storage.invalid/upload', method: 'PUT', headers: {}, uploadToken: 'private-token'};

function renderWorkspace(audioCount: number, canUpload = true) {
  return renderToStaticMarkup(
    <AudioUploadWorkspace
      chapterId="chapter-1"
      audioCount={audioCount}
      canUpload={canUpload}
      onUploaded={async () => undefined}
      onNotice={() => undefined}
    >
      {audioCount > 0 ? <div>Tập 01</div> : null}
    </AudioUploadWorkspace>,
  );
}

function dependencies(events: string[]): AudioUploadDependencies {
  return {
    createAudio: async () => { events.push('create'); return audio; },
    createUploadGrant: async () => { events.push('grant'); return grant; },
    uploadDirect: async () => { events.push('put'); },
    confirmUpload: async () => { events.push('confirm-response'); return confirmedAudio; },
    reloadAudio: async () => { events.push('reload'); },
  };
}

test('chapter without Audio shows the shared MP3 upload CTA', () => {
  const markup = renderWorkspace(0);
  assert.match(markup, /Chương này chưa có Audio\./);
  assert.match(markup, /\+ Thêm Audio MP3/);
  assert.match(markup, /accept="audio\/mpeg,\.mp3"/);
});

test('chapter with Audio still shows the shared add-audio CTA', () => {
  const markup = renderWorkspace(1);
  assert.match(markup, /Tập 01/);
  assert.match(markup, /\+ Thêm Audio MP3/);
  assert.doesNotMatch(markup, /Chương này chưa có Audio\./);
});

test('unauthorized actor does not receive an upload control', () => {
  const markup = renderWorkspace(0, false);
  assert.doesNotMatch(markup, /\+ Thêm Audio MP3/);
  assert.doesNotMatch(markup, /type="file"/);
});

test('upload authorization accepts active approved Creator and active Admin', () => {
  assert.equal(canAccessAudioUpload({role: 'USER', authorStatus: 'APPROVED', accountStatus: 'ACTIVE'}), true);
  assert.equal(canAccessAudioUpload({role: 'ADMIN', authorStatus: 'NONE', accountStatus: 'ACTIVE'}), true);
});

test('upload authorization rejects non-approved Creator and inactive accounts', () => {
  for (const authorStatus of ['NONE', 'PENDING', 'REJECTED', 'SUSPENDED']) {
    assert.equal(canAccessAudioUpload({role: 'USER', authorStatus, accountStatus: 'ACTIVE'}), false);
  }
  assert.equal(canAccessAudioUpload({role: 'ADMIN', authorStatus: 'APPROVED', accountStatus: 'SUSPENDED'}), false);
});

test('Creator and Admin import the same canonical upload workspace', () => {
  const creatorSource = readFileSync(new URL('../src/pages/Creator/CreatorDashboard.tsx', import.meta.url), 'utf8');
  const adminSource = readFileSync(new URL('../src/pages/Admin/AdminContentManagement.tsx', import.meta.url), 'utf8');
  assert.match(creatorSource, /AudioUploadWorkspace/);
  assert.match(adminSource, /AudioUploadWorkspace/);
  assert.doesNotMatch(adminSource, /fetch\s*\(/);
});

test('shared upload rejects files that are not MP3', () => {
  assert.match(validateAudioFile({name: 'voice.wav', size: 1024, type: 'audio/wav'}) || '', /chỉ nhận file MP3/);
  assert.match(validateAudioFile({name: 'voice.mp3', size: 1024, type: 'application/octet-stream'}) || '', /chỉ nhận file MP3/);
});

test('shared upload enforces the canonical 30 MiB file limit', () => {
  assert.equal(validateAudioFile({name: 'voice.mp3', size: MAX_AUDIO_BYTES, type: 'audio/mpeg'}), null);
  assert.match(validateAudioFile({name: 'voice.mp3', size: MAX_AUDIO_BYTES + 1, type: 'audio/mpeg'}) || '', /30 MiB/);
});

test('shared upload enforces the canonical 60 minute duration limit', () => {
  assert.equal(validateAudioDuration(MAX_AUDIO_DURATION_SEC), null);
  assert.match(validateAudioDuration(MAX_AUDIO_DURATION_SEC + 0.01) || '', /60 phút/);
});

test('blank chapter context is rejected before any dependency runs', async () => {
  const events: string[] = [];
  await assert.rejects(
    executeAudioUpload({chapterId: '  ', file, dependencies: dependencies(events)}),
    (error: Error & {code?: string}) => error.code === 'CHAPTER_CONTEXT_REQUIRED',
  );
  assert.deepEqual(events, []);
});

test('metadata contract contains only chapterId, title and HUMAN sourceType', async () => {
  const events: string[] = [];
  let createInput: Record<string, unknown> | undefined;
  const deps = dependencies(events);
  deps.createAudio = async input => {
    createInput = input;
    events.push('create');
    return audio;
  };
  await executeAudioUpload({chapterId: 'chapter-1', file, dependencies: deps});
  assert.deepEqual(createInput, {chapterId: 'chapter-1', title: 'tap-01', sourceType: 'HUMAN'});
});

test('metadata is created before requesting the upload grant', async () => {
  const events: string[] = [];
  await executeAudioUpload({chapterId: 'chapter-1', file, dependencies: dependencies(events)});
  assert.ok(events.indexOf('create') < events.indexOf('grant'));
});

test('direct PUT completes before upload confirmation', async () => {
  const events: string[] = [];
  await executeAudioUpload({chapterId: 'chapter-1', file, dependencies: dependencies(events)});
  assert.ok(events.indexOf('grant') < events.indexOf('put'));
  assert.ok(events.indexOf('put') < events.indexOf('confirm-response'));
});

test('a retry reuses existing Audio metadata instead of creating a duplicate', async () => {
  const events: string[] = [];
  await executeAudioUpload({chapterId: 'chapter-1', file, existingAudio: audio, dependencies: dependencies(events)});
  assert.deepEqual(events, ['grant', 'put', 'confirm-response', 'reload']);
});

test('confirm success reloads canonical Audio state', async () => {
  const events: string[] = [];
  const result = await executeAudioUpload({chapterId: 'chapter-1', file, dependencies: dependencies(events)});
  assert.equal(result.processingStatus, 'READY');
  assert.ok(events.indexOf('confirm-response') < events.indexOf('reload'));
});

test('UI phase never becomes READY before backend confirmation and canonical reload', async () => {
  const events: string[] = [];
  const phases: AudioUploadPhase[] = [];
  await executeAudioUpload({
    chapterId: 'chapter-1',
    file,
    dependencies: dependencies(events),
    onPhase: phase => { phases.push(phase); events.push(`phase:${phase}`); },
  });
  assert.ok(events.indexOf('reload') < events.indexOf('phase:READY'));
  assert.deepEqual(phases, ['CREATING_METADATA', 'UPLOADING', 'CONFIRMING', 'PROCESSING', 'READY']);
});

test('single-flight guard prevents repeated click from starting duplicate upload flows', async () => {
  let calls = 0;
  let release: (() => void) | undefined;
  const lock = {current: false};
  const task = async () => {
    calls += 1;
    await new Promise<void>(resolve => { release = resolve; });
    return 'done';
  };
  const first = runSingleFlight(lock, task);
  const second = runSingleFlight(lock, task);
  assert.equal(calls, 1);
  assert.equal(await second, undefined);
  release?.();
  assert.equal(await first, 'done');
  assert.equal(lock.current, false);
});
