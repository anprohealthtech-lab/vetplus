import React, { useState } from 'react';
import { Sparkles, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { database, supabase } from '../../utils/supabase';

interface LogEntry {
  type: 'info' | 'success' | 'error';
  message: string;
  timestamp: Date;
}

export function AdminEmbeddingsSetup() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<{
    totalLabs: number;
    processedLabs: number;
    totalEmbeddings: number;
    errors: number;
  }>({
    totalLabs: 0,
    processedLabs: 0,
    totalEmbeddings: 0,
    errors: 0,
  });

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLog(prev => [...prev, { message, type, timestamp: new Date() }]);
  };

  const handleGenerateForAllLabs = async () => {
    setIsGenerating(true);
    setLog([]);
    setStats({ totalLabs: 0, processedLabs: 0, totalEmbeddings: 0, errors: 0 });
    
    addLog('🚀 Starting embedding generation for all labs...', 'info');

    try {
      // Get all labs
      const { data: labs, error: labsError } = await supabase
        .from('labs')
        .select('id, name');

      if (labsError) throw labsError;

      setStats(prev => ({ ...prev, totalLabs: labs.length }));
      addLog(`📊 Found ${labs.length} labs to process`, 'info');

      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated. Please login again.');
      }

      // Call edge function for each lab
      for (const lab of labs) {
        addLog(`⏳ Processing ${lab.name}...`, 'info');

        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-catalog-embeddings`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ labId: lab.id }),
            }
          );

          const result = await response.json();

          if (result.success) {
            addLog(
              `✅ ${lab.name}: ${result.count} embeddings generated (${result.analytesProcessed} analytes)`, 
              'success'
            );
            setStats(prev => ({
              ...prev,
              processedLabs: prev.processedLabs + 1,
              totalEmbeddings: prev.totalEmbeddings + result.count,
            }));
          } else {
            addLog(`❌ ${lab.name}: ${result.error}`, 'error');
            setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
          }
        } catch (error: any) {
          addLog(`❌ ${lab.name}: ${error.message}`, 'error');
          setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
        }

        // Small delay between labs to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      addLog('🎉 All labs processed!', 'success');
    } catch (error: any) {
      addLog(`❌ Fatal error: ${error.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">AI Embeddings Setup</h1>
        </div>
        <p className="text-gray-600">
          Generate vector embeddings for all labs' test catalogs to enable AI-powered template assistance.
          This is a one-time setup process that enables semantic search for placeholder suggestions.
        </p>
      </div>

      {/* Stats Cards */}
      {stats.totalLabs > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium mb-1">Total Labs</div>
            <div className="text-2xl font-bold text-blue-900">{stats.totalLabs}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium mb-1">Processed</div>
            <div className="text-2xl font-bold text-green-900">{stats.processedLabs}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-sm text-purple-600 font-medium mb-1">Embeddings</div>
            <div className="text-2xl font-bold text-purple-900">{stats.totalEmbeddings}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-600 font-medium mb-1">Errors</div>
            <div className="text-2xl font-bold text-red-900">{stats.errors}</div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="mb-6">
        <button
          onClick={handleGenerateForAllLabs}
          disabled={isGenerating}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
        >
          {isGenerating ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Generating Embeddings...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Embeddings for All Labs
            </>
          )}
        </button>
        <p className="text-sm text-gray-500 mt-2">
          This process will take approximately {Math.ceil((stats.totalLabs || 10) * 1.5)} minutes.
          Progress will be shown below.
        </p>
      </div>

      {/* Log Console */}
      <div className="bg-gray-900 rounded-lg p-4 max-h-[500px] overflow-y-auto">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
          <h3 className="text-white font-semibold">Generation Log</h3>
          <span className="text-gray-400 text-sm">{log.length} entries</span>
        </div>
        {log.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No logs yet. Click the button above to start.
          </div>
        ) : (
          <div className="space-y-2">
            {log.map((entry, i) => (
              <div key={i} className="flex items-start gap-2 font-mono text-sm">
                <div className="flex-shrink-0 mt-1">{getLogIcon(entry.type)}</div>
                <div className="flex-1">
                  <span className="text-gray-400 mr-2">
                    [{entry.timestamp.toLocaleTimeString()}]
                  </span>
                  <span
                    className={
                      entry.type === 'error'
                        ? 'text-red-400'
                        : entry.type === 'success'
                        ? 'text-green-400'
                        : 'text-gray-300'
                    }
                  >
                    {entry.message}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">What happens during this process?</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Fetches all analytes for each lab from the database</li>
          <li>• Generates AI embeddings using OpenAI's text-embedding-ada-002 model</li>
          <li>• Creates 6 placeholder variants per analyte (value, flag, unit, range, method, comment)</li>
          <li>• Stores embeddings in the test_catalog_embeddings table for semantic search</li>
          <li>• Enables AI-powered placeholder suggestions in the template builder</li>
        </ul>
      </div>

      {/* Cost Estimate */}
      <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-semibold text-green-900 mb-2">💰 Cost Estimate</h4>
        <p className="text-sm text-green-800">
          Approximately $0.0025 per lab (one-time). For {stats.totalLabs || 100} labs, total cost: ~$
          {((stats.totalLabs || 100) * 0.0025).toFixed(2)}.
          Future analyte additions are auto-embedded at $0.0001 each.
        </p>
      </div>
    </div>
  );
}

export default AdminEmbeddingsSetup;
