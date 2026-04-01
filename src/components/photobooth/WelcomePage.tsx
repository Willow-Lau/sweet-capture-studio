import { motion } from 'framer-motion';
import { Camera } from 'lucide-react';

interface WelcomePageProps {
  onStart: () => void;
}

export default function WelcomePage({ onStart }: WelcomePageProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ backgroundColor: '#FDFBF7' }}
    >
      <div
        className="pointer-events-none absolute -top-16 -right-12 w-48 h-48 rounded-full opacity-[0.35]"
        style={{ background: 'radial-gradient(circle, #F8D7E0 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute top-1/3 -left-20 w-56 h-56 rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, #F5C9D4 0%, transparent 72%)' }}
      />
      <div
        className="pointer-events-none absolute bottom-24 right-6 w-28 h-28 rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, #E8D4DC 0%, transparent 75%)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative z-10 text-center max-w-md"
      >
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-wide text-foreground mb-2">
          SweetL人生四格
        </h1>
        <p className="text-xs sm:text-sm tracking-[0.18em] text-muted-foreground uppercase mb-4">
          Photo Booth
        </p>
        <p className="text-base text-foreground/70 mb-10 font-light">咔嚓咔嚓生活美好</p>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          className="w-full max-w-xs mx-auto py-3.5 px-8 rounded-2xl text-[15px] font-medium text-white shadow-md transition-opacity hover:opacity-95 active:opacity-90"
          style={{ backgroundColor: '#E8A8BC', boxShadow: '0 8px 24px -6px rgba(232, 168, 188, 0.45)' }}
        >
          <Camera className="inline-block w-4 h-4 mr-2 -mt-0.5 opacity-95" />
          开始拍摄
        </motion.button>
      </motion.div>
    </div>
  );
}
