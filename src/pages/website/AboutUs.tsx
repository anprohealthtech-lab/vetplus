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
                        We are a leading veterinary pathology laboratory committed to bringing advanced diagnostic capabilities to our animal community. With state-of-the-art technology and expert veterinary professionals, we ensure every test result is accurate and reliable for your beloved pets and farm animals.
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
                        <p className="text-gray-600">Highly qualified veterinary pathologists and trained technicians at your service.</p>
                    </div>
                    <div className="text-center p-6">
                        <div className="mx-auto bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                            <Shield className="h-8 w-8 text-orange-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Data Privacy</h3>
                        <p className="text-gray-600">Your pet's health data is secured with enterprise-grade encryption.</p>
                    </div>
                </div>

                {/* Story / Text block with Images */}
                <div className="mb-20">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Mission</h2>
                            <p className="text-lg text-gray-700 leading-relaxed mb-6">
                                Since our inception, Vetplus Diagnostics has been driven by a single goal: to provide affordable, high-quality diagnostic services for the animal kingdom. We understand that behind every sample is a beloved pet or a vital farm animal waiting for care. That's why we don't just process tests—we deliver clarity and peace of mind to pet parents and veterinarians.
                            </p>
                            <p className="text-lg text-gray-700 leading-relaxed">
                                Located at Gannavaram, we serve thousands of animal patients and partner with leading veterinary hospitals to ensure that advanced healthcare is accessible to all animals.
                            </p>
                        </div>
                        <div className="relative h-80 rounded-3xl overflow-hidden shadow-2xl">
                            <img 
                                src="https://ik.imagekit.io/18tsendxqy/Vetplus%20veterinary/Robotic_machine_processing_202604071003.jpeg?tr=w-800,q-80,fo-auto" 
                                alt="Veterinary Technology" 
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-blue-900/10 rounded-3xl ring-1 ring-inset ring-black/10"></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div className="order-2 lg:order-1 relative h-80 rounded-3xl overflow-hidden shadow-2xl">
                            <img 
                                src="https://ik.imagekit.io/18tsendxqy/Vetplus%20veterinary/Veterinary_pathologists_discussi__202604071001.jpeg?tr=w-800,q-80,fo-auto" 
                                alt="Expert Veterinary Team" 
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-blue-900/10 rounded-3xl ring-1 ring-inset ring-black/10"></div>
                        </div>
                        <div className="order-1 lg:order-2">
                            <h2 className="text-3xl font-bold text-gray-900 mb-6">Led by Experts</h2>
                            <p className="text-lg text-gray-700 leading-relaxed mb-6">
                                Our facility is proudly operated by highly certified veterinary pathologists who dedicate their lives to animal health. From routine wellness checks to highly specialized diagnostic profiles, our experts work directly with your local veterinarian to curate the best treatment path possible.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutUs;
