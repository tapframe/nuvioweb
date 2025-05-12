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
  title: string;
  episodes: Episode[];
}

// State for the stream dialog target
interface StreamTarget {
  season?: number | null;
  episode?: number | null;
}

export default function DetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { type, id } = params;
  const addonId = searchParams.get('addonId');
  
  const [details, setDetails] = useState<MetaDetails | null>(null);
  const [basicDetails, setBasicDetails] = useState<BasicMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partialMetadata, setPartialMetadata] = useState<boolean>(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState<boolean>(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([]);
  
  // State for Stream Dialog
  const [isStreamDialogOpen, setIsStreamDialogOpen] = useState(false);
  const [streamTarget, setStreamTarget] = useState<StreamTarget | null>(null);
  
  // Helper function to check if an object has minimal required properties
  const hasMinimalProperties = (obj: any): boolean => {
    return obj && typeof obj === 'object' && 
           'id' in obj && 'type' in obj && 'name' in obj;
  };
  
  // Try to find basic metadata in catalogs if available
  const tryExtractBasicMetaFromCatalogs = async () => {
    try {
      const storedData = localStorage.getItem('installedAddons');
      if (!storedData) return null;
      
      const loadedAddons = JSON.parse(storedData);
      const addonsToCheck = addonId 
        ? loadedAddons.filter((addon: any) => addon.id === addonId)
        : loadedAddons;
        
      if (addonsToCheck.length === 0) return null;
      
      // Check catalogs from each addon to see if we can find this item
      for (const addon of addonsToCheck) {
        const addonCatalogs = addon.catalogs || [];
        const selectedIds = addon.selectedCatalogIds || [];
        const filteredCatalogs = addonCatalogs.filter(
          (catalog: any) => catalog.type === type && selectedIds.includes(`${catalog.type}/${catalog.id}`)
        );
        
        // Extract base URL
        const manifestUrlParts = addon.manifestUrl.split('/');
        manifestUrlParts.pop();
        const baseUrl = manifestUrlParts.join('/');
        
        // Check each catalog
        for (const catalog of filteredCatalogs) {
          try {
            const catalogUrl = `${baseUrl}/catalog/${catalog.type}/${catalog.id}.json`;
            const response = await fetch(catalogUrl);
            if (!response.ok) continue;
            
            const data = await response.json();
            if (data && Array.isArray(data.metas)) {
              // Find the item with matching ID
              const item = data.metas.find((meta: any) => meta.id === id);
              if (item && hasMinimalProperties(item)) {
                return {
                  id: item.id,
                  type: item.type || type,
                  name: item.name,
                  poster: item.poster
                };
              }
            }
          } catch (err) {
            console.warn(`Error checking catalog for basic meta:`, err);
          }
        }
      }
      
      return null;
    } catch (err) {
      console.error("Error extracting basic meta:", err);
      return null;
    }
  };
  
  // Function to fetch episodes data from addons
  const fetchEpisodes = useCallback(async (addonBaseUrl: string, seriesType: string, seriesId: string, season: number) => {
    setLoadingEpisodes(true);
    setEpisodesError(null);
    
    try {
      // Use the exact format provided: meta/series/tt0944947/season=1.json
      const metaSeasonUrl = `${addonBaseUrl}/meta/${seriesType}/${seriesId}/season=${season}.json`;
      console.log(`Fetching episodes using correct meta endpoint: ${metaSeasonUrl}`);
      
      const response = await fetch(metaSeasonUrl);
      
      if (response.ok) {
        const data = await response.json();
        
        // Process the response data - **Check inside data.meta**
        if (data && data.meta && data.meta.episodes) {
          // Direct episodes array inside meta
          const formattedEpisodes = data.meta.episodes.map((ep: any) => ({
            id: ep.id || `${seriesId}-s${season}-e${ep.episode || 0}`,
            title: ep.title || ep.name || `Episode ${ep.episode || 0}`,
            overview: ep.overview || ep.description || ep.synopsis || '',
            thumbnail: ep.thumbnail || ep.poster || '',
            season: season,
            episode: ep.episode || ep.number || 0,
            released: ep.released || ep.air_date || ep.releaseInfo || '',
            runtime: ep.runtime || ep.duration || ''
          }));
          
          setEpisodes(formattedEpisodes);
          return formattedEpisodes;
        } else if (data && data.meta && data.meta.videos) {
          // Videos array format inside meta
          const videoEpisodes = data.meta.videos
            .filter((v: any) => v.season === season || v.season === undefined) // Keep filtering by season if present
            .map((v: any) => ({
              id: v.id || `${seriesId}-s${season}-e${v.episode || 0}`,
              title: v.title || v.name || `Episode ${v.episode || 0}`,
              overview: v.overview || v.description || '',
              thumbnail: v.thumbnail || v.poster || '',
              season: season,
              episode: v.episode || v.number || 0, // Use v.number as fallback for episode number
              released: v.released || '',
              runtime: v.runtime || ''
            }));
            
          setEpisodes(videoEpisodes);
          return videoEpisodes;
        } else if (data && Array.isArray(data.metas)) {
          // Some addons might return a metas array directly (less common)
          const episodesMetas = data.metas
            .filter((m: any) => (m.type === 'episode' || m.episode) && (m.season === season || m.season === undefined))
            .map((m: any) => ({
              id: m.id || `${seriesId}-s${season}-e${m.episode || 0}`,
              title: m.name || m.title || `Episode ${m.episode || 0}`,
              overview: m.overview || m.description || '',
              thumbnail: m.poster || m.thumbnail || '',
              season: season,
              episode: m.episode || 0,
              released: m.releaseInfo || '',
              runtime: m.runtime || ''
            }));
            
          if (episodesMetas.length > 0) {
            setEpisodes(episodesMetas);
            return episodesMetas;
          }
        }
      }
      
      // Try the older formats as fallbacks
      console.log('Meta endpoint failed or did not contain episodes, trying legacy formats...');
      
      // Legacy format 1
      const episodesUrl = `${addonBaseUrl}/series/${seriesId}/seasons/${season}/episodes.json`;
      console.log(`Trying legacy format: ${episodesUrl}`);
      
      const legacyResponse = await fetch(episodesUrl);
      
      if (!legacyResponse.ok) {
        // Legacy format 2
        const alternativeUrl = `${addonBaseUrl}/episodes/${seriesId}/${season}.json`;
        console.log(`Trying alternative episodes URL: ${alternativeUrl}`);
        
        const alternativeResponse = await fetch(alternativeUrl);
        
        if (!alternativeResponse.ok) {
          throw new Error(`Failed to fetch episodes data from any known format`);
        }
        
        const data = await alternativeResponse.json();
        
        if (data && Array.isArray(data.episodes)) {
          const formattedEpisodes = data.episodes.map((ep: any) => ({
            id: ep.id || `${seriesId}-s${season}-e${ep.episode || 0}`,
            title: ep.title || ep.name || `Episode ${ep.episode || 0}`,
            overview: ep.overview || ep.description || ep.synopsis || '',
            thumbnail: ep.thumbnail || ep.poster || '',
            season: season,
            episode: ep.episode || ep.number || 0,
            released: ep.released || ep.air_date || ep.releaseInfo || '',
            runtime: ep.runtime || ep.duration || ''
          }));
          
          setEpisodes(formattedEpisodes);
          return formattedEpisodes;
        }
      } else {
        const data = await legacyResponse.json();
        
        if (data && Array.isArray(data.episodes)) {
          const formattedEpisodes = data.episodes.map((ep: any) => ({
            id: ep.id || `${seriesId}-s${season}-e${ep.episode || 0}`,
            title: ep.title || ep.name || `Episode ${ep.episode || 0}`,
            overview: ep.overview || ep.description || ep.synopsis || '',
            thumbnail: ep.thumbnail || ep.poster || '',
            season: season,
            episode: ep.episode || ep.number || 0,
            released: ep.released || ep.air_date || ep.releaseInfo || '',
            runtime: ep.runtime || ep.duration || ''
          }));
          
          setEpisodes(formattedEpisodes);
          return formattedEpisodes;
        }
      }
      
      throw new Error('No valid episodes data found in any format');
    } catch (err: any) {
      console.error(`Error fetching episodes for ${seriesId} season ${season}:`, err);
      setEpisodesError(err.message || 'Failed to load episodes');
      return null;
    } finally {
      setLoadingEpisodes(false);
    }
  }, []);

  // Function to fetch seasons data and determine available seasons
  const fetchSeasons = useCallback(async (addonBaseUrl: string, seriesType: string, seriesId: string) => {
    try {
      // First try to get data from the meta endpoint which should contain videos
      const metaUrl = `${addonBaseUrl}/meta/${seriesType}/${seriesId}.json`;
      console.log(`Trying to extract seasons from meta endpoint: ${metaUrl}`);
      
      const response = await fetch(metaUrl);
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if we have videos in the meta object
        if (data && data.meta && Array.isArray(data.meta.videos)) {
          // Extract unique season numbers from videos array as explicit numbers
          const seasonNumbers: number[] = [];
          
          data.meta.videos.forEach((video: any) => {
            if (video.season !== undefined && video.season !== null) {
              const seasonNum = Number(video.season);
              if (!isNaN(seasonNum) && !seasonNumbers.includes(seasonNum)) {
                seasonNumbers.push(seasonNum);
              }
            }
          });
          
          // Sort the season numbers
          seasonNumbers.sort((a, b) => a - b);
          
          if (seasonNumbers.length > 0) {
            console.log(`Found ${seasonNumbers.length} seasons in meta data:`, seasonNumbers);
            setAvailableSeasons(seasonNumbers);
            return seasonNumbers;
          }
        }
      }
      
      // Fallback to direct seasons endpoint
      const seasonsUrl = `${addonBaseUrl}/series/${seriesId}/seasons.json`;
      console.log(`Fetching seasons from: ${seasonsUrl}`);
      
      const seasonsResponse = await fetch(seasonsUrl);
      
      if (seasonsResponse.ok) {
        const data = await seasonsResponse.json();
        
        if (data && Array.isArray(data.seasons)) {
          const seasonNumbers: number[] = [];
          
          data.seasons.forEach((season: any) => {
            const seasonNum = Number(season.season || season.number || 1);
            if (!isNaN(seasonNum) && !seasonNumbers.includes(seasonNum)) {
              seasonNumbers.push(seasonNum);
            }
          });
          
          seasonNumbers.sort((a, b) => a - b);
          
          console.log(`Found ${seasonNumbers.length} seasons:`, seasonNumbers);
          setAvailableSeasons(seasonNumbers);
          return seasonNumbers;
        }
      }
      
      // Default to at least season 1
      console.log('No seasons data found, defaulting to season 1');
      setAvailableSeasons([1]);
      return [1];
    } catch (err) {
      console.error(`Error fetching seasons for ${seriesId}:`, err);
      setAvailableSeasons([1]);
      return [1];
    }
  }, []);
  
  // Effect to fetch episodes when season changes or when details are loaded
  useEffect(() => {
    if (details && details.type === 'series') {
      // Get addon base URL from any matched addon
      const getAddonBaseUrl = async () => {
        const storedData = localStorage.getItem('installedAddons');
        if (!storedData) return null;
        
        const loadedAddons = JSON.parse(storedData);
        
        // Prioritize the specific addon if addonId is provided
        const prioritizedAddons = [...loadedAddons];
        if (addonId) {
          const addonIndex = prioritizedAddons.findIndex(a => a.id === addonId);
          if (addonIndex >= 0) {
            const [targetAddon] = prioritizedAddons.splice(addonIndex, 1);
            prioritizedAddons.unshift(targetAddon);
          }
        }
        
        // Convert params to string to ensure they're not undefined
        const contentType = typeof type === 'string' ? type : String(type);
        const contentId = typeof id === 'string' ? id : String(id);
        
        for (const addon of prioritizedAddons) {
          try {
            // Extract base URL
            const manifestUrlParts = addon.manifestUrl.split('/');
            manifestUrlParts.pop();
            const baseUrl = manifestUrlParts.join('/');
            
            // Check if this addon supports episodes
            const metaUrl = `${baseUrl}/meta/${contentType}/${contentId}.json`;
            const response = await fetch(metaUrl);
            
            if (response.ok) {
              // This addon has metadata for this content, try to get seasons
              const seasons = await fetchSeasons(baseUrl, contentType, contentId);
              
              if (seasons && seasons.length > 0) {
                // Use the first season in the array if the selected season isn't in the available seasons
                const seasonToFetch = seasons.includes(selectedSeason) ? selectedSeason : seasons[0];
                await fetchEpisodes(baseUrl, contentType, contentId, seasonToFetch);
              }
              
              return baseUrl;
            }
          } catch (err) {
            console.warn(`Error checking addon ${addon.name} for episodes:`, err);
          }
        }
        
        return null;
      };
      
      getAddonBaseUrl();
    }
  }, [details, selectedSeason, addonId, type, id, fetchEpisodes, fetchSeasons]);
  
  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      setPartialMetadata(false);
      
      try {
        // Load installed addons from localStorage
        const storedData = localStorage.getItem('installedAddons');
        if (!storedData) {
          throw new Error('No addons installed');
        }
        
        const loadedAddons = JSON.parse(storedData);
        
        // If addonId is provided, prioritize that addon but don't limit to it
        const prioritizedAddons = [...loadedAddons];
        if (addonId) {
          // Move the specified addon to the front of the array if it exists
          const addonIndex = prioritizedAddons.findIndex(a => a.id === addonId);
          if (addonIndex > 0) {
            const [targetAddon] = prioritizedAddons.splice(addonIndex, 1);
            prioritizedAddons.unshift(targetAddon);
          }
        }
        
        if (prioritizedAddons.length === 0) {
          throw new Error('No addons available');
        }
        
        // Try to fetch meta details from each addon
        let partialMeta = null;
        
        for (const addon of prioritizedAddons) {
          try {
            // Extract base URL from the manifest URL
            const manifestUrlParts = addon.manifestUrl.split('/');
            // Remove the 'manifest.json' part
            manifestUrlParts.pop();
            const baseUrl = manifestUrlParts.join('/');
            
            // Construct meta URL
            const metaUrl = `${baseUrl}/meta/${type}/${id}.json`;
            
            console.log(`Fetching details from: ${metaUrl}`);
            
            const response = await fetch(metaUrl);
            if (!response.ok) {
              console.warn(`Failed to fetch from ${metaUrl}: ${response.statusText}`);
              continue; // Try next addon
            }
            
            const data = await response.json();
            
            if (data && data.meta && hasMinimalProperties(data.meta)) {
              // If this addon provided complete metadata
              if (data.meta.description && (data.meta.poster || data.meta.background)) {
                setDetails(data.meta);
                setLoading(false);
                return; // Successfully found complete details
              }
              // Store partial metadata if it's better than what we have
              else if (!partialMeta || !partialMeta.description || !partialMeta.background) {
                partialMeta = data.meta;
              }
            }
          } catch (addonError) {
            console.error(`Error fetching from addon ${addon.name}:`, addonError);
            // Continue to next addon
          }
        }
        
        // If we've found partial metadata, use it
        if (partialMeta) {
          setDetails(partialMeta);
          setPartialMetadata(true);
          setLoading(false);
          return;
        }
        
        // If no addon provided metadata, try to extract basic info from catalogs
        const basicMeta = await tryExtractBasicMetaFromCatalogs();
        if (basicMeta) {
          setBasicDetails(basicMeta);
          setPartialMetadata(true);
          setLoading(false);
          return;
        }
        
        // If we've tried all addons and none worked
        throw new Error(`Could not find details for ${type}/${id} in any addon`);
        
      } catch (err: any) {
        console.error("Error fetching details:", err);
        setError(err.message || 'Failed to load content details');
        
        // Try to extract basic meta as a last resort
        const basicMeta = await tryExtractBasicMetaFromCatalogs();
        if (basicMeta) {
          setBasicDetails(basicMeta);
          setPartialMetadata(true);
        }
        
        setLoading(false);
      }
    };
    
    fetchDetails();
  }, [type, id, addonId]);
  
  // Function to open the stream dialog
  const openStreamDialog = (target: StreamTarget) => {
    setStreamTarget(target);
    setIsStreamDialogOpen(true);
  };
  
  // Handle click on the main Play button
  const handlePlayClick = () => {
    if (!details) return;
    
    if (details.type === 'series') {
      // For series, play the first available episode (or just S1E1 if no data)
      const firstSeason = availableSeasons.length > 0 ? availableSeasons[0] : 1;
      const firstEpisode = episodes.length > 0 ? episodes[0].episode : 1;
      openStreamDialog({ season: firstSeason, episode: firstEpisode });
    } else {
      // For movies, open dialog without season/episode
      openStreamDialog({});
    }
  };
  
  // Handle click on an episode - Opens the dialog
  const handleEpisodeClick = (episode: Episode) => {
    // Open the stream dialog with the specific season and episode
    openStreamDialog({ season: episode.season, episode: episode.episode });
  };
  
  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#141414',
        color: 'white'
      }}>
        <CircularProgress color="inherit" />
      </Box>
    );
  }
  
  // If we only have basic details but no full metadata
  if (!details && basicDetails) {
    return (
      <Box sx={{ 
        backgroundColor: '#141414',
        color: 'white',
        minHeight: '100vh',
        pt: { xs: 10, md: 12 },
        px: { xs: 3, md: 7.5 }
      }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 'bold' }}>
          {basicDetails.name}
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 4, mb: 4 }}>
          {basicDetails.poster && (
            <Box sx={{ 
              width: { xs: '70%', sm: '300px' }, 
              alignSelf: { xs: 'center', sm: 'flex-start' },
              borderRadius: '8px',
              overflow: 'hidden',
              position: 'relative',
              aspectRatio: '2/3'
            }}>
              <Image 
                src={basicDetails.poster} 
                alt={basicDetails.name}
                layout="fill"
                objectFit="cover"
              />
            </Box>
          )}
          
          <Box>
            <Typography variant="body1" sx={{ mb: 4 }}>
              Limited information available. This content was found in your catalogs, but complete metadata is not available from your installed addons.
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                variant="contained" 
                onClick={() => window.history.back()}
                sx={{ 
                  backgroundColor: '#e50914', 
                  '&:hover': { backgroundColor: '#f40612' } 
                }}
              >
                Go Back
              </Button>
              
              <Link href="/addons" passHref>
                <Button 
                  variant="contained"
                  sx={{ 
                    backgroundColor: 'rgba(133,133,133,0.6)', 
                    color: 'white',
                    '&:hover': { backgroundColor: 'rgba(133,133,133,0.4)' }
                  }}
                >
                  Manage Addons
                </Button>
              </Link>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }
  
  if (error && !basicDetails && !details) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#141414',
        color: 'white',
        px: 3,
        textAlign: 'center'
      }}>
        <Typography variant="h5" component="h1" sx={{ mb: 2 }}>
          {error || 'Content details not found'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="contained" 
            onClick={() => window.history.back()}
            sx={{ 
              backgroundColor: '#e50914', 
              '&:hover': { backgroundColor: '#f40612' } 
            }}
          >
            Go Back
          </Button>
          
          <Link href="/addons" passHref>
            <Button 
              variant="contained"
              sx={{ 
                backgroundColor: 'rgba(133,133,133,0.6)', 
                color: 'white',
                '&:hover': { backgroundColor: 'rgba(133,133,133,0.4)' }
              }}
            >
              Manage Addons
            </Button>
          </Link>
        </Box>
      </Box>
    );
  }
  
  // At this point we should have details, even if it's partial
  if (!details) return null;
  
  // Update this section to include the episodes we fetched
  const hasSeasons = details.type === 'series' && (
    (details.seasons && details.seasons.length > 0) || 
    availableSeasons.length > 0
  );
  
  const hasVideos = details.type === 'series' && details.videos && details.videos.length > 0;
  
  // Find episodes from details object and combine with fetched episodes
  const currentSeason = details.seasons?.find(s => s.season === selectedSeason);
  const episodesFromDetails = currentSeason?.episodes || [];
  
  // If we have directly fetched episodes for the current season, use those
  const episodesToDisplay = episodes.length > 0 
    ? episodes 
    : episodesFromDetails.length > 0 
      ? episodesFromDetails 
      : hasVideos 
        ? details.videos
            ?.filter(v => v.season === selectedSeason)
            .map(v => ({
              id: v.id,
              title: v.title,
              season: v.season || 1,
              episode: v.episode || 0
            })) as Episode[]
        : [];
  
  // Determine if we should show the episodes section
  const showEpisodesSection = details.type === 'series' && (
    hasSeasons || hasVideos || episodesToDisplay.length > 0 || availableSeasons.length > 0
  );
  
  // Determine the info string for the dialog title
  const dialogEpisodeInfo = streamTarget?.season && streamTarget?.episode 
    ? `S${streamTarget.season} E${streamTarget.episode}` 
    : '';

  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#141414',
      color: 'white',
      position: 'relative'
    }}>
      {/* Background Image */}
      <Box sx={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        height: { xs: '70vh', md: '80vh' }, 
        zIndex: 0,
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '75%',
          backgroundImage: 'linear-gradient(to top, #141414, transparent)'
        }
      }}>
        {details.background ? (
          <Image
            src={details.background}
            alt={details.name}
            layout="fill"
            objectFit="cover"
            priority
          />
        ) : details.poster ? (
          <Image
            src={details.poster}
            alt={details.name}
            layout="fill"
            objectFit="cover"
            priority
            style={{ filter: 'blur(8px) brightness(0.7)' }}
          />
        ) : null}
      </Box>
      
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
        {/* Title or Logo */}
        {details.logo ? (
          <Box sx={{ 
            mb: 3, 
            maxWidth: { xs: '70%', sm: '60%', md: '50%', lg: '40%' }
          }}>
            <Image 
              src={details.logo}
              alt={details.name}
              width={500}
              height={150}
              layout="responsive"
              priority
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
            {details.name}
          </Typography>
        )}
        
        {/* Partial data warning */}
        {partialMetadata && (
          <Alert severity="info" sx={{ mb: 3, backgroundColor: '#333', color: 'white' }}>
            Limited metadata available. Some information may be missing.
          </Alert>
        )}
        
        {/* Meta info row */}
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
        
        {/* Action buttons - Update Play button */}
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
        
        {/* Description */}
        <Box sx={{ maxWidth: '50rem', mb: 5 }}>
          <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.6 }}>
            {details.description || 'No description available'}
          </Typography>
          
          {/* Additional metadata */}
          {(!!details.cast?.length || !!details.director?.length || !!details.genres?.length) && (
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
              
              {details.director && details.director.length > 0 && (
                <Box sx={{ mb: 1, display: 'flex' }}>
                  <Typography variant="body2" sx={{ color: 'grey.500', minWidth: '120px' }}>
                    Director:
                  </Typography>
                  <Typography variant="body2">
                    {details.director.join(', ')}
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
        
        {/* Episodes Section - Update episode onClick */}
        {showEpisodesSection && (
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
                    {availableSeasons.map(season => (
                      <MenuItem key={season} value={season}>
                        Season {season}
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
                {episodesToDisplay.map((episode) => (
                  <EpisodeItem 
                    key={episode.id} 
                    episode={episode} 
                    onClick={() => handleEpisodeClick(episode)} 
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: 'grey.400', fontStyle: 'italic' }}>
                {episodesError || 'No episode information available for this season'}
              </Typography>
            )}
          </Box>
        )}
        
        {/* More Like This section */}
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
      </Box>
      
      {/* Render the Stream Dialog */}
      <StreamDialog
        open={isStreamDialogOpen}
        onClose={() => setIsStreamDialogOpen(false)}
        contentType={String(type)}
        contentId={String(id)}
        season={streamTarget?.season}
        episode={streamTarget?.episode}
        contentName={details?.name}
        episodeInfo={dialogEpisodeInfo}
        initialAddonId={addonId}
      />
    </Box>
  );
} 