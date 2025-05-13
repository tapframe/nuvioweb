'use client';

import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import Hero from '../components/Hero';
import MediaRow from '../components/MediaRow';
import { useAddonContext } from '@/context/AddonContext';
import { useTmdbContext } from '@/context/TmdbContext'; // Import TMDB context

// --- Stremio Types ---
interface StremioAddonCatalog {
  type: string;
  id: string;
  name?: string;
}

interface StremioCatalogResponse {
  metas?: { id: string; name?: string; poster?: string; type?: string }[];
}
// --- End Stremio Types ---

// --- TMDB Types ---
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

interface TmdbItem {
  id: number;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  // Movie specific
  title?: string;
  release_date?: string;
  // TV specific
  name?: string;
  first_air_date?: string;
  media_type?: 'movie' | 'tv'; // present in multi-search or trending all
}

interface TmdbPagedResponse {
  page: number;
  results: TmdbItem[];
  total_pages: number;
  total_results: number;
}
// --- End TMDB Types ---


// --- Shared Types for MediaRow ---
interface MediaItem {
  id: string;       // Stremio ID (e.g., tt12345) or TMDB ID (e.g., tmdb:123)
  imageUrl: string;
  alt: string;
  type: 'movie' | 'series'; // Standardized type
}

interface HomepageCatalogRow {
  title: string;
  items: MediaItem[];
  id: string; // Unique ID for the row (e.g., addonId-catalogId or tmdb-trending_movies)
  addonId?: string; // Only for addon-sourced rows
  source: 'addon' | 'tmdb'; // To distinguish the origin
}
// --- End Shared Types ---


export default function HomePage() {
  // Stremio Addon Context
  const {
    installedAddons,
    isLoading: isLoadingAddons,
    error: addonContextError
  } = useAddonContext();

  // TMDB Context
  const {
    tmdbApiKey,
    isLoadingKey: isLoadingTmdbKey,
    isTmdbEnabled, // Get the enabled status
    // keyError: tmdbKeyError // We can handle this if needed, e.g. disable TMDB section
  } = useTmdbContext();

  const [homepageCatalogs, setHomepageCatalogs] = useState<HomepageCatalogRow[]>([]);
  const [isLoadingPageData, setIsLoadingPageData] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const getStremioCatalogUniqueId = (catalog: StremioAddonCatalog) => `${catalog.type}/${catalog.id}`;

  // --- TMDB Data Fetching Functions --- 
  const fetchTmdbData = async (endpoint: string, apiKey: string): Promise<TmdbItem[]> => {
    const url = `https://api.themoviedb.org/3${endpoint}?api_key=${apiKey}&language=en-US&page=1`;
    console.log(`HomePage (TMDB): Fetching ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`TMDB API error for ${endpoint}: ${errorData.message || response.statusText} (${response.status})`);
    }
    const data: TmdbPagedResponse = await response.json();
    return data.results || [];
  };

  // Function to fetch backdrops for a specific movie/TV item from the /images endpoint
  const fetchTmdbItemBackdrop = async (itemType: 'movie' | 'tv', itemId: number, apiKey: string): Promise<string | null> => {
    try {
      const url = `https://api.themoviedb.org/3/${itemType}/${itemId}/images?api_key=${apiKey}&include_image_language=en,null`;
      
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch images for ${itemType}/${itemId}: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      
      // Find the best backdrop - prioritize by language first (English), then quality
      if (data?.backdrops && data.backdrops.length > 0) {
        // First try to get English backdrops
        const englishBackdrops = data.backdrops.filter(
          (backdrop: any) => backdrop.iso_639_1 === 'en'
        );
        
        // If English backdrops exist, sort and use them
        if (englishBackdrops.length > 0) {
          englishBackdrops.sort((a: any, b: any) => {
            // Sort by vote_average first
            if (a.vote_average !== undefined && b.vote_average !== undefined) {
              return b.vote_average - a.vote_average;
            }
            // Then by vote_count
            if (a.vote_count !== undefined && b.vote_count !== undefined) {
              return b.vote_count - a.vote_count;
            }
            return 0;
          });
          
          return `${TMDB_IMAGE_BASE_URL}original${englishBackdrops[0].file_path}`;
        }
        
        // Fallback to any backdrops (including null language/language-neutral)
        const sortedBackdrops = [...data.backdrops];
        sortedBackdrops.sort((a, b) => {
          // First try to sort by vote_average
          if (a.vote_average !== undefined && b.vote_average !== undefined) {
            return b.vote_average - a.vote_average;
          }
          // Then try to sort by vote_count
          if (a.vote_count !== undefined && b.vote_count !== undefined) {
            return b.vote_count - a.vote_count;
          }
          // Default to the order they came in
          return 0;
        });
        
        const bestBackdrop = sortedBackdrops[0];
        // Use original size for the best quality
        return `${TMDB_IMAGE_BASE_URL}original${bestBackdrop.file_path}`;
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching backdrop for ${itemType}/${itemId}:`, error);
      return null;
    }
  };

  const transformTmdbItemToMediaItem = (item: TmdbItem, typeOverride?: 'movie' | 'series'): MediaItem | null => {
    // We still check if backdrop_path exists as a minimum requirement
    if (!item.backdrop_path && !item.poster_path) return null; // Skip items without any images
    
    let itemType: 'movie' | 'series';
    if (typeOverride) {
        itemType = typeOverride;
    } else if (item.media_type === 'movie') {
        itemType = 'movie';
    } else if (item.media_type === 'tv') {
        itemType = 'series';
    } else if (item.title && item.release_date) { // Heuristic for movie if media_type is missing
        itemType = 'movie';
    } else if (item.name && item.first_air_date) { // Heuristic for TV/series if media_type is missing
        itemType = 'series';
    } else {
        console.warn("HomePage (TMDB): Could not determine type for TMDB item", item);
        return null; // Cannot determine type
    }

    // Prefer backdrop_path for horizontal rows, but fall back to poster_path if needed
    const imageUrl = item.backdrop_path 
      ? `${TMDB_IMAGE_BASE_URL}original${item.backdrop_path}` 
      : (item.poster_path ? `${TMDB_IMAGE_BASE_URL}w500${item.poster_path}` : '');

    return {
      id: `tmdb:${item.id}`, // Prefix TMDB IDs to avoid collision with Stremio IDs
      imageUrl: imageUrl,
      alt: item.title || item.name || 'TMDB Item',
      type: itemType,
    };
  };

  const fetchTmdbHomepageCatalogs = async (apiKey: string) => {
    setIsLoadingPageData(true);
    setPageError(null);
    setHomepageCatalogs([]);
    console.log("HomePage: Fetching catalogs from TMDB...");

    const tmdbCatalogsToFetch = [
      { id: 'trending_movies_week', endpoint: '/trending/movie/week', title: 'Trending Movies', type: 'movie' as const },
      { id: 'popular_movies', endpoint: '/movie/popular', title: 'Popular Movies', type: 'movie' as const },
      { id: 'top_rated_movies', endpoint: '/movie/top_rated', title: 'Top Rated Movies', type: 'movie' as const },
      { id: 'trending_tv_week', endpoint: '/trending/tv/week', title: 'Trending TV Shows', type: 'series' as const },
      { id: 'popular_tv', endpoint: '/tv/popular', title: 'Popular TV Shows', type: 'series' as const },
      { id: 'top_rated_tv', endpoint: '/tv/top_rated', title: 'Top Rated TV Shows', type: 'series' as const },
    ];

    try {
      const fetchedTmdbRows: HomepageCatalogRow[] = [];
      const promises = tmdbCatalogsToFetch.map(async (tmdbCat) => {
        try {
          const tmdbItems = await fetchTmdbData(tmdbCat.endpoint, apiKey);
          
          // Process TMDB items with basic backdrop/poster paths first
          const basicMediaItems: MediaItem[] = tmdbItems
            .map(item => transformTmdbItemToMediaItem(item, tmdbCat.type))
            .filter((item): item is MediaItem => item !== null);
          
          if (basicMediaItems.length > 0) {
            // Create a row with the basic items - enhanced ones will come later
            fetchedTmdbRows.push({
              id: `tmdb-${tmdbCat.id}`,
              title: `${tmdbCat.title} • TMDB`,
              items: basicMediaItems,
              source: 'tmdb',
            });
          }
        } catch (catError) {
          console.error(`HomePage (TMDB): Error fetching TMDB catalog ${tmdbCat.title}:`, catError);
          // Optionally collect these errors to show a partial error message
        }
      });

      await Promise.all(promises);
      
      // Simple sort for TMDB rows, can be customized
      fetchedTmdbRows.sort((a,b) => a.title.localeCompare(b.title));
      setHomepageCatalogs(fetchedTmdbRows);

      // Process each row for enhanced backdrops sequentially to avoid overloading
      // This happens after the initial rows are displayed, providing a progressive enhancement
      const enhanceRowBackdrops = async () => {
        for (const row of fetchedTmdbRows) {
          if (row.source !== 'tmdb') continue; // Only process TMDB rows

          const enhancedItems = [...row.items];
          let updatedCount = 0;
          
          // Process in small batches to avoid rate limiting
          const BATCH_SIZE = 3;
          for (let i = 0; i < row.items.length; i += BATCH_SIZE) {
            const batch = row.items.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (item, batchIndex) => {
              try {
                // Extract numeric TMDB ID
                const tmdbId = parseInt(item.id.replace('tmdb:', ''));
                if (isNaN(tmdbId)) return;
                
                // Determine if movie or TV
                const mediaType = item.type === 'movie' ? 'movie' : 'tv';
                
                // Get high-quality backdrop
                const betterBackdrop = await fetchTmdbItemBackdrop(mediaType, tmdbId, apiKey);
                if (betterBackdrop) {
                  enhancedItems[i + batchIndex] = {
                    ...item,
                    imageUrl: betterBackdrop
                  };
                  updatedCount++;
                }
              } catch (error) {
                console.warn(`Error enhancing backdrop for ${item.id}:`, error);
              }
            });
            
            await Promise.all(batchPromises);
            
            // If we made updates in this batch, update the state
            if (updatedCount > 0) {
              // Update the state with the enhanced items we have so far
              setHomepageCatalogs(prevCatalogs => {
                return prevCatalogs.map(prevRow => {
                  if (prevRow.id === row.id) {
                    return {
                      ...prevRow,
                      items: enhancedItems
                    };
                  }
                  return prevRow;
                });
              });
              
              // Reset counter for next batch
              updatedCount = 0;
            }
            
            // Add a small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      };
      
      // Start the enhancement process after initial render
      enhanceRowBackdrops().catch(error => {
        console.error("Error enhancing backdrops:", error);
      });

      if (fetchedTmdbRows.length === 0) {
        setPageError("Could not load any content from TMDB. The API might be temporarily unavailable or there's no content for these categories.");
      }

    } catch (error: any) {
      console.error("HomePage (TMDB): Failed to fetch TMDB homepage catalogs:", error);
      setPageError(`Failed to load data from TMDB: ${error.message}`);
    } finally {
      setIsLoadingPageData(false);
    }
  };
  // --- End TMDB Data Fetching Functions ---

  // --- Stremio Addon Data Fetching (Original Logic, adapted) ---
  const fetchStremioHomepageCatalogs = async () => {
    if (!installedAddons || installedAddons.length === 0) {
      console.log("HomePage: No addons installed or loaded yet for Stremio fetching.");
      setHomepageCatalogs([]);
      // Only set error if TMDB isn't also an option or has failed
      if (!addonContextError) {
           setPageError("No Stremio addons are currently installed. Please visit the Addons page to install some, or configure TMDB.");
      }
      setIsLoadingPageData(false);
      return;
    }
    
    setIsLoadingPageData(true);
    setPageError(null);
    console.log("HomePage: Fetching catalogs from Stremio Addons...");
    let allFetchedStremioRows: HomepageCatalogRow[] = [];
    const fetchPromises: Promise<void>[] = [];

    installedAddons.forEach(addon => {
      const addonSelectedCatalogs = addon.catalogs?.filter(catalog => 
        addon.selectedCatalogIds?.includes(getStremioCatalogUniqueId(catalog))
      ) || [];

      if (addonSelectedCatalogs.length > 0) {
        const baseUrl = addon.manifestUrl.substring(0, addon.manifestUrl.lastIndexOf('/'));

        addonSelectedCatalogs.forEach(stremioCatalog => {
          const catalogFullId = getStremioCatalogUniqueId(stremioCatalog);
          let catalogTitle = stremioCatalog.name || `${stremioCatalog.type} ${stremioCatalog.id}`.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          
          const lowerCaseName = catalogTitle.toLowerCase();
          const hasMovieWord = lowerCaseName.includes('movie');
          const hasSeriesWord = lowerCaseName.includes('series') || lowerCaseName.includes('tv') || lowerCaseName.includes('show');

          if (stremioCatalog.type === 'movie' && !hasMovieWord) catalogTitle += ' Movies';
          else if (stremioCatalog.type === 'series' && !hasSeriesWord) catalogTitle += ' TV Shows';
          
          catalogTitle = `${catalogTitle} • ${addon.name}`;
          const catalogUrl = `${baseUrl}/catalog/${stremioCatalog.type}/${stremioCatalog.id}.json`;
          
          fetchPromises.push(
            fetch(catalogUrl)
              .then(response => {
                if (!response.ok) throw new Error(`Fetch failed for ${catalogTitle}: ${response.statusText} (${catalogUrl})`);
                return response.json() as Promise<StremioCatalogResponse>;
              })
              .then(data => {
                if (data?.metas && data.metas.length > 0) {
                  const items: MediaItem[] = data.metas
                    .filter(meta => meta.poster && meta.type) // Ensure type is present for Stremio items
                    .map(meta => ({ 
                      id: meta.id!,
                      imageUrl: meta.poster!,
                      alt: meta.name || meta.id!,
                      type: meta.type as 'movie' | 'series' // Assuming type is 'movie' or 'series'
                    }));
                  if (items.length > 0) {
                    allFetchedStremioRows.push({ 
                      title: catalogTitle, 
                      items: items, 
                      id: `${addon.id}-${catalogFullId}`,
                      addonId: addon.id,
                      source: 'addon',
                    });
                  }
                }
              })
              .catch(err => {
                console.error(`HomePage (Stremio): Error fetching/processing catalog ${catalogTitle}:`, err);
              })
          );
        });
      }
    });

    try {
      await Promise.all(fetchPromises);
      allFetchedStremioRows.sort((a, b) => a.title.localeCompare(b.title));
      setHomepageCatalogs(allFetchedStremioRows);

      if (allFetchedStremioRows.length === 0 && installedAddons.some(a => a.selectedCatalogIds && a.selectedCatalogIds.length > 0)) {
          setPageError("No content could be loaded from the selected Stremio addon catalogs. Check addon configurations or CORS issues.");
      } else if (allFetchedStremioRows.length === 0 && installedAddons.length > 0) {
          setPageError("No Stremio addon catalogs selected to display. Visit the Addons page to enable some.");
      }

    } catch (overallError) {
       console.error("HomePage (Stremio): Error during Promise.all for catalogs:", overallError);
       setPageError("An error occurred while fetching Stremio addon catalog data.");
    } finally {
      setIsLoadingPageData(false);
    }
  };
  // --- End Stremio Addon Data Fetching ---


  useEffect(() => {
    if (addonContextError) {
        setPageError(`Addon loading error: ${addonContextError}`);
    }

    // Decide whether to fetch from TMDB or Stremio Addons
    if (!isLoadingTmdbKey && !isLoadingAddons) { // Wait until *both* contexts have loaded their initial state
      if (tmdbApiKey && isTmdbEnabled) { // Check for API Key AND enabled status
        console.log("HomePage: TMDB API Key found and integration enabled. Fetching from TMDB.");
        fetchTmdbHomepageCatalogs(tmdbApiKey);
      } else {
        // Fallback to Stremio addons if TMDB key missing OR TMDB is disabled
        if (!tmdbApiKey) console.log("HomePage: No TMDB API Key found. Fetching from Stremio Addons.");
        if (tmdbApiKey && !isTmdbEnabled) console.log("HomePage: TMDB integration is disabled. Fetching from Stremio Addons.");
        fetchStremioHomepageCatalogs();
      }
    } else {
        console.log(`HomePage: Waiting for initial context loading... (TMDB Key: ${isLoadingTmdbKey}, Addons: ${isLoadingAddons})`);
        setIsLoadingPageData(true); // Show loading while waiting for contexts
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbApiKey, isTmdbEnabled, isLoadingTmdbKey, installedAddons, isLoadingAddons, addonContextError]); // Added isTmdbEnabled dependency


  // Combined loading state for UI
  const showLoadingIndicator = isLoadingTmdbKey || isLoadingAddons || isLoadingPageData;

  return (
    <Box>
      <Hero />
      <Box sx={{ py: 4, backgroundColor: '#141414' }}>
        {showLoadingIndicator && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
            <CircularProgress sx={{color: 'red'}} />
          </Box>
        )}

        {!showLoadingIndicator && pageError && (
          <Alert severity="warning" sx={{ mx: { xs: 2, md: 7.5 }, my: 2, backgroundColor: '#333', color: 'white' }}>
            {pageError}
          </Alert>
        )}
        
        {!showLoadingIndicator && !pageError && homepageCatalogs.length === 0 && (
            <Alert severity="info" sx={{ mx: { xs: 2, md: 7.5 }, my: 2, backgroundColor: '#1f1f1f', color: 'white' }}>
                No content to display. Please configure TMDB API key, or install and select Stremio addon catalogs.
            </Alert>
        )}

        {!showLoadingIndicator && homepageCatalogs.length > 0 && (
          homepageCatalogs.map((catalogRow) => (
            <MediaRow 
              key={catalogRow.id} 
              title={catalogRow.title} 
              items={catalogRow.items} 
              addonId={catalogRow.source === 'addon' ? catalogRow.addonId : undefined}
              imageType={catalogRow.source === 'tmdb' ? 'backdrop' : 'poster'} // Use backdrop format for TMDB, poster for addons
              // Pass TMDB ID or Stremio ID appropriately to details page in MediaRow if needed
              // For TMDB items, catalogRow.items[any].id is `tmdb:${tmdb_id}`
            />
          ))
        )}
      </Box>
    </Box>
  );
}
