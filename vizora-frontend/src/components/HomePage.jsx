import React, { useState, useEffect, useRef, useMemo } from 'react';
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

const SEGMENTS = ['North America', 'EMEA', 'APAC'];
const TIME_RANGES = [
    { id: '7', label: 'Last 7 days' },
    { id: '30', label: '30 days' },
    { id: '90', label: '90 days' }
];

const METRIC_CONFIG = {
    revenue: {
        label: 'Pipeline Revenue',
        unit: '$',
        series: [
            {
                name: 'North America',
                color: 'from-[#14FFEC] to-[#0D7377]',
                values: { '7': 0.82, '30': 3.9, '90': 11.2 },
                deltas: { '7': 6, '30': 12, '90': 19 }
            },
            {
                name: 'EMEA',
                color: 'from-[#7C4DFF] to-[#3E206D]',
                values: { '7': 0.65, '30': 3.1, '90': 9.8 },
                deltas: { '7': 4, '30': 9, '90': 15 }
            },
            {
                name: 'APAC',
                color: 'from-[#FF8A00] to-[#FF3CAC]',
                values: { '7': 0.54, '30': 2.7, '90': 8.1 },
                deltas: { '7': 3, '30': 7, '90': 11 }
            }
        ]
    },
    conversion: {
        label: 'Conversion Rate',
        unit: '%',
        series: [
            {
                name: 'North America',
                color: 'from-[#00F5A0] to-[#00D9F5]',
                values: { '7': 3.4, '30': 3.9, '90': 4.2 },
                deltas: { '7': 2, '30': 5, '90': 7 }
            },
            {
                name: 'EMEA',
                color: 'from-[#FCE38A] to-[#F38181]',
                values: { '7': 3.1, '30': 3.4, '90': 3.7 },
                deltas: { '7': 1, '30': 3, '90': 5 }
            },
            {
                name: 'APAC',
                color: 'from-[#F83600] to-[#F9D423]',
                values: { '7': 2.8, '30': 3.2, '90': 3.5 },
                deltas: { '7': -1, '30': 1, '90': 3 }
            }
        ]
    },
    retention: {
        label: 'Customer Retention',
        unit: '%',
        series: [
            {
                name: 'North America',
                color: 'from-[#4FACFE] to-[#00F2FE]',
                values: { '7': 88, '30': 90, '90': 92 },
                deltas: { '7': 1, '30': 2, '90': 4 }
            },
            {
                name: 'EMEA',
                color: 'from-[#43CBFF] to-[#9708CC]',
                values: { '7': 84, '30': 86, '90': 88 },
                deltas: { '7': 1, '30': 2, '90': 3 }
            },
            {
                name: 'APAC',
                color: 'from-[#EE0979] to-[#FF6A00]',
                values: { '7': 79, '30': 82, '90': 85 },
                deltas: { '7': -1, '30': 1, '90': 2 }
            }
        ]
    }
};

const formatMetricValue = (unit, value = 0) => {
    if (unit === '$') {
        if (value >= 1) return `$${value.toFixed(1)}M`;
        return `$${Math.round(value * 1000)}K`;
    }
    if (unit === '%') {
        return `${value.toFixed(1)}%`;
    }
    return value.toLocaleString();
};

const DashboardPreview = () => {
    const [activeMetric, setActiveMetric] = useState('revenue');
    const [activeRange, setActiveRange] = useState('30');
    const [activeSegment, setActiveSegment] = useState(SEGMENTS[0]);

    const metric = METRIC_CONFIG[activeMetric];

    const chartValues = useMemo(() => (
        metric.series.map(series => ({
            name: series.name,
            value: series.values[activeRange] || 0,
            color: series.color,
            delta: series.deltas[activeRange] || 0
        }))
    ), [metric, activeRange]);

    const maxValue = Math.max(...chartValues.map(item => item.value), 1);
    const activeSeries = metric.series.find(series => series.name === activeSegment) || metric.series[0];

    const leader = useMemo(() => (
        chartValues.reduce((prev, curr) => (curr.value > prev.value ? curr : prev), chartValues[0])
    ), [chartValues]);

    const laggard = useMemo(() => (
        chartValues.reduce((prev, curr) => (curr.value < prev.value ? curr : prev), chartValues[0])
    ), [chartValues]);

    const insightCopy = `${leader.name} is leading ${metric.label.toLowerCase()} at ${formatMetricValue(metric.unit, leader.value)}, while ${laggard.name} shows room to improve. An automated playbook recommends nudging ${laggard.name} with fresh enablement assets.`;

    return (
        <div className="bg-[#161616] border border-gray-800 rounded-2xl p-5 md:p-6 shadow-2xl shadow-black/40 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Live workspace</p>
                    <h3 className="text-2xl font-bold text-white">Vizora Interactive Dashboard</h3>
                </div>
                <span className="text-xs font-semibold text-[#14FFEC] bg-[#14FFEC]/10 border border-[#14FFEC]/40 px-3 py-1 rounded-full">Realtime demo</span>
            </div>

            <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                    {Object.entries(METRIC_CONFIG).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => setActiveMetric(key)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeMetric === key ? 'bg-[#14FFEC] text-black shadow-lg shadow-[#14FFEC]/40' : 'bg-[#1f1f1f] text-gray-300 hover:bg-[#2c2c2c]'}`}
                        >
                            {config.label}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                        {TIME_RANGES.map(range => (
                            <button
                                key={range.id}
                                onClick={() => setActiveRange(range.id)}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${activeRange === range.id ? 'bg-white text-black' : 'bg-[#202020] text-gray-300 hover:bg-[#2d2d2d]'}`}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {SEGMENTS.map(segment => (
                            <button
                                key={segment}
                                onClick={() => setActiveSegment(segment)}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${activeSegment === segment ? 'border border-[#14FFEC] text-white' : 'border border-transparent text-gray-400 hover:text-white'}`}
                            >
                                {segment}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-4 space-y-4 flex-1 flex flex-col">
                <div className="bg-[#101010] border border-gray-800 rounded-xl p-4 flex-shrink-0">
                    <div className="flex items-center justify-between text-sm">
                        <div className="text-gray-400">{metric.label}</div>
                        <div className={`${(activeSeries.deltas[activeRange] || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'} font-semibold`}>
                            {(activeSeries.deltas[activeRange] || 0) >= 0 ? '+' : ''}{activeSeries.deltas[activeRange] || 0}% vs prior
                        </div>
                    </div>
                    <div className="flex items-end justify-between gap-2 h-32 mt-4">
                        {chartValues.map(item => (
                            <div key={item.name} className="flex flex-col items-center flex-1">
                                <div className="h-full flex items-end w-full">
                                    <div
                                        className={`w-full bg-gradient-to-t ${item.color} rounded-t-lg transition-all duration-500 ${item.name === activeSegment ? 'ring-2 ring-[#14FFEC]/80 ring-offset-2 ring-offset-[#101010]' : ''}`}
                                        style={{ height: `${(item.value / maxValue) * 100}%` }}
                                        aria-label={`${item.name} ${formatMetricValue(metric.unit, item.value)}`}
                                    ></div>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">{item.name}</p>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                        {chartValues.map(item => (
                            <div key={`${item.name}-card`} className="bg-[#1b1b1b] rounded-lg p-2 border border-gray-800">
                                <p className="text-[11px] text-gray-500">{item.name}</p>
                                <p className="text-base font-semibold text-white">{formatMetricValue(metric.unit, item.value)}</p>
                                <span className={`text-[11px] ${item.delta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                    {item.delta >= 0 ? '+' : ''}{item.delta}% vs plan
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3 flex-1">
                    <div className="bg-[#101010] border border-gray-800 rounded-xl p-4 flex flex-col">
                        <div className="flex items-center justify-between">
                            <h4 className="text-lg font-semibold text-white">Segment spotlight</h4>
                            <span className="text-xs text-gray-500">Drilldown</span>
                        </div>
                        <p className="text-2xl font-bold text-[#14FFEC] mt-3">{formatMetricValue(metric.unit, activeSeries.values[activeRange])}</p>
                        <p className="text-xs text-gray-400">{activeSegment} · {metric.label}</p>
                        <ul className="mt-3 space-y-2 text-sm text-gray-300">
                            <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#14FFEC]"></span>Stage 3 drop-off alert triggered.</li>
                            <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#FFD166]"></span>Top driver: product-qualified leads (+{activeSeries.deltas[activeRange] || 0}%).</li>
                            <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#EF476F]"></span>Action: sync playbook to RevOps.</li>
                        </ul>
                    </div>
                    <div className="bg-[#101010] border border-gray-800 rounded-xl p-4 flex flex-col">
                        <div className="flex items-center justify-between">
                            <h4 className="text-lg font-semibold text-white">Autonomous insight</h4>
                            <button className="text-xs text-[#14FFEC]">Share</button>
                        </div>
                        <p className="text-sm text-gray-300 mt-2 flex-1">{insightCopy}</p>
                        <div className="mt-3 text-xs text-gray-400">
                            <p>Next sync · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

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

const ProductSection = () => {
    return (
        <section id="product" className="bg-[#212121]">
            <div className="container mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Meet Vizora</h2>
                    <p className="text-lg text-gray-400">A next generation AI assistant designed to be safe, accurate, and secure to help you do your best work.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-center">
                    <div className="md:col-span-3">
                        <DashboardPreview />
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

export default function HomePage({ onLoginSuccess }) { // Accept onLoginSuccess from App.js
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
      {/* Pass the onLoginSuccess function down to the AuthPage modal */}
      {showAuthModal && <AuthPage onClose={() => setShowAuthModal(false)} onLoginSuccess={onLoginSuccess} />}
    </div>
  );
}