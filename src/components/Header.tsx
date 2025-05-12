'use client';

import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import SearchIcon from '@mui/icons-material/Search';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Image from 'next/image'; // Use next/image for logo
import NextLink from 'next/link'; // Import NextLink for client-side navigation

const navLinks = [
  { name: 'Home', href: '/' }, // Point Home to root
  { name: 'TV Shows', href: '#' },
  { name: 'Movies', href: '#' },
  { name: 'New & Popular', href: '#' },
  { name: 'My List', href: '#' },
  { name: 'Browse by Languages', href: '#' },
  { name: 'Addons', href: '/addons' }, // Added Addons link
];

// TODO: Add profile image from Figma node 5:408 if needed
const profileImageUrl = '/assets/icons/default-profile.png'; // Placeholder

const Header: React.FC = () => {
  return (
    <AppBar position="fixed" sx={{ background: 'transparent', backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 10%, rgba(0,0,0,0))', boxShadow: 'none' }}>
      <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 7.5 } /* Corresponds to 60px padding */ }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Netflix Logo */}
          <Link href="#" sx={{ lineHeight: 0 /* Prevents layout shift */ }}>
            <Image
              src="/assets/icons/netflix-logo.svg"
              alt="Netflix Logo"
              width={92} // Adjust size as needed based on original SVG
              height={25} // Adjust size as needed
              priority
            />
          </Link>
          {/* Navigation Links */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 2.5 /* Approx 20px */ }}>
            {navLinks.map((link) => (
              <Link
                key={link.name}
                component={NextLink} // Use NextLink for routing
                href={link.href}
                color="#e5e5e5" // Light gray, adjust based on Figma
                underline="none"
                sx={{ fontSize: '14px', fontWeight: 'normal', transition: 'color 0.3s', '&:hover': { color: '#b3b3b3' /* Slightly darker gray */ } }}
              >
                {link.name}
              </Link>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton color="inherit">
            <SearchIcon />
          </IconButton>
          <IconButton color="inherit">
            <NotificationsIcon />
          </IconButton>
          {/* Profile Avatar/Dropdown */}
          <IconButton sx={{ p: 0 }}>
            <Avatar alt="Profile" src={profileImageUrl} sx={{ width: 32, height: 32, borderRadius: '4px' /* From Figma */ }} />
            <img src="/assets/icons/dropdown-arrow-icon.svg" alt="Dropdown" style={{ marginLeft: '6px' }} />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
