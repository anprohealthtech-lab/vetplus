import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Clock, Activity, FileText } from 'lucide-react';
import { getSiteBasePath } from '../../utils/domain';

const Home: React.FC = () => {
    const basePath = getSiteBasePath();
    return (
        <div className="flex flex-col">
            {/* Hero Section */}
            <div className="relative bg-blue-900 overflow-hidden text-white">
                <div className="absolute inset-0 opacity-40">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-blue-900/80 to-transparent z-10" />
                    <img 
                        src="https://ik.imagekit.io/18tsendxqy/Vetplus%20veterinary/Veterinarian_petting_Golden_202604070854.jpeg?tr=w-1600,q-80,fo-auto" 
                        alt="Veterinarian with pet" 
                        className="w-full h-full object-cover object-center"
                    />
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 py-20 lg:py-32">
                    <div className="md:w-2/3">
                        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
                            Advanced Diagnostics for <span className="text-blue-400">Animal Health</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-blue-100 mb-10 max-w-2xl leading-relaxed">
                            Experience state-of-the-art veterinary testing with Vetplus Diagnostics. Accurate clinical results for your pets and farm animals, delivered on time to your phone.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link to={`${basePath}/home-collection`} className="inline-flex justify-center items-center px-8 py-4 text-lg font-bold rounded-xl text-blue-900 bg-white hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                                Book Home Collection
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                            <Link to="/patient/login" className="inline-flex justify-center items-center px-8 py-4 text-lg font-bold rounded-xl text-white bg-green-600 hover:bg-green-700 transition-colors border border-green-500 shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                                Download Reports
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Features/Highlights */}
            <div className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Why Choose Vetplus?</h2>
                        <p className="mt-4 text-xl text-gray-600">Committed to excellence in veterinary pathology and animal care.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        <div className="bg-blue-50 rounded-2xl p-8 hover:shadow-xl transition-all border border-blue-100 transform hover:-translate-y-1">
                            <div className="bg-blue-600 w-14 h-14 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                                <ShieldCheck className="h-8 w-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">100% Accurate</h3>
                            <p className="text-gray-600 leading-relaxed">Using advanced AI and automated analyzers to ensure zero errors in your diagnostic reports.</p>
                        </div>
                        <div className="bg-green-50 rounded-2xl p-8 hover:shadow-xl transition-all border border-green-100 transform hover:-translate-y-1">
                            <div className="bg-green-600 w-14 h-14 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                                <Clock className="h-8 w-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">Timely Delivery</h3>
                            <p className="text-gray-600 leading-relaxed">Fastest turnaround times. Get SMS and WhatsApp alerts the moment your report is verified.</p>
                        </div>
                        <div className="bg-purple-50 rounded-2xl p-8 hover:shadow-xl transition-all border border-purple-100 transform hover:-translate-y-1">
                            <div className="bg-purple-600 w-14 h-14 rounded-xl flex items-center justify-center mb-6 shadow-lg">
                                <Activity className="h-8 w-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">Veterinary Profiles</h3>
                            <p className="text-gray-600 leading-relaxed">From routine pet health checkups to specialized diagnostic profiles, we cover all your animal testing needs.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="bg-blue-50 py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-6">Ready for your Pet's Health Checkup?</h2>
                    <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">Explore our wide range of tests or let our expert veterinary technicians collect your animal's sample securely from home.</p>
                    <Link to={`${basePath}/tests-offered`} className="inline-flex justify-center items-center px-8 py-4 text-lg font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg">
                        View All Tests
                        <FileText className="ml-2 h-5 w-5" />
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Home;
