import React from 'react';
import { AlertTriangle, Phone, Mail, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const InactiveLab: React.FC = () => {
    const { labName, signOut, refreshLabStatus, labStatusLoading } = useAuth();

    const handleRetry = async () => {
        await refreshLabStatus();
    };

    const handleSignOut = async () => {
        await signOut();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-6">
                {/* Warning Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                    {/* Warning Icon */}
                    <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6">
                        <AlertTriangle className="w-10 h-10 text-amber-600" />
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Lab Account Inactive
                    </h1>

                    {/* Lab Name */}
                    {labName && (
                        <p className="text-lg text-gray-600 mb-4">
                            <span className="font-semibold">{labName}</span>
                        </p>
                    )}

                    {/* Message */}
                    <p className="text-gray-600 mb-6">
                        Your lab account is currently inactive. Please contact your administrator
                        to activate your subscription and regain access to the system.
                    </p>

                    {/* Contact Section */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                        <h3 className="font-semibold text-blue-800 mb-3">Contact Support</h3>
                        <div className="space-y-2">
                            <a
                                href="tel:+919876543210"
                                className="flex items-center justify-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
                            >
                                <Phone className="w-4 h-4" />
                                <span>+91 98765 43210</span>
                            </a>
                            <a
                                href="mailto:support@limsapp.in"
                                className="flex items-center justify-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
                            >
                                <Mail className="w-4 h-4" />
                                <span>support@limsapp.in</span>
                            </a>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleRetry}
                            disabled={labStatusLoading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {labStatusLoading ? (
                                <>
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    <span>Checking...</span>
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-5 h-5" />
                                    <span>Check Again</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="text-center text-sm text-gray-500">
                    <p>
                        Visit{' '}
                        <a
                            href="https://limsapp.in"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                        >
                            limsapp.in
                        </a>
                        {' '}for more information
                    </p>
                </div>
            </div>
        </div>
    );
};

export default InactiveLab;
