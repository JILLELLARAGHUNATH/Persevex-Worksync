'use client';

import { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface ExportButtonProps {
  action: any;
  fileName?: string;
  label?: string;
}

export default function ExportButton({ action, fileName = 'Export_Report', label = 'Export Excel (.xlsx)' }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = typeof action === 'function' ? await action() : null;
      if (!res) throw new Error('No export data received');
      const base64 = typeof res === 'string' ? res : res.base64;
      const downloadName =
        typeof res === 'object' && res.fileName
          ? res.fileName
          : `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`;

      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = downloadName.endsWith('.xlsx') ? downloadName : `${downloadName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Spreadsheet generated and downloaded successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate export file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 text-xs font-semibold bg-slate-100 dark:bg-slate-950 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-2.5 rounded-xl transition border border-slate-200 dark:border-slate-800 dark:border-slate-700 shadow-sm"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
      {loading ? 'Generating...' : label}
    </button>
  );
}