'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
// import Image from 'next/image'; // No longer needed here
import MediaItemCard from './MediaItemCard'; // Import the new component

// Update interface reference if needed, ensuring it matches page.tsx
interface MediaItem {
  id: string | number;
  imageUrl: string; 
  alt: string;
  landscapeImageUrl?: string; 
}

interface MediaRowProps {
  title: string;
  items: MediaItem[];
}

const MediaRow: React.FC<MediaRowProps> = ({ title, items }) => {
  // Split the title by the bullet character to separate catalog name from addon name
  const titleParts = title.split(' • ');
  const catalogName = titleParts[0];
  const addonName = titleParts.length > 1 ? titleParts[1] : null;
  
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
          gap: 2, // Slightly reduced gap for potentially wider items
          pb: 2, // Padding at the bottom for scrollbar room
          // Hide scrollbar visually but keep functionality
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          msOverflowStyle: 'none', 
          scrollbarWidth: 'none', 
        }}
      >
        {items.map((item) => (
          // Use the new MediaItemCard component
          <MediaItemCard key={item.id} item={item} />
        ))}
      </Box>
    </Box>
  );
};

export default MediaRow; 