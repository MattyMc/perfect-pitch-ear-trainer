import HoldToExit from './HoldToExit';

/**
 * "Ready to continue?": shown before resuming a session, and whenever sound needs a tap to start
 * again (the app came back from the background), since the Continue tap itself unlocks the audio.
 * Hold-to-exit stays available so a parent is never stuck here if the sound doesn't come back.
 */
export default function ResumePrompt({ onContinue, onExit }: { onContinue: () => void; onExit: () => void }) {
  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-4 pt-12 pb-2">
        <HoldToExit onExit={onExit} />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        <h2 className="text-3xl font-bold text-slate-800">Ready to continue?</h2>
        <button
          onClick={onContinue}
          className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-2xl font-bold shadow-lg active:scale-95 transition-transform"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
