import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, Phone, Mail, MapPin, ChevronRight, Download, Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';
import { getSiteBasePath } from '../../utils/domain';

const WebsiteLayout: React.FC = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const location = useLocation();
    
    const basePath = getSiteBasePath();

    // Auto-scroll to top on route change
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);
    
    // Vetplus Diagnostics data
    const labName = "Vetplus Diagnostics";
    const phone = "+918500949789";
    const email = "admin@drsnoopy.co.in";
    const address = "Opp Veterinary Hospital, Girls High School Road, Gannavaram, Andhra Pradesh 521101";

    const navLinks = [
        { path: basePath || '/', label: 'Home' },
        { path: `${basePath}/about-us`, label: 'About Us' },
        { path: `${basePath}/tests-offered`, label: 'Tests Offered' },
        { path: `${basePath}/home-collection`, label: 'Home Collection (Booking)' },
        { path: `${basePath}/latest-updates`, label: 'Latest Updates' },
        { path: `${basePath}/contact-us`, label: 'Contact Us' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            {/* Top Bar */}
            <div className="bg-blue-900 text-white py-2 px-4 shadow-inner">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center text-sm font-medium">
                    <div className="flex items-center space-x-6">
                        <a href={`tel:${phone}`} className="flex items-center hover:text-blue-200 transition-colors">
                            <Phone className="h-4 w-4 mr-2" /> {phone}
                        </a>
                        <a href={`mailto:${email}`} className="flex items-center hover:text-blue-200 transition-colors hidden md:flex">
                            <Mail className="h-4 w-4 mr-2" /> {email}
                        </a>
                    </div>
                </div>
            </div>

            {/* Main Navigation */}
            <nav className="bg-white shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20 items-center">
                        <Link to={basePath || '/'} className="flex items-center">
                            <img
                                src="https://ik.imagekit.io/18tsendxqy/Vetplus%20veterinary/Logo%20copy%20(1).png?tr=w-200,h-200,fo-auto"
                                alt="Vetplus Diagnostics Logo"
                                className="h-12 w-auto mr-3 object-contain drop-shadow-sm"
                            />
                            <div>
                                <span className="font-bold text-xl text-gray-900 tracking-tight block">{labName}</span>
                                <span className="text-xs text-blue-600 font-bold uppercase tracking-wider block">Advanced Pathology Lab</span>
                            </div>
                        </Link>
                        
                        <div className="hidden lg:flex space-x-1 items-center">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                                        location.pathname === link.path
                                            ? 'text-blue-700 bg-blue-50'
                                            : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            {/* Prominent Patient Portal Button */}
                            <Link
                                to="/patient/login"
                                className="ml-4 inline-flex items-center px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-bold shadow-md shadow-green-200 hover:bg-green-700 transition-colors transform hover:-translate-y-0.5"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Patient Login
                            </Link>
                        </div>

                        <div className="lg:hidden flex items-center">
                            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-600 p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMenuOpen && (
                    <div className="lg:hidden bg-white border-t border-gray-100 shadow-xl absolute w-full left-0 transition-all">
                        <div className="px-4 pt-2 pb-4 space-y-1">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    onClick={() => setIsMenuOpen(false)}
                                    className={`block px-4 py-3 rounded-xl text-base font-semibold ${
                                        location.pathname === link.path
                                            ? 'text-blue-700 bg-blue-50'
                                            : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <Link
                                to="/patient/login"
                                onClick={() => setIsMenuOpen(false)}
                                className="block mt-4 px-4 py-3 text-center rounded-xl text-white font-bold bg-green-600 shadow-md shadow-green-200"
                            >
                                Download Reports
                            </Link>
                        </div>
                    </div>
                )}
            </nav>

            <main className="flex-grow">
                <Outlet />
            </main>

            <footer className="bg-gray-900 text-white pt-16 pb-8 border-t-4 border-blue-600 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                        <div>
                            <div className="flex items-center mb-6">
                                <div className="bg-white p-1.5 rounded-lg mr-3">
                                    <img
                                        src="https://ik.imagekit.io/18tsendxqy/Vetplus%20veterinary/Logo%20copy%20(1).png?tr=w-200,h-200,fo-auto"
                                        alt="Vetplus Diagnostics Logo"
                                        className="h-10 w-auto object-contain"
                                    />
                                </div>
                                <span className="font-bold text-2xl tracking-tight">{labName}</span>
                            </div>
                            <p className="text-gray-400 leading-relaxed mb-6 block">
                                Providing accurate, reliable, and timely diagnostic services. Your pet's health is our priority. Get comprehensive checkups with precision.
                            </p>
                            <div className="flex space-x-4">
                                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-blue-600 hover:text-white transition-colors">
                                    <Facebook className="w-5 h-5" />
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-pink-600 hover:text-white transition-colors">
                                    <Instagram className="w-5 h-5" />
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-blue-500 hover:text-white transition-colors">
                                    <Twitter className="w-5 h-5" />
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-blue-700 hover:text-white transition-colors">
                                    <Linkedin className="w-5 h-5" />
                                </a>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold mb-6 border-b border-gray-800 pb-3">
                                Quick Links
                            </h3>
                            <ul className="space-y-3">
                                {navLinks.map((link) => (
                                    <li key={link.path}>
                                        <Link to={link.path} className="text-gray-400 hover:text-blue-400 transition-colors flex items-center group">
                                            <ChevronRight className="w-4 h-4 mr-1 text-gray-600 group-hover:text-blue-500" />
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold mb-6 border-b border-gray-800 pb-3">Contact Us</h3>
                            <ul className="space-y-4">
                                <li className="flex items-start text-gray-400 hover:text-white transition-colors group">
                                    <MapPin className="h-5 w-5 mr-3 text-blue-500 flex-shrink-0 mt-0.5 group-hover:text-blue-400" />
                                    <span className="leading-relaxed">{address}</span>
                                </li>
                                <li className="flex items-center text-gray-400 hover:text-white transition-colors group">
                                    <Phone className="h-5 w-5 mr-3 text-blue-500 flex-shrink-0 group-hover:text-blue-400" />
                                    <span>{phone}</span>
                                </li>
                                <li className="flex items-center text-gray-400 hover:text-white transition-colors group">
                                    <Mail className="h-5 w-5 mr-3 text-blue-500 flex-shrink-0 group-hover:text-blue-400" />
                                    <span>{email}</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-gray-800 pt-8 text-center text-gray-500 text-sm">
                        &copy; {new Date().getFullYear()} {labName}. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default WebsiteLayout;
