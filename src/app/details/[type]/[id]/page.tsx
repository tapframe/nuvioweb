'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
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
}

// Basic metadata we can extract from catalog items
interface BasicMeta {
  id: string;
  type: string;
  name: string;
  poster?: string;
}

export default function DetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { type, id } = params;
  const addonId = searchParams.get('addonId');
  
  const [details, setDetails] = useState<MetaDetails | null>(null);
  const [basicDetails, setBasicDetails] = useState<BasicMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partialMetadata, setPartialMetadata] = useState<boolean>(false);
  
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
  
  return (
    <Box sx={{ 
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
        px: { xs: 3, md: 7.5 }
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
        
        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
          <Button 
            variant="contained"
            startIcon={<PlayArrow />}
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
        
        {/* More Like This section */}
        <Box sx={{ mb: 8 }}>
          <Typography variant="h5" component="h2" sx={{ mb: 3, fontWeight: 'bold' }}>
            More Like This
          </Typography>
          
          <Typography variant="body2" sx={{ color: 'grey.400', fontStyle: 'italic' }}>
            Similar content recommendations will appear here
          </Typography>
        </Box>
      </Box>
    </Box>
  );
} 