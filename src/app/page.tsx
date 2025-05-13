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

  const transformTmdbItemToMediaItem = (item: TmdbItem, typeOverride?: 'movie' | 'series'): MediaItem | null => {
    if (!item.poster_path) return null; // Skip items without posters
    
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

    return {
      id: `tmdb:${item.id}`, // Prefix TMDB IDs to avoid collision with Stremio IDs
      imageUrl: `${TMDB_IMAGE_BASE_URL}w500${item.poster_path}`,
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
          const mediaItems: MediaItem[] = tmdbItems
            .map(item => transformTmdbItemToMediaItem(item, tmdbCat.type))
            .filter((item): item is MediaItem => item !== null);
          
          if (mediaItems.length > 0) {
            fetchedTmdbRows.push({
              id: `tmdb-${tmdbCat.id}`,
              title: `${tmdbCat.title} • TMDB`,
              items: mediaItems,
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
    // Handle addon context errors that might affect decision logic
    if (addonContextError) {
        setPageError(`Addon loading error: ${addonContextError}`);
        // Potentially stop further processing if addons are crucial and errored
    }

    // Decide whether to fetch from TMDB or Stremio Addons
    if (!isLoadingTmdbKey) { // Wait until TMDB key status is known
      if (tmdbApiKey) {
        fetchTmdbHomepageCatalogs(tmdbApiKey);
      } else {
        // No TMDB key, or it was explicitly removed. Fallback to Stremio addons.
        // Wait for addons to load before fetching from them.
        if (!isLoadingAddons) {
          fetchStremioHomepageCatalogs();
        } else {
          console.log("HomePage: Waiting for Stremio addons to load...");
          setIsLoadingPageData(true); // Explicitly set loading if waiting for addons context
        }
      }
    } else {
        console.log("HomePage: Waiting for TMDB API key status...");
        setIsLoadingPageData(true); // Explicitly set loading if waiting for TMDB context
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbApiKey, isLoadingTmdbKey, installedAddons, isLoadingAddons, addonContextError]);


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
              // Pass TMDB ID or Stremio ID appropriately to details page in MediaRow if needed
              // For TMDB items, catalogRow.items[any].id is `tmdb:${tmdb_id}`
            />
          ))
        )}
      </Box>
    </Box>
  );
}
