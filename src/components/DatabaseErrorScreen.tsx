import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/** One place for "unknown thrown value → text". Dexie already prefixes its messages with the error name. */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  return err.message.startsWith(err.name) ? err.message : `${err.name}: ${err.message}`;
}

/** Shown when IndexedDB cannot be opened or a record is missing. Nothing has been deleted. */
export function DatabaseErrorScreen({ detail }: { detail: string }) {
  return (
    <div className="w-full h-[100dvh] bg-slate-900 text-white flex flex-col items-center justify-center p-8 text-center space-y-4 font-sans">
      <AlertTriangle className="w-12 h-12 text-amber-400" />
      <h1 className="text-xl font-bold">Something went wrong opening the app</h1>
      <p className="text-slate-300 text-sm leading-relaxed max-w-sm">
        Nothing has been deleted. Close any other tabs running this app, then reload. If it keeps
        happening, this browser may have storage disabled for this site.
      </p>
      <code className="text-xs text-slate-500 break-all max-w-sm">{detail}</code>
    </div>
  );
}

/**
 * `useLiveQuery` rethrows a rejected querier during render so that a boundary can catch it.
 * That is the one path every database failure takes: a schema upgrade that threw, storage
 * blocked, or an invariant the App snapshot asserts. Without a boundary the whole tree
 * unmounts and the page goes blank.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <DatabaseErrorScreen detail={describeError(this.state.error)} />;
    }
    return this.props.children;
  }
}
