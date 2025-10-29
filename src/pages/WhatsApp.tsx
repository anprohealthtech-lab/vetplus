// src/pages/WhatsApp.tsx
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.tsx';
import WhatsAppDashboard from '../components/WhatsApp/WhatsAppDashboard';
import WhatsAppMessaging from '../components/WhatsApp/WhatsAppMessaging';
import MessageHistory from '../components/WhatsApp/MessageHistory';
import WhatsAppUserSyncManager from '../components/WhatsApp/WhatsAppUserSyncManager';
import { MessageResult } from '../utils/whatsappAPI';

const WhatsApp: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleConnectionChange = (connected: boolean) => {
    setIsConnected(connected);
  };

  const handleMessageSent = (result: MessageResult) => {
    if (result.success) {
      // Switch to history tab to show the sent message
      setActiveTab('history');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Integration</h1>
          <p className="text-gray-600 mt-2">
            Send PDF reports and messages to patients via WhatsApp
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Connection</TabsTrigger>
          <TabsTrigger value="messaging">Send Message</TabsTrigger>
          <TabsTrigger value="history">Message History</TabsTrigger>
          <TabsTrigger value="sync">User Management</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <WhatsAppDashboard onConnectionChange={handleConnectionChange} />
        </TabsContent>

        <TabsContent value="messaging" className="space-y-6">
          <WhatsAppMessaging 
            isConnected={isConnected} 
            onMessageSent={handleMessageSent}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <MessageHistory />
        </TabsContent>

        <TabsContent value="sync" className="space-y-6">
          <WhatsAppUserSyncManager />
        </TabsContent>
      </Tabs>

      {/* Quick Start Guide */}
      {!isConnected && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-4">
            Getting Started with WhatsApp Integration
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <div className="font-medium text-blue-900">Connect WhatsApp</div>
                <div className="text-sm text-blue-800">
                  Go to the "Connection" tab and click "Connect" to generate a QR code
                </div>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <div className="font-medium text-blue-900">Scan QR Code</div>
                <div className="text-sm text-blue-800">
                  Open WhatsApp on your phone, go to Settings → Linked Devices → Link a Device
                </div>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <div className="font-medium text-blue-900">Start Sending Messages</div>
                <div className="text-sm text-blue-800">
                  Once connected, use the "Send Message" tab to send reports and messages to patients
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsApp;