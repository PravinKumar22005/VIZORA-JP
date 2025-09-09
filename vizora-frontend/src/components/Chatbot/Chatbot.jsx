import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Plus, Mic, Menu, X, HelpCircle, User, Share2, Trash2, ChevronRight, HardDrive, FileText, FileX2, ChevronsLeft, ChevronsRight, ArrowRight, CornerDownLeft, Lock } from 'lucide-react';
import logoGif from '../../assets/logo.gif'; // Place your GIF here

// --- Main Chatbot Component ---
export default function Chatbot() {
    const navigate = useNavigate();

    // --- User Data ---
    const initialUserData = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('user') || '{}');
        } catch {
            return {};
        }
    }, []);
    const [userData] = useState(initialUserData);

    // --- State Management ---
    const [chats, setChats] = useState([
        {
            id: 'chat-1',
            title: 'Exploring AI Concepts',
            messages: [
                { id: 'msg-1', sender: 'user', text: 'Can you explain the concept of generative AI?' },
                { id: 'msg-2', sender: 'bot', text: 'Of course! Generative AI refers to a class of artificial intelligence models that can create new, original content, such as text, images, music, and code. Unlike discriminative models that classify data, generative models learn the underlying patterns of a dataset to produce novel outputs.' },
            ],
        },
        {
            id: 'chat-2',
            title: 'Data Analysis with CSV',
            messages: [
                { id: 'msg-3', sender: 'user', text: 'I have a CSV file with sales data. Can you help me analyze it?' }
            ],
        },
    ]);
    const [activeChatId, setActiveChatId] = useState('chat-1');
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // UI State
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showFilePreview, setShowFilePreview] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
    const [searchTerm, setSearchTerm] = useState('');

    // --- Refs ---
    const helpRef = useRef(null);
    const fileInputRef = useRef(null);

    // --- Effects ---
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            setIsSidebarOpen(!mobile);
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        function handleClickOutside(event) {
            if (helpRef.current && !helpRef.current.contains(event.target)) {
                setShowHelp(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [helpRef]);

    useEffect(() => {
        if (toast.show) {
            const timer = setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    // --- Computed State ---
    const activeChat = useMemo(() => chats.find(chat => chat.id === activeChatId), [chats, activeChatId]);
    const filteredChats = useMemo(() =>
        chats.filter(chat => chat.title.toLowerCase().includes(searchTerm.toLowerCase()))
    , [chats, searchTerm]);

    // --- Core Functions ---
    const showToast = (message, type = 'error') => {
        setToast({ show: true, message, type });
    };

    const handleNewChat = () => {
        const newChatId = `chat-${Date.now()}`;
        const newChat = {
            id: newChatId,
            title: `New Conversation`,
            messages: [],
        };
        setChats([newChat, ...chats]);
        setActiveChatId(newChatId);
        if(isMobile) setIsSidebarOpen(false);
    };

    const handleSendMessage = (text, file = null) => {
        if (!text && !file) return;

        const newMessage = {
            id: `msg-${Date.now()}`,
            sender: 'user',
            ...(text && { text }),
            ...(file && { file }),
        };

        const updatedChats = chats.map(chat => {
            if (chat.id === activeChatId) {
                let newTitle = chat.title;
                if (chat.messages.length === 0) {
                    if (file) {
                        newTitle = file.name
                            .replace(/\.(csv|xlsx)$/i, '')
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase());
                    } else if (text) {
                        newTitle = text.substring(0, 30) + (text.length > 30 ? '...' : '');
                    }
                }
                return { ...chat, title: newTitle, messages: [...chat.messages, newMessage] };
            }
            return chat;
        });

        setChats(updatedChats);

        // Simulate bot response
        setTimeout(() => {
            const botResponse = {
                id: `msg-${Date.now() + 1}`,
                sender: 'bot',
                typing: true,
            };
            const chatsWithTyping = updatedChats.map(chat =>
                chat.id === activeChatId ? { ...chat, messages: [...chat.messages, botResponse] } : chat
            );
            setChats(chatsWithTyping);

            setTimeout(() => {
                let botText = "I'm processing that. Give me a moment.";
                if (file) {
                    botText = `I've received the file "${file.name}". I'm ready to analyze its contents for you. What would you like to know?`;
                } else if(text && text.toLowerCase().includes('hello')) {
                    botText = 'Hello there! How can I assist you today?';
                }

                const finalBotResponse = { ...botResponse, typing: false, text: botText };
                const finalChats = chatsWithTyping.map(chat =>
                    chat.id === activeChatId
                        ? { ...chat, messages: [...chat.messages.slice(0, -1), finalBotResponse] }
                        : chat
                );
                setChats(finalChats);
            }, 2000);
        }, 500);
    };

    const handleDeleteChat = (chatId) => {
        const remainingChats = chats.filter(chat => chat.id !== chatId);
        setChats(remainingChats);
        if (activeChatId === chatId) {
            setActiveChatId(remainingChats.length > 0 ? remainingChats[0].id : null);
        }
    };

    const handleDeleteHistory = () => {
        setChats([]);
        setActiveChatId(null);
        setShowAccountModal(false);
        showToast("All chats have been deleted.", "success");
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
        if (!allowedTypes.includes(file.type)) {
            showToast('Invalid file type. Please upload .xlsx or .csv files.');
            return;
        }

        // Only metadata is stored/sent
        const fileData = {
            name: file.name,
            size: (file.size / 1024).toFixed(2) + ' KB',
            type: file.type === 'text/csv' ? 'CSV' : 'XLSX',
            uploadedBy: userData.email,
            uploadedAt: new Date().toISOString(),
        };
        handleSendMessage(null, fileData);
        fileInputRef.current.value = "";
    };

    const handleShareChat = () => {
        navigator.clipboard.writeText(window.location.href)
            .then(() => showToast("Chat link copied to clipboard!", "success"))
            .catch(() => showToast("Failed to copy link."));
    };

    useEffect(() => {
        const styleElement = document.createElement('style');
        styleElement.innerHTML = `
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #555; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #777; }
            @keyframes blob {
              0% { transform: translate(0px, 0px) scale(1); }
              33% { transform: translate(30px, -50px) scale(1.1); }
              66% { transform: translate(-20px, 20px) scale(0.9); }
              100% { transform: translate(0px, 0px) scale(1); }
            }
            .animate-blob { animation: blob 10s infinite; }
            .animation-delay-4000 { animation-delay: -4s; }
        `;
        document.head.appendChild(styleElement);

        const loadScript = (src, id) => {
            if (document.getElementById(id)) return;
            const script = document.createElement('script');
            script.src = src;
            script.id = id;
            script.async = true;
            document.head.appendChild(script);
        };

        loadScript('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js', 'papaparse-script');
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'xlsx-script');

        return () => {
            document.head.removeChild(styleElement);
        };
    }, []);

    // --- Render ---
    return (
        <div className="font-sans antialiased text-gray-200 bg-[#212121] h-screen w-screen overflow-hidden flex relative">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[#0D7377] rounded-full opacity-20 filter blur-3xl animate-blob"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-[#14FFEC] rounded-full opacity-10 filter blur-3xl animate-blob animation-delay-4000"></div>
            </div>

            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.aside
                        key="sidebar"
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="bg-[#323232]/80 backdrop-blur-md h-full z-20 flex flex-col"
                        style={{ width: isMobile ? '85%' : '260px' }}
                    >
                        <Sidebar
                            chats={filteredChats}
                            activeChatId={activeChatId}
                            setActiveChatId={setActiveChatId}
                            onNewChat={handleNewChat}
                            onShowAccount={() => setShowAccountModal(true)}
                            onShareChat={handleShareChat}
                            onDeleteChat={() => handleDeleteChat(activeChatId)}
                            onToggleSidebar={() => setIsSidebarOpen(false)}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            userData={userData}
                        />
                    </motion.aside>
                )}
            </AnimatePresence>

            <main className="flex-1 flex flex-col h-full z-10 relative">
                <header className="flex items-center justify-between p-4 border-b border-gray-700/50 bg-[#212121]/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        {!isSidebarOpen && (
                            <button onClick={() => setIsSidebarOpen(true)} className="p-1.5 rounded-md hover:bg-gray-700/80 transition-colors focus:outline-none focus:ring-2 focus:ring-[#14FFEC]">
                                <Menu className="w-6 h-6 text-gray-300" />
                            </button>
                        )}
                        <h1 className="text-xl font-semibold text-white">{activeChat?.title || 'Vizora Chat'}</h1>
                    </div>
                    <div className="relative" ref={helpRef}>
                        <button onClick={() => setShowHelp(prev => !prev)} className="p-2 rounded-full hover:bg-gray-700/80 transition-colors focus:outline-none focus:ring-2 focus:ring-[#14FFEC]">
                            <HelpCircle className="w-6 h-6 text-gray-300" />
                        </button>
                        <AnimatePresence>
                            {showHelp && <HelpDropdown onAction={(action) => {
                                if (action === 'newChat') handleNewChat();
                                if (action === 'account') setShowAccountModal(true);
                                if (action === 'clear') handleDeleteHistory();
                                if (action === 'upload') fileInputRef.current?.click();
                                setShowHelp(false);
                            }} />}
                        </AnimatePresence>
                    </div>
                </header>

                <ChatPanel messages={activeChat?.messages || []} onPreviewFile={setShowFilePreview} />

                <ChatInput onSendMessage={handleSendMessage} onUploadClick={() => fileInputRef.current?.click()} />
            </main>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.csv" className="hidden" />

            <AnimatePresence>
                {showAccountModal && <AccountModal key="accountModal" userData={userData} onClose={() => setShowAccountModal(false)} onDeleteHistory={handleDeleteHistory} onShowPasswordChange={() => {
                    setShowAccountModal(false);
                    navigate('/change-password');
                }} />}
                {showFilePreview && <FilePreviewModal key="filePreviewModal" file={showFilePreview} onClose={() => setShowFilePreview(null)} />}
                {toast.show && <Toast key="toast" message={toast.message} type={toast.type} onClose={() => setToast({ show: false, message: '', type: 'error' })} />}
            </AnimatePresence>
        </div>
    );
}

// --- Child Components ---
const Sidebar = ({ chats, activeChatId, setActiveChatId, onNewChat, onShowAccount, onShareChat, onDeleteChat, onToggleSidebar, searchTerm, setSearchTerm, userData }) => (
    <div className="flex flex-col h-full p-3">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <img src={logoGif} alt="Vizora Logo" className="w-8 h-8" />
                <div>
                    <h1 className="text-2xl font-bold text-white">Vizora</h1>
                    <div className="text-xs text-gray-400">{userData?.name}</div>
                </div>
            </div>
            <button onClick={onToggleSidebar} className="p-1.5 rounded-md hover:bg-gray-700/80 transition-colors focus:outline-none focus:ring-2 focus:ring-[#14FFEC]">
                <ChevronsLeft className="w-5 h-5" />
            </button>
        </div>

        <button onClick={onNewChat} className="group flex items-center justify-center gap-2 w-full bg-[#0D7377] text-white py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-[#14FFEC] hover:text-black transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#323232] focus:ring-[#14FFEC] mb-4">
            <Plus className="w-5 h-5" />
            New Chat
        </button>

        <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
                type="text"
                placeholder="Search chats..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14FFEC]"
            />
        </div>

        <nav className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
            <ul className="space-y-1">
                <AnimatePresence>
                    {chats.map(chat => (
                        <motion.li
                            key={chat.id}
                            layout
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <a
                                href="#"
                                onClick={(e) => { e.preventDefault(); setActiveChatId(chat.id); }}
                                className={`flex items-center justify-between p-2.5 rounded-lg text-sm font-medium transition-colors group ${
                                    activeChatId === chat.id ? 'bg-[#14FFEC] text-black shadow-lg' : 'hover:bg-gray-700/60 text-gray-300'
                                }`}
                            >
                                <span className="truncate">{chat.title}</span>
                                {activeChatId === chat.id && <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                            </a>
                        </motion.li>
                    ))}
                </AnimatePresence>
            </ul>
        </nav>

        <div className="mt-auto pt-4 border-t border-gray-700/50 space-y-1">
            <SidebarButton icon={User} text="Account" onClick={onShowAccount} />
            <SidebarButton icon={Lock} text="Change Password" onClick={() => onShowAccount('changePassword')} />
            <SidebarButton icon={Share2} text="Share Chat" onClick={onShareChat} />
            <SidebarButton icon={Trash2} text="Delete Chat" onClick={onDeleteChat} danger />
        </div>
    </div>
);

const SidebarButton = ({ icon: Icon, text, onClick, danger = false }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-sm font-medium transition-colors ${
            danger ? 'text-red-400 hover:bg-red-500/20' : 'text-gray-300 hover:bg-gray-700/60'
        }`}
    >
        <Icon className="w-5 h-5" />
        {text}
    </button>
);

// --- Child Components ---

const ChatPanel = ({ messages, onPreviewFile }) => {
    const endOfMessagesRef = useRef(null);
    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {messages.map((msg) => (
                <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {msg.sender === 'user' ? (
                        <UserMessage message={msg} onPreviewFile={onPreviewFile} />
                    ) : (
                        <BotMessage message={msg} />
                    )}
                </motion.div>
            ))}

            <div ref={endOfMessagesRef} />
        </div>
    );
};

const UserMessage = ({ message, onPreviewFile }) => (
    <div className="flex items-start gap-3 justify-end">
        <div className="bg-[#0D7377] rounded-xl rounded-br-none p-4 max-w-lg">
            {message.text && <p className="text-white text-base leading-relaxed">{message.text}</p>}
            {message.file && <FileCard file={message.file} onPreview={() => onPreviewFile(message.file)} />}
        </div>
        <div className="w-8 h-8 rounded-full bg-gray-600 flex-shrink-0 flex items-center justify-center font-bold text-sm">
            {message.file?.uploadedBy?.[0]?.toUpperCase() || 'U'}
        </div>
    </div>
);

const BotMessage = ({ message }) => (
    <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0D7377] to-[#14FFEC] flex-shrink-0"></div>
        <div className="bg-[#323232] rounded-xl rounded-bl-none p-4 max-w-lg">
            {message.typing ? <TypingIndicator /> : <p className="text-white text-base leading-relaxed">{message.text}</p>}
        </div>
    </div>
);

const TypingIndicator = () => (
    <div className="flex items-center gap-1.5">
        <motion.div className="w-2 h-2 bg-gray-400 rounded-full" animate={{ scale: [1, 1.2, 1], y: [0, -2, 0] }} transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="w-2 h-2 bg-gray-400 rounded-full" animate={{ scale: [1, 1.2, 1], y: [0, -2, 0] }} transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} />
        <motion.div className="w-2 h-2 bg-gray-400 rounded-full" animate={{ scale: [1, 1.2, 1], y: [0, -2, 0] }} transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} />
    </div>
);

const FileCard = ({ file, onPreview }) => (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-3 bg-black/30 rounded-lg p-3 flex items-center gap-3">
        <div className="p-2 bg-gray-600 rounded-md">
            {file.type === 'CSV' ? <FileText className="w-6 h-6 text-[#14FFEC]" /> : <HardDrive className="w-6 h-6 text-[#14FFEC]" />}
        </div>
        <div className="flex-1 text-sm">
            <p className="font-semibold text-white truncate">{file.name}</p>
            <p className="text-gray-400">{file.size}</p>
        </div>
        <button onClick={onPreview} className="bg-[#14FFEC] text-black px-3 py-1 rounded-md text-xs font-semibold hover:bg-white transition-colors">
            Preview
        </button>
    </motion.div>
);

const ChatInput = ({ onSendMessage, onUploadClick }) => {
    const [input, setInput] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); if (input.trim()) { onSendMessage(input.trim()); setInput(''); } };
    const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }

    return (
        <div className="p-4 bg-transparent">
            <form onSubmit={handleSubmit} className="flex items-center gap-3 bg-[#323232] rounded-xl p-2.5 shadow-2xl border border-gray-700/50 focus-within:ring-2 focus-within:ring-[#14FFEC] transition-all duration-300">
                <button type="button" onClick={onUploadClick} className="p-2 rounded-full hover:bg-gray-600/50 transition-colors"><Plus className="w-6 h-6 text-gray-300" /></button>
                <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask Vizora..." rows="1" className="flex-1 bg-transparent text-gray-200 text-base placeholder-gray-500 focus:outline-none resize-none max-h-40 custom-scrollbar" />
                <button type="submit" className="p-2 rounded-full hover:bg-gray-600/50 transition-colors disabled:opacity-50" disabled={!input.trim()}><ArrowRight className="w-6 h-6 text-gray-300" /></button>
                <button type="button" className="p-2 rounded-full hover:bg-gray-600/50 transition-colors"><Mic className="w-6 h-6 text-gray-300" /></button>
            </form>
        </div>
    );
};

const HelpDropdown = ({ onAction }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.15 }}
        className="absolute top-full right-0 mt-2 w-64 bg-[#323232] border border-gray-700 rounded-lg shadow-xl z-50 p-2"
    >
        <ul>
            <HelpItem text="Start New Chat" onClick={() => onAction('newChat')} />
            <HelpItem text="Manage Account" onClick={() => onAction('account')} />
            <HelpItem text="Clear History" onClick={() => onAction('clear')} />
            <HelpItem text="Upload File" onClick={() => onAction('upload')} />
        </ul>
        <div className="text-xs text-gray-500 text-center pt-2 mt-2 border-t border-gray-700/50">
            Vizora can make mistakes. Consider checking important information.
        </div>
    </motion.div>
);

const HelpItem = ({ text, onClick }) => (
    <li>
        <button onClick={onClick} className="w-full flex justify-between items-center p-2 rounded-md hover:bg-gray-700/60 transition-colors text-left text-sm">
            <span>{text}</span>
        </button>
    </li>
);

const AccountModal = ({ userData, onClose, onDeleteHistory, onShowPasswordChange }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center" onClick={onClose}>
        <motion.div
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-[#323232] rounded-xl w-full max-w-md p-6 border border-gray-700/50 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-700/80 transition-colors"><X className="w-5 h-5" /></button>
            <h2 className="text-2xl font-bold mb-6 text-white">Account Settings</h2>
            <div className="space-y-4">
                <InfoDisplay label="Name" value={userData.name} />
                <InfoDisplay label="Email" value={userData.email} />
                <button onClick={onShowPasswordChange} className="w-full text-sm py-2.5 px-4 rounded-lg border border-gray-600 hover:bg-gray-700/60 transition-colors">Change Password</button>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-700/50">
                <h3 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h3>
                <p className="text-sm text-gray-400 mb-4">This will permanently delete all your chat history.</p>
                <button onClick={onDeleteHistory} className="w-full bg-red-500/20 text-red-400 font-semibold py-2 px-4 rounded-lg hover:bg-red-500/40 transition-colors">Delete Chat History</button>
            </div>
        </motion.div>
    </motion.div>
);

const InfoDisplay = ({ label, value }) => (
    <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
        <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200">
            {value}
        </div>
    </div>
);

const FilePreviewModal = ({ file, onClose }) => {
    const [data, setData] = useState(null);
    const [headers, setHeaders] = useState([]);
    const [error, setError] = useState('');
    const [activeSheet, setActiveSheet] = useState(0);
    const [workbook, setWorkbook] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const rowsPerPage = 10;

    useEffect(() => {
        if (!window.Papa || !window.XLSX) { setError("File parsing libraries are loading..."); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (file.type === 'CSV') {
                    const result = window.Papa.parse(e.target.result, { header: true, skipEmptyLines: true });
                    if(result.errors.length) throw new Error("Parsing error");
                    setHeaders(result.meta.fields);
                    setData(result.data);
                } else {
                    const wb = window.XLSX.read(e.target.result, { type: 'binary' });
                    setWorkbook(wb);
                    const sheetName = wb.SheetNames[activeSheet];
                    const ws = wb.Sheets[sheetName];
                    const jsonData = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
                    setHeaders(jsonData[0] || []);
                    setData(jsonData.slice(1).map(row => (jsonData[0] || []).reduce((obj, h, i) => ({...obj, [h]: row[i]}), {})));
                }
            } catch (err) { setError("Failed to parse file."); }
        };
        reader.onerror = () => setError("Failed to read the file.");
        if (file.type === 'XLSX') { reader.readAsBinaryString(file.raw); } else { reader.readAsText(file.raw); }
    }, [file, activeSheet]);

    const handleSheetChange = (sheetIndex) => {
        if (!window.XLSX || !workbook) return;
        setActiveSheet(sheetIndex);
        const sheetName = workbook.SheetNames[sheetIndex];
        const ws = workbook.Sheets[sheetName];
        const jsonData = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
        setHeaders(jsonData[0] || []);
        setData(jsonData.slice(1).map(row => (jsonData[0] || []).reduce((obj, h, i) => ({...obj, [h]: row[i]}), {})));
        setCurrentPage(1);
    }

    const filteredData = useMemo(() => {
        if (!data) return [];
        if (!searchTerm) return data;
        return data.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase())));
    }, [data, searchTerm]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return filteredData.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredData, currentPage]);

    const totalPages = Math.ceil(filteredData.length / rowsPerPage);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }} className="bg-[#212121] rounded-xl w-full max-w-4xl h-[90vh] flex flex-col border border-gray-700/50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <header className="p-4 flex items-center justify-between border-b border-gray-700/50 flex-shrink-0">
                    <h2 className="text-xl font-bold text-white truncate">{file.name}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-700/80 transition-colors"><X className="w-5 h-5" /></button>
                </header>

                <div className="p-4 flex-shrink-0 flex flex-col md:flex-row gap-4 items-center">
                    {workbook && (<select value={activeSheet} onChange={(e) => handleSheetChange(parseInt(e.target.value))} className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14FFEC]">{workbook.SheetNames.map((name, index) => (<option key={name} value={index}>{name}</option>))}</select>)}
                    <div className="relative flex-grow w-full md:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type="text" placeholder="Search table..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14FFEC]"/>
                    </div>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar p-4">
                    {error ? <div className="text-red-400">{error}</div> : !data ? <div className="text-gray-400">Loading data...</div> : (
                        <table className="w-full text-sm text-left text-gray-300">
                            <thead className="text-xs text-gray-400 uppercase bg-[#323232] sticky top-0"><tr>{headers.map(h => <th key={h} className="px-6 py-3">{h}</th>)}</tr></thead>
                            <tbody>{paginatedData.map((row, i) => (<tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">{headers.map(h => <td key={h} className="px-6 py-4 truncate max-w-xs">{String(row[h] || '')}</td>)}</tr>))}</tbody>
                        </table>
                    )}
                </div>

                <footer className="p-4 border-t border-gray-700/50 flex-shrink-0 flex items-center justify-between text-sm">
                    <span className="text-gray-400">Showing {paginatedData.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0}-{Math.min(currentPage * rowsPerPage, filteredData.length)} of {filteredData.length}</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="p-1.5 rounded-md disabled:opacity-50 hover:bg-gray-700/60 transition-colors"><ChevronsLeft className="w-4 h-4" /></button>
                        <span className="font-semibold">Page {currentPage} of {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="p-1.5 rounded-md disabled:opacity-50 hover:bg-gray-700/60 transition-colors"><ChevronsRight className="w-4 h-4" /></button>
                    </div>
                </footer>
            </motion.div>
        </motion.div>
    );
};

const Toast = ({ message, type, onClose }) => (
    <motion.div layout initial={{ opacity: 0, y: 50, scale: 0.3 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.5 }} className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 p-4 rounded-lg shadow-2xl border ${ type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-green-500/20 border-green-500/30 text-green-300' }`}>
        {type === 'error' ? <FileX2 className="w-6 h-6" /> : <CornerDownLeft className="w-6 h-6" />}
        <p className="font-semibold">{message}</p>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700/80 transition-colors"><X className="w-4 h-4" /></button>
    </motion.div>
);