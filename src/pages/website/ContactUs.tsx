import React, { useState } from 'react';
import { Phone, Mail, MapPin, Send } from 'lucide-react';

const ContactUs: React.FC = () => {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Just mock submission for the static site
        setSubmitted(true);
        setTimeout(() => {
            setSubmitted(false);
            setFormData({ name: '', email: '', phone: '', message: '' });
        }, 3000);
    };

    return (
        <div className="py-16 bg-white min-h-[80vh]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Contact Us</h1>
                    <p className="text-xl text-gray-600">We are here to help. Reach out to us for any queries.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                    {/* Contact Information */}
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-8">Get in Touch</h2>
                        <div className="space-y-8">
                            <div className="flex items-start">
                                <div className="bg-blue-100 p-3 rounded-full mr-4 mt-1">
                                    <MapPin className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">Our Location</h3>
                                    <p className="text-gray-600 leading-relaxed">
                                        Opp Veterinary Hospital, Girls High School Road<br />
                                        Gannavaram, Andhra Pradesh 521101
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-start">
                                <div className="bg-blue-100 p-3 rounded-full mr-4 mt-1">
                                    <Phone className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">Phone Number</h3>
                                    <a href="tel:+918500949789" className="text-blue-600 hover:text-blue-800 transition-colors font-medium">+91 85009 49789</a>
                                    <p className="text-sm text-gray-500 mt-1">Available Everyday: 7am to 9pm</p>
                                </div>
                            </div>

                            <div className="flex items-start">
                                <div className="bg-blue-100 p-3 rounded-full mr-4 mt-1">
                                    <Mail className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">Email Address</h3>
                                    <a href="mailto:admin@drsnoopy.co.in" className="text-blue-600 hover:text-blue-800 transition-colors font-medium">admin@drsnoopy.co.in</a>
                                </div>
                            </div>
                        </div>

                        {/* Map placeholder */}
                        <div className="mt-12 bg-gray-100 h-64 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden relative">
                            <div className="absolute inset-0 opacity-40 bg-[url('https://maps.gstatic.com/mapfiles/api-3/images/mapcnt6.png')] blur-[1px]"></div>
                            <div className="relative z-10 bg-white px-6 py-3 rounded-lg shadow-md font-medium text-gray-700 flex items-center">
                                <MapPin className="h-5 w-5 text-blue-500 mr-2" />
                                Gannavaram, Andhra Pradesh
                            </div>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                        <h2 className="text-2xl font-bold text-gray-900 mb-8">Send us a Message</h2>
                        {submitted ? (
                            <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-6 text-center">
                                <BadgeCheck className="h-12 w-12 text-green-500 mx-auto mb-3" />
                                <h3 className="font-bold text-lg mb-1">Message Sent!</h3>
                                <p>Thank you for reaching out. We will get back to you shortly.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                                    <input 
                                        type="text" 
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-3 border" 
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                                    <input 
                                        type="tel" 
                                        required
                                        value={formData.phone}
                                        onChange={e => setFormData({...formData, phone: e.target.value})}
                                        className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-3 border" 
                                        placeholder="+91"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                    <input 
                                        type="email" 
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-3 border" 
                                        placeholder="john@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                                    <textarea 
                                        rows={4} 
                                        required
                                        value={formData.message}
                                        onChange={e => setFormData({...formData, message: e.target.value})}
                                        className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-3 border" 
                                        placeholder="How can we help you?"
                                    />
                                </div>
                                <button type="submit" className="w-full flex items-center justify-center px-8 py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md">
                                    <Send className="w-5 h-5 mr-2" />
                                    Send Message
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Add BadgeCheck since it was used in success message
import { BadgeCheck } from 'lucide-react';

export default ContactUs;
