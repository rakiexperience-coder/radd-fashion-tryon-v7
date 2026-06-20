
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartScreen from './components/StartScreen';
import Canvas from './components/Canvas';
import WardrobePanel from './components/WardrobeModal';
import OutfitStack from './components/OutfitStack';
import { generateVirtualTryOnImage, generatePoseVariation, generateOutfitFromMoodBoard, refineOutfitWithGemini } from './services/geminiService';
import { OutfitLayer, WardrobeItem } from './types';
import { DownloadIcon, RotateCcwIcon, ShirtIcon, CheckCircleIcon } from './components/icons';
import { defaultWardrobe } from './wardrobe';
import Footer from './components/Footer';
import { getFriendlyErrorMessage } from './lib/utils';
import Spinner from './components/Spinner';
import MoodBoardPanel from './components/AddProductModal';
import GenerationHistory, { HistoryImage } from './components/GenerationHistory';

// --- Types & Constants ---
const POSE_INSTRUCTIONS = [
  "Slightly turned, 3/4 view",
  "Side profile view",
  "Walking towards camera",
  "Leaning against a wall",
  "Sitting legs crossed hand on chin, sitting on a chair",
  "Sitting legs crossed on the floor",
  "Runway walk",
  "Playful twirl",
  "Cross-legged stance",
  "Hand in hair"
];

const LICENSE_KEY = "RADDVIP";
const LS_LICENSE_KEY = "radd_license";

// --- Custom Hooks ---
const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQueryList.addEventListener('change', listener);
    return () => mediaQueryList.removeEventListener('change', listener);
  }, [query]);
  return matches;
};

// --- Sub-components (Gates) ---

const LicenseGate: React.FC<{ onGranted: () => void }> = ({ onGranted }) => {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim().toUpperCase() === LICENSE_KEY) {
      localStorage.setItem(LS_LICENSE_KEY, LICENSE_KEY);
      onGranted();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-gray-100 text-center"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#A4823F]/10 rounded-full flex items-center justify-center">
            <ShirtIcon className="w-8 h-8 text-[#A4823F]" />
          </div>
        </div>
        <h1 className="text-3xl font-serif font-bold text-[#A4823F] mb-2">Private Studio Access</h1>
        <p className="text-gray-500 mb-8">Enter your VIP license code to unlock the RADD Virtual Try-On Studio.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="text" 
            placeholder="License Key" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className={`w-full px-6 py-4 rounded-xl border-2 transition-all outline-none text-center tracking-widest font-semibold uppercase ${error ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-[#A4823F]'}`}
          />
          {error && <p className="text-red-500 text-xs font-bold uppercase tracking-widest">Invalid VIP Access Code</p>}
          <button 
            type="submit"
            className="w-full bg-[#A4823F] text-white py-4 rounded-xl font-bold hover:bg-[#937438] transition-colors shadow-lg shadow-[#A4823F]/20"
          >
            Activate Studio
          </button>
        </form>
        <p className="mt-8 text-xs text-gray-400 uppercase tracking-tighter">Authorized RADD Fashion Digital Den Personnel Only</p>
      </motion.div>
    </div>
  );
};

// --- Refinement Component ---
interface GeminiChatPanelProps {
  onRefine: (prompt: string) => void;
  isLoading: boolean;
  refineError: string | null;
}

const GeminiChatPanel: React.FC<GeminiChatPanelProps> = ({ onRefine, isLoading, refineError }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onRefine(prompt.trim());
      setPrompt('');
    }
  };

  return (
    <div className="chat-section pt-6 border-t border-gray-400/50">
      <h2 className="text-xl font-serif tracking-wider mb-3" style={{ color: '#A4823F' }}>Chat with Gemini (Refine Look)</h2>
       <p className="text-sm text-gray-600 mb-4">
        Describe a quick outfit fix, e.g., "remove the bag" or "change top to white crop".
      </p>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe a quick outfit fix..."
          disabled={isLoading}
          className="flex-grow w-full px-4 py-2 text-base text-gray-700 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#a4823f] focus:border-transparent transition disabled:opacity-60 disabled:bg-gray-100"
          aria-label="Outfit refinement prompt"
        />
        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="flex-shrink-0 flex items-center justify-center px-4 py-2 text-base font-semibold text-white bg-[#a4823f] rounded-md cursor-pointer group hover:bg-[#937438] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Send refinement prompt"
        >
          Send
        </button>
      </form>
      {refineError && <p className="text-red-500 text-sm mt-2">{refineError}</p>}
    </div>
  );
};

// --- Main App Component ---
const App: React.FC = () => {
  // Gate States
  const [isLicensed, setIsLicensed] = useState(() => localStorage.getItem(LS_LICENSE_KEY) === LICENSE_KEY);

  // App States
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);
  const [outfitHistory, setOutfitHistory] = useState<OutfitLayer[]>([]);
  const [currentOutfitIndex, setCurrentOutfitIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(defaultWardrobe);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const handleResetAccess = () => {
    localStorage.removeItem(LS_LICENSE_KEY);
    handleStartOver();
  };

  const activeOutfitLayers = useMemo(() => 
    outfitHistory.slice(0, currentOutfitIndex + 1), 
    [outfitHistory, currentOutfitIndex]
  );
  
  const activeGarmentIds = useMemo(() => 
    activeOutfitLayers.map(layer => layer.garment?.id).filter(Boolean) as string[], 
    [activeOutfitLayers]
  );
  
  const displayImageUrl = useMemo(() => {
    if (outfitHistory.length === 0) return modelImageUrl;
    const currentLayer = outfitHistory[currentOutfitIndex];
    if (!currentLayer) return modelImageUrl;
    const poseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
    return currentLayer.poseImages[poseInstruction] ?? Object.values(currentLayer.poseImages)[0];
  }, [outfitHistory, currentOutfitIndex, currentPoseIndex, modelImageUrl]);

  const availablePoseKeys = useMemo(() => {
    if (outfitHistory.length === 0) return [];
    const currentLayer = outfitHistory[currentOutfitIndex];
    return currentLayer ? Object.keys(currentLayer.poseImages) : [];
  }, [outfitHistory, currentOutfitIndex]);

  const generationHistory = useMemo((): HistoryImage[] => {
    const uniqueImages = new Map<string, { outfitIndex: number; poseInstruction: string }>();
    outfitHistory.forEach((layer, outfitIndex) => {
      POSE_INSTRUCTIONS.forEach(poseInstruction => {
        const imageUrl = layer.poseImages[poseInstruction];
        if (imageUrl && !uniqueImages.has(imageUrl)) {
          uniqueImages.set(imageUrl, { outfitIndex, poseInstruction });
        }
      });
    });
    return Array.from(uniqueImages.entries()).map(([imageUrl, data]) => ({
      imageUrl,
      ...data,
    }));
  }, [outfitHistory]);

  const handleModelFinalized = (url: string) => {
    setModelImageUrl(url);
    setOutfitHistory([{
      garment: null,
      poseImages: { [POSE_INSTRUCTIONS[0]]: url }
    }]);
    setCurrentOutfitIndex(0);
  };

  const handleStartOver = () => {
    setModelImageUrl(null);
    setOutfitHistory([]);
    setCurrentOutfitIndex(0);
    setIsLoading(false);
    setLoadingMessage('');
    setError(null);
    setRefineError(null);
    setCurrentPoseIndex(0);
    setWardrobe(defaultWardrobe);
  };

  const handleDownload = () => {
    if (!displayImageUrl) return;
    const link = document.createElement('a');
    link.href = displayImageUrl;
    link.download = 'radd-fashion-outfit.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApiError = useCallback((err: any) => {
    const msg = String(err);
    if (msg.includes("Requested entity was not found.")) {
      return "API Key session expired or invalid. Please reconnect your API key.";
    }
    return getFriendlyErrorMessage(msg, 'Action failed');
  }, []);

  const handleGarmentSelect = useCallback(async (garmentFile: File, garmentInfo: WardrobeItem) => {
    if (!displayImageUrl || isLoading) return;
    const nextLayer = outfitHistory[currentOutfitIndex + 1];
    if (nextLayer && nextLayer.garment?.id === garmentInfo.id) {
        setCurrentOutfitIndex(prev => prev + 1);
        setCurrentPoseIndex(0);
        return;
    }
    setError(null);
    setRefineError(null);
    setIsLoading(true);
    setLoadingMessage(`Adding ${garmentInfo.name}...`);
    try {
      const newImageUrl = await generateVirtualTryOnImage(displayImageUrl, garmentFile);
      const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
      const newLayer: OutfitLayer = { garment: garmentInfo, poseImages: { [currentPoseInstruction]: newImageUrl } };
      setOutfitHistory(prev => [...prev.slice(0, currentOutfitIndex + 1), newLayer]);
      setCurrentOutfitIndex(prev => prev + 1);
      setWardrobe(prev => prev.find(item => item.id === garmentInfo.id) ? prev : [...prev, garmentInfo]);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, currentPoseIndex, outfitHistory, currentOutfitIndex, handleApiError]);

  const handleRemoveLastGarment = () => {
    if (currentOutfitIndex > 0) {
      setCurrentOutfitIndex(prevIndex => prevIndex - 1);
      setCurrentPoseIndex(0);
    }
  };
  
  const handlePoseSelect = useCallback(async (newIndex: number) => {
    if (isLoading || outfitHistory.length === 0 || newIndex === currentPoseIndex) return;
    const poseInstruction = POSE_INSTRUCTIONS[newIndex];
    const currentLayer = outfitHistory[currentOutfitIndex];
    if (currentLayer.poseImages[poseInstruction]) {
      setCurrentPoseIndex(newIndex);
      return;
    }
    const baseImageForPoseChange = Object.values(currentLayer.poseImages)[0];
    if (!baseImageForPoseChange) return;
    setError(null);
    setRefineError(null);
    setIsLoading(true);
    setLoadingMessage(`Changing pose...`);
    const prevPoseIndex = currentPoseIndex;
    setCurrentPoseIndex(newIndex);
    try {
      const newImageUrl = await generatePoseVariation(baseImageForPoseChange, poseInstruction);
      setOutfitHistory(prev => {
        const newHistory = [...prev];
        newHistory[currentOutfitIndex].poseImages[poseInstruction] = newImageUrl;
        return newHistory;
      });
    } catch (err) {
      setError(handleApiError(err));
      setCurrentPoseIndex(prevPoseIndex);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [currentPoseIndex, outfitHistory, isLoading, currentOutfitIndex, handleApiError]);

  const handleMoodBoardSelect = useCallback(async (moodFile: File) => {
    const baseModelUrl = modelImageUrl;
    if (!baseModelUrl || isLoading) return;
    setError(null);
    setRefineError(null);
    setIsLoading(true);
    setLoadingMessage('Applying mood board look...');
    try {
        const newImageUrl = await generateOutfitFromMoodBoard(baseModelUrl, moodFile);
        const moodBoardGarment: WardrobeItem = {
            id: `moodboard-${moodFile.name}-${Date.now()}`,
            name: `Mood Board Look`,
            url: URL.createObjectURL(moodFile),
        };
        const newLayer: OutfitLayer = { garment: moodBoardGarment, poseImages: { [POSE_INSTRUCTIONS[0]]: newImageUrl } };
        setOutfitHistory(prev => [...prev.slice(0, 1), newLayer]);
        setCurrentOutfitIndex(1);
        setCurrentPoseIndex(0);
        setWardrobe(prev => prev.find(item => item.id === moodBoardGarment.id) ? prev : [...prev, moodBoardGarment]);
    } catch (err) {
        setError(handleApiError(err));
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [modelImageUrl, isLoading, handleApiError]);

  const handleGeminiChatRefine = useCallback(async (prompt: string) => {
    if (!displayImageUrl || isLoading) return;
    setError(null);
    setRefineError(null);
    setIsLoading(true);
    setLoadingMessage('Updating outfit with Gemini...');
    try {
      const newImageUrl = await refineOutfitWithGemini(displayImageUrl, prompt);
      const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
      setOutfitHistory(prev => {
        const newHistory = [...prev];
        const currentLayer = { ...newHistory[currentOutfitIndex] };
        currentLayer.poseImages = { ...currentLayer.poseImages, [currentPoseInstruction]: newImageUrl };
        newHistory[currentOutfitIndex] = currentLayer;
        return newHistory;
      });
    } catch (err) {
      setRefineError(handleApiError(err));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, currentOutfitIndex, currentPoseIndex, handleApiError]);

  const handleHistoryImageSelect = useCallback((outfitIndex: number, poseInstruction: string) => {
    if (isLoading) return;
    const poseIndex = POSE_INSTRUCTIONS.indexOf(poseInstruction);
    if (poseIndex !== -1) {
      setCurrentOutfitIndex(outfitIndex);
      setCurrentPoseIndex(poseIndex);
    }
  }, [isLoading]);

  // Render Conditional Gates
  if (!isLicensed) return <LicenseGate onGranted={() => setIsLicensed(true)} />;

  const viewVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
  };

  return (
    <div className="font-sans bg-white">
      <AnimatePresence mode="wait">
        {!modelImageUrl ? (
          <motion.div
            key="start-screen"
            className="w-screen min-h-screen flex items-start sm:items-center justify-center bg-gray-50 p-4"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <StartScreen onModelFinalized={handleModelFinalized} />
          </motion.div>
        ) : (
          <motion.div
            key="main-app"
            className="min-h-screen flex flex-col"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <main className="flex-1 pb-12 md:pb-24">
              <div className="mx-auto max-w-[1200px] w-full px-4 md:px-6 lg:px-8 flex flex-col md:flex-row gap-8 md:gap-12 md:items-start pt-6 md:pt-8">
                <section className="flex-1 min-w-0 md:sticky md:top-8" id="preview-column">
                  <div className="flex flex-col items-center gap-4 mx-auto w-full max-w-[720px]">
                    <div className="w-full">
                      <Canvas 
                        displayImageUrl={displayImageUrl}
                        isLoading={isLoading}
                        loadingMessage={loadingMessage}
                        onSelectPose={handlePoseSelect}
                        poseInstructions={POSE_INSTRUCTIONS}
                        currentPoseIndex={currentPoseIndex}
                        availablePoseKeys={availablePoseKeys}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 justify-center sticky md:static bottom-4 z-10 w-full">
                      <button 
                          onClick={handleStartOver}
                          className="flex items-center justify-center bg-[#a4823f] text-white border-none px-6 py-2.5 rounded-full font-semibold cursor-pointer transition-opacity hover:opacity-90 whitespace-nowrap"
                      >
                          <RotateCcwIcon className="w-4 h-4 mr-2" />
                          Start Over
                      </button>
                      <button 
                          onClick={handleResetAccess}
                          className="flex items-center justify-center bg-gray-200 text-gray-700 border-none px-6 py-2.5 rounded-full font-semibold cursor-pointer transition-opacity hover:opacity-90 whitespace-nowrap"
                      >
                          Reset Studio Access
                      </button>
                      {displayImageUrl && (
                        <button 
                            onClick={handleDownload}
                            className="flex items-center justify-center bg-[#a4823f] text-white border-none px-6 py-2.5 rounded-full font-semibold cursor-pointer transition-opacity hover:opacity-90 whitespace-nowrap"
                        >
                            <DownloadIcon className="w-4 h-4 mr-2" />
                            Download
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                <aside id="controls-column" className="w-full md:w-[360px] lg:w-[380px] xl:w-[420px] md:shrink-0">
                    <div className="flex flex-col gap-[1.2rem]">
                      {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                          <p className="font-bold">Error</p>
                          <p>{error}</p>
                        </div>
                      )}
                      <OutfitStack outfitHistory={activeOutfitLayers} onRemoveLastGarment={handleRemoveLastGarment} />
                      <MoodBoardPanel onMoodBoardSelect={handleMoodBoardSelect} isLoading={isLoading} />
                      <WardrobePanel onGarmentSelect={handleGarmentSelect} activeGarmentIds={activeGarmentIds} isLoading={isLoading} wardrobe={wardrobe} />
                      <GeminiChatPanel onRefine={handleGeminiChatRefine} isLoading={isLoading} refineError={refineError} />
                      <GenerationHistory historyImages={generationHistory} onSelect={handleHistoryImageSelect} currentImageUrl={displayImageUrl} isLoading={isLoading} />
                    </div>
                </aside>
              </div>
            </main>
            
            <AnimatePresence>
              {isLoading && isMobile && (
                <motion.div
                  className="fixed inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Spinner />
                  {loadingMessage && <p className="text-lg font-serif text-gray-700 mt-4 text-center px-4">{loadingMessage}</p>}
                </motion.div>
              )}
            </AnimatePresence>
            <Footer isOnDressingScreen={!!modelImageUrl} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
