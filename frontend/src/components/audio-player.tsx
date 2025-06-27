import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Volume2 } from 'lucide-react';

const AudioPlayer = ({ audioData }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = (e) => {
      console.error('Erreur audio:', e);
      setError('Impossible de charger l\'audio');
      setIsLoading(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', () => setIsLoading(false));

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioData?.url]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => {
        console.error('Erreur lecture:', err);
        setError('Erreur lors de la lecture');
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    if (!audioData?.url) return;
    
    const link = document.createElement('a');
    link.href = audioData.url;
    link.download = audioData.filename || 'audio.wav';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!audioData || !audioData.url) {
    return null;
  }

  return (
    <div className="w-full max-w-md mx-auto bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg p-6 text-white">
      <audio 
        ref={audioRef} 
        src={audioData.url} 
        preload="metadata"
      />
      
      <div className="mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Volume2 className="w-5 h-5" />
          Audio généré
        </h3>
        {error && (
          <p className="text-sm text-red-200 mt-1">{error}</p>
        )}
      </div>

      <div className="space-y-4">
        {/* Boutons de contrôle */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={togglePlayPause}
            disabled={isLoading || error}
            className="bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-full p-3 transition-all transform hover:scale-105"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-0.5" />
            )}
          </button>
          
          <button
            onClick={handleDownload}
            disabled={isLoading || error}
            className="bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-full p-3 transition-all transform hover:scale-105"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>

        {/* Barre de progression */}
        <div className="space-y-2">
          <div 
            className="h-2 bg-white/20 rounded-full cursor-pointer relative overflow-hidden"
            onClick={handleSeek}
          >
            <div 
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
            {isLoading && (
              <div className="absolute inset-0 bg-white/30 animate-pulse" />
            )}
          </div>
          
          <div className="flex justify-between text-sm">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Contrôle du volume */}
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="flex-1 h-2 bg-white/20 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, white ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`
            }}
          />
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
        </div>
      )}
    </div>
  );
};

// Exemple d'utilisation dans un composant de chat
const ChatMessage = ({ message }) => {
  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <p className="mb-4">{message.response}</p>
      
      {message.audioData && (
        <AudioPlayer audioData={message.audioData} />
      )}
    </div>
  );
};

// Démo
export default function AudioPlayerDemo() {
  const [messages, setMessages] = useState([
    {
      response: "🎉 Tadaaa ! Ton audio est prêt ! Clique sur play pour l'écouter.",
      audioData: {
        url: "http://localhost:3333/audio/sample_audio.wav",
        filename: "sample_audio.wav",
        mimeType: "audio/wav",
        duration: 10
      }
    }
  ]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Ekho Studio - Chat Audio</h1>
        
        <div className="space-y-4">
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
        </div>
      </div>
    </div>
  );
}