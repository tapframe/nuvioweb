'use client';

import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import Hero from '../components/Hero';
import MediaRow from '../components/MediaRow';

// --- Types (Should match addons/page.tsx structure) ---
interface AddonCatalog {
  type: string;
  id: string;
  name?: string;
}

interface AddonManifest {
  id: string;
  version: string;
  name: string;
  description?: string;
  resources?: (string | { name: string; types?: string[]; idPrefixes?: string[] })[];
  types?: string[];
  catalogs?: AddonCatalog[];
  // Add other relevant fields
}

interface InstalledAddon extends AddonManifest {
  manifestUrl: string;
  selectedCatalogIds?: string[]; // Crucial for filtering
}

interface MediaItem {
  id: string | number;
  imageUrl: string;
  alt: string;
}

interface Catalog {
  title: string;
  items: MediaItem[];
  id: string; // e.g., movie/top
}

// Stremio Catalog Response Structure (Simplified)
interface StremioMeta {
    id: string;
    type: string;
    name: string;
    poster?: string;
    posterShape?: 'square' | 'poster' | 'landscape';
    // Add other potential fields like description, year, etc.
}

interface StremioCatalogResponse {
    metas: StremioMeta[];
}
// --- End Types ---


export default function HomePage() {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const getCatalogUniqueId = (catalog: AddonCatalog) => `${catalog.type}/${catalog.id}`;

  useEffect(() => {
    const fetchCatalogs = async () => {
      setIsLoading(true);
      setError(null);
      let loadedAddons: InstalledAddon[] = [];
      let allFetchedCatalogs: Catalog[] = [];

      // 1. Load installed addons (including selectedCatalogIds)
      try {
        const storedAddons = localStorage.getItem('installedAddons');
        if (storedAddons) {
          // Assuming addons page saves structure with selectedCatalogIds
          loadedAddons = JSON.parse(storedAddons);
        } else {
            loadedAddons = []; // Ensure it's an array
        }
      } catch (err) {
        console.error("Error loading addons:", err);
        setError("Failed to load installed addons.");
        setIsLoading(false);
        return;
      }

      if (loadedAddons.length === 0) {
         console.log("No addons installed.");
         setIsLoading(false);
         setCatalogs([]);
         return;
      }

      const fetchPromises: Promise<void>[] = [];

      loadedAddons.forEach(addon => {
        const addonCatalogs = addon.catalogs || [];
        const selectedIds = addon.selectedCatalogIds || []; // Get selected IDs for this addon
        
        // No need for the fallback logic here if addons page saves defaults

        if (addonCatalogs.length > 0) {
           console.log(`Processing addon: ${addon.name}`);
           const baseUrl = addon.manifestUrl.substring(0, addon.manifestUrl.lastIndexOf('/'));

           addonCatalogs.forEach(catalog => {
             const catalogFullId = getCatalogUniqueId(catalog);
             
             // Create a better formatted catalog title
             let catalogTitle = '';
             
             // If catalog has a name, use it
             if (catalog.name) {
               catalogTitle = catalog.name;
               console.log(`Using catalog provided name: ${catalogTitle} for ${catalog.type}/${catalog.id}`);
               
               // Even for named catalogs, let's add the media type if not already included
               // Check if catalog name already has movie/series/tv/show/movie words
               const lowerCaseName = catalogTitle.toLowerCase();
               const hasMovieWord = lowerCaseName.includes('movie');
               const hasSeriesWord = lowerCaseName.includes('series') || 
                                   lowerCaseName.includes('tv') || 
                                   lowerCaseName.includes('show');
               
               // Add media type suffix if not already included
               if (catalog.type === 'movie' && !hasMovieWord) {
                 catalogTitle += ' Movies';
               } else if (catalog.type === 'series' && !hasSeriesWord) {
                 catalogTitle += ' TV Shows';
               }
               
               console.log(`After adding media type to catalog name: ${catalogTitle}`);
             } 
             // Otherwise, format based on type and id
             else {
               // Format the catalog ID to be more readable
               let formattedId = catalog.id
                 .replace(/[-_]/g, ' ')  // Replace underscores/hyphens with spaces
                 .replace(/\b\w/g, c => c.toUpperCase());  // Capitalize first letter of each word
               
               // Special case for common IDs - format for better readability
               if (catalog.id === 'top') formattedId = 'Popular';
               if (catalog.id === 'trending') formattedId = 'Trending';
               if (catalog.id === 'recent') formattedId = 'Recent';
               if (catalog.id === 'new') formattedId = 'New';
               
               console.log(`Formatting catalog ID "${catalog.id}" as "${formattedId}"`);
               
               // Format by catalog type - always include the media type
               if (catalog.type === 'movie') {
                 catalogTitle = `${formattedId} Movies`;
               } else if (catalog.type === 'series') {
                 catalogTitle = `${formattedId} TV Shows`;
               } else {
                 // For other types (like anime, channel, etc.)
                 catalogTitle = `${formattedId} ${catalog.type.charAt(0).toUpperCase() + catalog.type.slice(1)}`;
               }
               
               console.log(`Formatted catalog title before addon name: ${catalogTitle}`);
             }
             
             // Add addon name as attribution
             catalogTitle = `${catalogTitle} • ${addon.name}`;
             console.log(`Final catalog title: ${catalogTitle}`);
             
             // *** Check if this catalog is selected ***
             if (!selectedIds.includes(catalogFullId)) {
                console.log(`Skipping catalog (not selected): ${catalogTitle}`);
                return; // Skip to the next catalog if not selected
             }

             // Construct catalog URL
             const catalogUrl = `${baseUrl}/catalog/${catalog.type}/${catalog.id}.json`;
             console.log(`Preparing to fetch SELECTED catalog: ${catalogTitle} from ${catalogUrl}`);

             // Create fetch promise ONLY for selected catalogs
             fetchPromises.push(
               fetch(catalogUrl) // Add fetch options if needed (e.g., mode: 'cors')
                 .then(response => {
                   if (!response.ok) throw new Error(`Fetch failed for ${catalogTitle}: ${response.statusText}`);
                   return response.json() as Promise<StremioCatalogResponse>;
                 })
                 .then(data => {
                   if (data?.metas?.length > 0) {
                     const items: MediaItem[] = data.metas
                        .filter(meta => meta.poster) // Ensure poster exists
                        .map(meta => ({ id: meta.id, imageUrl: meta.poster!, alt: meta.name || meta.id }));
                     if (items.length > 0) {
                         allFetchedCatalogs.push({ title: catalogTitle, items: items, id: catalogFullId });
                         console.log(`Successfully processed ${items.length} items for: ${catalogTitle}`);
                     } else {
                          console.log(`Catalog ${catalogTitle} had items but none with posters.`);
                     }
                   } else {
                     console.warn(`No valid 'metas' array found for catalog: ${catalogTitle}`, data);
                   }
                 })
                 .catch(err => {
                   console.error(`Error fetching/processing catalog ${catalogTitle}:`, err);
                 })
             );
           }); // End forEach catalog
        } // End if addon has catalogs
      }); // End forEach addon

       // Execute fetches and update state
       try {
         console.warn("Fetching selected catalogs directly (CORS may still block)...", fetchPromises.length, "requests planned.");
         await Promise.all(fetchPromises);
         setCatalogs(allFetchedCatalogs);

         if (allFetchedCatalogs.length === 0 && loadedAddons.some(a => a.selectedCatalogIds && a.selectedCatalogIds.length > 0)) {
             setError("No catalogs could be loaded. Check CORS, addon URLs, or try re-installing addons.");
         } else if (allFetchedCatalogs.length === 0 && loadedAddons.length > 0) {
             setError("No catalogs selected. Visit the Addons page to enable some.");
         }

       } catch (overallError) {
          console.error("Error during Promise.all for catalogs:", overallError);
          setError("An error occurred fetching catalog data.");
       } finally {
         setIsLoading(false);
       }
    };

    fetchCatalogs();
  }, []);

  return (
    <Box sx={{ backgroundColor: '#141414', pb: 4 }}>
      <Hero />
      <Box sx={{ mt: -4, position: 'relative', zIndex: 3 }}>
         {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress color="inherit" />
            </Box>
         )}
         {error && (
            <Alert severity="warning" sx={{ mx: { xs: 2, md: 7.5 }, mb: 2, backgroundColor: '#555', color: 'white' }}>
                {error} { /* Changed severity to warning as some errors are expected (CORS) */}
            </Alert>
         )}
         {!isLoading && !error && catalogs.length === 0 && (
             <Typography sx={{ color: 'grey.500', textAlign: 'center', p: 4 }}>
                 No catalogs selected or available. Visit the Addons page to install or enable catalogs.
             </Typography>
         )}
         {!isLoading && catalogs.map((catalog) => (
            <MediaRow key={catalog.id} title={catalog.title} items={catalog.items} />
         ))}
      </Box>
    </Box>
  );
}
