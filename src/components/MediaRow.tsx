'use client';

import React, { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { SxProps, Theme } from '@mui/material/styles';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

// Add the image enhancement helper function
const getEnhancedImageUrl = (url: string): string => {
  if (!url) return '';
  
  // Convert metahub background URLs from medium to large
  if (url.includes('images.metahub.space/background/medium/')) {
    return url.replace('/background/medium/', '/background/large/');
  }
  
  // Convert metahub poster URLs from medium to large if needed
  if (url.includes('images.metahub.space/poster/medium/')) {
    return url.replace('/poster/medium/', '/poster/large/');
  }
  
  // Convert metahub logo URLs from medium to large if needed
  if (url.includes('images.metahub.space/logo/medium/')) {
    return url.replace('/logo/medium/', '/logo/large/');
  }
  
  return url;
};

interface MediaItem {
  id: string | number;
  imageUrl: string;
  alt: string;
  type?: string; // Add type for content categorization (movie, series, etc.)
  logoUrl?: string; // Add logoUrl here as well
  isLoading?: boolean; // Flag to indicate loading state
}

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  addonId?: string; // Optional addon ID for tracking source
  disableBottomMargin?: boolean; // New prop
  imageType?: 'poster' | 'backdrop'; // New prop for image aspect ratio
}

const MediaRow: React.FC<MediaRowProps> = ({ title, items, addonId, disableBottomMargin, imageType = 'poster' }) => {
  const router = useRouter();
  const rowRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
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

  const isBackdrop = imageType === 'backdrop';

  // Check if we can scroll left or right
  const checkScrollability = () => {
    if (rowRef.current) {
      setCanScrollLeft(rowRef.current.scrollLeft > 0);
      setCanScrollRight(
        rowRef.current.scrollLeft < 
        rowRef.current.scrollWidth - rowRef.current.clientWidth - 10 // 10px threshold
      );
    }
  };

  // Scroll the row left or right
  const handleScroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const scrollAmount = rowRef.current.clientWidth * 0.8; // Scroll 80% of the visible width
      const newPosition = direction === 'left' 
        ? rowRef.current.scrollLeft - scrollAmount 
        : rowRef.current.scrollLeft + scrollAmount;
      
      rowRef.current.scrollTo({
        left: newPosition,
        behavior: 'smooth'
      });
      
      // Update scroll buttons visibility after scrolling
      setTimeout(checkScrollability, 400); // Check after scroll animation
    }
  };

  const getItemSx = (): SxProps<Theme> => {
    const baseStyles: SxProps<Theme> = {
      position: 'relative',
      borderRadius: '6px',
      overflow: 'hidden',
      backgroundColor: 'grey.800',
      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
      '&:hover': {
        transform: 'scale(1.07) translateZ(0)', // Slightly more pop, ensure hardware acceleration
        cursor: 'pointer',
        boxShadow: '0px 8px 20px rgba(0,0,0,0.6)',
        zIndex: 10, // Ensure hovered item comes to the front
      }
    };

    if (isBackdrop) {
      return {
        ...baseStyles,
        minWidth: { xs: '220px', sm: '280px', md: '320px' }, // Width for backdrop
        height: { xs: '124px', sm: '158px', md: '180px' },   // Height for 16:9 (width * 9/16)
        // aspectRatio is NOT set here, width/height define it
      };
    } else {
      // Poster styles
      return {
        ...baseStyles,
        minWidth: { xs: '140px', sm: '170px', md: '200px' },
        aspectRatio: '2 / 3', // aspectRatio IS set here
      };
    }
  };

  // Debug output
  // console.log(`MediaRow received title: "${title}"`);
  // console.log(`Split into catalogName: "${catalogName}" and addonName: "${addonName}"`);
  // console.log(`Image type: ${imageType}`);

  return (
    <Box 
      sx={{ 
        mb: disableBottomMargin ? 0 : 5, 
        ml: { xs: 2, md: 4 },
        mr: { xs: 2, md: 4 },
        position: 'relative'
      }}
      onMouseEnter={() => {
        setShowControls(true);
        checkScrollability();
      }}
      onMouseLeave={() => setShowControls(false)}
    >
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
      
      {/* Scroll Left Button */}
      {showControls && canScrollLeft && (
        <IconButton
          onClick={() => handleScroll('left')}
          sx={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 20,
            color: 'white',
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.7)'
            },
            width: '40px',
            height: '80px',
            borderRadius: '4px'
          }}
        >
          <ArrowBackIosNewIcon />
        </IconButton>
      )}
      
      {/* Media Items Row */}
      <Box 
        ref={rowRef}
        onScroll={checkScrollability}
        sx={{
          display: 'flex',
          overflowX: 'auto',
          gap: 2.5,
          pb: 2, // Padding at the bottom for scrollbar room
          pt: 1, // Add some padding top to allow for scale effect without cutting off top
          perspective: '1000px', // For 3D hover effect if desired
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
            sx={getItemSx()} // Apply dynamic styles
          >
            {item.isLoading ? (
              // Skeleton loading animation
              <Skeleton
                variant="rectangular"
                animation="wave"
                width="100%"
                height="100%"
                sx={{
                  bgcolor: 'grey.800',
                  '&::after': {
                    background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
                  },
                }}
              />
            ) : (
              // Normal image when loaded
              <Image
                src={getEnhancedImageUrl(item.imageUrl)}
                alt={item.alt}
                layout="fill"
                objectFit="cover"
                quality={isBackdrop ? 75 : 80} // Slightly lower quality for larger backdrop images if needed
                loading="lazy" // Add lazy loading for rows
                sizes={isBackdrop ? "(max-width: 600px) 220px, (max-width: 900px) 280px, 320px" : "(max-width: 600px) 140px, (max-width: 900px) 170px, 200px"}
              />
            )}
            {item.logoUrl && !item.isLoading && (
              <Box sx={{
                position: 'absolute',
                bottom: '8px',
                left: '8px',
                width: isBackdrop ? '40%' : '60%', // Adjust logo size based on image type
                maxWidth: isBackdrop ? '120px' : '100px', 
                maxHeight: isBackdrop ? '50px' : '40px',
                zIndex: 2, // Ensure logo is above the main image
                transition: 'opacity 0.3s ease',
                opacity: 0.9, // Slightly transparent by default
                'img': { // Target the img tag directly for objectFit
                    objectFit: 'contain',
                },
                '.item:hover &': { //This syntax might not work directly in sx, consider separate class or JS
                    opacity: 1,
                }
              }}>
                <Image 
                  src={getEnhancedImageUrl(item.logoUrl)}
                  alt={`${item.alt} logo`}
                  layout="fill"
                  // objectFit="contain" // Applied via sx to parent img tag instead
                  quality={70}
                />
              </Box>
            )}
          </Box>
        ))}
      </Box>
      
      {/* Scroll Right Button */}
      {showControls && canScrollRight && (
        <IconButton
          onClick={() => handleScroll('right')}
          sx={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 20,
            color: 'white',
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.7)'
            },
            width: '40px',
            height: '80px',
            borderRadius: '4px'
          }}
        >
          <ArrowForwardIosIcon />
        </IconButton>
      )}
    </Box>
  );
};

export default MediaRow; 