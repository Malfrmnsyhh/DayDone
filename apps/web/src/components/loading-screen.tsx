import { Loader2 } from 'lucide-react';

export function LoadingScreen({ message = 'Memuat sesi DayDone...' }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <div className="flex flex-col items-center space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
          <span className="text-xl font-bold tracking-tight">DD</span>
        </div>
        <div className="flex items-center space-x-2 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">{message}</span>
        </div>
      </div>
    </div>
  );
}

