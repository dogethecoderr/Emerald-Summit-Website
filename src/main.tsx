import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ScheduleProvider } from './context/ScheduleContext';
import { AnnouncementsProvider } from './context/AnnouncementsContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { Toaster } from '@/components/ui/sonner';
import App from './App';
import { loadSummitContent } from './services/summitContent';
import { installDiagnostics } from './lib/diagnostics';

// Start recording recent pages, errors and failed requests for bug reports.
installDiagnostics();

// Tracks and sessions come from the database when it's reachable; until then
// (or without it) the bundled lists in src/models show.
void loadSummitContent();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter
      basename={import.meta.env.BASE_URL.replace(/\/$/, '')}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <ThemeProvider>
      <AuthProvider>
        <ScheduleProvider>
          <NotificationsProvider>
            <AnnouncementsProvider>
              <App />
              <Toaster position="bottom-center" />
            </AnnouncementsProvider>
          </NotificationsProvider>
        </ScheduleProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
