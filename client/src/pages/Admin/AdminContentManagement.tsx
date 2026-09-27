import {type FormEvent, useCallback, useEffect, useState} from 'react';
import {AudioUploadWorkspace, canAccessAudioUpload, type UploadNotice} from '../../components/audio/AudioUploadWorkspace';
import {CreatorPreviewPlayer} from '../../components/audio/CreatorPreviewPlayer';
import {useAuth} from '../../context/AuthContext';
import {audioService, mediaErrorMessage, type AudioAsset} from '../../services/audioService';
import {creatorService, type CreatorChapter, type CreatorGenre, type CreatorStory} from '../../services/creatorService';

type ContentSection = 'stories' | 'chapters' | 'audio';

function errorText(error: unknown) {
  const mapped = mediaErrorMessage(error);
  return mapped === 'Không thể hoàn tất thao tác. Vui lòng thử lại.' && error instanceof Error
    ? error.message
    : mapped;
}

export function AdminContentManagement({section}: {section: ContentSection}) {
  const {role, authorStatus, accountStatus} = useAuth();
  const canUpload = canAccessAudioUpload({role, authorStatus, accountStatus});
  const [stories, setStories] = useState<CreatorStory[]>([]);
  const [genres, setGenres] = useState<CreatorGenre[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState('');
  const [chapters, setChapters] = useState<CreatorChapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [audios, setAudios] = useState<AudioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<UploadNotice>(null);

  const loadStories = useCallback(async () => {
    const [storyRows, genreRows] = await Promise.all([creatorService.listStories(), creatorService.listGenres()]);
    setStories(storyRows);
    setGenres(genreRows);
    setSelectedStoryId(current => current && storyRows.some(item => item.id === current) ? current : storyRows[0]?.id || '');
  }, []);

  const loadChapters = useCallback(async () => {
    if (!selectedStoryId) {
      setChapters([]);
      setSelectedChapterId('');
      return;
    }
    const rows = await creatorService.listChapters(selectedStoryId);
    setChapters(rows);
    setSelectedChapterId(current => current && rows.some(item => item.id === current) ? current : rows[0]?.id || '');
  }, [selectedStoryId]);

  const loadAudio = useCallback(async () => {
    if (!selectedChapterId) {
      setAudios([]);
      return;
    }
    setAudios(await audioService.listByChapter(selectedChapterId));
  }, [selectedChapterId]);

  useEffect(() => {
    if (!canUpload) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadStories()
      .catch(error => setNotice({tone: 'error', text: errorText(error)}))
      .finally(() => setLoading(false));
  }, [canUpload, loadStories]);

  useEffect(() => {
    void loadChapters().catch(error => setNotice({tone: 'error', text: errorText(error)}));
  }, [loadChapters]);

  useEffect(() => {
    void loadAudio().catch(error => setNotice({tone: 'error', text: errorText(error)}));
  }, [loadAudio]);

  const createStory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    const description = String(form.get('description') || '').trim();
    const selectedGenres = form.getAll('genres').map(String);
    if (!title || !description) return setNotice({tone: 'error', text: 'Nhập tên và mô tả Story hợp lệ.'});
    setBusy(true);
    try {
      const created = await creatorService.createStory({title, description, genres: selectedGenres});
      await loadStories();
      setSelectedStoryId(created.id);
      event.currentTarget.reset();
      setNotice({tone: 'success', text: 'Đã tạo Story canonical cho Admin.'});
    } catch (error) {
      setNotice({tone: 'error', text: errorText(error)});
    } finally {
      setBusy(false);
    }
  };

  const createChapter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStoryId || busy) return;
    const form = new FormData(event.currentTarget);
    const chapterNumber = Number(form.get('chapterNumber'));
    const title = String(form.get('title') || '').trim();
    if (!Number.isInteger(chapterNumber) || chapterNumber < 1 || !title) {
      return setNotice({tone: 'error', text: 'Nhập số chương và tiêu đề hợp lệ.'});
    }
    setBusy(true);
    try {
      const created = await creatorService.createChapter(selectedStoryId, {
        chapterNumber,
        title,
        content: String(form.get('content') || ''),
      });
      await loadChapters();
      setSelectedChapterId(created.id);
      event.currentTarget.reset();
      setNotice({tone: 'success', text: 'Đã tạo Chapter canonical.'});
    } catch (error) {
      setNotice({tone: 'error', text: errorText(error)});
    } finally {
      setBusy(false);
    }
  };

  if (!canUpload) {
    return <section role="alert" className="rounded-xl border border-[#8b4f45]/40 bg-[#8b4f45]/10 p-5 text-sm text-[#e3b0a7]">
      Tài khoản Admin phải ở trạng thái ACTIVE để quản lý Audio.
    </section>;
  }

  if (loading) return <div className="h-40 animate-pulse rounded-xl border border-white/10 bg-[#1b202a]" />;

  const selectedStory = stories.find(item => item.id === selectedStoryId);
  const selectedChapter = chapters.find(item => item.id === selectedChapterId);

  return <section className="space-y-5" aria-label="Quản lý nội dung Audio">
    {notice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${notice.tone === 'error' ? 'border-[#8b4f45]/40 bg-[#8b4f45]/10 text-[#e3b0a7]' : 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'}`}>{notice.text}</div>}

    <header>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#b9a7ff]">Admin · Canonical content</p>
      <h2 className="mt-2 text-2xl font-bold">Story → Chapter → Audio MP3</h2>
      <p className="mt-2 text-sm text-[#aaa6b4]">Audio dùng cùng upload pipeline và quyền backend với Creator; không có đường upload riêng cho Admin.</p>
    </header>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(0,1.3fr)]">
      <article className={`rounded-xl border p-4 ${section === 'stories' ? 'border-[#9f8cff]/50 bg-[#9f8cff]/5' : 'border-white/10 bg-[#1b202a]'}`}>
        <h3 className="font-bold">1. Story</h3>
        <label className="mt-3 block text-xs text-[#aaa6b4]">Story của Admin
          <select value={selectedStoryId} onChange={event => setSelectedStoryId(event.target.value)} className="creator-input">
            <option value="">Chọn Story</option>
            {stories.map(story => <option key={story.id} value={story.id}>{story.title}</option>)}
          </select>
        </label>
        {selectedStory && <p className="mt-2 text-xs text-[#aaa6b4]">{selectedStory.reviewStatus} · {selectedStory.visibility}</p>}
        <details className="mt-4 border-t border-white/10 pt-3">
          <summary className="cursor-pointer text-xs font-bold text-[#b9a7ff]">+ Tạo Story</summary>
          <form onSubmit={event => void createStory(event)} className="mt-3 grid gap-3">
            <input required name="title" placeholder="Tên Story" className="creator-input" />
            <textarea required name="description" rows={3} placeholder="Mô tả" className="creator-input" />
            {genres.length > 0 && <fieldset><legend className="text-xs text-[#aaa6b4]">Genre canonical</legend><div className="mt-2 flex flex-wrap gap-2">{genres.map(genre => <label key={genre.id} className="rounded-lg border border-white/10 px-2 py-1 text-xs"><input type="checkbox" name="genres" value={genre.id} className="mr-1" />{genre.name}</label>)}</div></fieldset>}
            <button disabled={busy} className="rounded-lg bg-[#9f8cff] px-3 py-2 text-xs font-bold text-[#11151d] disabled:opacity-50">Tạo Story</button>
          </form>
        </details>
      </article>

      <article className={`rounded-xl border p-4 ${section === 'chapters' ? 'border-[#9f8cff]/50 bg-[#9f8cff]/5' : 'border-white/10 bg-[#1b202a]'}`}>
        <h3 className="font-bold">2. Chapter</h3>
        <label className="mt-3 block text-xs text-[#aaa6b4]">Chapter thuộc Story đã chọn
          <select value={selectedChapterId} onChange={event => setSelectedChapterId(event.target.value)} disabled={!selectedStoryId} className="creator-input">
            <option value="">Chọn Chapter</option>
            {chapters.map(chapter => <option key={chapter.id} value={chapter.id}>Chương {chapter.chapterNumber} · {chapter.title}</option>)}
          </select>
        </label>
        {selectedChapter && <p className="mt-2 text-xs text-[#aaa6b4]">{selectedChapter.status}</p>}
        <details className="mt-4 border-t border-white/10 pt-3">
          <summary className="cursor-pointer text-xs font-bold text-[#b9a7ff]">+ Tạo Chapter</summary>
          <form onSubmit={event => void createChapter(event)} className="mt-3 grid gap-3">
            <input required min="1" name="chapterNumber" type="number" placeholder="Số chương" disabled={!selectedStoryId} className="creator-input" />
            <input required name="title" placeholder="Tiêu đề Chapter" disabled={!selectedStoryId} className="creator-input" />
            <textarea name="content" rows={3} placeholder="Nội dung (không bắt buộc)" disabled={!selectedStoryId} className="creator-input" />
            <button disabled={busy || !selectedStoryId} className="rounded-lg bg-[#9f8cff] px-3 py-2 text-xs font-bold text-[#11151d] disabled:opacity-50">Tạo Chapter</button>
          </form>
        </details>
      </article>

      <article className={`rounded-xl border p-4 ${section === 'audio' ? 'border-[#9f8cff]/50 bg-[#9f8cff]/5' : 'border-white/10 bg-[#1b202a]'}`}>
        <h3 className="font-bold">3. Audio</h3>
        {!selectedChapterId ? <p className="mt-3 text-sm text-[#aaa6b4]">Chọn Story và Chapter để quản lý Audio.</p> : (
          <AudioUploadWorkspace chapterId={selectedChapterId} audioCount={audios.length} canUpload={canUpload} onUploaded={loadAudio} onNotice={setNotice}>
            <div className="space-y-3">
              {audios.map(audio => <div key={audio.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <div><p className="text-sm font-semibold">Tập {audio.partNumber ?? '—'} · {audio.title}</p><p className="mt-1 text-[11px] text-[#aaa6b4]">{audio.processingStatus} · {audio.status} · {audio.mimeType || 'chưa có file'}</p></div>
                  {audio.durationSec != null && <span className="text-xs text-[#aaa6b4]">{Math.floor(audio.durationSec / 60)}:{String(Math.round(audio.durationSec % 60)).padStart(2, '0')}</span>}
                </div>
                <CreatorPreviewPlayer audio={audio} onNotice={setNotice} />
              </div>)}
            </div>
          </AudioUploadWorkspace>
        )}
      </article>
    </div>
  </section>;
}
