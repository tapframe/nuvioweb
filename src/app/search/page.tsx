'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import MediaRow from '@/components/MediaRow';
import { useAddonContext } from '@/context/AddonContext'; // Import the context hook

// Define interfaces based on existing types in the app
interface AddonCatalog {
  id: string;
  name?: string;
  type: string;
}

interface AddonManifest {
  id: string;
  name: string;
  version: string;
  catalogs?: AddonCatalog[];
}

interface InstalledAddon extends AddonManifest {
  manifestUrl: string;
  selectedCatalogIds?: string[];
}

interface StremioCatalogMeta {
  id: string;
  name: string;
  poster?: string;
  type?: string;
}

interface StremioCatalogResponse {
  metas?: StremioCatalogMeta[];
}

interface MediaItem {
  id: string;
  imageUrl: string;
  alt: string;
  type: string;
}

interface SearchResult {
  addonId: string;
  addonName: string;
  catalogId: string;
  catalogName: string;
  catalogType: string;
  items: MediaItem[];
}

// A common ID for the official Cinemeta v3 addon
const CINEMETA_ADDON_ID = 'community.cinemeta'; 
const CINEMETA_BASE_URL = 'https://v3-cinemeta.strem.io';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const {
    installedAddons,
    isLoading: isLoadingAddons, // From context
    error: addonContextError    // From context
  } = useAddonContext();

  const [allSearchResults, setAllSearchResults] = useState<MediaItem[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isSearchingCinemeta, setIsSearchingCinemeta] = useState<boolean>(false);

  const getCatalogUniqueId = (catalog: AddonCatalog) => `${catalog.type}/${catalog.id}`;
  
  useEffect(() => {
    // Reflect addon context errors onto the page error state
    if (addonContextError) {
        setPageError(`Addon loading error: ${addonContextError}`);
    }
  }, [addonContextError]);

  useEffect(() => {
    if (!query) {
      setIsLoadingSearch(false);
      setAllSearchResults([]);
      setIsSearchingCinemeta(false);
      setPageError(null);
      return;
    }

    if (isLoadingAddons) {
        setIsLoadingSearch(true); // Wait for addons to load
        return;
    }

    if (installedAddons.length === 0 && query) {
        setPageError("No addons installed. Please install an addon to search.");
        setIsLoadingSearch(false);
        setAllSearchResults([]);
        setIsSearchingCinemeta(false);
        return;
    }

    const cinemetaAddon = installedAddons.find(addon => 
      addon.id === CINEMETA_ADDON_ID || addon.name?.toLowerCase().includes('cinemeta')
    );
    setIsSearchingCinemeta(!!cinemetaAddon);

    const performSearch = async () => {
      setIsLoadingSearch(true);
      setPageError(null); // Clear previous search-specific errors
      setAllSearchResults([]);
      
      const searchPromises: Promise<MediaItem[]>[] = [];
      let useCinemetaLogic = !!cinemetaAddon;

      if (useCinemetaLogic && cinemetaAddon) {
        console.log("SearchPage: Cinemeta addon found. Searching only Cinemeta using 'top' catalog.");
        const typesToSearch: ('movie' | 'series')[] = ['movie', 'series'];
        typesToSearch.forEach(type => {
          const searchUrl = `${CINEMETA_BASE_URL}/catalog/${type}/top/search=${encodeURIComponent(query)}.json`;
          searchPromises.push(
            fetch(searchUrl)
              .then(res => {
                if (!res.ok) throw new Error(`HTTP error ${res.status} for ${searchUrl}`);
                return res.json() as Promise<StremioCatalogResponse>;
              })
              .then(data => {
                if (data?.metas && data.metas.length > 0) {
                  return data.metas
                    .filter(meta => meta.poster) 
                    .map(meta => ({
                      id: meta.id,
                      imageUrl: meta.poster!,
                      alt: meta.name || meta.id,
                      type: meta.type || type 
                    }));
                }
                return [];
              })
              .catch(err => {
                console.error(`SearchPage: Error searching Cinemeta ${type}/top:`, err);
                return []; 
              })
          );
        });
      } else {
        console.log("SearchPage: Cinemeta not found or not used. Searching selected catalogs of other installed addons.");
        installedAddons.forEach(addon => {
          if (!addon.catalogs || addon.catalogs.length === 0) return;
          
          const selectedCatalogIds = addon.selectedCatalogIds || addon.catalogs.map(getCatalogUniqueId);
          if (selectedCatalogIds.length === 0) return;

          const baseUrl = addon.manifestUrl.substring(0, addon.manifestUrl.lastIndexOf('/'));
          
          addon.catalogs.forEach(catalog => {
            const catalogFullId = getCatalogUniqueId(catalog);
            if (!selectedCatalogIds.includes(catalogFullId)) return;

            const searchUrl = `${baseUrl}/catalog/${catalog.type}/${catalog.id}/search=${encodeURIComponent(query)}.json`;
            searchPromises.push(
              fetch(searchUrl)
                .then(res => {
                  if (!res.ok) throw new Error(`HTTP error ${res.status} for ${searchUrl}`);
                  return res.json() as Promise<StremioCatalogResponse>;
                })
                .then(data => {
                  if (data?.metas && data.metas.length > 0) {
                    return data.metas
                      .filter(meta => meta.poster)
                      .map(meta => ({
                        id: meta.id,
                        imageUrl: meta.poster!,
                        alt: meta.name || meta.id,
                        type: meta.type || catalog.type 
                      }));
                  }
                  return [];
                })
                .catch(err => {
                  console.error(`SearchPage: Error searching ${addon.name} - ${catalog.name || catalog.id}:`, err);
                  return [];
                })
            );
          });
        });
      }

      try {
        const resultsFromAllPromises = await Promise.all(searchPromises);
        const combinedResults = resultsFromAllPromises.flat();
        
        const uniqueResults: MediaItem[] = [];
        const seenIds = new Set<string>();
        for (const item of combinedResults) {
          if (!seenIds.has(item.id)) {
            uniqueResults.push(item);
            seenIds.add(item.id);
          }
        }
        setAllSearchResults(uniqueResults);
        
        if (uniqueResults.length === 0) {
          setPageError(`No results found for "${query}". ${isSearchingCinemeta ? '(Searched Cinemeta)' : '(Searched installed addons)'}`);
        }
      } catch (err) {
        console.error("SearchPage: Error during Promise.all execution:", err);
        setPageError('An error occurred while aggregating search results');
      } finally {
        setIsLoadingSearch(false);
      }
    };

    performSearch(); // Call performSearch if addons are loaded

  }, [query, installedAddons, isLoadingAddons, addonContextError]); // Added isLoadingAddons and addonContextError

  const resultsByType: Record<string, MediaItem[]> = {};
  allSearchResults.forEach(item => {
    const typeKey = item.type || 'other';
    if (!resultsByType[typeKey]) {
      resultsByType[typeKey] = [];
    }
    resultsByType[typeKey].push(item);
  });

  const showOverallLoading = isLoadingAddons || isLoadingSearch;

  return (
    <Box sx={{ pt: 12, px: { xs: 2, md: 7.5 }, minHeight: '100vh', backgroundColor: '#141414' }}>
      <Typography variant="h4" sx={{ color: 'white', mb: 1 }}>
        Search Results for "{query}"
      </Typography>
      {isSearchingCinemeta && query && !showOverallLoading && !pageError && (
          <Typography variant="caption" sx={{color: 'grey.500', mb:3, display: 'block'}}>
              Showing results from Cinemeta.
          </Typography>
      )}
      {!isSearchingCinemeta && installedAddons.length > 0 && query && !showOverallLoading && !pageError && (
          <Typography variant="caption" sx={{color: 'grey.500', mb:3, display: 'block'}}>
              Showing results from all installed addons.
          </Typography>
      )}
      
      {showOverallLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress sx={{ color: 'red' }} />
        </Box>
      )}
      
      {pageError && !showOverallLoading && (
        <Alert severity={pageError.startsWith("No results found") || pageError.startsWith("No addons installed") ? "info" : "warning"} sx={{ mt: 2, backgroundColor: '#333', color: 'white' }}>
          {pageError}
        </Alert>
      )}

      {!showOverallLoading && !pageError && allSearchResults.length === 0 && query && (
        <Alert severity="info" sx={{ mt: 2, backgroundColor: '#333', color: 'white' }}>
          No results found for "{query}". Please try a different search term.
        </Alert>
      )}

      {!showOverallLoading && Object.keys(resultsByType).length > 0 && (
        <>
          {Object.entries(resultsByType).map(([type, items], index, arr) => {
            const isLastType = index === arr.length - 1;
            return (
              <Box 
                key={type} 
                sx={{ mb: isLastType ? 0 : 4 }} 
              >
                <Typography variant="h5" sx={{ color: 'white', mb: 2, textTransform: 'capitalize' }}>
                  {type === 'movie' ? 'Movies' : type === 'series' ? 'TV Shows' : type}
                </Typography>
                <MediaRow 
                  title="" 
                  items={items} 
                  disableBottomMargin={isLastType} 
                />
              </Box>
            );
          })}
        </>
      )}
    </Box>
  );
} 