import React from 'react';
import { Heart, ListMusic, Plus, XSquare } from 'lucide-react';
import type { AudioPlaylist, AudioPlaylistItem } from '../../types/audio-playlist.types';
import {
  ContextMenu,
  type ContextMenuEntry,
} from './ContextMenu';

interface AudioTrackContextMenuProps {
  contextMenu: {
    x: number;
    y: number;
    assetId: string;
  } | null;
  playlists: AudioPlaylist[];
  playlistItems: Record<string, AudioPlaylistItem[]>;
  favoriteAssetIds: Set<string>;
  selectedPlaylistId?: string | null;
  currentPlaylistAssetIds?: Set<string>;
  onClose: () => void;
  onToggleFavorite: (assetId: string) => void;
  onAddToPlaylist: (assetId: string, playlistId: string) => void;
  onRemoveFromPlaylist?: (assetId: string, playlistId: string) => void;
  onCreatePlaylistAndAdd: (assetId: string) => void;
}

export const AudioTrackContextMenu: React.FC<AudioTrackContextMenuProps> = ({
  contextMenu,
  playlists,
  playlistItems,
  favoriteAssetIds,
  selectedPlaylistId,
  currentPlaylistAssetIds,
  onClose,
  onToggleFavorite,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onCreatePlaylistAndAdd,
}) => {
  if (!contextMenu) {
    return null;
  }

  const items: ContextMenuEntry<string>[] = [
    {
      key: 'favorite',
      label: (assetId) => (favoriteAssetIds.has(assetId) ? '取消收藏' : '加入收藏'),
      icon: <Heart size={14} />,
      onSelect: (assetId) => onToggleFavorite(assetId),
    },
    {
      key: 'playlist-actions',
      type: 'submenu',
      label: '添加到播放列表',
      icon: <ListMusic size={14} />,
      children: (assetId) =>
        playlists.map((playlist) => {
          const exists = (playlistItems[playlist.id] || []).some(
            (item) => item.assetId === assetId
          );
          return {
            key: `playlist-${playlist.id}`,
            label: exists ? `已在 ${playlist.name}` : `添加到 ${playlist.name}`,
            icon: <ListMusic size={14} />,
            disabled: exists,
            onSelect: () => onAddToPlaylist(assetId, playlist.id),
          };
        }),
    },
  ];

  if (
    selectedPlaylistId &&
    currentPlaylistAssetIds?.has(contextMenu.assetId) &&
    onRemoveFromPlaylist
  ) {
    items.push({
      key: 'remove-from-current',
      label: '从当前播放列表移除',
      icon: <XSquare size={14} />,
      danger: true,
      onSelect: (assetId) => onRemoveFromPlaylist(assetId, selectedPlaylistId),
    });
  }

  items.push({
    key: 'create-playlist',
    label: '新建播放列表并添加',
    icon: <Plus size={14} />,
    onSelect: (assetId) => onCreatePlaylistAndAdd(assetId),
  });

  return (
    <ContextMenu
      state={{
        x: contextMenu.x,
        y: contextMenu.y,
        payload: contextMenu.assetId,
      }}
      items={items}
      onClose={onClose}
    />
  );
};
