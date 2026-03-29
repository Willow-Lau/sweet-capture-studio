import { useEffect, useState } from 'react';
import WelcomePage from '@/components/photobooth/WelcomePage';
import FeatureSelectPage from '@/components/photobooth/FeatureSelectPage';
import PhotoBooth from '@/components/photobooth/PhotoBooth';
import {
  loadPhotosFromStorage,
  loadSessionFromStorage,
  BoothSessionPersist,
} from '@/lib/photobooth-utils';

type Flow = 'welcome' | 'select' | 'booth';

const Index = () => {
  const [flow, setFlow] = useState<Flow>('welcome');
  const [session, setSession] = useState<BoothSessionPersist | null>(null);

  useEffect(() => {
    const photos = loadPhotosFromStorage();
    const saved = loadSessionFromStorage();
    if (photos.length === 4 && saved) {
      setSession(saved);
      setFlow('booth');
    }
  }, []);

  if (flow === 'welcome') {
    return <WelcomePage onStart={() => setFlow('select')} />;
  }

  if (flow === 'select') {
    return (
      <FeatureSelectPage
        onBack={() => setFlow('welcome')}
        onStart={(cfg) => {
          setSession(cfg);
          setFlow('booth');
        }}
      />
    );
  }

  if (flow === 'booth' && session) {
    return (
      <PhotoBooth
        key={`${session.layout}-${session.captureMode}-${session.countdownSec}-${session.frame.id}-${session.frame.imageUrl?.substring(0, 48) ?? ''}`}
        session={session}
        onExit={() => setFlow('select')}
      />
    );
  }

  return <WelcomePage onStart={() => setFlow('select')} />;
};

export default Index;
