import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const navigate = useNavigate();
  const { setIntroPlayed } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  const handleComplete = useCallback(() => {
    setIntroPlayed(true);
    navigate('/login');
  }, [navigate, setIntroPlayed]);

  const tryPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const p = video.play();
    if (p?.catch) p.catch(() => {});
  };

  useEffect(() => {
    const timer = setTimeout(handleComplete, 10000);
    return () => clearTimeout(timer);
  }, [handleComplete]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    tryPlay();
    const onCanPlay = () => {
      tryPlay();
      setIsVideoLoaded(true);
    };
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('loadeddata', tryPlay);
    return () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadeddata', tryPlay);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center overflow-hidden">
      <div
        className={`relative w-full max-w-xs px-6 flex justify-center transition-opacity duration-[1500ms] ease-in-out ${
          isVideoLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onCanPlayThrough={() => {
            tryPlay();
            setIsVideoLoaded(true);
          }}
          onEnded={handleComplete}
          className="w-full h-auto rounded-xl"
          style={{ objectFit: 'contain' }}
        >
          <source src={`${import.meta.env.BASE_URL}assets/intro.mp4`} type="video/mp4" />
          Seu navegador não suporta vídeos.
        </video>
      </div>
    </div>
  );
};

export default Home;
