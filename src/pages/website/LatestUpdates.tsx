import React from 'react';
import { Bell } from 'lucide-react';

const LatestUpdates: React.FC = () => {
    return (
        <div className="py-16 bg-white min-h-[70vh] flex flex-col items-center justify-center">
            <div className="text-center max-w-2xl mx-auto px-4">
                <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Bell className="h-10 w-10 text-blue-600" />
                </div>
                <h1 className="text-4xl font-extrabold text-gray-900 mb-6">Latest Updates</h1>
                <p className="text-xl text-gray-600 leading-relaxed mb-8">
                    We're currently preparing our news and updates feed. Check back soon for health articles, new test announcements, and lab news!
                </p>
                <div className="inline-flex px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">
                    Coming Soon
                </div>
            </div>
        </div>
    );
};

export default LatestUpdates;
