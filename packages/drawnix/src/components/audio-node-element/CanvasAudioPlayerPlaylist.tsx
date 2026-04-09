import React, { useMemo, useState } from 'react';
import { Dialog, Input } from 'tdesign-react';
import { AudioTrackList } from '../shared/AudioTrackList';
import { AudioTrackContextMenu } from '../shared/AudioTrackContextMenu';
import { useContextMenuState } from '../shared';
import { useAssets } from '../../contexts/AssetContext';
import { useResolvedAudioDurations } from '../../hooks/useResolvedAudioDurations';
import { AssetType } from '../../types/asset.types';
import { useAudioPlaylists } from '../../contexts/AudioPlaylistContext';
import { AUDIO_PLAYLIST_ALL_ID } from '../../types/audio-playlist.types';
import type { CanvasAudioPlaybackSource, CanvasAudioQueueSource } from '../../services/canvas-audio-playback-service';

interface CanvasAudioPlayerPlaylistProps {
  queue: CanvasAudioPlaybackSource[];
  activeQueueIndex: number;
  queueSource: CanvasAudioQueueSource;
  activePlaylistId?: string;
  onSelect: (item: CanvasAudioPlaybackSource) => void;
}

const ASSET_ELEMENT_ID_PREFIX = 'asset:';

function getAssetIdFromSource(item?: CanvasAudioPlaybackSource): string | null {
  if (!item?.elementId?.startsWith(ASSET_ELEMENT_ID_PREFIX)) {
    return null;
  }

  return item.elementId.slice(ASSET_ELEMENT_ID_PREFIX.length);
}

function formatDuration(duration?: number): string {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
    return '--:--';
  }
  const totalSeconds = Math.floor(duration);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const CanvasAudioPlayerPlaylist: React.FC<CanvasAudioPlayerPlaylistProps> = ({
  queue,
  activeQueueIndex,
  queueSource,
  activePlaylistId,
  onSelect,
}) => {
  const { assets } = useAssets();
  const {
    playlists,
    playlistItems,
    favoriteAssetIds,
    createPlaylist,
    addAssetToPlaylist,
    removeAssetFromPlaylist,
    toggleFavorite,
  } = useAudioPlaylists();
  const {
    contextMenu,
    openAt: openContextMenuAt,
    close: closeContextMenu,
  } = useContextMenuState<string>();
  const [createDialogVisible, setCreateDialogVisible] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null);

  const selectedPlaylistId =
    queueSource === 'playlist' && activePlaylistId ? activePlaylistId : AUDIO_PLAYLIST_ALL_ID;
  const resolvedDurations = useResolvedAudioDurations(queue);
  const resolveAssetId = (item?: CanvasAudioPlaybackSource): string | null => {
    const directAssetId = getAssetIdFromSource(item);
    if (directAssetId) {
      return directAssetId;
    }

    if (!item?.audioUrl) {
      return null;
    }

    const matchedAsset = assets.find(
      (asset) => asset.type === AssetType.AUDIO && asset.url === item.audioUrl
    );
    return matchedAsset?.id || null;
  };
  const currentPlaylistAssetIds = useMemo(
    () => new Set(
      selectedPlaylistId !== AUDIO_PLAYLIST_ALL_ID
        ? (playlistItems[selectedPlaylistId] || []).map((item) => item.assetId)
        : []
    ),
    [playlistItems, selectedPlaylistId]
  );
  return (
    <div className="canvas-audio-player__playlist">
      <AudioTrackList
        className="canvas-audio-player__playlist-list audio-track-list--queue"
        items={queue.map((item, index) => {
          const assetId = resolveAssetId(item);

          return {
            id: `${item.audioUrl}-${index}`,
            title: item.title || '未命名音频',
            subtitle: formatDuration(resolvedDurations.get(item.audioUrl) ?? item.duration),
            previewImageUrl: item.previewImageUrl,
            isActive: index === activeQueueIndex,
            isPlaying: index === activeQueueIndex,
            isFavorite: assetId ? favoriteAssetIds.has(assetId) : false,
            canFavorite: !!assetId,
          };
        })}
        onSelect={(selectedItem) => {
          const nextItem = queue.find((item, index) => `${item.audioUrl}-${index}` === selectedItem.id);
          if (nextItem) {
            onSelect(nextItem);
          }
        }}
        onContextMenu={(selectedItem, event) => {
          const nextItem = queue.find((item, index) => `${item.audioUrl}-${index}` === selectedItem.id);
          const assetId = resolveAssetId(nextItem);
          if (!assetId) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          openContextMenuAt(event.clientX, event.clientY, assetId);
        }}
        onToggleFavorite={(selectedItem) => {
          const nextItem = queue.find((item, index) => `${item.audioUrl}-${index}` === selectedItem.id);
          const assetId = resolveAssetId(nextItem);
          if (assetId) {
            void toggleFavorite(assetId);
          }
        }}
        onTogglePlayback={(selectedItem) => {
          const nextItem = queue.find((item, index) => `${item.audioUrl}-${index}` === selectedItem.id);
          if (nextItem) {
            onSelect(nextItem);
          }
        }}
        showFavoriteButton
        showPlaybackIndicator
      />
      <AudioTrackContextMenu
        contextMenu={
          contextMenu
            ? {
                x: contextMenu.x,
                y: contextMenu.y,
                assetId: contextMenu.payload,
              }
            : null
        }
        playlists={playlists}
        playlistItems={playlistItems}
        favoriteAssetIds={favoriteAssetIds}
        selectedPlaylistId={selectedPlaylistId === AUDIO_PLAYLIST_ALL_ID ? null : selectedPlaylistId}
        currentPlaylistAssetIds={currentPlaylistAssetIds}
        onClose={closeContextMenu}
        onToggleFavorite={(assetId) => void toggleFavorite(assetId)}
        onAddToPlaylist={(assetId, playlistId) => void addAssetToPlaylist(assetId, playlistId)}
        onRemoveFromPlaylist={(assetId, playlistId) => void removeAssetFromPlaylist(assetId, playlistId)}
        onCreatePlaylistAndAdd={(assetId) => {
          setPendingAssetId(assetId);
          setPlaylistName('');
          setCreateDialogVisible(true);
        }}
      />
      <Dialog
        visible={createDialogVisible}
        header="新建播放列表"
        onClose={() => setCreateDialogVisible(false)}
        onConfirm={async () => {
          const playlist = await createPlaylist(playlistName);
          if (pendingAssetId) {
            await addAssetToPlaylist(pendingAssetId, playlist.id);
          }
          setCreateDialogVisible(false);
          setPlaylistName('');
          setPendingAssetId(null);
        }}
        onCancel={() => {
          setCreateDialogVisible(false);
          setPendingAssetId(null);
        }}
        confirmBtn="确定"
        cancelBtn="取消"
      >
        <Input
          value={playlistName}
          onChange={(value) => setPlaylistName(String(value))}
          placeholder="请输入播放列表名称"
        />
      </Dialog>
    </div>
  );
};
