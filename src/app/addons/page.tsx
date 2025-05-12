'use client';

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, List, ListItem, ListItemText,
  CircularProgress, Alert, Paper, IconButton, FormGroup, FormControlLabel, Checkbox, Divider,
  Accordion, AccordionSummary, AccordionDetails, Card, CardContent, CardHeader, Tab, Tabs
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SettingsIcon from '@mui/icons-material/Settings';

// --- Interfaces ---
interface AddonCatalog {
  type: string;
  id: string;
  name?: string;
  // Add other catalog specific fields if needed (e.g., extra)
}

interface AddonManifest {
  id: string;
  version: string;
  name: string;
  description?: string;
  catalogs?: AddonCatalog[];
  // Keep other manifest fields like resources, types if they are used elsewhere
  resources?: (string | { name: string; types?: string[]; idPrefixes?: string[] })[];
  types?: string[];
}

interface InstalledAddon extends AddonManifest {
  manifestUrl: string;
  selectedCatalogIds?: string[]; // Stores IDs like "movie/top"
}
// --- End Interfaces ---

export default function AddonsPage() {
  const [addonUrl, setAddonUrl] = useState<string>('');
  const [installedAddons, setInstalledAddons] = useState<InstalledAddon[] | null>(null);
  const [isLoadingInstall, setIsLoadingInstall] = useState<boolean>(false);
  const [isLoadingState, setIsLoadingState] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);

  const getCatalogUniqueId = (catalog: AddonCatalog) => `${catalog.type}/${catalog.id}`;

  // Load addons from local storage
  useEffect(() => {
    setIsLoadingState(true);
    try {
      const storedData = localStorage.getItem('installedAddons');
      const loadedAddons: InstalledAddon[] = storedData ? JSON.parse(storedData) : [];
      // Ensure selectedCatalogIds exists and defaults for older stored addons
      const processedAddons = loadedAddons.map(addon => ({
        ...addon,
        selectedCatalogIds: addon.selectedCatalogIds || (addon.catalogs?.map(getCatalogUniqueId) || [])
      }));
      setInstalledAddons(processedAddons);
    } catch (e) {
      console.error("Error loading addons:", e);
      setError('Error loading addons from storage.');
      setInstalledAddons([]);
    } finally {
      setIsLoadingState(false);
    }
  }, []);

  // Save addons to local storage
  useEffect(() => {
    if (installedAddons !== null) {
      try {
        localStorage.setItem('installedAddons', JSON.stringify(installedAddons));
      } catch (e) {
        console.error("Error saving addons:", e);
        setError('Error saving addon preferences.');
      }
    }
  }, [installedAddons]);

  const handleInstallAddon = async () => {
    setIsLoadingInstall(true);
    setError(null);
    if (!addonUrl || !addonUrl.endsWith('manifest.json')) {
      setError('Invalid manifest URL (must end with manifest.json).');
      setIsLoadingInstall(false);
      return;
    }
    if (installedAddons && installedAddons.some(a => a.manifestUrl === addonUrl)) {
      setError('Addon from this URL is already installed.');
      setAddonUrl('');
      setIsLoadingInstall(false);
      return;
    }
    try {
      const res = await fetch(addonUrl);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const manifest = await res.json() as AddonManifest;
      if (!manifest.id || !manifest.version || !manifest.name) throw new Error('Manifest is missing required fields (id, version, name).');
      
      const newAddon: InstalledAddon = {
        ...manifest,
        manifestUrl: addonUrl,
        // By default, select all catalogs from the newly installed addon
        selectedCatalogIds: manifest.catalogs?.map(getCatalogUniqueId) || [],
      };
      setInstalledAddons(prev => (prev ? [...prev, newAddon] : [newAddon]));
      setAddonUrl('');
    } catch (err: any) {
      console.error("Failed to install addon:", err);
      setError(`Install Failed: ${err.message}`);
    } finally {
      setIsLoadingInstall(false);
    }
  };

  const handleUninstallAddon = (manifestUrl: string) => {
    setInstalledAddons(prev => (prev ? prev.filter(a => a.manifestUrl !== manifestUrl) : []));
  };

  const handleToggleCatalog = (addonManifestUrl: string, catalogId: string) => {
    setInstalledAddons(prevAddons => 
      prevAddons ? prevAddons.map(addon => {
        if (addon.manifestUrl === addonManifestUrl) {
          const selectedIds = addon.selectedCatalogIds || [];
          const newSelectedIds = selectedIds.includes(catalogId) 
            ? selectedIds.filter(id => id !== catalogId)
            : [...selectedIds, catalogId];
          return { ...addon, selectedCatalogIds: newSelectedIds };
        }
        return addon;
      }) : []
    );
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Group catalogs by type for the catalog configuration section
  const getCatalogsByType = () => {
    if (!installedAddons) return {};
    
    const catalogsByType: {[key: string]: {catalog: AddonCatalog, addon: InstalledAddon}[]} = {};
    
    installedAddons.forEach(addon => {
      if (addon.catalogs && addon.catalogs.length > 0) {
        addon.catalogs.forEach(catalog => {
          const type = catalog.type;
          if (!catalogsByType[type]) {
            catalogsByType[type] = [];
          }
          catalogsByType[type].push({
            catalog,
            addon
          });
        });
      }
    });
    
    return catalogsByType;
  };

  const catalogsByType = getCatalogsByType();

  return (
    <Box sx={{ pt: {xs: 8, md: 10}, px: {xs: 2, md: 7.5 }, color: '#e5e5e5', minHeight: '100vh', backgroundColor: '#141414' }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 'bold' }}>
        Addons & Catalogs
      </Typography>

      <Tabs 
        value={activeTab} 
        onChange={handleTabChange} 
        sx={{ 
          mb: 4, 
          '& .MuiTab-root': { 
            color: 'grey.400', 
            '&.Mui-selected': { color: 'white' } 
          },
          '& .MuiTabs-indicator': { backgroundColor: '#e50914' }
        }}
      >
        <Tab label="Installed Addons" />
        <Tab label="Catalog Configuration" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 3, backgroundColor: '#444', color: '#e5e5e5' }}>{error}</Alert>}

      {isLoadingState ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress color="inherit" /></Box>
      ) : (
        <>
          {/* ADDONS TAB */}
          {activeTab === 0 && (
            <>
              <Box component="form" sx={{ display: 'flex', gap: 1, mb: 4, alignItems: 'flex-start' }} onSubmit={(e) => { e.preventDefault(); handleInstallAddon(); }}>
                <TextField
                  label="Addon Manifest URL"
                  variant="filled" size="small" value={addonUrl} onChange={(e) => setAddonUrl(e.target.value)}
                  fullWidth InputLabelProps={{ sx: { color: 'grey.500' }}} InputProps={{ sx: { color: 'white', backgroundColor: '#333' }, disableUnderline: true }}
                  sx={{ borderRadius: '4px', '& .MuiFilledInput-root': { backgroundColor: '#333', borderRadius: '4px', '&:hover': { backgroundColor: '#444' }, '&.Mui-focused': { backgroundColor: '#444' } } }}
                  placeholder="https://.../manifest.json"
                />
                <Button
                  variant="contained" onClick={handleInstallAddon} disabled={isLoadingInstall}
                  sx={{ height: '44px', px: 3, flexShrink: 0, backgroundColor: '#e50914', fontWeight: 'bold', '&:hover': { backgroundColor: '#f40612' } }}
                >
                  {isLoadingInstall ? <CircularProgress size={24} color="inherit" /> : 'Install'}
                </Button>
              </Box>

              <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 'bold' }}>
                Installed Addons
              </Typography>

              {!installedAddons || installedAddons.length === 0 ? (
                <Typography sx={{ color: 'grey.500', fontStyle: 'italic' }}>No addons installed yet.</Typography>
              ) : (
                <List disablePadding>
                  {installedAddons.map((addon) => (
                    <Paper key={addon.manifestUrl} elevation={0} sx={{ backgroundColor: '#1f1f1f', mb: 1.5, borderRadius: '4px', p: 2 }}>
                      <ListItem
                        disablePadding
                        secondaryAction={
                          <IconButton
                            aria-label="uninstall"
                            onClick={() => handleUninstallAddon(addon.manifestUrl)}
                            size="small"
                            sx={{ color: 'grey.500', '&:hover': { color: '#e50914' } }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={`${addon.name} (v${addon.version})`}
                          secondary={
                            <>
                              <Typography component="span" variant="body2" sx={{ color: 'grey.400', display: 'block', mb: 0.5 }}>
                                {addon.description || 'No description provided'}
                              </Typography>
                              <Typography component="span" variant="caption" sx={{ color: 'grey.500', fontSize: '0.7rem' }}>
                                {addon.manifestUrl}
                              </Typography>
                            </>
                          }
                          primaryTypographyProps={{ color: '#e5e5e5', fontWeight: 'bold', mb: 0.5 }}
                        />
                      </ListItem>
                      
                      {addon.catalogs && addon.catalogs.length > 0 && (
                        <Accordion 
                          disableGutters 
                          elevation={0} 
                          sx={{ 
                            backgroundColor: 'transparent', 
                            '&:before': { display: 'none' }, 
                            mt: 1 
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<ExpandMoreIcon sx={{ color: 'grey.400' }} />}
                            sx={{ 
                              p: 0, 
                              borderTop: '1px solid #333',
                              minHeight: '40px',
                              '& .MuiAccordionSummary-content': { my: 1 }
                            }}
                          >
                            <Typography variant="subtitle2" sx={{ color: 'grey.300', fontWeight: 'medium' }}>
                              Available Catalogs ({addon.catalogs.length})
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails sx={{ p: 0, pl: 1, pt: 1 }}>
                            <Typography variant="caption" sx={{ color: 'grey.500', mb: 1, display: 'block' }}>
                              Toggle catalogs to show/hide on homepage
                            </Typography>
                            <FormGroup>
                              {addon.catalogs.map(catalog => {
                                const catalogId = getCatalogUniqueId(catalog);
                                return (
                                  <FormControlLabel
                                    key={catalogId}
                                    control={
                                      <Checkbox
                                        size="small"
                                        checked={addon.selectedCatalogIds?.includes(catalogId) || false}
                                        onChange={() => handleToggleCatalog(addon.manifestUrl, catalogId)}
                                        sx={{ color: 'grey.500', '&.Mui-checked': { color: '#e50914' } }}
                                      />
                                    }
                                    label={catalog.name || `${catalog.type} - ${catalog.id}`}
                                    sx={{ '.MuiFormControlLabel-label': { fontSize: '0.9rem', color: 'grey.200' } }}
                                  />
                                );
                              })}
                            </FormGroup>
                          </AccordionDetails>
                        </Accordion>
                      )}
                    </Paper>
                  ))}
                </List>
              )}
            </>
          )}

          {/* CATALOGS TAB */}
          {activeTab === 1 && (
            <>
              <Typography variant="h5" component="h2" sx={{ mb: 3, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon sx={{ color: '#e50914' }} />
                Catalog Configuration
              </Typography>

              {!installedAddons || installedAddons.length === 0 ? (
                <Alert severity="info" sx={{ backgroundColor: '#1f1f1f', color: 'white' }}>
                  No addons installed yet. Install addons first to configure catalogs.
                </Alert>
              ) : Object.keys(catalogsByType).length === 0 ? (
                <Alert severity="info" sx={{ backgroundColor: '#1f1f1f', color: 'white' }}>
                  No catalogs available from installed addons.
                </Alert>
              ) : (
                <Box>
                  {/* Group catalogs by type for better organization */}
                  {Object.entries(catalogsByType).map(([type, catalogItems]) => (
                    <Card key={type} sx={{ mb: 3, backgroundColor: '#1f1f1f', borderRadius: '8px', overflow: 'visible' }}>
                      <CardHeader 
                        title={type.charAt(0).toUpperCase() + type.slice(1)} 
                        sx={{ 
                          pb: 1,
                          '.MuiCardHeader-title': { 
                            color: 'white', 
                            fontWeight: 'bold',
                            fontSize: '1.1rem'
                          }
                        }}
                      />
                      <Divider sx={{ borderColor: '#333' }} />
                      <CardContent>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -0.5 }}>
                          {catalogItems.map(({catalog, addon}) => {
                            const catalogId = getCatalogUniqueId(catalog);
                            const catalogName = catalog.name || catalog.id;
                            const isEnabled = addon.selectedCatalogIds?.includes(catalogId) || false;
                            
                            return (
                              <Box 
                                key={`${addon.id}-${catalogId}`}
                                sx={{ 
                                  width: { xs: '100%', sm: '50%', md: '33.333%' }, 
                                  p: 0.5 
                                }}
                              >
                                <Paper 
                                  sx={{ 
                                    p: 1.5, 
                                    backgroundColor: isEnabled ? 'rgba(229, 9, 20, 0.1)' : '#262626', 
                                    borderRadius: '4px',
                                    border: isEnabled ? '1px solid rgba(229, 9, 20, 0.3)' : '1px solid #333',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                      backgroundColor: isEnabled ? 'rgba(229, 9, 20, 0.15)' : '#2e2e2e'
                                    }
                                  }}
                                >
                                  <FormControlLabel
                                    control={
                                      <Checkbox
                                        size="small"
                                        checked={isEnabled}
                                        onChange={() => handleToggleCatalog(addon.manifestUrl, catalogId)}
                                        sx={{ color: 'grey.500', '&.Mui-checked': { color: '#e50914' } }}
                                      />
                                    }
                                    label={
                                      <Box>
                                        <Typography variant="body2" sx={{ color: 'white', fontWeight: isEnabled ? 'bold' : 'normal' }}>
                                          {catalogName}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'grey.400', display: 'block' }}>
                                          From: {addon.name}
                                        </Typography>
                                      </Box>
                                    }
                                    sx={{ 
                                      m: 0,
                                      width: '100%', 
                                      '.MuiFormControlLabel-label': { width: '100%' } 
                                    }}
                                  />
                                </Paper>
                              </Box>
                            );
                          })}
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
} 