import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { sites } from '../api/client';
import type { Site } from '../types';

interface SiteContextType {
  currentSiteId: string | null;
  currentSite: Site | null;
  allSites: Site[];
  setCurrentSiteId: (id: string) => void;
  loading: boolean;
  refreshSites: () => Promise<void>;
}

const SiteContext = createContext<SiteContextType>({
  currentSiteId: null,
  currentSite: null,
  allSites: [],
  setCurrentSiteId: () => {},
  loading: true,
  refreshSites: async () => {},
});

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [currentSiteId, setCurrentSiteId] = useState<string | null>(
    () => localStorage.getItem('currentSiteId')
  );
  const [loading, setLoading] = useState(true);

  const refreshSites = useCallback(async () => {
    try {
      const data = await sites.list();
      setAllSites(data);
      if (!currentSiteId && data.length > 0) {
        const firstId = data[0].id;
        setCurrentSiteId(firstId);
        localStorage.setItem('currentSiteId', firstId);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSites();
  }, [refreshSites]);

  const selectSite = (id: string) => {
    setCurrentSiteId(id);
    localStorage.setItem('currentSiteId', id);
  };

  const currentSite = allSites.find((s) => s.id === currentSiteId) || allSites[0] || null;

  return (
    <SiteContext.Provider value={{
      currentSiteId: currentSite?.id || null,
      currentSite,
      allSites,
      setCurrentSiteId: selectSite,
      loading,
      refreshSites,
    }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  return useContext(SiteContext);
}
