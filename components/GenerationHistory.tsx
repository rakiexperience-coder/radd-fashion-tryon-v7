/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

export interface HistoryImage {
  imageUrl: string;
  outfitIndex: number;
  poseInstruction: string;
}

interface GenerationHistoryProps {
  historyImages: HistoryImage[];
  onSelect: (outfitIndex: number, poseInstruction: string) => void;
  currentImageUrl: string | null;
  isLoading: boolean;
}

const GenerationHistory: React.FC<GenerationHistoryProps> = ({ historyImages, onSelect, currentImageUrl, isLoading }) => {
  // Only show history if there's more than just the initial base image.
  if (historyImages.length <= 1) {
    return null;
  }

  return (
    <div className="generation-history">
      <h2 className="text-xl font-serif tracking-wider mb-3" style={{ color: '#A4823F' }}>Generation History</h2>
      <div className="grid grid-cols-4 gap-2">
        {historyImages.map(({ imageUrl, outfitIndex, poseInstruction }) => {
          const isSelected = currentImageUrl === imageUrl;
          return (
            <button
              key={imageUrl}
              onClick={() => onSelect(outfitIndex, poseInstruction)}
              disabled={isLoading}
              className={`relative aspect-square rounded-lg overflow-hidden transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#a4823f] group disabled:opacity-60 disabled:cursor-not-allowed
                ${isSelected ? 'ring-2 ring-[#a4823f]' : 'border border-gray-200 hover:border-[#a4823f]'}`}
              aria-label={`Select generated image ${outfitIndex + 1}`}
            >
              <img src={imageUrl} alt="Generated outfit history" className="w-full h-full object-cover" />
              {isSelected && (
                <div className="absolute inset-0 bg-[#a4823f]/40" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default GenerationHistory;