'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import PlayArrow from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import Link from 'next/link';
import Alert from '@mui/material/Alert';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Divider from '@mui/material/Divider';
import StreamDialog from '../../../../components/StreamDialog';
import VideocamIcon from '@mui/icons-material/Videocam';
import EpisodeItem from './EpisodeItem';
import Fade from '@mui/material/Fade';
import Grow from '@mui/material/Grow';
import { TransitionProps } from '@mui/material/transitions';
import Zoom from '@mui/material/Zoom';
import Slide from '@mui/material/Slide';
import { useAddonContext } from '@/context/AddonContext';
import { Chip, Paper } from '@mui/material';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';

interface MetaDetails {
  id: string;
  type: string;
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  runtime?: string;
  year?: number;
  genres?: string[];
  director?: string[];
  cast?: string[];
  imdbRating?: string;
  country?: string[];
  language?: string[];
  certification?: string;
  trailer?: string;
  videos?: { id: string; title: string; season?: number; episode?: number }[];
  seasons?: Season[];
}

// Basic metadata we can extract from catalog items
interface BasicMeta {
  id: string;
  type: string;
  name: string;
  poster?: string;
}

// Add episode interfaces
interface Episode {
  id: string;
  title: string;
  overview?: string;
  thumbnail?: string;
  season: number;
  episode: number;
  released?: string;
  runtime?: string;
}

interface Season {
  season: number;
  title?: string;
  episodes: Episode[];
}

// State for the stream dialog target
interface StreamTarget {
  season?: number | null;
  episode?: number | null;
}

// Define the Transition component using Grow
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Grow ref={ref} {...props} timeout={500} />;
});

// After animation duration constant
const ANIMATION_DURATION = 600; // in ms
const HERO_ANIMATION_DURATION = 1000; // Hero animation slightly longer for dramatic effect

// Helper to check if an object looks like a Meta object (basic check)
function hasMinimalProperties(obj: any): obj is Meta {
  return obj && typeof obj.id === 'string' && typeof obj.name === 'string' && typeof obj.type === 'string';
}

// Helper function to enhance image URLs
const getEnhancedImageUrl = (url: string | undefined): string => {
  if (!url) return ''; // Empty string fallback instead of undefined
  
  // Convert metahub background URLs from medium to large
  if (url.includes('images.metahub.space/background/medium/')) {
    return url.replace('/background/medium/', '/background/large/');
  }
  
  // Convert metahub poster URLs from medium to large if needed
  if (url.includes('images.metahub.space/poster/medium/')) {
    return url.replace('/poster/medium/', '/poster/large/');
  }
  
  // Convert metahub logo URLs from medium to large if needed
  if (url.includes('images.metahub.space/logo/medium/')) {
    return url.replace('/logo/medium/', '/logo/large/');
  }
  
  return url;
};

interface Meta {
    id: string;
    type: 'movie' | 'series' | string;
    name: string;
    poster?: string;
    background?: string;
    description?: string;
    director?: string | string[];
    cast?: string[];
    runtime?: string;
    releaseInfo?: string; // Year
    imdbRating?: string;
    genres?: string[];
    logo?: string;
    videos?: { id: string; title: string; season?: number; episode?: number }[];
    streams?: any[];
    seasons?: Season[];
    certification?: string;
    country?: string[];
    language?: string[];
    trailer?: string;
}

export default function DetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { type: routeType, id } = params;
  const sourceAddonId = searchParams.get('addonId');
  const { 
    installedAddons, 
    isLoading: isLoadingAddons, 
    error: addonContextError,
    getAddonById // Get the function from context
  } = useAddonContext(); // Use context
  
  // Type assertion/guard for route params
  const type = typeof routeType === 'string' ? routeType : '';

  const [details, setDetails] = useState<Meta | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [partialMetadata, setPartialMetadata] = useState<boolean>(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState<boolean>(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([]);
  
  // State for Stream Dialog
  const [isStreamDialogOpen, setIsStreamDialogOpen] = useState(false);
  const [streamTarget, setStreamTarget] = useState<StreamTarget | null>(null);
  
  // Animation states
  const [contentLoaded, setContentLoaded] = useState(false);
  
  const getCatalogUniqueId = (catalog: { type: string; id: string }) => `${catalog.type}/${catalog.id}`;

  // --- Restore fetchSeasons function --- 
  const fetchSeasons = useCallback(async (addonBaseUrl: string, seriesType: string, seriesId: string): Promise<number[]> => {
    try {
      const metaUrl = `${addonBaseUrl}/meta/${seriesType}/${seriesId}.json`;
      console.log(`DetailsPage (Seasons): Trying meta endpoint: ${metaUrl}`);
      const response = await fetch(metaUrl);
      if (response.ok) {
        const data = await response.json();
        if (data && data.meta && Array.isArray(data.meta.videos)) {
          const seasonNumbersSet = new Set<number>();
          data.meta.videos.forEach((video: any) => {
            if (video.season !== undefined && video.season !== null) {
              const seasonNum = Number(video.season);
              if (!isNaN(seasonNum)) seasonNumbersSet.add(seasonNum);
            }
          });
          const seasonNumbers = Array.from(seasonNumbersSet).sort((a, b) => a - b);
          if (seasonNumbers.length > 0) {
            console.log(`DetailsPage (Seasons): Found seasons in meta:`, seasonNumbers);
            setAvailableSeasons(seasonNumbers);
            return seasonNumbers;
          }
        }
      }
      // Fallback (you might have other legacy endpoints)
      console.log(`DetailsPage (Seasons): Meta endpoint didn't yield seasons, assuming season 1.`);
      setAvailableSeasons([1]);
      return [1]; 
    } catch (err) {
      console.error(`DetailsPage (Seasons): Error fetching seasons for ${seriesId}:`, err);
      setAvailableSeasons([1]); // Default fallback
      return [1];
    }
  }, []); // Empty dependency array, relies on arguments

  // --- Restore fetchEpisodes function ---
  const fetchEpisodes = useCallback(async (addonBaseUrl: string, seriesType: string, seriesId: string, season: number) => {
    setLoadingEpisodes(true);
    setEpisodesError(null);
    setEpisodes([]); // Clear previous episodes
    try {
      const metaSeasonUrl = `${addonBaseUrl}/meta/${seriesType}/${seriesId}/season=${season}.json`;
      console.log(`DetailsPage (Episodes): Fetching episodes from: ${metaSeasonUrl}`);
      const response = await fetch(metaSeasonUrl);
      if (!response.ok) throw new Error(`HTTP error ${response.status} fetching episodes from ${metaSeasonUrl}`);
      
      const data = await response.json();
      let fetchedEpData: Episode[] = [];

      if (data?.meta?.episodes) {
          fetchedEpData = data.meta.episodes.map((ep: any): Episode => ({
            id: ep.id || `${seriesId}-s${season}-e${ep.episode || 0}`,
            title: ep.title || ep.name || `Episode ${ep.episode || 0}`,
            overview: ep.overview || ep.description || '',
            thumbnail: ep.thumbnail || ep.poster || '',
            season: season,
            episode: ep.episode || ep.number || 0,
            released: ep.released || ep.air_date || '',
            runtime: ep.runtime || ep.duration || ''
          }));
      } else if (data?.meta?.videos) { // Check videos array as fallback
           fetchedEpData = data.meta.videos
            .filter((v: any) => v.season === season || (season === 1 && v.season === undefined)) // Filter by season
            .map((v: any): Episode => ({ 
              id: v.id || `${seriesId}-s${season}-e${v.episode || 0}`,
              title: v.title || v.name || `Episode ${v.episode || 0}`,
              overview: v.overview || v.description || '',
              thumbnail: v.thumbnail || v.poster || '',
              season: season,
              episode: v.episode || v.number || 0,
              released: v.released || '',
              runtime: v.runtime || ''
            }));
      }
      
      if (fetchedEpData.length > 0) {
          console.log(`DetailsPage (Episodes): Successfully fetched ${fetchedEpData.length} episodes for S${season}.`);
          setEpisodes(fetchedEpData);
      } else {
          console.warn(`DetailsPage (Episodes): No episodes found in response for S${season}.`);
          setEpisodesError('No episode information available for this season.');
      }

    } catch (err: any) {
      console.error(`DetailsPage (Episodes): Error fetching episodes for ${seriesId} S${season}:`, err);
      setEpisodesError(err.message || 'Failed to load episodes for this season');
    } finally {
      setLoadingEpisodes(false);
    }
  }, []); // Empty dependency array, relies on arguments

  // --- Main useEffect to fetch DETAILS --- 
  useEffect(() => {
    if (!id || !type) {
      setPageError('Missing item ID or type.');
      setLoadingDetails(false);
      return;
    }
    
    // Wait for addons context to finish loading
    if (isLoadingAddons) {
        setLoadingDetails(true); 
        return;
    }

    // Handle case where no addons are installed (after context load finished)
    if (!installedAddons || installedAddons.length === 0) {
        setPageError("No addons installed to fetch details.");
        setLoadingDetails(false);
        return;
    }

    // Reflect addon context errors
    if (addonContextError) {
        setPageError(`Addon Context Error: ${addonContextError}`);
        // Optionally, still try to fetch if some addons might work?
        // For now, we block fetching if the context itself had issues loading.
        // setLoadingDetails(false); 
        // return;
    }

    const fetchDetailsAndMaybeSeasons = async () => {
      setLoadingDetails(true);
      setPageError(null); // Clear previous page-specific errors
      setPartialMetadata(false);
      setDetails(null);
      // setStreams([]); // Streams are fetched later

      let fetchedDetails: Meta | null = null;
      // let fetchedStreams: Stream[] = []; // Streams state managed separately
      let detailFetchError: string | null = null;
      // let streamFetchError: string | null = null; // Streams error state managed separately
      let triedBasicMeta = false;

      // --- Prioritize Addons ---
      const prioritizedAddons = [...installedAddons];
      if (sourceAddonId) {
          const sourceIndex = prioritizedAddons.findIndex(a => a.id === sourceAddonId);
          if (sourceIndex > 0) {
              const [sourceAddon] = prioritizedAddons.splice(sourceIndex, 1);
              prioritizedAddons.unshift(sourceAddon);
              console.log(`DetailsPage: Prioritizing source addon: ${sourceAddon.name}`);
          }
      }
      // --- End Prioritize Addons ---

      if (prioritizedAddons.length === 0) {
          setPageError("No suitable addons found to fetch details.");
          setLoadingDetails(false);
          return;
      }

      // 1. Fetch Full Metadata
      console.log(`DetailsPage: Fetching details for ${type} ${id} from ${prioritizedAddons.length} addons.`);
      let partialMeta: Meta | null = null;
      for (const addon of prioritizedAddons) {
        // Skip if addon has no meta resource defined or doesn't support the type
        const providesMeta = addon.resources?.some(resource => 
            (typeof resource === 'string' && resource === 'meta') ||
            (typeof resource === 'object' && resource.name === 'meta' && (!resource.types || resource.types.includes(type)))
        );
        if (!providesMeta) {
            console.log(`DetailsPage: Skipping meta fetch for ${addon.name} (doesn't provide meta for type ${type})`);
            continue;
        }

        try {
          const manifestUrlParts = addon.manifestUrl.split('/');
          manifestUrlParts.pop();
          const baseUrl = manifestUrlParts.join('/');
          const metaUrl = `${baseUrl}/meta/${type}/${id}.json`;
          console.log(`DetailsPage: Trying meta endpoint: ${metaUrl}`);
          
          const response = await fetch(metaUrl);
          if (!response.ok) {
            console.warn(`DetailsPage: Failed meta fetch from ${addon.name} (${metaUrl}): ${response.statusText}`);
            continue; 
          }
          
          const data = await response.json(); // Expecting StremioMetaResponse structure
          
          if (data && data.meta && hasMinimalProperties(data.meta)) {
             console.log(`DetailsPage: Received meta from ${addon.name}`);
             const currentMeta = data.meta as Meta; // Type assertion

             // Prioritize complete metadata (has description and some visual)
             if (currentMeta.description && (currentMeta.poster || currentMeta.background)) {
               fetchedDetails = currentMeta;
               console.log(`DetailsPage: Found complete metadata from ${addon.name}.`);
               break; // Found good details, stop searching meta
             }
             // Store the best partial metadata found so far
             else if (!partialMeta || 
                      (!partialMeta.description && currentMeta.description) || 
                      (!partialMeta.background && currentMeta.background) ||
                      (!partialMeta.poster && currentMeta.poster) ) 
             {
                console.log(`DetailsPage: Storing partial metadata from ${addon.name}.`);
                partialMeta = currentMeta;
             }
          } else {
             console.warn(`DetailsPage: Invalid or empty meta received from ${addon.name} (${metaUrl})`, data);
          }
        } catch (addonError) {
          console.error(`DetailsPage: Error fetching meta from addon ${addon.name}:`, addonError);
        }
      }

      // If no full details found, use the best partial match or try basic extraction
      if (!fetchedDetails) {
          if (partialMeta) {
              console.log("DetailsPage: Using best partial metadata found.");
              fetchedDetails = partialMeta;
              setPartialMetadata(true);
          } else {
              // --- Try extracting basic info as a last resort ---
              console.log("DetailsPage: No full/partial meta found, attempting basic info extraction from catalogs.");
              triedBasicMeta = true;
              let basicInfo: BasicMeta | null = null;
              // Use prioritizedAddons here as well
              for (const addon of prioritizedAddons) {
                const addonCatalogs = addon.catalogs || [];
                const selectedIds = addon.selectedCatalogIds || addonCatalogs.map(getCatalogUniqueId);
                const filteredCatalogs = addonCatalogs.filter(
                  (catalog) => catalog.type === type && selectedIds.includes(getCatalogUniqueId(catalog))
                );
                
                if (filteredCatalogs.length === 0) continue;
                const manifestUrlParts = addon.manifestUrl.split('/');
                manifestUrlParts.pop();
                const baseUrl = manifestUrlParts.join('/');
                
                for (const catalog of filteredCatalogs) {
                  try {
                    const catalogUrl = `${baseUrl}/catalog/${catalog.type}/${catalog.id}.json`;
                    const response = await fetch(catalogUrl);
                    if (!response.ok) continue;
                    const data = await response.json();
                    if (data && Array.isArray(data.metas)) {
                      const item = data.metas.find((meta: any) => meta.id === id);
                      if (item && item.name && item.id && item.type) { // Basic check
                        basicInfo = {
                          id: item.id, type: item.type, name: item.name, poster: item.poster
                        };
                        console.log(`DetailsPage: Extracted basic info from ${addon.name}/${catalog.id}`);
                        break; 
                      }
                    }
                  } catch (err) { console.warn(`DetailsPage: Error checking catalog ${addon.name}/${catalog.id} for basic info:`, err); }
                }
                if (basicInfo) break; 
              }
              // --- End basic info extraction ---
              if (basicInfo) {
                  console.log("DetailsPage: Using extracted basic metadata.");
                  // Create a minimal Meta object from BasicMeta
                  fetchedDetails = { ...basicInfo, type: basicInfo.type as 'movie' | 'series' }; 
                  setPartialMetadata(true); // Mark as partial
              } else {
                   detailFetchError = "Could not find metadata for this item from any installed addon.";
              }
          }
      }

      // --- Streams are fetched separately now, typically via StreamDialog ---
      // // 2. Fetch Streams (only if metadata was found)
      // if (fetchedDetails) { ... stream fetching logic removed ... }

      // 3. Update State
      setDetails(fetchedDetails); // Set final details (could be full, partial, or basic)
      setPageError(detailFetchError); // Set page error only if detail fetching failed completely
      setLoadingDetails(false);

      // --- If details found AND it's a series, fetch available seasons ---
      if (fetchedDetails && fetchedDetails.type === 'series') {
          // Find the addon that provided the details to get its base URL
          let addonUsedForDetails: any = null;
          if (sourceAddonId) addonUsedForDetails = getAddonById(sourceAddonId);
          if (!addonUsedForDetails) { // Fallback if source ID missing or addon not found
             // Heuristic: assume the first addon in the list provided it, or find based on fetchedDetails content if possible
             // This is imperfect; ideally, the fetching loop would return which addon succeeded.
             addonUsedForDetails = prioritizedAddons[0]; 
          }

          if (addonUsedForDetails) {
              const manifestUrlParts = addonUsedForDetails.manifestUrl.split('/');
              manifestUrlParts.pop();
              const baseUrl = manifestUrlParts.join('/');
              console.log(`DetailsPage: Fetching seasons using base URL from addon: ${addonUsedForDetails.name}`);
              await fetchSeasons(baseUrl, fetchedDetails.type, fetchedDetails.id);
          } else {
              console.warn("DetailsPage: Could not determine addon base URL to fetch seasons.");
              setAvailableSeasons([1]); // Default fallback
          }
      } else {
          // Not a series or no details found, clear seasons/episodes state
          setAvailableSeasons([]);
          setEpisodes([]);
      }
    };

    fetchDetailsAndMaybeSeasons();

    // Clean up function (optional)
    return () => {
        // Cancel any ongoing fetches if necessary
    };

  }, [id, type, sourceAddonId, installedAddons, isLoadingAddons, addonContextError, getAddonById, fetchSeasons]); // Added fetchSeasons

  // --- useEffect to fetch EPISODES when season changes or details load ---
  useEffect(() => {
    if (details && details.type === 'series' && availableSeasons.length > 0) {
        // Ensure selectedSeason is valid
        const seasonToFetch = availableSeasons.includes(selectedSeason) ? selectedSeason : availableSeasons[0];
        if (selectedSeason !== seasonToFetch) {
            setSelectedSeason(seasonToFetch); // Correct the selected season if invalid
        }

        // Find addon base URL again (similar logic as above)
        let addonUsedForDetails: any = null;
        if (sourceAddonId) addonUsedForDetails = getAddonById(sourceAddonId);
        if (!addonUsedForDetails) { 
            addonUsedForDetails = installedAddons.find(a => a.id === details.id.split(':')[0]); // Try to guess from meta ID prefix
            if (!addonUsedForDetails) addonUsedForDetails = installedAddons[0]; // Last resort
        }

        if (addonUsedForDetails) {
            const manifestUrlParts = addonUsedForDetails.manifestUrl.split('/');
            manifestUrlParts.pop();
            const baseUrl = manifestUrlParts.join('/');
            console.log(`DetailsPage: Fetching episodes for S${seasonToFetch} using base URL from addon: ${addonUsedForDetails.name}`);
            fetchEpisodes(baseUrl, details.type, details.id, seasonToFetch);
        } else {
            console.error("DetailsPage: Could not determine addon base URL to fetch episodes.");
            setEpisodesError("Could not determine addon source for episodes.");
        }
    }
  }, [details, selectedSeason, availableSeasons, installedAddons, sourceAddonId, getAddonById, fetchEpisodes]); // Dependencies

  // --- Other useEffects (Animation) ---
  useEffect(() => {
    if (details) { // Animate when details (even partial) are ready
      const timer = setTimeout(() => setContentLoaded(true), 100);
      return () => clearTimeout(timer);
    }
  }, [details]);

  // --- Event Handlers ---
  const openStreamDialog = (target: StreamTarget) => {
    setStreamTarget(target);
    setIsStreamDialogOpen(true);
  };

  const handlePlayClick = () => { // Main play button
    if (!details) return;
    if (details.type === 'series') {
      const targetSeason = availableSeasons.includes(selectedSeason) ? selectedSeason : (availableSeasons[0] || 1);
      const firstEpisodeNum = episodes.length > 0 ? episodes[0].episode : 1;
      openStreamDialog({ season: targetSeason, episode: firstEpisodeNum });
    } else {
      openStreamDialog({}); // Movie
    }
  };

  const handleEpisodeClick = (episode: Episode) => {
    openStreamDialog({ season: episode.season, episode: episode.episode });
  };

  // --- Display Logic ---
  // ... loading/error checks ...

  // Need to calculate this before the return statement
  const episodesToDisplay = episodes; // Use the fetched episodes state directly
  const showEpisodesSection = details && details.type === 'series'; // Show if it's a series

  if (!details) { /* ... handle loading or error states ... */ return null; }

  // --- Render Details --- 
  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#141414',
      color: 'white',
      position: 'relative'
    }}>
      {/* Background Image with Animation */}
      <Fade 
        in={true} // Always animate in
        timeout={HERO_ANIMATION_DURATION} 
        appear={true} // Animate on first render
      >
        <Box sx={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          height: { xs: '70vh', md: '80vh' }, 
          zIndex: 0,
          overflow: 'hidden', // Ensure image doesn't spill out
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '75%',
            backgroundImage: 'linear-gradient(to top, #141414, transparent)',
            opacity: contentLoaded ? 1 : 0, // Fade in gradient with content
            transition: 'opacity 1.2s ease-in-out'
          }
        }}>
          {details?.background ? (
            <Box sx={{ 
              width: '100%', 
              height: '100%', 
              position: 'relative',
              transform: contentLoaded ? 'scale(1)' : 'scale(1.05)',
              transition: 'transform 1.5s ease-out',
            }}>
              <Image
                src={getEnhancedImageUrl(details.background)}
                alt={details.name || ''}
                layout="fill"
                objectFit="cover"
                priority
                quality={90}
                sizes="100vw"
                loading="eager"
              />
            </Box>
          ) : details?.poster ? (
            <Box sx={{ 
              width: '100%', 
              height: '100%', 
              position: 'relative',
              transform: contentLoaded ? 'scale(1)' : 'scale(1.05)',
              transition: 'transform 1.5s ease-out',
            }}>
              <Image
                src={getEnhancedImageUrl(details.poster)}
                alt={details.name || ''}
                layout="fill"
                objectFit="cover"
                priority
                quality={90}
                sizes="100vw"
                loading="eager"
                style={{ filter: 'blur(8px) brightness(0.7)' }}
              />
            </Box>
          ) : null}
        </Box>
      </Fade>
      
      {/* Content */}
      <Box sx={{ 
        position: 'relative', 
        zIndex: 1,
        pt: { xs: '35vh', md: '40vh' },
        px: { xs: 3, md: 7.5 },
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1
      }}>
        {/* Title or Logo with Fade animation */}
        <Fade in={contentLoaded} timeout={ANIMATION_DURATION} style={{ transitionDelay: '100ms' }}>
          <Box>
            {details?.logo ? (
              <Box sx={{ 
                mb: 3, 
                maxWidth: { xs: '70%', sm: '60%', md: '50%', lg: '40%' }
              }}>
                <Image 
                  src={getEnhancedImageUrl(details.logo)}
                  alt={details.name || 'Title logo'}
                  width={500}
                  height={150}
                  layout="responsive"
                  priority
                  quality={95}
                  loading="eager"
                />
              </Box>
            ) : (
              <Typography 
                variant="h2" 
                component="h1" 
                sx={{ 
                  fontWeight: 'bold', 
                  fontSize: { xs: '2rem', sm: '3rem', md: '4rem' },
                  textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                  mb: 2
                }}
              >
                {details?.name || 'Untitled'}
              </Typography>
            )}
          </Box>
        </Fade>
        
        {/* Partial data warning */}
        {partialMetadata && !pageError && (
          <Fade in={contentLoaded} timeout={ANIMATION_DURATION} style={{ transitionDelay: '200ms' }}>
            <Alert severity="info" sx={{ mb: 3, backgroundColor: '#333', color: 'white' }}>
              Displaying partial information. Some details like description or background might be missing.
            </Alert>
          </Fade>
        )}
        
        {/* Meta info row */}
        <Fade in={contentLoaded} timeout={ANIMATION_DURATION} style={{ transitionDelay: '300ms' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, alignItems: 'center' }}>
            {details.releaseInfo && (
              <Typography variant="body1" sx={{ color: 'grey.300' }}>
                {details.releaseInfo}
              </Typography>
            )}
            
            {details.certification && (
              <Box sx={{ 
                border: '1px solid grey.500', 
                px: 1, 
                borderRadius: '4px',
                backgroundColor: 'rgba(0,0,0,0.3)'
              }}>
                <Typography variant="body2">
                  {details.certification}
                </Typography>
              </Box>
            )}
            
            {details.runtime && (
              <Typography variant="body1" sx={{ color: 'grey.300' }}>
                {details.runtime}
              </Typography>
            )}
            
            {details.imdbRating && (
              <Typography variant="body1" sx={{ color: '#f5c518', fontWeight: 'bold' }}>
                ★ {details.imdbRating}
              </Typography>
            )}
          </Box>
        </Fade>
        
        {/* Action buttons */}
        <Fade in={contentLoaded} timeout={ANIMATION_DURATION} style={{ transitionDelay: '400ms' }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
            <Button 
              variant="contained"
              startIcon={<PlayArrow />}
              onClick={handlePlayClick}
              sx={{ 
                backgroundColor: 'white', 
                color: 'black',
                fontWeight: 'bold',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.75)' }
              }}
            >
              Play
            </Button>
            
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              sx={{ 
                backgroundColor: 'rgba(133,133,133,0.6)', 
                color: 'white',
                '&:hover': { backgroundColor: 'rgba(133,133,133,0.4)' }
              }}
            >
              My List
            </Button>
            
            <Box sx={{ 
              width: '40px', 
              height: '40px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundColor: 'rgba(42,42,42,0.6)',
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(42,42,42,0.4)' }
            }}>
              <VolumeOffIcon />
            </Box>
          </Box>
        </Fade>
        
        {/* Description */}
        <Fade in={contentLoaded} timeout={ANIMATION_DURATION} style={{ transitionDelay: '500ms' }}>
          <Box sx={{ maxWidth: '50rem', mb: 5 }}>
            <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.6 }}>
              {details.description || 'No description available'}
            </Typography>
            
            {/* Additional metadata */}
            {(!!details.cast?.length || !!details.director || !!details.genres?.length) && (
              <Box sx={{ mt: 3 }}>
                {details.cast && details.cast.length > 0 && (
                  <Box sx={{ mb: 1, display: 'flex' }}>
                    <Typography variant="body2" sx={{ color: 'grey.500', minWidth: '120px' }}>
                      Cast:
                    </Typography>
                    <Typography variant="body2">
                      {details.cast.slice(0, 5).join(', ')}
                      {details.cast.length > 5 ? ', ...' : ''}
                    </Typography>
                  </Box>
                )}
                
                {details.director && (
                  <Box sx={{ mb: 1, display: 'flex' }}>
                    <Typography variant="body2" sx={{ color: 'grey.500', minWidth: '120px' }}>
                      Director:
                    </Typography>
                    <Typography variant="body2">
                      {Array.isArray(details.director) ? details.director.join(', ') : details.director}
                    </Typography>
                  </Box>
                )}
                
                {details.genres && details.genres.length > 0 && (
                  <Box sx={{ mb: 1, display: 'flex' }}>
                    <Typography variant="body2" sx={{ color: 'grey.500', minWidth: '120px' }}>
                      Genres:
                    </Typography>
                    <Typography variant="body2">
                      {details.genres.join(', ')}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Fade>
        
        {/* Episodes Section */}
        {showEpisodesSection && (
          <Slide direction="up" in={contentLoaded} timeout={ANIMATION_DURATION} style={{ transitionDelay: '600ms' }}>
            <Box sx={{ width: '100%', mb: 8 }}>
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold' }}>
                  Episodes
                </Typography>
                
                {availableSeasons.length > 1 && (
                  <FormControl 
                    variant="outlined" 
                    size="small" 
                    sx={{ 
                      minWidth: 120, 
                      '.MuiOutlinedInput-root': {
                        color: 'white',
                        borderColor: 'grey.700',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                      }
                    }}
                  >
                    <Select
                      value={selectedSeason}
                      onChange={(e) => setSelectedSeason(Number(e.target.value))}
                      sx={{ 
                        color: 'white',
                        '.MuiOutlinedInput-notchedOutline': { borderColor: 'grey.700' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'grey.400' },
                        '.MuiSvgIcon-root': { color: 'white' } 
                      }}
                    >
                      {availableSeasons.map(seasonNum => (
                        <MenuItem key={seasonNum} value={seasonNum}>
                          Season {seasonNum}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
              
              <Divider sx={{ borderColor: 'grey.800', mb: 2 }} />
              
              {loadingEpisodes ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress color="inherit" size={32} />
                </Box>
              ) : episodesToDisplay.length > 0 ? (
                <Box>
                  {episodesToDisplay.map((episode, index) => (
                    <Zoom key={episode.id || index} in={contentLoaded} style={{ transitionDelay: `${700 + index * 50}ms` }} timeout={ANIMATION_DURATION}>
                      <div> {/* Wrapper div required for Zoom */} 
                        <EpisodeItem 
                          episode={episode} 
                          onClick={() => handleEpisodeClick(episode)} 
                        />
                      </div>
                    </Zoom>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: 'grey.400', fontStyle: 'italic', p:2 }}>
                  {episodesError || 'Episode list not available for this season.'}
                </Typography>
              )}
            </Box>
          </Slide>
        )}
        
        {/* More Like This section */}
        <Fade in={contentLoaded} timeout={ANIMATION_DURATION} style={{ transitionDelay: '800ms' }}>
          <Box sx={{ 
            mb: 8,
            mt: 'auto',
            pt: 5
          }}>
            <Typography variant="h5" component="h2" sx={{ mb: 3, fontWeight: 'bold' }}>
              More Like This
            </Typography>
            
            <Typography variant="body2" sx={{ color: 'grey.400', fontStyle: 'italic' }}>
              Similar content recommendations will appear here
            </Typography>
          </Box>
        </Fade>
      </Box>
      
      {/* Render the Stream Dialog with Grow transition */}
      <Grow in={isStreamDialogOpen} timeout={500}> 
        <div>
          <StreamDialog
            open={isStreamDialogOpen}
            onClose={() => setIsStreamDialogOpen(false)}
            TransitionComponent={Transition}
            keepMounted
            contentType={String(type)}
            contentId={String(id)}
            season={streamTarget?.season}
            episode={streamTarget?.episode}
            contentName={details?.name}
            initialAddonId={sourceAddonId}
          />
        </div>
      </Grow>
    </Box>
  );
} 