import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppContent } from './App.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { AppStateProvider } from './context/AppStateContext.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </ThemeProvider>
  </React.StrictMode>
);
