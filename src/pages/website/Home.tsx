import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Clock, Activity, FileText } from 'lucide-react';
import { getSiteBasePath } from '../../utils/domain';

const Home: React.FC = () => {
    const basePath = getSiteBasePath();
    const [currentVideoIdx, setCurrentVideoIdx] = useState(0);

    const videos = [
        "https://ik.imagekit.io/18tsendxqy/Vetplus%20veterinary/Veterinarian_comforting_puppy_202604071011.mp4",
        "https://ik.imagekit.io/18tsendxqy/Vetplus%20veterinary/Veterinarian_comforting_puppy_202604071018.mp4",
        "https://ik.imagekit.io/18tsendxqy/Vetplus%20veterinary/Veterinarian_comforting_puppy_202604071011%20(1).mp4"
    ];
    return (
        <div className="flex flex-col">
            {/* Hero Section with Video Loop */}
            <div className="relative bg-black overflow-hidden text-white min-h-[90vh] flex items-center">
                <div className="absolute inset-0 opacity-60">
                    <video 
                        key={videos[currentVideoIdx]} // Forces video reload when source changes
                        autoPlay 
                        muted 
                        playsInline 
                        onEnded={() => setCurrentVideoIdx((prev) => (prev + 1) % videos.length)}
                        className="w-full h-full object-cover object-center transition-opacity duration-1000"
                    >
                        <source src={videos[currentVideoIdx]} type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-blue-900/70 to-transparent z-10" />
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 py-20 lg:py-32 w-full">
                    <div className="md:w-2/3">
                        <span className="inline-block py-1 px-3 rounded-full bg-blue-100/20 border border-blue-200/30 text-blue-100 font-semibold tracking-wider text-sm mb-6 backdrop-blur-sm shadow-sm">
                            India's Most Advanced Veterinary Lab
                        </span>
                        <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight drop-shadow-lg">
                            Accurate Diagnostics, <br className="hidden md:block"/>
                            <span className="text-blue-300">Unmatched Compassion.</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-200 mb-10 max-w-2xl leading-relaxed drop-shadow-md">
                            Welcome to Vetplus Diagnostics. We leverage state-of-the-art robotic technology and an expert team of veterinary pathologists to guarantee 100% accurate results for your beloved pets.
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

            {/* Moving Hero Image Downwards */}
            <div className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="order-2 lg:order-1 relative h-96 sm:h-[30rem] rounded-3xl overflow-hidden shadow-2xl">
                            <img 
                                src="https://ik.imagekit.io/18tsendxqy/Vetplus%20veterinary/Veterinarian_petting_Golden_202604070854.jpeg?tr=w-800,q-80,fo-auto" 
                                alt="Veterinarian performing health checkup" 
                                className="w-full h-full object-cover object-center"
                            />
                            <div className="absolute inset-0 bg-blue-900/10 hover:bg-transparent transition-colors duration-500 rounded-3xl ring-1 ring-inset ring-black/10"></div>
                        </div>
                        <div className="order-1 lg:order-2">
                            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-6 leading-tight">
                                Because your pet deserves the absolute best.
                            </h2>
                            <p className="text-lg text-gray-700 leading-relaxed mb-6">
                                We know that waiting for a diagnostic report is stressful. That's why Vetplus was built to eliminate the waiting and the guesswork. 
                            </p>
                            <p className="text-lg text-gray-700 leading-relaxed mb-8">
                                With a fully integrated laboratory ecosystem, we seamlessly hand off your pet's sample to automated analyzers monitored globally by top-tier veterinary pathologists, ensuring peace of mind for both you and your local vet.
                            </p>
                            
                            <ul className="space-y-4">
                                <li className="flex items-center text-gray-800 font-medium">
                                    <ShieldCheck className="w-6 h-6 text-green-500 mr-3" /> State and Federal Compliant Testing
                                </li>
                                <li className="flex items-center text-gray-800 font-medium">
                                    <Clock className="w-6 h-6 text-green-500 mr-3" /> Same-day Results via WhatsApp
                                </li>
                                <li className="flex items-center text-gray-800 font-medium">
                                    <Activity className="w-6 h-6 text-green-500 mr-3" /> Dedicated Animal Diagnostic Algorithms
                                </li>
                            </ul>
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
