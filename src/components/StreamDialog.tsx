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
import { TransitionProps } from '@mui/material/transitions';
import Collapse from '@mui/material/Collapse';
import { useTmdbContext } from '@/context/TmdbContext'; // Import TMDB context
import Chip from '@mui/material/Chip';
import BoltIcon from '@mui/icons-material/Bolt';
import InfoIcon from '@mui/icons-material/Info';
import FilterListIcon from '@mui/icons-material/FilterList';

// Interfaces (Copied from stream page)
interface Stream {
  name: string;
  title?: string;
  url: string;
  description?: string;
  behaviorHints?: {
    videoSize?: number;
    filename?: string;
    [key: string]: any;
  };
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
  format?: string;
  codec?: string;
  audio?: string;
  hdr?: boolean;
  dv?: boolean;
  language?: string;
  release_group?: string;
  is10bit?: boolean;      // Added for 10-bit video information
  cachedInfo?: string;   // Added for caching provider information (e.g., "Cached on RD, AD")
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
  TransitionComponent?: React.ComponentType<
    TransitionProps & {
      children: React.ReactElement<any, any>;
    }
  >;
  keepMounted?: boolean;
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
  TransitionComponent,
  keepMounted,
}: StreamDialogProps) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false); // Start as false, fetch on open
  const [error, setError] = useState<string | null>(null);
  const [selectedAddon, setSelectedAddon] = useState<string | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null); // For ID conversion errors

  const { tmdbApiKey } = useTmdbContext(); // Get TMDB API key

  // Function to convert TMDB ID to IMDb ID
  const fetchImdbIdFromTmdb = useCallback(async (tmdbNumericId: string, type: 'movie' | 'series'): Promise<string | null> => {
    if (!tmdbApiKey) {
      console.warn('StreamDialog: TMDB API key is missing, cannot convert TMDB ID to IMDb ID.');
      setConversionError('TMDB API key missing. Cannot look up IMDb ID.');
      return null;
    }
    const tmdbType = type === 'series' ? 'tv' : 'movie';
    const url = `https://api.themoviedb.org/3/${tmdbType}/${tmdbNumericId}/external_ids?api_key=${tmdbApiKey}`;
    
    console.log(`StreamDialog: Fetching IMDb ID from TMDB: ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`TMDB External IDs API error ${response.status}: ${errorData.status_message || response.statusText}`);
      }
      const data = await response.json();
      if (data.imdb_id) {
        console.log(`StreamDialog: Found IMDb ID: ${data.imdb_id} for TMDB ID: ${tmdbNumericId}`);
        return data.imdb_id;
      }
      console.warn(`StreamDialog: IMDb ID not found in TMDB external IDs for ${tmdbNumericId}`);
      setConversionError(`IMDb ID not found for this TMDB item.`);
      return null;
    } catch (err: any) {
      console.error("StreamDialog: Error fetching IMDb ID from TMDB:", err);
      setConversionError(`Failed to fetch IMDb ID: ${err.message}`);
      return null;
    }
  }, [tmdbApiKey]);

  // Fetch streams logic (adapted from stream page)
  const fetchStreams = useCallback(async () => {
    if (!open || !contentType || !contentId) return; // Don't fetch if not open or missing params

    setLoading(true);
    setStreams([]);
    setError(null);
    setConversionError(null); // Reset conversion error

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
      let anAddonWasAttempted = false;

      // For each addon, try to fetch streams
      for (const addon of loadedAddons) {
        anAddonWasAttempted = true;
        let idForAddon = contentId;
        let videoIdForUrl = contentId; // This will include season/episode for series

        // Check if contentId is TMDB ID and needs conversion
        if (contentId.startsWith('tmdb:')) {
          const tmdbNumericIdOnly = contentId.substring(5);
          const imdbId = await fetchImdbIdFromTmdb(tmdbNumericIdOnly, contentType as 'movie' | 'series');
          if (imdbId) {
            idForAddon = imdbId; // Use IMDb ID for this addon
            videoIdForUrl = imdbId; // Update videoIdForUrl as well
          } else {
            // If conversion fails, log it and skip this addon for this TMDB item
            console.warn(`StreamDialog: Skipping addon ${addon.name} for TMDB item ${contentId} due to failed IMDb ID conversion.`);
            // Optionally, accumulate these errors to show a more specific message
            if (!conversionError) setConversionError(prev => prev ? `${prev}, ${addon.name}` : `Could not get IMDb ID for some sources (e.g., ${addon.name})`);
            continue; // Skip to the next addon
          }
        }
        
        // Build the final video ID for the URL (including season/episode if applicable)
        if (contentType === 'series' && season && episode) {
          videoIdForUrl = `${idForAddon}:${season}:${episode}`;
        } else {
          videoIdForUrl = idForAddon; // Ensure it uses the potentially converted ID
        }

        try {
          const manifestUrlParts = addon.manifestUrl.split('/');
          manifestUrlParts.pop();
          const baseUrl = manifestUrlParts.join('/');

          const fetchPromise = (async () => {
            try {
              const streamUrl = `${baseUrl}/stream/${contentType}/${videoIdForUrl}.json`;
              console.log(`StreamDialog: Fetching streams from ${addon.name}: ${streamUrl} (using ID: ${videoIdForUrl})`);

              const response = await fetch(streamUrl);
              if (!response.ok) {
                console.warn(`No streams available from ${addon.name} for ID ${videoIdForUrl}`);
                return;
              }
              const data = await response.json() as StreamResponse;

              if (data && Array.isArray(data.streams) && data.streams.length > 0) {
                // Process and add streams
                const processedStreams = data.streams.map(stream => {
                  console.log(`StreamDialog: Original stream object from ${addon.name}:`, JSON.parse(JSON.stringify(stream)));

                  let enhancedStream: Stream = {
                    ...stream, // Start with the original stream object
                    addon: addon.id,
                    addonName: addon.name,
                    // Initialize potentially missing fields to avoid issues later
                    format: stream.format,
                    codec: stream.codec,
                    audio: stream.audio,
                    hdr: !!stream.hdr, // Ensure boolean
                    dv: !!stream.dv,   // Ensure boolean
                    language: stream.language,
                    release_group: stream.release_group,
                    size: stream.size, // Will be overridden if behaviorHints.videoSize is present
                    resolution: stream.resolution,
                    source: stream.source,
                    is10bit: !!stream.is10bit, // Initialize from stream object or ensure boolean
                    cachedInfo: stream.cachedInfo // Initialize from stream object
                  };

                  // --- Start of new parsing logic ---

                  // 1. Prioritize behaviorHints.videoSize for filesize
                  if (stream.behaviorHints && stream.behaviorHints.videoSize && typeof stream.behaviorHints.videoSize === 'number') {
                    const sizeInBytes = stream.behaviorHints.videoSize;
                    if (sizeInBytes >= 1073741824) { // GB
                      enhancedStream.size = `${(sizeInBytes / 1073741824).toFixed(2)} GB`;
                    } else if (sizeInBytes >= 1048576) { // MB
                      enhancedStream.size = `${(sizeInBytes / 1048576).toFixed(2)} MB`;
                    } else if (sizeInBytes > 0) {
                      enhancedStream.size = `${sizeInBytes} B`;
                    }
                  }

                  // Combine filename (highest priority), description, title, and name for comprehensive parsing
                  const filenameText = (stream.behaviorHints && stream.behaviorHints.filename) ? stream.behaviorHints.filename : '';
                  const descriptionText = stream.description || '';
                  const titleText = stream.title || '';
                  const nameText = stream.name || '';
                  
                  // Give priority to filename, then description, then title, then name
                  const sourceToParse = `${filenameText} ${descriptionText} ${titleText} ${nameText}`.toLowerCase();

                  // Regex patterns (keeping them as they are for now, might need refinement)
                  const formatPatterns = [
                    { regex: /\b(bluray|blu-ray|bdrip|remux)\b/i, format: 'BluRay' }, // Added remux
                    { regex: /\bweb-?dl\b/i, format: 'WEB-DL' },
                    { regex: /\bhdtv\b/i, format: 'HDTV' },
                    { regex: /\bdvdrip\b/i, format: 'DVDRip' },
                    { regex: /\bwebrip\b/i, format: 'WEBRip' },
                    { regex: /\bcam\b/i, format: 'CAM' },
                  ];

                  const codecPatterns = [
                    { regex: /\b(hevc|h\.?265|x\.?265)\b/i, codec: 'HEVC' },
                    { regex: /\b(avc|h\.?264|x\.?264)\b/i, codec: 'AVC' }, // Grouped H264/AVC
                    { regex: /\bvp9\b/i, codec: 'VP9' },
                    { regex: /\bav1\b/i, codec: 'AV1' },
                  ];

                  const audioPatterns = [
                    { regex: /\batmos\b/i, audio: 'Atmos' },
                    { regex: /\bdts-?hd(?:-?ma)?\b/i, audio: 'DTS-HD' }, // More specific DTS-HD
                    { regex: /\bdts\b/i, audio: 'DTS' }, // General DTS
                    { regex: /\bdolby\s*digital\s*plus\b|\bdd\+\b|\beac3\b/i, audio: 'DD+' },
                    { regex: /\bdolby\s*digital\b|\bdd\b|\bac3\b/i, audio: 'DD' },
                    { regex: /\b(?:5|7)\.1\b/i, audio: 'Surround' }, // General surround
                    { regex: /\btrue\s*hd\b/i, audio: 'TrueHD' },
                    { regex: /\baac\b/i, audio: 'AAC' },
                  ];

                  const hdrPatterns = [
                    { regex: /\bhdr10\+\b/i, hdr: true, dv: false }, // HDR10+
                    { regex: /\bhdr10\b/i, hdr: true, dv: false },  // HDR10
                    { regex: /\bhdr\b/i, hdr: true, dv: false },     // Generic HDR
                    { regex: /\bdv\b|\bdolby\s*vision\b/i, hdr: true, dv: true }, // Dolby Vision implies HDR
                  ];
                  
                  const resolutionPatterns = [
                    { regex: /\b(2160p|4k|ultra\s*hd)\b/i, resolution: '2160p' },
                    { regex: /\b(1080p|full\s*hd)\b/i, resolution: '1080p' },
                    { regex: /\b(720p|hd)\b/i, resolution: '720p' },
                    { regex: /\b480p\b/i, resolution: '480p' },
                  ];
                  
                  const languagePatterns = [
                      { regex: /\b(eng|english)\b/i, language: 'English' },
                      { regex: /\b(esp|spanish|espanol|latino)\b/i, language: 'Spanish' },
                      { regex: /\b(fre|french|français)\b/i, language: 'French' },
                      { regex: /\b(ger|german|deutsch)\b/i, language: 'German' },
                      { regex: /\b(ita|italian)\b/i, language: 'Italian' },
                      { regex: /\b(multi|dual\s*audio)\b/i, language: 'Multi Audio' },
                  ];

                  // Release group detection (often in square brackets or parentheses, or after a dash at the end)
                  const releaseGroupRegex = /(?:\b|-)([a-z0-9]+(?:-[a-z0-9]+)*)(?=\s*\.\w{2,4}$)|(?:\[|\()([a-z0-9\s-]+)(?:\]|\))/i;

                  // Apply parsing if not already present or to refine existing data
                  if (!enhancedStream.format) {
                    for (const p of formatPatterns) if (p.regex.test(sourceToParse)) { enhancedStream.format = p.format; break; }
                  }
                  if (!enhancedStream.codec) {
                    for (const p of codecPatterns) if (p.regex.test(sourceToParse)) { enhancedStream.codec = p.codec; break; }
                  }
                  if (!enhancedStream.audio) {
                    for (const p of audioPatterns) if (p.regex.test(sourceToParse)) { enhancedStream.audio = p.audio; break; }
                  }
                  
                  // HDR/DV - allow multiple matches if DV also sets HDR
                  for (const p of hdrPatterns) {
                      if (p.regex.test(sourceToParse)) {
                          if (p.hdr) enhancedStream.hdr = true;
                          if (p.dv) enhancedStream.dv = true;
                          // Don't break, allow DV to also set HDR if a generic HDR was found first
                      }
                  }

                  if (!enhancedStream.resolution) {
                    for (const p of resolutionPatterns) if (p.regex.test(sourceToParse)) { enhancedStream.resolution = p.resolution; break; }
                  }
                  if (!enhancedStream.language) {
                    for (const p of languagePatterns) if (p.regex.test(sourceToParse)) { enhancedStream.language = p.language; break; }
                  }
                  if (!enhancedStream.release_group) {
                    const rgMatch = sourceToParse.match(releaseGroupRegex);
                    if (rgMatch) {
                      enhancedStream.release_group = (rgMatch[1] || rgMatch[2] || '').trim();
                    }
                  }
                  
                  // Special handling for 10bit from description/filename 
                  if (!enhancedStream.is10bit && (sourceToParse.includes('10bit') || sourceToParse.includes('10-bit'))) {
                    enhancedStream.is10bit = true;
                  }

                  // Extract caching information specifically from the original description if not already set
                  if (!enhancedStream.cachedInfo && stream.description) {
                    const cachedOnRegex = /cached on ([\w\s,&]+)/i;
                    // Use stream.description directly here, not sourceToParse, to avoid lowercasing issues if provider names are case-sensitive
                    const cachedMatch = stream.description.match(cachedOnRegex);
                    if (cachedMatch && cachedMatch[1]) {
                      enhancedStream.cachedInfo = `Cached on ${cachedMatch[1].trim()}`;
                    }
                  }
                  
                  // Identify source (RD, PM, AD) - this can be refined
                  if (!enhancedStream.source) {
                      if (addon.name.toLowerCase().includes('rd') || nameText.toLowerCase().includes('[rd') || descriptionText.toLowerCase().includes('[rd')) enhancedStream.source = 'RD';
                      else if (addon.name.toLowerCase().includes('ad') || nameText.toLowerCase().includes('[ad') || descriptionText.toLowerCase().includes('[ad')) enhancedStream.source = 'AD';
                      else if (addon.name.toLowerCase().includes('pm') || nameText.toLowerCase().includes('[pm') || descriptionText.toLowerCase().includes('[pm')) enhancedStream.source = 'PM';
                  }

                  // --- End of new parsing logic ---
                  
                  // Cleanup: if release_group is the same as addonName or a generic term, clear it
                  if (enhancedStream.release_group && 
                      (enhancedStream.release_group.toLowerCase() === enhancedStream.addonName.toLowerCase() || 
                       enhancedStream.release_group.match(/^(english|spanish|multi)$/i))) {
                    enhancedStream.release_group = undefined;
                  }

                  console.log('StreamDialog: Enhanced stream metadata:', enhancedStream);
                  return enhancedStream;
                });

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
        if (conversionError && !error) {
            setError(conversionError); // Prioritize conversion error if no streams found
        } else if (!error) {
            setError(anAddonWasAttempted ? 'No streaming sources found from available addons.' : 'No addons available to fetch streams.');
        }
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
  }, [open, contentType, contentId, season, episode, initialAddonId, fetchImdbIdFromTmdb, conversionError, error]);

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
      TransitionComponent={TransitionComponent}
      keepMounted={keepMounted}
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

      <DialogContent dividers sx={{ bgcolor: '#141414', p: { xs: 2, md: 3 }, position: 'relative', minHeight: '150px' }}>
        {/* Loading indicator */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
            <CircularProgress color="inherit" />
          </Box>
        )}

        {/* Content that appears after loading - wrapped in Collapse */}
        <Collapse in={!loading} timeout="auto" unmountOnExit> 
          {error || conversionError ? (
            // Error Alert
            <Alert
              severity="warning"
              sx={{
                backgroundColor: '#333',
                color: 'white',
                '.MuiAlert-icon': { color: 'white' },
                minHeight: '100px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {error || conversionError}
            </Alert>
          ) : (
            // Streams List and Filter
            <>
              {/* Addon filter */}
              {availableAddons.length > 1 && (
                <Box sx={{ mb: 3, maxWidth: '300px' }}>
                  <FormControl fullWidth variant="filled" size="small">
                    <InputLabel id="addon-select-label" sx={{ color: 'grey.300' }}>
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

              {/* Streams list Title */}
              <Typography variant="body1" component="h3" sx={{ mb: 1.5, fontWeight: 'medium', color: 'grey.300' }}>
                Available Streams {filteredStreams.length > 0 && `(${filteredStreams.length})`}
              </Typography>

              {/* Streams List or "Not Found" message */}
              {filteredStreams.length > 0 ? (
                <List sx={{ p: 0, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
                  {filteredStreams.map((stream, index) => (
                    <React.Fragment key={`${stream.addon}-${index}`}>
                      {index > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />}
                      <ListItem
                        component="div"
                        onClick={() => handleStreamSelect(stream)}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
                          py: 1.5
                        }}
                      >
                        <ListItemIcon sx={{ color: 'white', minWidth: '40px' }}>
                          {stream.external ? <PublicIcon fontSize="small" /> : getQualityIcon(stream)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                              {stream.title || stream.name || `Stream ${index + 1}`}
                            </Typography>
                          }
                          secondary={
                            <Box component="div" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, color: 'grey.400', fontSize: '0.8rem', mt: 0.5 }}>
                              <Box component="div" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                                {/* Quality/Resolution */}
                                {(stream.resolution || stream.quality) && (
                                  <Chip 
                                    label={stream.resolution || stream.quality} 
                                    size="small" 
                                    sx={{ 
                                      height: 20, 
                                      fontSize: '0.7rem', 
                                      bgcolor: 'rgba(255,255,255,0.1)', 
                                      color: 'white' 
                                    }} 
                                  />
                                )}
                                {/* File Size */}
                                {stream.size && (
                                  <Chip 
                                    label={stream.size} 
                                    size="small" 
                                    sx={{ 
                                      height: 20, 
                                      fontSize: '0.7rem', 
                                      bgcolor: 'rgba(255,255,255,0.1)', 
                                      color: 'white' 
                                    }} 
                                  />
                                )}
                                {/* Source Tag (RD, PM, AD) */}
                                {stream.source && (
                                   <Chip 
                                    label={stream.source} 
                                    size="small" 
                                    icon={stream.source === 'RD' ? <BoltIcon sx={{ fontSize: 12, color: '#ffc107' }} /> : undefined}
                                    sx={{ 
                                      height: 20, 
                                      fontSize: '0.7rem', 
                                      bgcolor: stream.source === 'RD' ? 'rgba(255,193,7,0.2)' : 'rgba(255,255,255,0.1)', 
                                      color: stream.source === 'RD' ? '#ffc107' : 'white',
                                      '& .MuiChip-icon': { ml: '5px', mr: '-2px'}
                                    }} 
                                  />
                                )}
                                 {/* HDR/DV indicators */}
                                 {stream.hdr && (
                                   <Chip 
                                     label={stream.dv ? "DV" : "HDR"} 
                                     size="small" 
                                     sx={{ 
                                       height: 20, 
                                       fontSize: '0.7rem', 
                                       bgcolor: stream.dv ? 'rgba(126,87,194,0.2)' : 'rgba(255,160,0,0.2)', // Purple for DV, Orange for HDR
                                       color: stream.dv ? '#7e57c2' : '#ffa000' 
                                     }} 
                                   />
                                 )}
                                 {/* 10bit indicator */}
                                 {stream.is10bit && (
                                   <Chip 
                                     label="10bit" 
                                     size="small" 
                                     sx={{ 
                                       height: 20, 
                                       fontSize: '0.7rem', 
                                       bgcolor: 'rgba(0,150,136,0.2)', // Teal for 10bit
                                       color: '#009688' 
                                     }} 
                                   />
                                 )}
                              </Box>
                              <Box component="div" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mt: 0.5 }}>
                                {/* Format (BluRay, WEB-DL) */}
                                {stream.format && (
                                  <Typography variant="caption" sx={{ color: 'grey.500' }}>{stream.format}</Typography>
                                )}
                                {/* Codec (HEVC, H264) */}
                                {stream.codec && (
                                  <Typography variant="caption" sx={{ color: 'grey.500' }}>{stream.codec}</Typography>
                                )}
                                {/* Audio (Atmos, DTS) */}
                                {stream.audio && (
                                  <Typography variant="caption" sx={{ color: 'grey.500' }}>{stream.audio}</Typography>
                                )}
                                {/* Language */}
                                {stream.language && (
                                  <Typography variant="caption" sx={{ color: 'grey.500' }}>{stream.language}</Typography>
                                )}
                              </Box>
                              <Typography variant="caption" sx={{ color: 'grey.600', fontSize: '0.7rem', mt: 0.5 }}>
                                via {stream.addonName} {stream.release_group && `| ${stream.release_group}`}
                              </Typography>
                              {/* Cached Info Display */}
                              {stream.cachedInfo && (
                                <Typography variant="caption" sx={{ color: '#4caf50', fontSize: '0.7rem', mt: 0.5, display: 'block' }}>
                                  {stream.cachedInfo}
                                </Typography>
                              )}
                              {/* Full Description Display */}
                              {stream.description && (
                                <Typography 
                                  variant="caption" 
                                  component="pre" // Use <pre> to preserve whitespace and line breaks
                                  sx={{ 
                                    color: 'grey.500', 
                                    fontSize: '0.65rem', 
                                    mt: 0.8, 
                                    display: 'block', 
                                    whiteSpace: 'pre-wrap', // Ensure wrapping
                                    wordBreak: 'break-word'  // Ensure long words break
                                  }}
                                >
                                  {stream.description}
                                </Typography>
                              )}
                            </Box>
                          }
                          secondaryTypographyProps={{ component: 'div' }}
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
        </Collapse>
      </DialogContent>

      <DialogActions sx={{ p: 1.5, bgcolor: '#181818' }}>
        <Button onClick={onClose} sx={{ color: 'grey.400' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
} 