import {
  useState,
  startTransition,
  useCallback,
  memo,
  useEffect,
  Suspense,
  lazy,
  type ComponentType,
} from "react";
import "./styles/globals.css";
import { ThemeProvider } from "./components/ThemeContext";
import HeroSection from "./components/HeroSection";
import PageTransition from "./components/PageTransition";
import AccessibilityProvider from "./components/AccessibilityProvider";
import { isFeatureEnabled } from "./featureFlags";

type HomePageProps = { onBackToLanding: () => void };
type HomePageModule = typeof import("./components/HomePage");

const lazyHomeEnabled = isFeatureEnabled("lazyHomePage");

let homePageModulePromise: Promise<HomePageModule> | null = null;

function ensureHomePageModule() {
  if (!homePageModulePromise) {
    homePageModulePromise = import("./components/HomePage");
  }
  return homePageModulePromise;
}

export function preloadHomePage() {
  return ensureHomePageModule();
}

let HomePageComponent: ComponentType<HomePageProps>;

if (lazyHomeEnabled) {
  HomePageComponent = lazy(async () => ensureHomePageModule());
} else {
  const module = await ensureHomePageModule();
  HomePageComponent = module.default;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<'landing' | 'home'>('landing');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [nextPage, setNextPage] = useState<'landing' | 'home' | null>(null);

  const navigateToHome = useCallback(() => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    setNextPage('home');

    if (lazyHomeEnabled) {
      void preloadHomePage();
    }
    
    // Smooth transition with proper timing
    setTimeout(() => {
      startTransition(() => {
        setCurrentPage('home');
        setNextPage(null);
        setIsTransitioning(false);
      });
    }, 600); // Match CSS transition duration
  }, [isTransitioning]);

  const navigateToLanding = useCallback(() => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    setNextPage('landing');
    
    setTimeout(() => {
      startTransition(() => {
        setCurrentPage('landing');
        setNextPage(null);
        setIsTransitioning(false);
      });
    }, 600);
  }, [isTransitioning]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const targetPage = event.state?.page || 'landing';
      if (targetPage !== currentPage) {
        if (targetPage === 'home') {
          navigateToHome();
        } else {
          navigateToLanding();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Set initial history state
    window.history.replaceState({ page: currentPage }, '', window.location.pathname);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentPage, navigateToHome, navigateToLanding]);

  // Update browser history on page change
  useEffect(() => {
    if (!isTransitioning) {
      const url = currentPage === 'home' ? '/#home' : '/';
      window.history.pushState({ page: currentPage }, '', url);
    }
  }, [currentPage, isTransitioning]);

  return (
    <ThemeProvider>
      <AccessibilityProvider>
        <PageTransition 
          isTransitioning={isTransitioning} 
          direction={nextPage === 'home' ? 'forward' : 'backward'}
        >
          {currentPage === 'landing' ? (
            <LandingPage onNavigateToHome={navigateToHome} />
          ) : (
            <Suspense fallback={<HomePageFallback />}>
              <HomePageComponent onBackToLanding={navigateToLanding} />
            </Suspense>
          )}
        </PageTransition>
      </AccessibilityProvider>
    </ThemeProvider>
  );
}

// Landing Page Component - Optimized for performance
const LandingPage = memo(function LandingPage({ onNavigateToHome }: { onNavigateToHome: () => void }) {
  return (
    <div className="landing-page-wrapper">
      <main className="main-wrapper" id="main-content" role="main">
        <HeroSection onNavigateToHome={onNavigateToHome} />
        <div className="custom-background page-top" aria-hidden="true"></div>
      </main>
    </div>
  );
});

const HomePageFallback = memo(function HomePageFallback() {
  return (
    <div className="home-page-wrapper" role="status" aria-live="polite">
      <div className="custom-background page-top" aria-hidden="true"></div>
      <div className="main-wrapper flex items-center justify-center min-h-screen">
        <p className="text-white/80 text-lg tracking-wide">Loading the experience…</p>
      </div>
    </div>
  );
});