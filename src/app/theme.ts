'use client';
import { Roboto } from 'next/font/google';
import { createTheme } from '@mui/material/styles';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

const theme = createTheme({
  typography: {
    fontFamily: roboto.style.fontFamily,
  },
  // You can customize the theme further here
  // palette: {
  //   mode: 'dark', // Example: Set default mode to dark
  //   primary: {
  //     main: '#e50914', // Example: Netflix red
  //   },
  // },
});

export default theme; 