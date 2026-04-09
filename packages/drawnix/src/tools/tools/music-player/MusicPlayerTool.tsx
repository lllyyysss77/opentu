import React, { useEffect, useMemo, useState } from 'react';
import { Input, Dialog } from 'tdesign-react';
import { Pause, Play, Search, Minimize2, Music4, SkipBack, SkipForward } from 'lucide-react';
import { useAssets } from '../../../contexts/AssetContext';
import { useAudioPlaylists } from '../../../contexts/AudioPlaylistContext';
import { AssetType } from '../../../types/asset.types';
import { AUDIO_PLAYLIST_ALL_ID } from '../../../types/audio-playlist.types';
import { AudioCover } from '../../../components/shared/AudioCover';
import { AudioPlaylistTabs } from '../../../components/shared/AudioPlaylistTabs';
import { AudioTrackList } from '../../../components/shared/AudioTrackList';
import { AudioTrackContextMenu } from '../../../components/shared/AudioTrackContextMenu';
import { useCanvasAudioPlayback } from '../../../hooks/useCanvasAudioPlayback';
import { useResolvedAudioDurations } from '../../../hooks/useResolvedAudioDurations';
import { toolWindowService } from '../../../services/tool-window-service';
import { MUSIC_PLAYER_TOOL_ID } from '../../tool-ids';
import './music-player-tool.scss';

function formatDuration(duration?: number): string {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
    return '--:--';
  }

  const totalSeconds = Math.floor(duration);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const MusicPlayerTool: React.FC = () => {
  const { assets, loadAssets } = useAssets();
  const {
    playlists,
    playlistItems,
    favoriteAssetIds,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addAssetToPlaylist,
    removeAssetFromPlaylist,
    toggleFavorite,
    getPlaylistAssetIds,
  } = useAudioPlaylists();
  const playback = useCanvasAudioPlayback();
  const [query, setQuery] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(AUDIO_PLAYLIST_ALL_ID);
  const [createDialogVisible, setCreateDialogVisible] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    assetId: string;
  } | null>(null);
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null);
  const [playlistDialogMode, setPlaylistDialogMode] = useState<'create' | 'rename'>('create');
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    const closeMenu = () => {
      setContextMenu(null);
    };
    document.addEventListener('click', closeMenu);
    document.addEventListener('scroll', closeMenu, true);
    return () => {
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('scroll', closeMenu, true);
    };
  }, []);

  const audioAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const selectedIds = new Set(
      selectedPlaylistId === AUDIO_PLAYLIST_ALL_ID
        ? assets.filter((asset) => asset.type === AssetType.AUDIO).map((asset) => asset.id)
        : getPlaylistAssetIds(selectedPlaylistId)
    );

    return assets
      .filter((asset) => asset.type === AssetType.AUDIO)
      .filter((asset) => selectedIds.has(asset.id))
      .filter((asset) =>
        normalizedQuery.length === 0 ? true : asset.name.toLowerCase().includes(normalizedQuery)
      )
      .sort((left, right) => right.createdAt - left.createdAt);
  }, [assets, query, selectedPlaylistId, getPlaylistAssetIds]);

  const queue = useMemo(
    () =>
      audioAssets.map((asset) => ({
        elementId: `asset:${asset.id}`,
        audioUrl: asset.url,
        title: asset.name,
        previewImageUrl: asset.thumbnail,
      })),
    [audioAssets]
  );
  const showPlaybackQueue = playback.queue.length > 0 && !!playback.activeAudioUrl;
  const resolvedQueueDurations = useResolvedAudioDurations(playback.queue);

  const queueListItems = useMemo(
    () =>
      playback.queue.map((item, index) => {
        const assetId = item.elementId?.startsWith('asset:')
          ? item.elementId.slice('asset:'.length)
          : (
            assets.find((asset) => asset.type === AssetType.AUDIO && asset.url === item.audioUrl)?.id || null
          );
        return {
          id: `${item.audioUrl}-${index}`,
          title: item.title || '未命名音频',
          subtitle: formatDuration(resolvedQueueDurations.get(item.audioUrl) ?? item.duration),
          previewImageUrl: item.previewImageUrl,
          isActive: index === playback.activeQueueIndex,
          isPlaying: index === playback.activeQueueIndex && playback.playing,
          isFavorite: assetId ? favoriteAssetIds.has(assetId) : false,
          canFavorite: !!assetId,
        };
      }),
    [assets, favoriteAssetIds, playback.activeQueueIndex, playback.playing, playback.queue, resolvedQueueDurations]
  );

  const handlePlayAsset = async (assetId: string) => {
    const activeIndex = audioAssets.findIndex((asset) => asset.id === assetId);
    if (activeIndex === -1) {
      return;
    }

    if (selectedPlaylistId !== AUDIO_PLAYLIST_ALL_ID) {
      const playlist = playlists.find((item) => item.id === selectedPlaylistId);
      if (playlist) {
        playback.setPlaylistQueue(queue, {
          playlistId: playlist.id,
          playlistName: playlist.name,
        });
      } else {
        playback.setQueue(queue);
      }
    } else {
      playback.setQueue(queue);
    }

    const asset = audioAssets[activeIndex];
    await playback.togglePlayback({
      elementId: `asset:${asset.id}`,
      audioUrl: asset.url,
      title: asset.name,
      previewImageUrl: asset.thumbnail,
    });
  };

  const handlePlayQueueItem = async (itemId: string) => {
    const selectedItem = playback.queue.find((item, index) => `${item.audioUrl}-${index}` === itemId);
    if (!selectedItem) {
      return;
    }
    await playback.togglePlayback(selectedItem);
  };

  const activeAssetCountLabel = `${showPlaybackQueue ? playback.queue.length : audioAssets.length} 首音频`;
  const activePlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId) || null;
  const fallbackAsset = audioAssets[0] || null;
  const effectivePlaylistId = showPlaybackQueue
    ? (playback.queueSource === 'playlist' ? playback.activePlaylistId || AUDIO_PLAYLIST_ALL_ID : AUDIO_PLAYLIST_ALL_ID)
    : selectedPlaylistId;
  const currentPlaylistAssetIds = useMemo(
    () => new Set(
      effectivePlaylistId !== AUDIO_PLAYLIST_ALL_ID ? getPlaylistAssetIds(effectivePlaylistId) : []
    ),
    [effectivePlaylistId, getPlaylistAssetIds]
  );
  const activeAsset = useMemo(() => {
    const elementAssetId = playback.activeElementId?.startsWith('asset:')
      ? playback.activeElementId.slice('asset:'.length)
      : null;
    if (elementAssetId) {
      return audioAssets.find((asset) => asset.id === elementAssetId) || null;
    }

    const exactUrlAndTitleMatch = audioAssets.find(
      (asset) => asset.url === playback.activeAudioUrl && asset.name === playback.activeTitle
    );
    if (exactUrlAndTitleMatch) {
      return exactUrlAndTitleMatch;
    }

    return audioAssets.find((asset) => asset.url === playback.activeAudioUrl) || null;
  }, [audioAssets, playback.activeAudioUrl, playback.activeElementId, playback.activeTitle]);
  const displayAsset = activeAsset || fallbackAsset;
  const activeAssetId = activeAsset?.id || null;
  const resolvedPreviewImageUrl = playback.activePreviewImageUrl || displayAsset?.thumbnail;
  const currentQueueTitle = playback.queueSource === 'playlist'
    ? (playback.activePlaylistName || '播放列表')
    : '当前播放队列';
  const listHeaderTitle = showPlaybackQueue
    ? currentQueueTitle
    : (activePlaylist?.name || '素材库音频');

  const openCreatePlaylistDialog = (assetId?: string) => {
    setPendingAssetId(assetId || null);
    setPlaylistName('');
    setPlaylistDialogMode('create');
    setEditingPlaylistId(null);
    setCreateDialogVisible(true);
    setContextMenu(null);
    setPlaylistContextMenu(null);
  };

  const openRenamePlaylistDialog = (playlistId: string, name: string) => {
    setPendingAssetId(null);
    setPlaylistDialogMode('rename');
    setEditingPlaylistId(playlistId);
    setPlaylistName(name);
    setCreateDialogVisible(true);
    setPlaylistContextMenu(null);
  };

  return (
    <div className="music-player-tool">
      <div className="music-player-tool__now-playing">
        <div className="music-player-tool__now-playing-cover">
          <AudioCover
            src={resolvedPreviewImageUrl}
            alt={displayAsset?.name || '当前音频'}
            fallbackClassName="music-player-tool__now-playing-cover music-player-tool__now-playing-cover--fallback"
            iconSize={22}
          />
        </div>
        <div className="music-player-tool__now-playing-meta">
          <div className="music-player-tool__eyebrow">当前播放</div>
          <div className="music-player-tool__title">
            {playback.activeTitle || displayAsset?.name || '未选择音频'}
          </div>
          <div className="music-player-tool__subtitle">
            {playback.queueSource === 'playlist' ? (playback.activePlaylistName || '播放列表') : '画布音频'}
            {' · '}
            {formatDuration(playback.currentTime)} / {formatDuration(playback.duration)}
          </div>
        </div>
        <div className="music-player-tool__now-playing-actions">
          <button
            type="button"
            className="music-player-tool__action-btn"
            onClick={() => void playback.playPrevious()}
            disabled={playback.activeQueueIndex <= 0}
            aria-label="上一首"
            data-tooltip="上一首"
          >
            <SkipBack size={16} />
          </button>
          <button
            type="button"
            className="music-player-tool__action-btn music-player-tool__action-btn--primary"
            onClick={() => {
              if (playback.playing) {
                playback.pausePlayback();
              } else if (playback.activeAudioUrl) {
                void playback.resumePlayback();
              } else if (fallbackAsset) {
                void handlePlayAsset(fallbackAsset.id);
              } else {
                return;
              }
            }}
            disabled={!playback.activeAudioUrl && !fallbackAsset}
            aria-label={playback.playing ? '暂停' : '播放'}
            data-tooltip={playback.playing ? '暂停' : '播放'}
          >
            {playback.playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            className="music-player-tool__action-btn"
            onClick={() => void playback.playNext()}
            disabled={
              playback.activeQueueIndex < 0 ||
              playback.activeQueueIndex >= playback.queue.length - 1
            }
            aria-label="下一首"
            data-tooltip="下一首"
          >
            <SkipForward size={16} />
          </button>
          <button
            type="button"
            className="music-player-tool__action-btn music-player-tool__action-btn--ghost"
            onClick={() => toolWindowService.minimizeTool(MUSIC_PLAYER_TOOL_ID)}
            aria-label="切回播放控件"
            data-tooltip="切回播放控件"
          >
            <Minimize2 size={16} />
          </button>
        </div>
      </div>

      {!showPlaybackQueue ? (
        <>
          <div className="music-player-tool__search">
            <Input
              value={query}
              onChange={(value) => setQuery(String(value))}
              prefixIcon={<Search size={14} />}
              placeholder="搜索素材库音频"
              clearable
            />
          </div>

          <AudioPlaylistTabs
            className="music-player-tool__playlists"
            selectedPlaylistId={selectedPlaylistId}
            allCount={assets.filter((asset) => asset.type === AssetType.AUDIO).length}
            playlists={playlists}
            playlistItems={playlistItems}
            onSelect={setSelectedPlaylistId}
            onCreate={() => openCreatePlaylistDialog()}
            onRename={(playlist) => openRenamePlaylistDialog(playlist.id, playlist.name)}
            onDelete={(playlist) => void deletePlaylist(playlist.id)}
          />
        </>
      ) : null}

      <div className="music-player-tool__list-header">
        <span>{listHeaderTitle}</span>
        <span>{activeAssetCountLabel}</span>
      </div>

      <div className="music-player-tool__list">
        {showPlaybackQueue ? (
          <AudioTrackList
            className="audio-track-list--queue"
            items={queueListItems}
            onSelect={(item) => void handlePlayQueueItem(item.id)}
            onContextMenu={(item, event) => {
              const selectedItem = playback.queue.find((queueItem, index) => `${queueItem.audioUrl}-${index}` === item.id);
              const assetId = selectedItem?.elementId?.startsWith('asset:')
                ? selectedItem.elementId.slice('asset:'.length)
                : (
                  selectedItem
                    ? assets.find((asset) => asset.type === AssetType.AUDIO && asset.url === selectedItem.audioUrl)?.id || null
                    : null
                );
              if (!assetId) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              setContextMenu({
                x: event.clientX,
                y: event.clientY,
                assetId,
              });
            }}
            onToggleFavorite={(item) => {
              const selectedItem = playback.queue.find((queueItem, index) => `${queueItem.audioUrl}-${index}` === item.id);
              const assetId = selectedItem?.elementId?.startsWith('asset:')
                ? selectedItem.elementId.slice('asset:'.length)
                : (
                  selectedItem
                    ? assets.find((asset) => asset.type === AssetType.AUDIO && asset.url === selectedItem.audioUrl)?.id || null
                    : null
                );
              if (assetId) {
                void toggleFavorite(assetId);
              }
            }}
            onTogglePlayback={(item) => {
              void handlePlayQueueItem(item.id);
            }}
            showFavoriteButton
            showPlaybackIndicator
          />
        ) : audioAssets.length === 0 ? (
          <div className="music-player-tool__empty">
            <Music4 size={18} />
            <span>当前列表里还没有音频</span>
          </div>
        ) : (
          <AudioTrackList
            items={audioAssets.map((asset) => ({
              id: asset.id,
              title: asset.name,
              subtitle: new Date(asset.createdAt).toLocaleDateString('zh-CN'),
              previewImageUrl: asset.thumbnail,
              isActive: activeAssetId === asset.id,
              isPlaying: activeAssetId === asset.id && playback.playing,
              isFavorite: favoriteAssetIds.has(asset.id),
              canFavorite: true,
            }))}
            onSelect={(item) => void handlePlayAsset(item.id)}
            onContextMenu={(item, event) => {
              event.preventDefault();
              event.stopPropagation();
              setContextMenu({
                x: event.clientX,
                y: event.clientY,
                assetId: item.id,
              });
            }}
            onToggleFavorite={(item) => {
              void toggleFavorite(item.id);
            }}
            onTogglePlayback={(item) => {
              void handlePlayAsset(item.id);
            }}
            showFavoriteButton
            showPlaybackIndicator
          />
        )}
      </div>

      <Dialog
        visible={createDialogVisible}
        header={playlistDialogMode === 'rename' ? '重命名播放列表' : '新建播放列表'}
        onClose={() => {
          setCreateDialogVisible(false);
          setPendingAssetId(null);
          setEditingPlaylistId(null);
          setPlaylistDialogMode('create');
        }}
        onConfirm={async () => {
          if (playlistDialogMode === 'rename' && editingPlaylistId) {
            await renamePlaylist(editingPlaylistId, playlistName);
          } else {
            const playlist = await createPlaylist(playlistName);
            if (pendingAssetId) {
              await addAssetToPlaylist(pendingAssetId, playlist.id);
            }
            setSelectedPlaylistId(playlist.id);
          }
          setCreateDialogVisible(false);
          setPlaylistName('');
          setPendingAssetId(null);
          setEditingPlaylistId(null);
          setPlaylistDialogMode('create');
        }}
        onCancel={() => {
          setCreateDialogVisible(false);
          setPendingAssetId(null);
          setEditingPlaylistId(null);
          setPlaylistDialogMode('create');
          setPlaylistName('');
        }}
        confirmBtn="确定"
        cancelBtn="取消"
      >
        <Input
          value={playlistName}
          onChange={(value) => setPlaylistName(String(value))}
          placeholder="请输入播放列表名称"
          autofocus
        />
      </Dialog>

      <AudioTrackContextMenu
        contextMenu={contextMenu}
        playlists={playlists}
        playlistItems={playlistItems}
        favoriteAssetIds={favoriteAssetIds}
        selectedPlaylistId={effectivePlaylistId === AUDIO_PLAYLIST_ALL_ID ? null : effectivePlaylistId}
        currentPlaylistAssetIds={currentPlaylistAssetIds}
        onClose={() => setContextMenu(null)}
        onToggleFavorite={(assetId) => void toggleFavorite(assetId)}
        onAddToPlaylist={(assetId, playlistId) => void addAssetToPlaylist(assetId, playlistId)}
        onRemoveFromPlaylist={(assetId, playlistId) => void removeAssetFromPlaylist(assetId, playlistId)}
        onCreatePlaylistAndAdd={(assetId) => openCreatePlaylistDialog(assetId)}
      />
    </div>
  );
};
