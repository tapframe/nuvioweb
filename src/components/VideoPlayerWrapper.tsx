'use client';

import React from 'react';
import VideoPlayer from './VideoPlayer';
import StremioPlayer from './StremioPlayer';

interface VideoPlayerWrapperProps {
  url: string;
  title?: string;
  quality?: string;
  addonName?: string;
  onClose?: () => void;
  autoPlay?: boolean;
  useStremio?: boolean; // Flag to choose which player to use
}

export default function VideoPlayerWrapper({
  useStremio = true, // Default to using Stremio player
  ...props
}: VideoPlayerWrapperProps) {
  // Use the Stremio player or fall back to the original player
  return useStremio ? <StremioPlayer {...props} /> : <VideoPlayer {...props} />;
} 