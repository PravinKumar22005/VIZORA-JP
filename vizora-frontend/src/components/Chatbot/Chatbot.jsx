import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Plus, Menu, X, HelpCircle, User, Share2, Trash2, ChevronRight, HardDrive, FileText, FileX2, ChevronsLeft, ChevronsRight, ArrowRight, CornerDownLeft, Lock } from 'lucide-react';
import logoGif from '../../assets/logo.gif';

// --- Main Chatbot Component ---
// FIX: It now receives `userData` and `onLogout` as props. This is the key to making it reactive to login state changes.
export default function Chatbot({ userData, onLogout }) {
    const navigate = useNavigate();

    // --- State Management (Internal to Chatbot) ---
    const [chats, setChats] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showFilePreview, setShowFilePreview] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
    const [searchTerm, setSearchTerm] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [selectedFileIds, setSelectedFileIds] = useState([]);
    const [tableData, setTableData] = useState(null);
    const [tableSQL, setTableSQL] = useState('');
    const [showSQL, setShowSQL] = useState(false);
    const [tableLoading, setTableLoading] = useState(false);
    const [tableError, setTableError] = useState('');

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

    // CRITICAL FIX: This effect now depends on the `userData` prop.
    // It will run when the component mounts AND when the user logs in, triggering a re-render with the new prop.
    useEffect(() => {
        const fetchChats = async () => {
            // Guard clause: Don't attempt to fetch if there's no valid token.
            if (!userData?.token) {
                return;
            }

            try {
                const res = await fetch('/chats', {
                    headers: { Authorization: `Bearer ${userData.token}` }
                });
                if (!res.ok) {
                    throw new Error(`Authorization failed. Could not load chats.`);
                }
                const data = await res.json();
                if (Array.isArray(data)) {
                    setChats(data.map(chat => ({
                        id: chat.id,
                        title: chat.title,
                        messages: [] // Start with empty messages
                    })));
                    // Automatically select the first chat if it exists
                    if (data.length > 0) {
                        setActiveChatId(data[0].id);
                    }
                }
            } catch (err) {
                showToast(err.message || "Failed to load chats.");
            }
        };

        fetchChats();
    }, [userData]); // The dependency on the `userData` object makes this reactive.

    // --- Computed State ---
    const activeChat = useMemo(() => chats.find(chat => chat.id === activeChatId), [chats, activeChatId]);
    const filteredChats = useMemo(() =>
        chats.filter(chat => chat.title.toLowerCase().includes(searchTerm.toLowerCase()))
    , [chats, searchTerm]);

    // --- Core Functions (Unchanged, but will now work) ---
    const showToast = (message, type = 'error') => {
        setToast({ show: true, message, type });
    };

    const handleNewChat = async () => {
        try {
            const res = await fetch('/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userData.token}` },
                body: JSON.stringify({ title: 'New Conversation' })
            });
            const data = await res.json();
            if (res.ok && data.chat_id) {
                const newChat = { id: data.chat_id, title: 'New Conversation', messages: [] };
                setChats([newChat, ...chats]);
                setActiveChatId(data.chat_id);
                if (isMobile) setIsSidebarOpen(false);
            } else {
                showToast(data.detail || "Failed to create chat.");
            }
        } catch (err) {
            showToast("Failed to create chat.");
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        // FIX: Add guard clause to prevent "null" chat ID error.
        if (!file || !activeChatId) {
            showToast(!file ? "No file selected." : "Please select or create a chat first.");
            return;
        }

        const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
        if (!allowedTypes.includes(file.type)) {
            showToast('Invalid file type. Please upload .xlsx or .csv files.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch(`/chats/${activeChatId}/files`, {
                method: 'POST',
                body: formData,
                headers: { Authorization: `Bearer ${userData.token}` }
            });
            const data = await res.json();
            if (res.ok && data.file_id) {
                setUploadedFiles(prev => [...prev, { id: data.file_id, name: file.name, columns: data.columns || [] }]);
                setSelectedFileIds([data.file_id]);
                showToast(`Uploaded ${file.name}`, "success");
            } else {
                showToast(data.detail || "File upload failed.");
            }
        } catch (err) {
            showToast("File upload failed.");
        }
        fileInputRef.current.value = "";
    };

    const handleSendMessage = async (text, file = null) => {
        if ((!text || !text.trim()) && !file) return;
        if (!activeChatId) {
            showToast("Please select or create a chat first.");
            return;
        }

        const userMessage = { id: `msg-${Date.now()}`, sender: 'user', text, file };
        const botTyping = { id: `msg-${Date.now() + 1}`, sender: 'bot', typing: true };

        // FIX: Use functional updates to prevent stale state and ensure messages appear immediately.
        setChats(currentChats => currentChats.map(chat => {
            if (chat.id === activeChatId) {
                // Logic to set title on first message
                let newTitle = chat.title;
                if (chat.messages.length === 0 && newTitle === 'New Conversation' && text) {
                    newTitle = text.substring(0, 30) + (text.length > 30 ? '...' : '');
                }
                return { ...chat, title: newTitle, messages: [...chat.messages, userMessage, botTyping] };
            }
            return chat;
        }));

        if (text) {
            const payload = { question: text, chat_id: activeChatId };
            if (selectedFileIds.length === 1) payload.file_id = selectedFileIds[0];
            if (selectedFileIds.length > 1) payload.file_ids = selectedFileIds;

            try {
                const aiRes = await fetch('/ai/ask', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userData.token}` },
                    body: JSON.stringify(payload)
                });
                if (!aiRes.ok) throw new Error('AI service request failed');
                const aiData = await aiRes.json();

                // FIX: Replace typing indicator with the actual bot message using a functional update.
                setChats(currentChats => currentChats.map(chat => {
                    if (chat.id === activeChatId) {
                        const newMessages = chat.messages.filter(m => !m.typing);
                        newMessages.push({ id: `msg-${Date.now() + 2}`, sender: 'bot', text: aiData.answer });
                        return { ...chat, messages: newMessages };
                    }
                    return chat;
                }));

                if (aiData.sql) {
                    // This logic was correct and will now work.
                    setTableLoading(true);
                    setTableError('');
                    try {
                        const tableRes = await fetch('/table/query', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userData.token}` },
                            body: JSON.stringify({
                                ...(selectedFileIds.length === 1 ? { file_id: selectedFileIds[0] } : { file_ids: selectedFileIds }),
                                sql: aiData.sql
                            })
                        });
                        const tableJson = await tableRes.json();
                        if (tableRes.ok && tableJson.columns && tableJson.rows) {
                            setTableData(tableJson);
                            setTableSQL(aiData.sql);
                            setShowSQL(false);
                        } else {
                            throw new Error(tableJson.detail || "Failed to fetch table data.");
                        }
                    } catch (err) {
                        setTableData(null);
                        setTableSQL('');
                        setTableError(err.message);
                    }
                    setTableLoading(false);
                } else {
                    setTableData(null);
                    setTableSQL('');
                    setTableError('');
                }
            } catch (err) {
                // FIX: Replace typing indicator with an error message.
                setChats(currentChats => currentChats.map(chat => {
                    if (chat.id === activeChatId) {
                        const newMessages = chat.messages.filter(m => !m.typing);
                        newMessages.push({ id: `msg-${Date.now() + 2}`, sender: 'bot', text: "Sorry, something went wrong." });
                        return { ...chat, messages: newMessages };
                    }
                    return chat;
                }));
                setTableData(null);
                setTableSQL('');
                setTableError('');
            }
        }
    };

    const handleDeleteChat = (chatId) => {
        // This function is fine.
        const remainingChats = chats.filter(chat => chat.id !== chatId);
        setChats(remainingChats);
        if (activeChatId === chatId) {
            setActiveChatId(remainingChats.length > 0 ? remainingChats[0].id : null);
        }
    };

    const handleDeleteHistory = () => {
        // This function is fine.
        setChats([]);
        setActiveChatId(null);
        setShowAccountModal(false);
        showToast("All chats have been deleted.", "success");
    };

    const handleShareChat = () => {
        // This function is fine.
        navigator.clipboard.writeText(window.location.href)
            .then(() => showToast("Chat link copied to clipboard!", "success"))
            .catch(() => showToast("Failed to copy link."));
    };

    useEffect(() => {
        // This effect for styles and scripts is fine.
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
    // The entire JSX return block is preserved, but will now work correctly with valid data.
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
                            navigate={navigate}
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

                <div className="p-4 flex gap-2 items-center bg-transparent">
                    <label className="text-sm text-gray-400">Select file(s):</label>
                    <select
                        multiple
                        value={selectedFileIds}
                        onChange={e => setSelectedFileIds([...e.target.selectedOptions].map(opt => Number(opt.value)))}
                        className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14FFEC]"
                        style={{ minWidth: 120, maxWidth: 300 }}
                    >
                        {uploadedFiles.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>

                {selectedFileIds.length > 0 && (
                  <div className="px-4 pb-2">
                    <div className="text-xs text-gray-400 mb-1">Available columns:</div>
                    <div className="flex flex-wrap gap-2">
                      {uploadedFiles
                        .filter(f => selectedFileIds.includes(f.id))
                        .flatMap(f => (f.columns || []).map(col => (
                          <span key={f.id + '-' + col.name} className="bg-[#0D7377] text-white px-2 py-1 rounded text-xs">{col.name}</span>
                        )))
                      }
                    </div>
                  </div>
                )}

                <ChatPanel messages={activeChat?.messages || []} onPreviewFile={setShowFilePreview} />

                {tableLoading && (
                    <div className="my-4 mx-4 text-[#14FFEC] font-semibold">Fetching table...</div>
                )}
                {tableError && (
                    <div className="my-4 mx-4 text-red-400 font-semibold">{tableError}</div>
                )}
                {tableData && !tableLoading && !tableError && (
                    <div className="my-4 mx-4">
                        <button onClick={() => setShowSQL(v => !v)} className="mb-2 px-3 py-1 rounded bg-[#0D7377] text-white">
                            {showSQL ? "Hide SQL" : "Show SQL"}
                        </button>
                        <button
                            onClick={() => {
                                const csv = [
                                    tableData.columns.join(","),
                                    ...tableData.rows.map(row => tableData.columns.map(col => `"${(row[col] ?? '').toString().replace(/"/g, '""')}"`).join(","))
                                ].join("\n");
                                const blob = new Blob([csv], { type: "text/csv" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "vizora-table.csv";
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                            className="mb-2 ml-2 px-3 py-1 rounded bg-[#14FFEC] text-black font-semibold"
                        >
                            Export CSV
                        </button>
                        {showSQL && (
                            <pre className="bg-gray-900 text-green-300 p-2 rounded mb-2 overflow-x-auto">{tableSQL}</pre>
                        )}
                        <div className="overflow-x-auto rounded">
                            <table className="w-full text-sm bg-gray-800 rounded">
                                <thead>
                                    <tr>
                                        {tableData.columns.map(col => <th key={col} className="px-4 py-2">{col}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableData.rows.map((row, i) => (
                                        <tr key={i}>
                                            {tableData.columns.map(col => <td key={col}>{row[col]}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <ChatInput
                    onSendMessage={handleSendMessage}
                    onUploadClick={() => fileInputRef.current?.click()}
                    disableSend={selectedFileIds.length === 0}
                />
            </main>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.csv" className="hidden" />

            <AnimatePresence>
                {showAccountModal && <AccountModal key="accountModal" userData={userData} onClose={() => setShowAccountModal(false)} onDeleteHistory={handleDeleteHistory} onShowPasswordChange={() => {
                    setShowAccountModal(false);
                    navigate('/change-password');
                }} onLogout={onLogout} />}
                {showFilePreview && <FilePreviewModal key="filePreviewModal" file={showFilePreview} onClose={() => setShowFilePreview(null)} />}
                {toast.show && <Toast key="toast" message={toast.message} type={toast.type} onClose={() => setToast({ show: false, message: '', type: 'error' })} />}
            </AnimatePresence>
        </div>
    );
}

// --- Child Components (All preserved and unchanged) ---
const Sidebar = ({ chats, activeChatId, setActiveChatId, onNewChat, onShowAccount, onShareChat, onDeleteChat, onToggleSidebar, searchTerm, setSearchTerm, userData, navigate }) => (
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
                            <button
                                type="button"
                                onClick={() => setActiveChatId(chat.id)}
                                className={`flex items-center justify-between w-full text-left p-2.5 rounded-lg text-sm font-medium transition-colors group ${
                                    activeChatId === chat.id ? 'bg-[#14FFEC] text-black shadow-lg' : 'hover:bg-gray-700/60 text-gray-300'
                                }`}
                            >
                                <span className="truncate">{chat.title}</span>
                                {activeChatId === chat.id && <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                            </button>
                        </motion.li>
                    ))}
                </AnimatePresence>
            </ul>
        </nav>

        <div className="mt-auto pt-4 border-t border-gray-700/50 space-y-1">
            <SidebarButton icon={User} text="Account" onClick={onShowAccount} />
            <SidebarButton icon={Lock} text="Change Password" onClick={() => navigate('/change-password')} />
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

const ChatInput = ({ onSendMessage, onUploadClick, disableSend }) => {
    const [input, setInput] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); if (input.trim()) { onSendMessage(input.trim()); setInput(''); } };
    const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }

    return (
        <div className="p-4 bg-transparent">
            <form onSubmit={handleSubmit} className="flex items-center gap-3 bg-[#323232] rounded-xl p-2.5 shadow-2xl border border-gray-700/50 focus-within:ring-2 focus-within:ring-[#14FFEC] transition-all duration-300">
                <button type="button" onClick={onUploadClick} className="p-2 rounded-full hover:bg-gray-600/50 transition-colors"><Plus className="w-6 h-6 text-gray-300" /></button>
                <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask Vizora..." rows="1" className="flex-1 bg-transparent text-gray-200 text-base placeholder-gray-500 focus:outline-none resize-none max-h-40 custom-scrollbar" />
                <button
                  type="submit"
                  className="p-2 rounded-full hover:bg-gray-600/50 transition-colors disabled:opacity-50"
                  disabled={!input.trim()}
                >
                  <ArrowRight className="w-6 h-6 text-gray-300" />
                </button>
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

const AccountModal = ({ userData, onClose, onDeleteHistory, onShowPasswordChange, onLogout }) => (
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
                <button onClick={onLogout} className="w-full text-sm py-2.5 px-4 rounded-lg border border-gray-600 hover:bg-gray-700/60 transition-colors">Logout</button>
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