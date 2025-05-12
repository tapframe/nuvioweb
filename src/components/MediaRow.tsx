'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface MediaItem {
  id: string | number;
  imageUrl: string;
  alt: string;
  type?: string; // Add type for content categorization (movie, series, etc.)
}

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  addonId?: string; // Optional addon ID for tracking source
}

const MediaRow: React.FC<MediaRowProps> = ({ title, items, addonId }) => {
  const router = useRouter();
  
  // Split the title by the bullet character to separate catalog name from addon name
  const titleParts = title.split(' • ');
  const catalogName = titleParts[0];
  const addonName = titleParts.length > 1 ? titleParts[1] : null;
  
  // Handle click on media item
  const handleItemClick = (item: MediaItem) => {
    // Navigate to the details page with the item ID and addon ID (if available)
    const type = item.type || 'movie'; // Default to movie if type is not provided
    router.push(`/details/${type}/${item.id}?${addonId ? `addonId=${addonId}` : ''}`);
  };

  // Debug output
  console.log(`MediaRow received title: "${title}"`);
  console.log(`Split into catalogName: "${catalogName}" and addonName: "${addonName}"`);

  return (
    <Box sx={{ mb: 5, ml: { xs: 3, md: 7.5 } /* Match Hero margin */ }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 2 }}>
        {/* Main catalog title */}
        <Typography variant="h5" component="h2" fontWeight="bold" sx={{ color: 'white' }}>
          {catalogName}
        </Typography>
        
        {/* Addon source name */}
        {addonName && (
          <Typography 
            variant="body2" 
            component="span" 
            sx={{ 
              color: 'grey.500', 
              ml: 1.5, 
              fontSize: '0.8rem',
              fontWeight: 'normal' 
            }}
          >
            {addonName}
          </Typography>
        )}
      </Box>
      
      <Box 
        sx={{
          display: 'flex',
          overflowX: 'auto',
          gap: 2.5,
          pb: 2, // Padding at the bottom for scrollbar room
          // Hide scrollbar visually but keep functionality
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          msOverflowStyle: 'none',  // Changed to camelCase
          scrollbarWidth: 'none',  // Changed to camelCase
        }}
      >
        {items.map((item) => (
          <Box 
            key={item.id} 
            onClick={() => handleItemClick(item)}
            sx={{
              position: 'relative',
              minWidth: { xs: '140px', sm: '170px', md: '200px' },
              aspectRatio: '2 / 3',
              borderRadius: '6px',
              overflow: 'hidden',
              backgroundColor: 'grey.800', // Placeholder bg
              transition: 'transform 0.3s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                cursor: 'pointer',
                // Consider adding hover effects here
              }
            }}
          >
            <Image
              src={item.imageUrl}
              alt={item.alt}
              layout="fill"
              objectFit="cover"
            />
            {/* Add overlay or other info on hover if needed */}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default MediaRow; 