'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PublicIcon from '@mui/icons-material/Public';
import HdIcon from '@mui/icons-material/Hd';
import SdIcon from '@mui/icons-material/Sd';
import VideocamIcon from '@mui/icons-material/Videocam';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

// Interfaces (Copied from stream page)
interface Stream {
  name: string;
  title?: string;
  url: string;
  behindProxy?: boolean;
  external?: boolean;
  ytId?: string;
  externalUrl?: string;
  addon: string;
  addonName: string;
  quality?: string | null;
  resolution?: string;
  size?: string;
  source?: string;
}

interface StreamResponse {
  streams?: Stream[];
  addon?: string;
  error?: string;
}

// Component Props
interface StreamDialogProps {
  open: boolean;
  onClose: () => void;
  contentType: string;
  contentId: string;
  season?: number | null;
  episode?: number | null;
  contentName?: string;
  episodeInfo?: string;
  initialAddonId?: string | null;
}

export default function StreamDialog({
  open,
  onClose,
  contentType,
  contentId,
  season,
  episode,
  contentName = 'Content',
  episodeInfo = '',
  initialAddonId,
}: StreamDialogProps) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false); // Start as false, fetch on open
  const [error, setError] = useState<string | null>(null);
  const [selectedAddon, setSelectedAddon] = useState<string | null>(null);

  // Fetch streams logic (adapted from stream page)
  const fetchStreams = useCallback(async () => {
    if (!open || !contentType || !contentId) return; // Don't fetch if not open or missing params

    setLoading(true);
    setStreams([]);
    setError(null);

    try {
      const storedData = localStorage.getItem('installedAddons');
      if (!storedData) {
        throw new Error('No addons installed');
      }

      const loadedAddons = JSON.parse(storedData);
      if (loadedAddons.length === 0) {
        throw new Error('No addons installed');
      }

      // Build the video ID based on type, ID, and optional season/episode
      let videoId = `${contentId}`;
      if (contentType === 'series' && season && episode) {
        videoId = `${contentId}:${season}:${episode}`;
      }

      const allStreams: Stream[] = [];
      const fetchPromises: Promise<void>[] = [];

      // For each addon, try to fetch streams
      for (const addon of loadedAddons) {
        try {
          // Extract base URL
          const manifestUrlParts = addon.manifestUrl.split('/');
          manifestUrlParts.pop();
          const baseUrl = manifestUrlParts.join('/');

          // Fetch streams
          const fetchPromise = (async () => {
            try {
              // Use the stream endpoint format: /stream/:type/:videoId.json
              const streamUrl = `${baseUrl}/stream/${contentType}/${videoId}.json`;
              console.log(`Fetching streams from ${addon.name}: ${streamUrl}`);

              const response = await fetch(streamUrl);
              if (!response.ok) {
                console.warn(`No streams available from ${addon.name}`);
                return;
              }

              const data = await response.json() as StreamResponse;

              if (data && Array.isArray(data.streams) && data.streams.length > 0) {
                // Process and add streams
                const processedStreams = data.streams.map(stream => ({
                  ...stream,
                  addon: addon.id,
                  addonName: addon.name
                }));

                allStreams.push(...processedStreams);
                console.log(`Added ${processedStreams.length} streams from ${addon.name}`);
              }
            } catch (addonError) {
              console.error(`Error fetching streams from ${addon.name}:`, addonError);
            }
          })();

          fetchPromises.push(fetchPromise);
        } catch (addonInitError) {
          console.error(`Error initializing fetch for ${addon.name}:`, addonInitError);
        }
      }

      // Wait for all fetchPromises to complete
      await Promise.all(fetchPromises);

      if (allStreams.length === 0) {
        setError('No streaming sources found for this content.');
      } else {
        // Sort streams by quality (if available)
        const sortedStreams = allStreams.sort((a, b) => {
          // Try to sort by resolution/quality
          const getQualityValue = (stream: Stream) => {
            if (stream.resolution) {
              const match = stream.resolution.match(/\d+/);
              return match ? parseInt(match[0], 10) : 0;
            }
            if (stream.quality) {
              if (stream.quality.includes('1080')) return 1080;
              if (stream.quality.includes('720')) return 720;
              if (stream.quality.includes('480')) return 480;
              if (stream.quality.includes('HD')) return 720;
              if (stream.quality.includes('SD')) return 480;
            }
            return 0;
          };

          const qualityA = getQualityValue(a);
          const qualityB = getQualityValue(b);

          return qualityB - qualityA; // Higher quality first
        });

        setStreams(sortedStreams);

        // Set initial selected addon if there are streams
        if (sortedStreams.length > 0) {
           // Use initialAddonId if provided, otherwise default to the first addon found
           const initialSelected = initialAddonId && sortedStreams.some(s => s.addon === initialAddonId)
             ? initialAddonId
             : sortedStreams[0].addon;
          setSelectedAddon(initialSelected);
        }
      }
    } catch (err: any) {
      console.error('Error fetching streams:', err);
      setError(err.message || 'Failed to load streaming sources');
    } finally {
      setLoading(false);
    }
  }, [open, contentType, contentId, season, episode, initialAddonId]); // Depend on open state

  // Trigger fetch when dialog opens or parameters change
  useEffect(() => {
    if (open) {
      fetchStreams();
    } else {
      // Reset state when dialog closes
      setStreams([]);
      setLoading(false);
      setError(null);
      setSelectedAddon(null);
    }
  }, [open, fetchStreams]);

  // Handle stream selection
  const handleStreamSelect = (stream: Stream) => {
    if (stream.externalUrl) {
      window.open(stream.externalUrl, '_blank');
    } else if (stream.url) {
      window.open(stream.url, '_blank');
    }
    onClose(); // Close dialog after selection
  };

  // Handle addon filter change
  const handleAddonChange = (event: any) => {
    setSelectedAddon(event.target.value as string);
  };

  // Get quality icon based on stream
  const getQualityIcon = (stream: Stream) => {
    const quality = stream.quality?.toLowerCase() || '';
    const resolution = stream.resolution?.toLowerCase() || '';

    if (quality.includes('1080') || resolution.includes('1080')) {
      return <HdIcon fontSize="small" />;
    } else if (quality.includes('720') || resolution.includes('720') || quality.includes('hd')) {
      return <HdIcon fontSize="small" />;
    } else if (quality.includes('480') || resolution.includes('480') || quality.includes('sd')) {
      return <SdIcon fontSize="small" />;
    } else {
      return <VideocamIcon fontSize="small" />;
    }
  };

  // Filter streams by selected addon
  const filteredStreams = selectedAddon
    ? streams.filter(stream => stream.addon === selectedAddon)
    : streams;

  // Get unique addons that have streams
  const availableAddons = [...new Set(streams.map(stream => stream.addon))];

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#222', // Dark background for dialog
          color: 'white',
        },
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, bgcolor: '#181818' }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
          {contentName}
        </Typography>
        {episodeInfo && (
          <Typography variant="body2" sx={{ color: 'grey.400' }}>
            {episodeInfo}
          </Typography>
        )}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: '#141414', p: { xs: 2, md: 3 } }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress color="inherit" />
          </Box>
        ) : error ? (
          <Alert
            severity="warning"
            sx={{
              backgroundColor: '#333',
              color: 'white',
              '.MuiAlert-icon': { color: 'white' }
            }}
          >
            {error}
          </Alert>
        ) : (
          <>
            {/* Addon filter */}
            {availableAddons.length > 1 && (
              <Box sx={{ mb: 3, maxWidth: '300px' }}>
                <FormControl fullWidth variant="filled" size="small">
                  <InputLabel
                    id="addon-select-label"
                    sx={{ color: 'grey.300' }}
                  >
                    Addon Source
                  </InputLabel>
                  <Select
                    labelId="addon-select-label"
                    value={selectedAddon || ''}
                    onChange={handleAddonChange}
                    label="Addon Source"
                    sx={{
                      color: 'white',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.12)' },
                      '.MuiFilledInput-input': { py: 1.5 },
                      '.MuiSvgIcon-root': { color: 'white' }
                    }}
                    disableUnderline
                  >
                    {availableAddons.map(addonId => {
                      const addonName = streams.find(s => s.addon === addonId)?.addonName || addonId;
                      return (
                        <MenuItem key={addonId} value={addonId} sx={{ bgcolor: '#333', '&:hover': { bgcolor: '#444' } }}>
                          {addonName}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Box>
            )}

            {/* Streams list */}
            <Typography variant="body1" component="h3" sx={{ mb: 1.5, fontWeight: 'medium', color: 'grey.300' }}>
              Available Streams {filteredStreams.length > 0 && `(${filteredStreams.length})`}
            </Typography>

            {filteredStreams.length > 0 ? (
              <List sx={{ p: 0, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
                {filteredStreams.map((stream, index) => (
                  <React.Fragment key={`${stream.addon}-${index}`}>
                    {index > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />}
                    <ListItem
                      component="div" // Use div for semantic correctness inside Dialog
                      onClick={() => handleStreamSelect(stream)}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'rgba(255,255,255,0.08)'
                        },
                        py: 1.5
                      }}
                    >
                      <ListItemIcon sx={{ color: 'white', minWidth: '40px' }}>
                        {stream.external ? <PublicIcon fontSize="small" /> : getQualityIcon(stream)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body1">
                            {stream.title || stream.name || `Stream ${index + 1}`}
                          </Typography>
                        }
                        secondary={
                          <Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, color: 'grey.400', fontSize: '0.8rem', mt: 0.5 }}>
                            {stream.quality && (
                              <Box component="span" sx={{ bgcolor: 'rgba(255,255,255,0.1)', px: 1, borderRadius: '4px', fontSize: '0.7rem' }}>
                                {stream.quality}
                              </Box>
                            )}
                            {stream.resolution && (
                              <Box component="span" sx={{ bgcolor: 'rgba(255,255,255,0.1)', px: 1, borderRadius: '4px', fontSize: '0.7rem' }}>
                                {stream.resolution}
                              </Box>
                            )}
                            {stream.size && (
                              <Box component="span" sx={{ bgcolor: 'rgba(255,255,255,0.1)', px: 1, borderRadius: '4px', fontSize: '0.7rem' }}>
                                {stream.size}
                              </Box>
                            )}
                            <Box component="span" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                              via {stream.addonName}
                            </Box>
                          </Box>
                        }
                        secondaryTypographyProps={{ component: 'div' }} // Ensure secondary is treated as a block
                      />
                      <ListItemIcon sx={{ color: '#e50914', minWidth: '30px' }}>
                        <PlayArrowIcon fontSize="small" />
                      </ListItemIcon>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography variant="body2" sx={{ color: 'grey.400', textAlign: 'center', py: 2 }}>
                {streams.length > 0 ? 'No streams available from this addon' : 'No streams found'}
              </Typography>
            )}
            
             {/* Hint text */}
             <Typography variant="caption" sx={{ display: 'block', color: 'grey.500', fontStyle: 'italic', textAlign: 'center', mt: 2 }}>
                Clicking on a stream may open an external player or website.
             </Typography>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 1.5, bgcolor: '#181818' }}>
        <Button onClick={onClose} sx={{ color: 'grey.400' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
} 