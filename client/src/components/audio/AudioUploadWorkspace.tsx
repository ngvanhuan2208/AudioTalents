import {type ChangeEvent, type ReactNode, useRef, useState} from 'react';
import {
  audioService,
  mediaErrorMessage,
  uploadAudioDirect,
  type AudioAsset,
  type UploadGrant,
} from '../../services/audioService';

export const MAX_AUDIO_BYTES = 31_457_280;
export const MAX_AUDIO_DURATION_SEC = 60 * 60;

export type AudioUploadPhase =
  | 'IDLE'
  | 'SELECTED'
  | 'CREATING_METADATA'
  | 'UPLOADING'
  | 'CONFIRMING'
  | 'PROCESSING'
  | 'READY'
  | 'ERROR';

export type UploadNotice = {tone: 'success' | 'error'; text: string} | null;
type UploadFile = Pick<File, 'name' | 'size' | 'type'>;

export interface AudioUploadActor {
  role?: string | null;
  authorStatus?: string | null;
  accountStatus?: string | null;
}

export function canAccessAudioUpload(actor: AudioUploadActor) {
  if (actor.accountStatus !== 'ACTIVE') return false;
  return actor.role === 'ADMIN' || (actor.role === 'USER' && actor.authorStatus === 'APPROVED');
}

export interface AudioUploadDependencies {
  createAudio: (input: {chapterId: string; title: string; sourceType: 'HUMAN'}) => Promise<AudioAsset>;
  createUploadGrant: (audioId: string, file: File) => Promise<UploadGrant>;
  uploadDirect: (grant: UploadGrant, file: File, signal?: AbortSignal) => Promise<void>;
  confirmUpload: (audioId: string, uploadToken: string) => Promise<AudioAsset>;
  reloadAudio: () => Promise<void>;
}

export interface ExecuteAudioUploadOptions {
  chapterId: string;
  file: File;
  existingAudio?: AudioAsset | null;
  signal?: AbortSignal;
  dependencies: AudioUploadDependencies;
  onCreated?: (audio: AudioAsset) => void;
  onPhase?: (phase: AudioUploadPhase) => void;
}

const phaseText: Record<AudioUploadPhase, string> = {
  IDLE: 'Sẵn sàng chọn file',
  SELECTED: 'Đã chọn file',
  CREATING_METADATA: 'Đang tạo tập Audio…',
  UPLOADING: 'Đang tải MP3 lên kho lưu trữ…',
  CONFIRMING: 'Đang xác nhận và kiểm tra file…',
  PROCESSING: 'Đang đồng bộ trạng thái xử lý…',
  READY: 'Audio đã sẵn sàng',
  ERROR: 'Tải lên chưa hoàn tất',
};

export function validateAudioFile(file: UploadFile): string | null {
  if (file.type !== 'audio/mpeg' || !/\.mp3$/i.test(file.name)) return 'Audio hiện chỉ nhận file MP3.';
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return 'File MP3 đang trống hoặc không hợp lệ.';
  if (file.size > MAX_AUDIO_BYTES) {
    return `Audio vượt giới hạn 30 MiB (${(file.size / 1048576).toFixed(1)} MiB). Hãy chia nội dung thành các tập nhỏ hơn.`;
  }
  return null;
}

export function validateAudioDuration(durationSec: number): string | null {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 'Không đọc được thời lượng MP3.';
  if (durationSec > MAX_AUDIO_DURATION_SEC) return 'Audio vượt quá 60 phút. Hãy chia nội dung thành các tập nhỏ hơn.';
  return null;
}

function codedError(code: string) {
  const error = new Error(code) as Error & {code?: string};
  error.code = code;
  return error;
}

export async function executeAudioUpload({
  chapterId,
  file,
  existingAudio,
  signal,
  dependencies,
  onCreated,
  onPhase = () => undefined,
}: ExecuteAudioUploadOptions): Promise<AudioAsset> {
  if (!chapterId.trim()) throw codedError('CHAPTER_CONTEXT_REQUIRED');

  let audio = existingAudio || null;
  if (!audio) {
    onPhase('CREATING_METADATA');
    audio = await dependencies.createAudio({
      chapterId,
      title: file.name.replace(/\.mp3$/i, '').trim() || 'Tập Audio mới',
      sourceType: 'HUMAN',
    });
    onCreated?.(audio);
  }

  onPhase('UPLOADING');
  const grant = await dependencies.createUploadGrant(audio.id, file);
  await dependencies.uploadDirect(grant, file, signal);

  onPhase('CONFIRMING');
  const confirmed = await dependencies.confirmUpload(audio.id, grant.uploadToken);

  onPhase('PROCESSING');
  await dependencies.reloadAudio();
  if (confirmed.processingStatus === 'READY') onPhase('READY');
  return confirmed;
}

export async function runSingleFlight<T>(lock: {current: boolean}, task: () => Promise<T>): Promise<T | undefined> {
  if (lock.current) return undefined;
  lock.current = true;
  try {
    return await task();
  } finally {
    lock.current = false;
  }
}

function inspectDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const probe = new Audio();
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      probe.removeAttribute('src');
    };
    probe.onloadedmetadata = () => {
      const value = probe.duration;
      cleanup();
      if (!Number.isFinite(value) || value <= 0) reject(new Error('Không đọc được thời lượng MP3.'));
      else resolve(value);
    };
    probe.onerror = () => {
      cleanup();
      reject(new Error('Không đọc được thời lượng MP3. Hãy chọn file MP3 hợp lệ khác.'));
    };
    probe.src = objectUrl;
  });
}

function displayDuration(value: number | null) {
  if (value == null) return '—';
  return `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`;
}

function uploadErrorMessage(error: unknown) {
  if ((error as Error)?.name === 'AbortError') return 'Đã hủy tải lên. Bạn có thể thử lại với cùng tập Audio.';
  const mapped = mediaErrorMessage(error);
  if (mapped !== 'Không thể hoàn tất thao tác. Vui lòng thử lại.') return mapped;
  return 'Không thể tải Audio. Kiểm tra kết nối rồi thử lại; bản ghi Audio hiện tại sẽ được tái sử dụng.';
}

export function AudioUploadControl({
  chapterId,
  existingAudio,
  canUpload,
  onUploaded,
  onNotice,
}: {
  chapterId: string;
  existingAudio?: AudioAsset | null;
  canUpload: boolean;
  onUploaded: () => Promise<void>;
  onNotice: (notice: UploadNotice) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [phase, setPhase] = useState<AudioUploadPhase>('IDLE');
  const [draftAudio, setDraftAudio] = useState<AudioAsset | null>(existingAudio || null);
  const [aborter, setAborter] = useState<AbortController | null>(null);
  const active = ['CREATING_METADATA', 'UPLOADING', 'CONFIRMING', 'PROCESSING'].includes(phase);
  const durationError = durationSec == null ? null : validateAudioDuration(durationSec);

  if (!canUpload) return null;

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const candidate = event.currentTarget.files?.[0] || null;
    if (!candidate) return;
    const fileError = validateAudioFile(candidate);
    if (fileError) {
      setFile(null);
      setDurationSec(null);
      setPhase('ERROR');
      onNotice({tone: 'error', text: fileError});
      return;
    }
    setFile(candidate);
    setDurationSec(null);
    setPhase('SELECTED');
    try {
      const inspectedDuration = await inspectDuration(candidate);
      setDurationSec(inspectedDuration);
      const validationError = validateAudioDuration(inspectedDuration);
      if (validationError) {
        setPhase('ERROR');
        onNotice({tone: 'error', text: validationError});
      }
    } catch (error) {
      setPhase('ERROR');
      onNotice({tone: 'error', text: (error as Error).message});
    }
  };

  const upload = async () => {
    if (!file || durationSec == null || validateAudioDuration(durationSec)) return;
    await runSingleFlight(activeRef, async () => {
      const controller = new AbortController();
      setAborter(controller);
      try {
        const confirmed = await executeAudioUpload({
          chapterId,
          file,
          existingAudio: draftAudio,
          signal: controller.signal,
          dependencies: {
            createAudio: audioService.create,
            createUploadGrant: audioService.createUploadGrant,
            uploadDirect: uploadAudioDirect,
            confirmUpload: audioService.confirmUpload,
            reloadAudio: onUploaded,
          },
          onCreated: setDraftAudio,
          onPhase: setPhase,
        });
        if (confirmed.processingStatus === 'READY') {
          setDraftAudio(existingAudio || null);
          setFile(null);
          setDurationSec(null);
          if (inputRef.current) inputRef.current.value = '';
          onNotice({tone: 'success', text: 'Audio đã tải lên, kiểm tra và sẵn sàng để xem trước.'});
        } else {
          onNotice({tone: 'success', text: 'Audio đã tải lên và đang được xử lý.'});
        }
      } catch (error) {
        setPhase('ERROR');
        onNotice({tone: 'error', text: uploadErrorMessage(error)});
      } finally {
        setAborter(null);
      }
    });
  };

  const resetPicker = () => {
    setFile(null);
    setDurationSec(null);
    setPhase('IDLE');
    if (inputRef.current) inputRef.current.value = '';
    inputRef.current?.click();
  };

  return <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
    <input ref={inputRef} aria-label="Chọn file Audio MP3 cho chương" type="file" accept="audio/mpeg,.mp3" disabled={active} onChange={event => void choose(event)} className="sr-only" />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold">{phaseText[phase]}</p>
        <p className="mt-1 text-[11px] text-outline">MP3 · tối đa 30 MiB · tối đa 60 phút</p>
      </div>
      <button type="button" disabled={active} onClick={resetPicker} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50">
        {existingAudio ? 'Thay file MP3' : '+ Thêm Audio MP3'}
      </button>
    </div>
    {file && <div className="mt-3 rounded-lg border border-white/10 bg-black/15 p-3 text-xs">
      <p className="break-all font-semibold">{file.name}</p>
      <p className="mt-1 text-[11px] text-outline">{(file.size / 1048576).toFixed(1)} MiB · {durationSec == null ? 'Đang đọc thời lượng…' : displayDuration(durationSec)}</p>
      {durationError && <p className="mt-1 text-[11px] text-error">{durationError}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={active || durationSec == null || Boolean(durationError) || phase === 'READY'} onClick={() => void upload()} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary disabled:opacity-50">
          {phase === 'ERROR' && draftAudio ? 'Thử tải lại' : 'Bắt đầu tải lên'}
        </button>
        {phase === 'UPLOADING' && <button type="button" onClick={() => aborter?.abort()} className="creator-action">Hủy</button>}
      </div>
    </div>}
  </div>;
}

export function AudioUploadWorkspace({
  chapterId,
  audioCount,
  children,
  canUpload,
  onUploaded,
  onNotice,
}: {
  chapterId: string;
  audioCount: number;
  children?: ReactNode;
  canUpload: boolean;
  onUploaded: () => Promise<void>;
  onNotice: (notice: UploadNotice) => void;
}) {
  return <section className="mt-4 space-y-3 border-t border-white/8 pt-4" aria-label="Audio của chương">
    <div>
      <h4 className="text-xs font-bold uppercase tracking-[.14em] text-tertiary">Audio của chương</h4>
      {audioCount === 0 && <p className="mt-2 text-xs text-outline">Chương này chưa có Audio.</p>}
    </div>
    {children}
    <AudioUploadControl chapterId={chapterId} canUpload={canUpload} onUploaded={onUploaded} onNotice={onNotice} />
  </section>;
}
