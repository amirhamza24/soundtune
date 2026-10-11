import { Undo2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BassTrebleControls } from './components/BassTrebleControls';
import { EffectsPanel } from './components/EffectsPanel';
import { Equalizer } from './components/Equalizer';
import { Header } from './components/Header';
import { NowPlaying } from './components/NowPlaying';
import { PresetSelector } from './components/PresetSelector';
import { VisualizerStage } from './components/VisualizerStage';
import { useStore } from './store';
import { SettingsView } from './views/SettingsView';

const EASE = [0.22, 1, 0.36, 1] as const;

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE, delay: 0.05 * i } }),
};

function Card({ i, children, className = '' }: { i: number; children: ReactNode; className?: string }): ReactNode {
  return (
    <motion.div custom={i} variants={rise} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

function ToastView(): ReactNode {
  const { toast, dismissToast } = useStore();
  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={toast.id}
          role="status"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="fixed bottom-6 left-1/2 z-40 flex w-[min(92vw,420px)] -translate-x-1/2 items-center gap-2 rounded-xl border border-line-strong bg-elevated/95 py-2.5 pl-4 pr-2 text-sm shadow-[0_12px_32px_-8px_rgb(0_0_0/0.7)] backdrop-blur"
        >
          <span className="flex-1 truncate">{toast.message}</span>
          {toast.undo ? (
            <button type="button" onClick={() => { toast.undo?.(); dismissToast(); }} className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 font-medium text-bright transition-colors hover:bg-interactive">
              <Undo2 size={14} /> Undo
            </button>
          ) : null}
          <button type="button" aria-label="Dismiss" onClick={dismissToast} className="grid size-7 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-interactive hover:text-fg">
            <X size={14} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }): ReactNode {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div key="scrim" className="fixed inset-0 z-30 bg-black/55 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-label="Settings"
            className="fixed inset-y-0 right-0 z-30 flex w-[min(100vw,420px)] flex-col border-l border-line bg-surface shadow-2xl"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-base font-semibold">Settings</h2>
              <button type="button" aria-label="Close settings" onClick={onClose} className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-interactive hover:text-fg">
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
              <SettingsView />
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function App(): ReactNode {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vizOpen, setVizOpen] = useState(false);

  return (
    <div className="relative min-h-full bg-[radial-gradient(90%_55%_at_85%_-10%,rgb(91_33_182/0.3),transparent_60%),radial-gradient(60%_45%_at_0%_100%,rgb(76_29_149/0.22),transparent_60%),var(--color-bg)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 pb-8 sm:px-8">
        <Header onSettings={() => setSettingsOpen(true)} settingsActive={settingsOpen} />
        <main className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-5">
            <Card i={0}><PresetSelector /></Card>
            <Card i={1}><BassTrebleControls /></Card>
            <Card i={2}><EffectsPanel /></Card>
          </div>
          <div className="flex flex-col gap-6 lg:col-span-7">
            <Card i={0}><NowPlaying onOpenViz={() => setVizOpen(true)} /></Card>
            <Card i={1}><Equalizer /></Card>
          </div>
        </main>
      </div>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AnimatePresence>{vizOpen ? <VisualizerStage key="viz" onClose={() => setVizOpen(false)} /> : null}</AnimatePresence>
      <ToastView />
    </div>
  );
}
