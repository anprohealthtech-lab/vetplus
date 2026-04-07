import React, { useState } from 'react';
import { Shield, Clock, FileText, CheckCircle2 } from 'lucide-react';
import WebsiteBookingModal from '../../components/Website/WebsiteBookingModal';

const HomeCollection: React.FC = () => {
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(false);
    const labId = 'b2b7b466-54b8-4935-ab90-b8c16643912f'; // Vetplus Diagnostics ID

    const handleSuccess = () => {
        setIsBookingModalOpen(false);
        setBookingSuccess(true);
        setTimeout(() => setBookingSuccess(false), 5000);
    };

    return (
        <div className="py-16 bg-white min-h-[80vh]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Hero section */}
                <div className="text-center max-w-3xl mx-auto mb-10">
                    <h1 className="text-4xl font-extrabold text-gray-900 mb-6">Home Sample Collection</h1>
                    <p className="text-xl text-gray-600 leading-relaxed">
                        Get your pet's test samples collected securely from the comfort of your home. Our expert veterinary technicians ensure a safe, hygienic, and stress-free experience for your animals.
                    </p>
                </div>

                <div className="max-w-5xl mx-auto mb-16 relative h-64 sm:h-80 md:h-96 rounded-3xl overflow-hidden shadow-2xl">
                    <img 
                        src="https://ik.imagekit.io/18tsendxqy/Vetplus%20veterinary/Veterinary_phlebotomist_collecti__202604071002.jpeg?tr=w-1200,q-80,fo-auto" 
                        alt="Veterinary Home Collection" 
                        className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-blue-900/40 to-transparent"></div>
                </div>

                {bookingSuccess && (
                    <div className="max-w-2xl mx-auto mb-12 bg-green-50 border-l-4 border-green-500 p-6 rounded-r-xl shadow-sm flex items-start">
                        <CheckCircle2 className="h-8 w-8 text-green-500 mr-4 flex-shrink-0" />
                        <div>
                            <h3 className="text-lg font-bold text-green-900 mb-1">Booking Confirmed!</h3>
                            <p className="text-green-800">Your home collection request has been successfully submitted. Our team will contact you shortly to confirm the exact time for your pet.</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-16">
                    {/* Booking CTA */}
                    <div className="bg-blue-50 p-10 rounded-3xl border border-blue-100 text-center lg:text-left transition-all hover:shadow-lg">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Book Your Slot Now</h2>
                        <p className="text-gray-600 mb-8 max-w-md mx-auto lg:mx-0">
                            Select the veterinary tests and choose a convenient time. We'll handle the rest.
                        </p>
                        <button 
                            onClick={() => setIsBookingModalOpen(true)}
                            className="inline-block px-8 py-4 text-lg font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1 w-full sm:w-auto"
                        >
                            Schedule Home Collection
                        </button>
                    </div>

                    {/* How it works */}
                    <div className="space-y-8">
                        <h3 className="text-2xl font-bold text-gray-900 mb-6">How it Works</h3>
                        
                        <div className="flex items-start">
                            <div className="bg-blue-100 p-3 rounded-2xl mr-4 flex-shrink-0">
                                <FileText className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-gray-900 mb-1">1. Book a Test</h4>
                                <p className="text-gray-600 leading-relaxed">Search tests or upload a vet's prescription, enter your pet's details, and pick a time slot.</p>
                            </div>
                        </div>

                        <div className="flex items-start">
                            <div className="bg-blue-100 p-3 rounded-2xl mr-4 flex-shrink-0">
                                <Shield className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-gray-900 mb-1">2. Safe Sample Collection</h4>
                                <p className="text-gray-600 leading-relaxed">Our certified veterinary technician arrives at your home equipped with sterile animal kits.</p>
                            </div>
                        </div>

                        <div className="flex items-start">
                            <div className="bg-blue-100 p-3 rounded-2xl mr-4 flex-shrink-0">
                                <Clock className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-gray-900 mb-1">3. Get Reports Online</h4>
                                <p className="text-gray-600 leading-relaxed">Receive a WhatsApp alert for you and your vet as soon as the tests are processed.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isBookingModalOpen && (
                <WebsiteBookingModal 
                    labId={labId}
                    onClose={() => setIsBookingModalOpen(false)}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
};

export default HomeCollection;
