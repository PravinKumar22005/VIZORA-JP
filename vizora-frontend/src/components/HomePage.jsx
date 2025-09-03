import React, { useState, useEffect, useRef } from 'react';
import AuthPage from './Auth/AuthPage'; // Import the AuthPage modal
import logo from '../assets/logo.jpg';
// --- SVG Icons as React Components ---
// ... (keep all your existing SVG components)
const CreateIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
);
const KnowledgeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10m16-5H4"></path></svg>
);
const CollaborateIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
);
const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
);
const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
);

// --- Main App Components ---

const Header = () => {
    // ... (keep existing Header component code)
    const [activeSection, setActiveSection] = useState('home');

    useEffect(() => {
        const sections = document.querySelectorAll('section');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id);
                }
            });
        }, { threshold: 0.5 });

        sections.forEach(section => observer.observe(section));

        return () => sections.forEach(section => observer.unobserve(section));
    }, []);

    const navItems = ['home', 'product', 'faq', 'contact'];

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-gray-800">
            <div className="container mx-auto px-6 py-4">
                <div className="flex justify-between items-center">
                    <a href="#home" className="flex items-center space-x-3 rtl:space-x-reverse">
                        <img src={logo} className="h-8" alt="Vizora Logo" />
                        <span className="self-center text-2xl font-bold whitespace-nowrap text-white transition-all hover:text-[#14FFEC] hover:drop-shadow-[0_0_8px_rgba(20,255,236,0.7)]">Vizora</span>
                    </a>
                    <nav className="hidden md:flex items-center space-x-8">
                        {navItems.map(item => (
                            <a key={item} href={`#${item}`} className={`nav-link uppercase text-white tracking-wider ${activeSection === item ? 'active-link' : ''}`}>
                                {item}
                            </a>
                        ))}
                    </nav>
                </div>
            </div>
        </header>
    );
};

const HomeSection = ({ onTryVizoraClick }) => { // Accept prop to open modal
    const [isInsightVisible, setInsightVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [insightText, setInsightText] = useState('');
    
    const handleGetInsights = () => {
        setInsightVisible(true);
        setIsLoading(true);
        setInsightText('');

        const hardcodedInsight = "The analysis reveals a significant 80% drop-off between the 'Visit' and 'Purchase' stages... To address this, I recommend investigating the user checkout flow for potential friction points, such as unexpected shipping costs or a complicated form, to improve conversion rates.";

        setTimeout(() => {
            setInsightText(hardcodedInsight);
            setIsLoading(false);
        }, 1500);
    };
    
    const handleCloseInsights = () => {
        setInsightVisible(false);
    };

    return (
        <section id="home" style={{ backgroundImage: 'radial-gradient(ellipse at top, #323232 0%, #212121 80%)' }}>
            <div className="container mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center w-full">
                    <div className="text-center md:text-left">
                        <h1 className="hero-text text-6xl md:text-8xl font-extrabold text-white leading-tight mb-4">Complex?<br />Solved.</h1>
                        <p className="hero-text text-xl text-gray-300 mb-8" style={{ animationDelay: '0.1s' }}>The AI for Data Analysts</p>
                        <div className="hero-btn">
                            <button onClick={onTryVizoraClick} type="button" className="glow-button text-lg font-semibold py-4 px-12 rounded-lg inline-block">Try Vizora ➶</button>
                        </div>
                    </div>
                    <div className="hidden md:flex flex-col items-center">
                        <div className="relative chart-box">
                            <div className="bg-[#323232]/50 border border-gray-700 rounded-2xl p-6 shadow-2xl shadow-black/30 backdrop-blur-sm">
                                <p className="text-sm text-gray-300 mb-4">Sales Funnel Analysis</p>
                                <div className="h-64 w-full">
                                    <svg viewBox="0 0 500 200" className="w-full h-full" preserveAspectRatio="none">
                                        <defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="coloredBlur"></feGaussianBlur><feMerge><feMergeNode in="coloredBlur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter></defs>
                                        <path className="chart-line" d="M50 20 L150 80 L250 110 L350 150 L450 170" stroke="#14FFEC" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                        <circle className="chart-point" style={{ animationDelay: '0.5s' }} cx="50" cy="20" r="5" fill="#14FFEC" /><circle className="chart-point" style={{ animationDelay: '0.8s' }} cx="150" cy="80" r="5" fill="#14FFEC" /><circle className="chart-point" style={{ animationDelay: '1.1s' }} cx="250" cy="110" r="5" fill="#14FFEC" /><circle className="chart-point" style={{ animationDelay: '1.4s' }} cx="350" cy="150" r="5" fill="#14FFEC" /><circle className="chart-point" style={{ animationDelay: '1.7s' }} cx="450" cy="170" r="5" fill="#14FFEC" />
                                    </svg>
                                </div>
                                <div className="flex justify-between -mx-2 mt-2"><span className="text-xs text-gray-400 w-1/5 text-center">Ad View</span><span className="text-xs text-gray-400 w-1/5 text-center">Email Open</span><span className="text-xs text-gray-400 w-1/5 text-center">Visit</span><span className="text-xs text-gray-400 w-1/5 text-center">Purchase</span><span className="text-xs text-gray-400 w-1/5 text-center">Repeat</span></div>
                            </div>
                            <div className="absolute -top-6 -left-6 bg-[#2a2a2a] text-sm text-gray-300 p-4 rounded-xl border border-[#14FFEC]/30 shadow-lg transition-all hover:border-[#14FFEC] hover:shadow-[#14FFEC]/20">There's a problem...</div>
                            <div className="absolute -bottom-6 -right-6 bg-[#2a2a2a] text-sm text-gray-300 p-4 rounded-xl border border-[#14FFEC]/30 shadow-lg transition-all hover:border-[#14FFEC] hover:shadow-[#14FFEC]/20">Yes, let's dig in.</div>
                        </div>
                        <div className="mt-8 text-center">
                            <button onClick={handleGetInsights} disabled={isLoading} className="glow-button text-md font-semibold py-3 px-8 rounded-lg inline-flex items-center space-x-2"><span>✨ Get AI Insights</span></button>
                            <div className={`mt-4 text-left bg-[#212121] border border-gray-700 rounded-lg p-4 text-gray-300 min-h-[120px] relative transition-all duration-300 max-w-md mx-auto ${isInsightVisible ? '' : 'hidden'}`}>
                                {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-[#212121]/80 rounded-lg"><div className="w-8 h-8 border-4 border-t-[#14FFEC] border-gray-600 rounded-full animate-spin"></div></div>}
                                {!isLoading && insightText && (
                                    <button onClick={handleCloseInsights} className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors">
                                        <CloseIcon />
                                    </button>
                                )}
                                <p className="text-sm pr-6">{insightText}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

// ... (keep ProductSection, FaqSection, ContactSection, Footer as they are)
const ProductSection = () => {
    return (
        <section id="product" className="bg-[#212121]">
            <div className="container mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Meet Vizora</h2>
                    <p className="text-lg text-gray-400">A next generation AI assistant designed to be safe, accurate, and secure to help you do your best work.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-center">
                    <div className="md:col-span-3 bg-[#323232]/50 border border-gray-700 rounded-2xl p-6">
                        <img src="https://placehold.co/1200x800/212121/14FFEC?text=Interactive+Dashboard" alt="Interactive Dashboard" className="rounded-lg w-full h-auto" />
                    </div>
                    <div className="md:col-span-2 space-y-8">
                        <div className="flex items-start space-x-4"><div className="text-[#14FFEC] mt-1"><CreateIcon /></div><div><h3 className="font-bold text-xl text-white">Create with Vizora</h3><p className="text-gray-400">Draft and iterate on analyses and visualizations.</p></div></div>
                        <div className="flex items-start space-x-4"><div className="text-[#14FFEC] mt-1"><KnowledgeIcon /></div><div><h3 className="font-bold text-xl text-white">Bring your knowledge</h3><p className="text-gray-400">Connect your own datasets from various sources.</p></div></div>
                        <div className="flex items-start space-x-4"><div className="text-[#14FFEC] mt-1"><CollaborateIcon /></div><div><h3 className="font-bold text-xl text-white">Share and collaborate</h3><p className="text-gray-400">Work with your team in real-time.</p></div></div>
                    </div>
                </div>
            </div>
        </section>
    );
};

const FaqItem = ({ item, isOpen, onClick }) => {
    const contentRef = useRef(null);

    return (
        <div className={`faq-item bg-[#212121] rounded-lg border border-gray-700 ${isOpen ? 'open' : ''}`}>
            <button onClick={onClick} className="faq-question w-full flex justify-between items-center text-left text-lg font-semibold p-6 focus:outline-none text-white">
                <span>{item.question}</span>
                <span className="faq-icon text-[#14FFEC]"><PlusIcon /></span>
            </button>
            <div
                ref={contentRef}
                className="faq-answer px-6 pb-0 pt-0 text-gray-400"
                style={{ maxHeight: isOpen ? `${contentRef.current?.scrollHeight}px` : '0px' }}
            >
                <p className="pb-6">{item.answer}</p>
            </div>
        </div>
    );
};

const FaqSection = () => {
    const [openFaqIndex, setOpenFaqIndex] = useState(null);

    const faqData = [
        { question: 'What is Vizora?', answer: 'Vizora is an AI-powered data analysis platform that helps you connect to your data sources, generate insights through natural language queries, and create interactive visualizations.' },
        { question: 'What should I use Vizora for?', answer: 'Use Vizora for sales analytics, business intelligence, financial modeling, and any task where you need to extract meaningful insights from complex datasets quickly.' },
        { question: 'How much does it cost?', answer: 'We offer a range of plans, including a free tier for individuals. Our paid plans include advanced features, more data connections, and priority support.' },
    ];

    const handleToggle = (index) => {
        setOpenFaqIndex(openFaqIndex === index ? null : index);
    };

    return (
        <section id="faq" style={{ backgroundImage: 'radial-gradient(ellipse at bottom, #323232 0%, #212121 80%)' }}>
            <div className="container mx-auto max-w-3xl">
                <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-12">Frequently Asked Questions</h2>
                <div className="space-y-4">
                    {faqData.map((item, index) => (
                        <FaqItem
                            key={index}
                            item={item}
                            isOpen={openFaqIndex === index}
                            onClick={() => handleToggle(index)}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
};

const ContactSection = () => {
    return (
        <section id="contact" className="bg-[#212121]">
            <div className="container mx-auto max-w-lg text-center">
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Get in Touch</h2>
                <p className="text-lg text-gray-400 mb-8">Have a question or want to learn more? We'd love to hear from you.</p>
                <form action="#" className="space-y-6 text-left">
                    <div>
                        <label htmlFor="name" className="glowing-label text-sm font-medium text-gray-400 mb-2 block">Name</label>
                        <input type="text" id="name" placeholder="Enter your name" className="w-full bg-[#2a2a2a] text-white border border-gray-700 focus:border-[#14FFEC] focus:ring-2 focus:ring-[#14FFEC]/50 rounded-lg py-3 px-4 transition-all outline-none" />
                    </div>
                    <div>
                        <label htmlFor="email" className="glowing-label text-sm font-medium text-gray-400 mb-2 block">Email</label>
                        <input type="email" id="email" placeholder="Enter your email" className="w-full bg-[#2a2a2a] text-white border border-gray-700 focus:border-[#14FFEC] focus:ring-2 focus:ring-[#14FFEC]/50 rounded-lg py-3 px-4 transition-all outline-none" />
                    </div>
                    <div>
                        <label htmlFor="query" className="glowing-label text-sm font-medium text-gray-400 mb-2 block">Doubt or Query</label>
                        <textarea id="query" placeholder="How can we help you?" rows="4" className="w-full bg-[#2a2a2a] text-white border border-gray-700 focus:border-[#14FFEC] focus:ring-2 focus:ring-[#14FFEC]/50 rounded-lg py-3 px-4 transition-all outline-none"></textarea>
                    </div>
                    <button type="submit" className="glow-button text-lg font-semibold py-3 px-12 rounded-lg inline-block w-full">
                        Send Message
                    </button>
                </form>
            </div>
        </section>
    );
};

const Footer = () => (
    <footer className="w-full py-8 text-center text-gray-500 text-sm bg-[#212121]">
        <div className="container mx-auto px-6">&copy; 2025 Vizora. All rights reserved.</div>
    </footer>
);

export default function HomePage() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div className="antialiased">
      <Header />
      <main>
        <HomeSection onTryVizoraClick={() => setShowAuthModal(true)} />
        <ProductSection />
        <FaqSection />
        <ContactSection />
      </main>
      <Footer />
      {showAuthModal && <AuthPage onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}