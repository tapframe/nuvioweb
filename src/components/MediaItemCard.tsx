'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Image from 'next/image';
import Typography from '@mui/material/Typography';

// Assuming MediaItem interface is defined elsewhere or passed correctly
// Re-defining here for clarity, ensure it matches the definition in page.tsx
interface MediaItem {
  id: string | number;
  imageUrl: string; // Standard poster
  alt: string;
  landscapeImageUrl?: string; // Optional landscape/background image
}

interface MediaItemCardProps {
  item: MediaItem;
}

const MediaItemCard: React.FC<MediaItemCardProps> = ({ item }) => {
  const displayImageUrl = item.landscapeImageUrl || item.imageUrl;

  return (
    <Box 
      sx={{
        position: 'relative',
        // Adjust minWidth for horizontal aspect ratio
        minWidth: { xs: '200px', sm: '240px', md: '280px' }, 
        aspectRatio: '16 / 9', // Use a common horizontal aspect ratio
        borderRadius: '6px',
        overflow: 'hidden',
        backgroundColor: 'grey.800', // Placeholder bg
        transition: 'transform 0.3s ease',
        flexShrink: 0, // Prevent items from shrinking
        cursor: 'pointer',
        '&:hover': {
          transform: 'scale(1.05)',
          '& .title-overlay': { // Target the overlay on hover
            opacity: 1,
          }
        }
      }}
    >
      {displayImageUrl ? (
        <Image
          src={displayImageUrl}
          alt={item.alt}
          layout="fill"
          objectFit="cover" // Cover will fill the 16:9 box, cropping if necessary
          onError={(e) => {
            // Optional: Handle image loading errors, e.g., show a placeholder
            console.error(`Failed to load image: ${displayImageUrl}`);
            // Potentially set a state to show a fallback UI
            (e.target as HTMLImageElement).style.display = 'none'; // Hide broken image
          }}
        />
      ) : (
        // Fallback UI if no image is available
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'grey.500' }}>
          {item.alt}
        </Box>
      )}
      
      {/* Title Overlay - Initially hidden, shown on hover */}
      <Box
        className="title-overlay" // Add className for targeting
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          p: 1.5, // Padding inside the overlay
          backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)', // Gradient overlay
          opacity: 0, // Initially hidden
          transition: 'opacity 0.3s ease',
          pointerEvents: 'none', // Allow clicks to pass through to the card
        }}
      >
        <Typography 
          variant="body2" 
          fontWeight="bold" 
          color="white" 
          noWrap // Prevent text wrapping
          sx={{ textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }} // Add shadow for readability
        >
          {item.alt}
        </Typography>
      </Box>
    </Box>
  );
};

export default MediaItemCard; 