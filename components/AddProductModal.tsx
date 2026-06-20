/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef } from 'react';
import { UploadCloudIcon } from './icons';

interface MoodBoardPanelProps {
  onMoodBoardSelect: (file: File) => void;
  isLoading: boolean;
}

const MoodBoardPanel: React.FC<MoodBoardPanelProps> = ({ onMoodBoardSelect, isLoading }) => {
  const moodBoardInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      onMoodBoardSelect(f);
    }
    if (e.target) {
        e.target.value = '';
    }
  };

  return (
    <div className="upload-section pt-6 border-t border-gray-400/50">
      <h2 className="text-xl font-serif tracking-wider mb-3" style={{ color: '#A4823F' }}>Mood Board (Optional)</h2>
      <p className="text-sm text-gray-600 mb-4">
        Upload an image to inspire a full outfit. The AI will restyle the model based on your mood board.
      </p>
      <button
        onClick={() => moodBoardInputRef.current?.click()}
        disabled={isLoading}
        className="w-full relative flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-[#a4823f] rounded-md cursor-pointer group hover:bg-[#937438] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <UploadCloudIcon className="w-5 h-5 mr-3" />
        Upload Mood Board
      </button>
      <input
        type="file"
        accept="image/*"
        ref={moodBoardInputRef}
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default MoodBoardPanel;