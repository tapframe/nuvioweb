'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import ReplayIcon from '@mui/icons-material/Replay';
import CloseIcon from '@mui/icons-material/Close';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

interface VideoPlayerProps {
  url: string;
  title?: string;
  quality?: string;
  addonName?: string;
  onClose?: () => void;
  autoPlay?: boolean;
}

export default function VideoPlayer({
  url,
  title = 'Video',
  quality = '',
  addonName = '',
  onClose,
  autoPlay = true,
}: VideoPlayerProps) {
  // Player state
  const [playing, setPlaying] = useState(autoPlay);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [hoverVolume, setHoverVolume] = useState(false);

  // References
  const playerRef = useRef<ReactPlayer | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Format time (seconds to MM:SS or HH:MM:SS)
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle player ready event
  const handleReady = () => {
    setReady(true);
    setLoading(false);
    console.log('Player is ready');
  };

  // Handle play/pause toggle
  const handlePlayPause = () => {
    setPlaying(!playing);
  };

  // Handle mute toggle
  const handleMute = () => {
    setMuted(!muted);
  };

  // Handle volume change
  const handleVolumeChange = (_event: Event, newValue: number | number[]) => {
    setVolume(newValue as number);
    if (newValue === 0) {
      setMuted(true);
    } else {
      setMuted(false);
    }
  };

  // Handle seeking
  const handleSeekMouseDown = () => {
    setSeeking(true);
  };

  const handleSeekChange = (_event: Event, newValue: number | number[]) => {
    setPlayed(newValue as number);
  };

  const handleSeekMouseUp = (_event: React.MouseEvent | React.TouchEvent) => {
    setSeeking(false);
    if (playerRef.current) {
      playerRef.current.seekTo(played);
    }
  };

  // Handle progress updates
  const handleProgress = (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number }) => {
    if (!seeking) {
      setPlayed(state.played);
    }
  };

  // Handle fullscreen toggle
  const handleFullscreen = () => {
    const container = playerContainerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.error(err));
    } else {
      container.requestFullscreen().catch(err => console.error(err));
    }
  };

  // Handle error
  const handleError = (error: any) => {
    console.error('Player error:', error);
    setError('Failed to load video. The stream may be unavailable or in an unsupported format.');
    setLoading(false);
  };

  // Show/hide controls based on mouse movement
  const showControls = () => {
    setControlsVisible(true);
    
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    
    controlsTimeout.current = setTimeout(() => {
      if (playing) {
        setControlsVisible(false);
      }
    }, 3000);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, []);

  // Reset controls timeout when playing state changes
  useEffect(() => {
    if (playing) {
      showControls();
    } else {
      setControlsVisible(true);
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    }
  }, [playing]);

  return (
    <Box
      ref={playerContainerRef}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: 'black',
        overflow: 'hidden',
        '&:hover': { cursor: playing && !controlsVisible ? 'none' : 'default' },
      }}
      onMouseMove={showControls}
      onClick={() => {
        if (!controlsVisible) {
          showControls();
        }
      }}
    >
      {/* Video player */}
      <ReactPlayer
        ref={playerRef}
        url={url}
        width="100%"
        height="100%"
        playing={playing}
        volume={volume}
        muted={muted}
        onReady={handleReady}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onProgress={handleProgress}
        onDuration={setDuration}
        onError={handleError}
        config={{
          file: {
            forceVideo: true,
            attributes: {
              controlsList: 'nodownload',
            }
          }
        }}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />

      {/* Loading indicator */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10,
          }}
        >
          <CircularProgress color="inherit" />
        </Box>
      )}

      {/* Error message */}
      {error && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 2,
            zIndex: 10,
          }}
        >
          <Alert 
            severity="error" 
            sx={{ 
              backgroundColor: 'rgba(0, 0, 0, 0.8)', 
              color: 'white',
              '.MuiAlert-icon': { color: 'white' }
            }}
          >
            {error}
          </Alert>
        </Box>
      )}

      {/* Controls overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: controlsVisible 
            ? 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.7) 100%)'
            : 'transparent',
          opacity: controlsVisible ? 1 : 0,
          transition: 'opacity 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 1,
        }}
      >
        {/* Top controls - title */}
        <Box 
          sx={{ 
            p: 2, 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            {title}
            {quality && (
              <Box component="span" sx={{ ml: 1, fontSize: '0.8rem', opacity: 0.8 }}>
                ({quality})
              </Box>
            )}
            {addonName && (
              <Typography variant="caption" sx={{ display: 'block', opacity: 0.7 }}>
                via {addonName}
              </Typography>
            )}
          </Typography>
          
          {onClose && (
            <IconButton 
              onClick={onClose} 
              sx={{ color: 'white' }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </Box>

        {/* Bottom controls - progress, play/pause, volume, etc. */}
        <Box sx={{ p: 1.5 }}>
          {/* Progress bar */}
          <Box sx={{ mb: 1 }}>
            <Slider
              value={played * 100}
              onChange={handleSeekChange}
              onMouseDown={handleSeekMouseDown}
              onMouseUp={handleSeekMouseUp}
              sx={{
                height: 4,
                '& .MuiSlider-thumb': {
                  width: 12,
                  height: 12,
                  display: controlsVisible ? 'block' : 'none',
                  '&:hover': {
                    boxShadow: '0 0 0 8px rgba(255, 255, 255, 0.16)',
                  },
                },
                '& .MuiSlider-rail': {
                  opacity: 0.3,
                },
              }}
            />
          </Box>

          {/* Control buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {/* Play/Pause */}
              <IconButton 
                onClick={handlePlayPause}
                sx={{ color: 'white', mr: 1 }}
              >
                {playing ? <PauseIcon /> : <PlayArrowIcon />}
              </IconButton>

              {/* Volume control */}
              <Box
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  position: 'relative',
                  '&:hover': { '& .volume-slider': { width: 100, opacity: 1 } }
                }}
                onMouseEnter={() => setHoverVolume(true)}
                onMouseLeave={() => setHoverVolume(false)}
              >
                <IconButton 
                  onClick={handleMute}
                  sx={{ color: 'white', mr: 1 }}
                >
                  {muted || volume === 0 ? <VolumeOffIcon /> : <VolumeUpIcon />}
                </IconButton>
                
                <Box 
                  className="volume-slider"
                  sx={{ 
                    width: hoverVolume ? 100 : 0, 
                    opacity: hoverVolume ? 1 : 0,
                    transition: 'width 0.2s ease, opacity 0.2s ease',
                    overflow: 'hidden',
                  }}
                >
                  <Slider
                    value={volume * 100}
                    onChange={(e, v) => handleVolumeChange(e, (v as number) / 100)}
                    sx={{
                      color: 'white',
                      height: 4,
                      '& .MuiSlider-rail': { opacity: 0.3 },
                      '& .MuiSlider-thumb': { width: 10, height: 10 },
                    }}
                  />
                </Box>
              </Box>

              {/* Time display */}
              <Typography variant="body2" sx={{ ml: 2, color: 'white' }}>
                {formatTime(played * duration)} / {formatTime(duration)}
              </Typography>
            </Box>

            {/* Right-side controls */}
            <Box>
              {/* Fullscreen button */}
              <IconButton 
                onClick={handleFullscreen}
                sx={{ color: 'white' }}
              >
                <FullscreenIcon />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
} 