import React from 'react';
import { Activity, Shield, Users, BadgeCheck } from 'lucide-react';

const AboutUs: React.FC = () => {
    return (
        <div className="py-16 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h1 className="text-4xl font-extrabold text-gray-900 mb-6">About Vetplus Diagnostics</h1>
                    <p className="text-xl text-gray-600 leading-relaxed">
                        We are a leading pathology laboratory committed to bringing advanced diagnostic capabilities to our community. With state-of-the-art technology and expert professionals, we ensure every test result is accurate and reliable.
                    </p>
                </div>

                {/* Values */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
                    <div className="text-center p-6">
                        <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                            <Activity className="h-8 w-8 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Modern Technology</h3>
                        <p className="text-gray-600">Equipped with fully automated analyzers for precision testing.</p>
                    </div>
                    <div className="text-center p-6">
                        <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                            <BadgeCheck className="h-8 w-8 text-green-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Quality Assured</h3>
                        <p className="text-gray-600">Strict quality control protocols to guarantee 100% accurate results.</p>
                    </div>
                    <div className="text-center p-6">
                        <div className="mx-auto bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                            <Users className="h-8 w-8 text-purple-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Expert Team</h3>
                        <p className="text-gray-600">Highly qualified pathologists and trained technicians at your service.</p>
                    </div>
                    <div className="text-center p-6">
                        <div className="mx-auto bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                            <Shield className="h-8 w-8 text-orange-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Patient Privacy</h3>
                        <p className="text-gray-600">Your data is secured with enterprise-grade encryption.</p>
                    </div>
                </div>

                {/* Story / Text block */}
                <div className="bg-gray-50 rounded-3xl p-8 md:p-16 border border-gray-100">
                    <div className="md:w-2/3 mx-auto text-center">
                        <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Mission</h2>
                        <p className="text-lg text-gray-700 leading-relaxed mb-6">
                            Since our inception, Vetplus Diagnostics has been driven by a single goal: to provide affordable, high-quality diagnostic services. We understand that behind every sample is a human life waiting for answers. That's why we don't just process tests—we deliver clarity and peace of mind.
                        </p>
                        <p className="text-lg text-gray-700 leading-relaxed">
                            Located at Gannavaram, we serve thousands of patients and partner with leading hospitals to ensure that advanced healthcare is accessible to everyone.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutUs;
