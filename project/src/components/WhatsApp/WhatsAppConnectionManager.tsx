import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, QrCode, AlertCircle, RefreshCw } from 'lucide-react';
import {
  checkWhatsAppStatus,
  initiateWhatsAppConnection,
  type WhatsAppStatus
} from '../../utils/whatsappConnection';

interface WhatsAppConnectionManagerProps {
  userId: string;
  labId?: string;
  onConnectionChange?: (connected: boolean, sessionId?: string) => void;
  className?: string;
}

interface ConnectionState {
  status: WhatsAppStatus | null;
  qrCode: string | null;
  loading: boolean;
  error: string | null;
  showQR: boolean;
}

const WhatsAppConnectionManager: React.FC<WhatsAppConnectionManagerProps> = ({
  userId,
  labId,
  onConnectionChange,
  className = ''
}) => {
  const [state, setState] = useState<ConnectionState>({
    status: null,
    qrCode: null,
    loading: true,
    error: null,
    showQR: false,
  });

  const checkStatus = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const status = await checkWhatsAppStatus(userId, labId);
      setState(prev => ({ 
        ...prev, 
        status, 
        loading: false,
        error: status.error || null 
      }));
      
      if (onConnectionChange) {
        onConnectionChange(status.connected, status.sessionId);
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: String(error) 
      }));
    }
  };



  const initiateConnection = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await initiateWhatsAppConnection(userId, labId);
      
      if (result.connected) {
        // Already connected
        setState(prev => ({ 
          ...prev, 
          status: { 
            success: true, 
            connected: true, 
            sessionId: result.sessionId 
          },
          loading: false 
        }));
        
        if (onConnectionChange) {
          onConnectionChange(true, result.sessionId);
        }
      } else if (result.qrCode) {
        // Need to scan QR code
        setState(prev => ({ 
          ...prev, 
          qrCode: result.qrCode!,
          showQR: true,
          loading: false 
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          error: result.error || 'Failed to initiate connection',
          loading: false 
        }));
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: String(error) 
      }));
    }
  };

  const hideQR = () => {
    setState(prev => ({ ...prev, showQR: false, qrCode: null }));
  };

  useEffect(() => {
    checkStatus();
  }, [userId, labId]);

  // Auto-refresh status every 5 seconds when QR is showing
  useEffect(() => {
    if (!state.showQR) return;

    const interval = setInterval(() => {
      checkStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [state.showQR]);

  if (state.loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
        <span className="text-sm text-gray-600">Checking WhatsApp status...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Status Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {state.status?.connected ? (
            <>
              <Wifi className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-green-700">
                WhatsApp Connected
              </span>
              {state.status.sessionId && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  Session: {state.status.sessionId.slice(0, 8)}...
                </span>
              )}
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium text-red-700">
                WhatsApp Not Connected
              </span>
            </>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={checkStatus}
            disabled={state.loading}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title="Refresh status"
          >
            <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
          </button>
          
          {!state.status?.connected && (
            <button
              onClick={initiateConnection}
              disabled={state.loading}
              className="flex items-center space-x-1 px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              <QrCode className="h-4 w-4" />
              <span>Connect WhatsApp</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {state.error && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-700">{state.error}</span>
        </div>
      )}

      {/* QR Code Display */}
      {state.showQR && state.qrCode && (
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900">
              Scan QR Code to Connect WhatsApp
            </h4>
            <button
              onClick={hideQR}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          
          <div className="text-center">
            <div className="inline-block p-4 bg-white border-2 border-gray-300 rounded-lg">
              <img
                src={`data:image/png;base64,${state.qrCode}`}
                alt="WhatsApp QR Code"
                className="w-48 h-48 mx-auto"
              />
            </div>
            
            <div className="mt-3 space-y-1">
              <p className="text-sm text-gray-600">
                1. Open WhatsApp on your phone
              </p>
              <p className="text-sm text-gray-600">
                2. Go to Settings → Linked Devices
              </p>
              <p className="text-sm text-gray-600">
                3. Tap "Link a Device" and scan this QR code
              </p>
            </div>
            
            <div className="mt-3 text-xs text-gray-500">
              Status will update automatically once connected
            </div>
          </div>
        </div>
      )}

      {/* Connection Instructions for SESSION_NOT_READY */}
      {!state.status?.connected && state.status?.sessionId && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-800 font-medium">
                Session exists but WhatsApp is not connected
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Click "Connect WhatsApp" to get a QR code and link your device.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppConnectionManager;