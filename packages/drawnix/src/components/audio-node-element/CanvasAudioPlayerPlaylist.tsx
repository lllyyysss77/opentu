import React from 'react';
import classNames from 'classnames';
import { AudioCover } from '../shared/AudioCover';

interface PlaylistItem {
  audioUrl: string;
  title?: string;
  previewImageUrl?: string;
  duration?: number;
}

interface CanvasAudioPlayerPlaylistProps {
  queue: PlaylistItem[];
  activeQueueIndex: number;
  onSelect: (item: PlaylistItem) => void;
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
  onSelect,
}) => {
  return (
    <div className="canvas-audio-player__playlist">
      {queue.map((item, index) => (
        <button
          key={`${item.audioUrl}-${index}`}
          type="button"
          className={classNames('canvas-audio-player__playlist-item', {
            'canvas-audio-player__playlist-item--active': index === activeQueueIndex,
          })}
          onClick={() => onSelect(item)}
        >
          <div className="canvas-audio-player__playlist-cover">
            <AudioCover
              src={item.previewImageUrl}
              alt={item.title || 'Audio cover'}
              fallbackClassName="canvas-audio-player__cover-fallback"
              iconSize={16}
              loading="lazy"
            />
          </div>
          <div className="canvas-audio-player__playlist-meta">
            <div className="canvas-audio-player__playlist-title">
              {item.title || '未命名音频'}
            </div>
            <div className="canvas-audio-player__playlist-subtitle">
              {formatDuration(item.duration)}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
