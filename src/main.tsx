import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { ScheduleProvider } from './context/ScheduleContext';
import { AnnouncementsProvider } from './context/AnnouncementsContext';
import { Toaster } from '@/components/ui/sonner';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter
      basename={import.meta.env.BASE_URL.replace(/\/$/, '')}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <ScheduleProvider>
          <AnnouncementsProvider>
            <App />
            <Toaster position="bottom-center" />
          </AnnouncementsProvider>
        </ScheduleProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
