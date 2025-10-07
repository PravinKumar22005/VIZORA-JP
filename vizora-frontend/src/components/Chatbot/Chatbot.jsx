
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { chatApi } from '../../services/chatApi';
import { shareChat as shareChatApi, getSharedChat as getSharedChatApi } from '../../services/sharingApi';
import { aiApi } from '../../services/aiApi';
import { tableQueryApi } from '../../services/tableQueryApi';
import { dashboardApi } from '../../services/dashboardApi';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Plus, Menu, X, User, Trash2, ChevronRight, HardDrive, FileText, FileX2, ChevronsLeft, ChevronsRight, ArrowRight, Clipboard, Eye, LayoutDashboard, LifeBuoy, Paperclip, Send, AlertTriangle, Settings, MailOpen, Pencil, LogOut, Info } from 'lucide-react';
// Note: PapaParse and XLSX are assumed to be loaded via script tags.

const RecycleBinModal = ({ onClose, deletedChats, onRestoreChat, onDeleteChat }) => {
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="bg-[#232323] rounded-xl w-full max-w-2xl p-6 border border-gray-700/50 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-700/80 transition-colors"><X className="w-5 h-5" /></button>
                <h2 className="text-2xl font-bold mb-6 text-white">Recycle Bin</h2>
                <div>
                    <h3 className="text-lg font-semibold text-gray-200 mb-2">Deleted Chats</h3>
                    {deletedChats.length === 0 ? <div className="text-gray-500 mb-4">No deleted chats.</div> : (
                        <div className="mb-4" style={{ maxHeight: '340px', overflowY: 'auto' }}>
                            <ul className="space-y-2">
                                {deletedChats.map(chat => (
                                    <li key={chat.id} className="flex items-center justify-between bg-gray-800/50 p-3 rounded-lg">
                                        <span className="text-white font-medium">{chat.title}</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => onRestoreChat(chat.id)} className="px-3 py-1 rounded bg-green-500/20 text-green-300 hover:bg-green-500/40 text-sm">Restore</button>
                                            <button onClick={() => onDeleteChat(chat.id)} className="px-3 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/40 text-sm">Delete Permanently</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

const BotAvatar = () => (
    <div className="w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-tr from-[#0D7377] to-[#14FFEC] p-1.5 flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    </div>
);


// --- Main App Component ---
export default function App({ userData: externalUserData }) {
    // --- Recycle Bin State ---
    const [showRecycleBin, setShowRecycleBin] = useState(false);
    const [deletedChats, setDeletedChats] = useState([]);

    // Fetch soft-deleted chats when recycle bin is opened
    useEffect(() => {
        if (!showRecycleBin) return;
        const fetchDeleted = async () => {
            try {
                const deleted = await chatApi.listDeletedChats();
                setDeletedChats(deleted);
            } catch (e) {
                showToast('Failed to load recycle bin items', 'error');
            }
        };
        fetchDeleted();
    }, [showRecycleBin]);

    // --- Recycle Bin Handlers (Chats only) ---
    const handleRestoreChat = async (chatId) => {
        try {
            await chatApi.restoreChat(chatId);
            // Refetch deleted chats after restore
            const deleted = await chatApi.listDeletedChats();
            setDeletedChats(deleted);
            showToast('Chat restored', 'success');
        } catch {
            showToast('Failed to restore chat', 'error');
        }
    };
    const handleDeleteChatPermanent = async (chatId) => {
        try {
            await chatApi.deleteChat(chatId);
            // Refetch deleted chats after permanent delete
            const deleted = await chatApi.listDeletedChats();
            setDeletedChats(deleted);
            showToast('Chat permanently deleted', 'success');
        } catch {
            showToast('Failed to permanently delete chat', 'error');
        }
    };
    // Prevent sending new message while bot is replying
    const [isBotReplying, setIsBotReplying] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    // --- State Management ---
    const [chats, setChats] = useState([]); // each chat: {id,title,messages:[],files:[],loaded?:bool}
    const [activeChatId, setActiveChatId] = useState(null);
    // Prefer prop userData, else load from localStorage, else guest fallback
    const derivedUser = externalUserData || (() => {
        try { const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null; } catch { return null; }
    })();
    const [userData, setUserData] = useState(derivedUser || { name: 'Guest User', email: 'guest@example.com', id: 'guest', token: localStorage.getItem('token') || '' });
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // UI State
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showFileDashboard, setShowFileDashboard] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [showFilePreview, setShowFilePreview] = useState(null); // Holds file object
    const [toast, setToast] = useState({ show: false, message: '', type: 'error', action: null });
    const [searchTerm, setSearchTerm] = useState('');
    const [viewCode, setViewCode] = useState('');
    const [confirmationProps, setConfirmationProps] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    const [shareCodeInfo, setShareCodeInfo] = useState({ isOpen: false, code: null });
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editingTitle, setEditingTitle] = useState('');
    const [showDashboardHint, setShowDashboardHint] = useState(false);
    const [lastDeletedFile, setLastDeletedFile] = useState(null);
    const [aiFilePickerOpen, setAiFilePickerOpen] = useState(false);
    const [selectedAIFileIds, setSelectedAIFileIds] = useState([]); // file metadata ids to send to /ai/ask

    // --- Refs ---
    const fileInputRef = useRef(null);
    const titleInputRef = useRef(null);

    // --- Effects ---
    // Handle responsive sidebar
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

    // Load chats from backend on mount or when token changes
    useEffect(() => {
        const load = async () => {
            try {
                const remoteChats = await chatApi.listChats();
                // Always REPLACE chat state, never merge, and deduplicate by id
                const enriched = remoteChats.map(c => ({ ...c, messages: [], files: [], loaded: false }));
                // Deduplicate by id
                const deduped = Array.from(new Map(enriched.map(c => [c.id, c])).values());
                setChats(deduped);
                if (deduped.length > 0) {
                    setActiveChatId(deduped[0].id);
                } else {
                    // If no chats, create a new chat on login
                    handleNewChat();
                }
            } catch (e) {
                console.error('Failed to load chats', e);
            }
        };
        if (userData?.token) load();
        // eslint-disable-next-line
    }, [userData?.token]);

    // Hydrate messages & files when switching to a chat not yet loaded
    useEffect(() => {
        const hydrate = async () => {
            if (!activeChatId) return;
            setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, loading: true } : c));
            try {
                const msgs = await chatApi.getMessages(activeChatId);
                const files = await chatApi.listFiles(activeChatId);
                // Parse special table messages
                const parsedMsgs = msgs.map(m => {
                    if (typeof m.text === 'string' && m.text.startsWith('__TABLE__:')) {
                        try {
                            const table = JSON.parse(m.text.replace('__TABLE__:', ''));
                            return {
                                ...m,
                                table: {
                                    ...table,
                                    view: 'table',
                                    editingSql: table.sql,
                                    running: false,
                                    error: null
                                },
                                text: undefined
                            };
                        } catch {
                            return m;
                        }
                    }
                    return m;
                });
                setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: parsedMsgs, files, loaded: true, loading: false } : c));
            } catch (e) {
                setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, loading: false } : c));
            }
        };
        const current = chats.find(c => c.id === activeChatId);
        if (current && !current.loaded) hydrate();
    }, [activeChatId, chats]);

    // Handle toast timeout
    useEffect(() => {
        if (toast.show) {
            const timer = setTimeout(() => {
                setToast(t => ({ ...t, show: false }));
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    // Focus title input when editing
    useEffect(() => {
        if (isEditingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [isEditingTitle]);

    // Dashboard hint timeout
    useEffect(() => {
        if (showDashboardHint) {
            const timer = setTimeout(() => setShowDashboardHint(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [showDashboardHint]);

    // Load external scripts
    useEffect(() => {
        const styleElement = document.createElement('style');
        styleElement.innerHTML = `
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #555; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #777; }
            @keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
            .animate-blob { animation: blob 10s infinite; }
            .animation-delay-4000 { animation-delay: -4s; }
            @keyframes rotate-gear { from { transform: rotate(0deg); } to { transform: rotate(180deg); } }
            .animate-gear-spin { animation: rotate-gear 0.4s ease-in-out; }
            @keyframes trash-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px) rotate(-3deg); } 75% { transform: translateX(3px) rotate(3deg); } }
            .animate-trash-shake { animation: trash-shake 0.3s ease-in-out; }
        `;
        document.head.appendChild(styleElement);

        const loadScript = (src, id) => {
            if (document.getElementById(id)) return;
            const script = document.createElement('script');
            script.src = src; script.id = id; script.async = true;
            document.head.appendChild(script);
        };
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js', 'papaparse-script');
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'xlsx-script');

        return () => { document.head.removeChild(styleElement); };
    }, []);

    // --- Computed State ---
    const activeChat = useMemo(() => chats.find(chat => chat.id === activeChatId), [chats, activeChatId]);
    const filteredChats = useMemo(() =>
        chats.filter(chat => chat.title.toLowerCase().includes(searchTerm.toLowerCase()))
    , [chats, searchTerm]);

    // --- Core Functions ---
    const showToast = (message, type = 'success', action = null) => {
        setToast({ show: true, message, type, action });
    };

    // Append messages, but deduplicate by id (prevents double user messages)
    const appendMessages = (chatId, newMsgs) => {
        setChats(prev => prev.map(c => {
            if (c.id !== chatId) return c;
            // Deduplicate by id
            const existingIds = new Set((c.messages || []).map(m => m.id));
            const filteredNew = newMsgs.filter(m => !existingIds.has(m.id));
            return { ...c, messages: [...(c.messages || []), ...filteredNew] };
        }));
    };

    const handleUploadFile = async (file, chatId, silent=false) => {
        try {
            const meta = await chatApi.uploadFile(chatId, file);
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, files: [...(c.files||[]), meta] } : c));
            if (!silent) showToast(`Uploaded ${file.name}`, 'success');
            return meta;
        } catch (e) {
            showToast('File upload failed','error');
        }
    };

    // Create a new chat, but only if there isn't already a new/empty chat
    const handleNewChat = async (initialFileMessage = null) => {
        // Prevent creating a new chat if there is already a new/empty chat (no messages, no files)
        const hasEmptyChat = chats.some(c => (c.messages?.length === 0 || !c.messages) && (c.files?.length === 0 || !c.files));
        if (hasEmptyChat) {
            // Focus the empty chat
            const emptyChat = chats.find(c => (c.messages?.length === 0 || !c.messages) && (c.files?.length === 0 || !c.files));
            if (emptyChat) setActiveChatId(emptyChat.id);
            return;
        }
        try {
            const backendChat = await chatApi.createChat('New Conversation');
            const newChatId = backendChat.id;
            const newChat = { ...backendChat, messages: [], files: [], loaded: true };
            // If initial file message provided, upload file
            if (initialFileMessage && initialFileMessage.file) {
                await handleUploadFile(initialFileMessage.file.raw || initialFileMessage.file, newChatId, true);
                newChat.messages.push({ id:`init-${Date.now()}`, sender:'user', file: initialFileMessage.file });
                setShowDashboardHint(true);
            }
            setChats(prevChats => {
                // Deduplicate by id
                const allChats = [newChat, ...prevChats];
                return Array.from(new Map(allChats.map(c => [c.id, c])).values());
            });
            setActiveChatId(newChatId);
            if(isMobile) setIsSidebarOpen(false);
        } catch (e) {
            console.error('Create chat failed', e);
            showToast('Failed to create chat','error');
        }
    };

    const handleSendMessage = async (text, file = null, { autoAI = true } = {}) => {
    if (isBotReplying || isSendingMessage) return;
    if ((!text || !text.trim()) && !file) return;
    setIsSendingMessage(true);
        let chatId = activeChatId;
        // If no chat is active, create a new chat and use its id
        if (!chatId) {
            await handleNewChat();
            // Wait for chat to be created and set as active
            // Use a MutationObserver or polling to get the new chatId
            // For now, just return and let the user try again
            return;
        }
        // If the current chat is a new/empty chat and the user switches to another chat before sending a message, remove the empty chat
        setChats(prevChats => {
            // If the active chat is empty and not the current chat, remove it
            if (prevChats.length > 1) {
                const emptyChats = prevChats.filter(c => (c.messages?.length === 0 || !c.messages) && (c.files?.length === 0 || !c.files));
                if (emptyChats.length > 0) {
                    // Remove all empty chats except the current one
                    return prevChats.filter(c => !(emptyChats.some(ec => ec.id === c.id) && c.id !== chatId));
                }
            }
            return prevChats;
        });
        try {
            let fileMsg = null;
            if (file) {
                setShowDashboardHint(true);
                const meta = await handleUploadFile(file, chatId);
                if (meta) {
                    fileMsg = { id:`file-${meta.id}`, sender:'user', file: { name: meta.file_name, size: `${Math.round(meta.file_size/1024)} KB`, type: meta.file_type, meta } };
                    appendMessages(chatId, [fileMsg]);
                }
            }
            if (text && text.trim()) {
                // Only append after backend returns (no optimistic add)
                const msg = await chatApi.addMessage(chatId, text.trim(), 'user');
                appendMessages(chatId, [msg]);
                if (autoAI) {
                    setIsBotReplying(true);
                    await triggerAIResponse(chatId, text.trim());
                    setIsBotReplying(false);
                }
            }
        } catch(e){
            setIsBotReplying(false);
            console.error('Send failed', e);
            showToast('Failed to send','error');
        } finally {
            setIsSendingMessage(false);
        }
    };

    const triggerAIResponse = async (chatId, question) => {
        // Show typing placeholder
        const typingId = `typing-${Date.now()}`;
        appendMessages(chatId, [{ id: typingId, sender: 'bot', typing: true }]);
        try {
            // Collect file_ids for this chat (metadata already stored after upload)
            const chat = chats.find(c => c.id === chatId);
            let fileIds = (chat?.files || []).map(f => f.id);
            if (selectedAIFileIds.length > 0) {
                // Only use user-selected subset (ensure they belong to this chat)
                fileIds = fileIds.filter(id => selectedAIFileIds.includes(id));
            }
            const payload = { question, chat_id: chatId };
            if (fileIds.length > 0) payload.file_ids = fileIds;
            const res = await aiApi.ask(payload); // expects { answer: string, sql?: string }
            // Replace typing with answer first
            let botMessageId = `bot-${Date.now()}`;
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.id === typingId ? { id: botMessageId, sender:'bot', text: res.answer } : m) } : c));
            // If SQL present, run table query automatically and persist as a bot message
            if (res.sql && res.sql.trim()) {
                const sql = res.sql.trim();
                try {
                    const tableRes = await tableQueryApi.run({ sql, file_ids: fileIds });
                    // Save table result as a bot message in the backend
                    const tableMsgText = "__TABLE__:" + JSON.stringify({
                        sql,
                        columns: tableRes.columns || [],
                        rows: tableRes.rows || [],
                        fileIds,
                    });
                    await chatApi.addMessage(chatId, tableMsgText, "bot");
                    // Also append to local state for immediate UI update
                    const tableMsg = {
                        id: `table-${Date.now()}`,
                        sender: 'bot',
                        table: {
                            sql,
                            columns: tableRes.columns || [],
                            rows: tableRes.rows || [],
                            fileIds,
                            view: 'table',
                            editingSql: sql,
                            running: false,
                            error: null
                        }
                    };
                    appendMessages(chatId, [tableMsg]);
                } catch (err) {
                    const errMsg = { id:`tableerr-${Date.now()}`, sender:'bot', text: 'Failed to run generated SQL.' };
                    appendMessages(chatId, [errMsg]);
                }
            }
        } catch(e){
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.id === typingId ? { id: `bot-${Date.now()}`, sender:'bot', text: 'AI response failed.' } : m) } : c));
        }
    };

    const requestDeleteChat = (chatId) => {
        if (!chatId) return;
        setConfirmationProps({
            isOpen: true,
            title: 'Delete Chat?',
            message: 'Are you sure you want to permanently delete this chat?',
            onConfirm: () => handleDeleteChat(chatId)
        });
    };

    const handleDeleteChat = async (chatId) => {
        try {
            await chatApi.softDeleteChat(chatId);
            let remainingChats = chats.filter(chat => chat.id !== chatId);
            // Remove any empty chats (no messages, no files)
            remainingChats = remainingChats.filter(c => (c.messages?.length > 0 || c.files?.length > 0));
            setChats(remainingChats);
            if (activeChatId === chatId) {
                const newActiveId = remainingChats.length > 0 ? remainingChats[0].id : null;
                setActiveChatId(newActiveId);
                if (remainingChats.length === 0) {
                    handleNewChat();
                }
            }
            // Refetch deleted chats for recycle bin
            try {
                const deleted = await chatApi.listDeletedChats();
                setDeletedChats(deleted);
            } catch {}
            showToast("Chat deleted.", "success");
        } catch {
            showToast("Failed to delete chat.", "error");
        }
    };

    // Request confirmation for deleting all chats
    const requestDeleteHistory = () => {
        setConfirmationProps({
            isOpen: true,
            title: 'Delete All Chats',
            message: 'Are you sure you want to delete all your chats? This will move all chats to the recycle bin.',
            onConfirm: handleDeleteHistory
        });
    };

    // Soft delete all chats for the user
    const handleDeleteHistory = async () => {
        setConfirmationProps(prev => ({ ...prev, isOpen: false }));
        try {
            // Call soft delete for all chats in parallel
            await Promise.all(
                chats.map(chat => chatApi.softDeleteChat(chat.id))
            );
            // Refetch deleted chats for recycle bin
            try {
                const deleted = await chatApi.listDeletedChats();
                setDeletedChats(deleted);
            } catch {}
            setChats([]);
            setActiveChatId(null);
            showToast('All chats moved to recycle bin', 'success');
        } catch (e) {
            showToast('Failed to delete all chats', 'error');
        }
    };

    const handleLogout = () => {
        setUserData({ name: 'Guest User', email: 'guest@example.com' }); // Reset user data
        setChats([]);
        setActiveChatId(null);
        handleNewChat();
        showToast("You have been logged out.", "success");
        setTimeout(() => {
            window.location.href = '/';
        }, 500);
    };

    const requestLogout = () => {
        setConfirmationProps({
            isOpen: true,
            title: 'Logout?',
            message: "We're going to miss you. Come back soon!",
            onConfirm: handleLogout,
            confirmText: 'Logout',
            icon: LogOut,
            iconColor: 'text-red-400',
            iconBgColor: 'bg-red-500/20',
            isLogout: true
        });
    };
    
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
        if (!allowedTypes.includes(file.type)) {
            return showToast('Invalid file type. Please upload .xlsx or .csv files.', 'error');
        }

        const fileData = {
            name: file.name,
            size: (file.size / 1024).toFixed(2) + ' KB',
            type: file.type === 'text/csv' ? 'CSV' : 'XLSX',
            raw: file
        };

        // If there is an active chat, upload to it. Otherwise, create a new chat with the file.
        if (activeChatId) {
            handleUploadFile(file, activeChatId);
        } else {
            const initialMessage = {
                id: `msg-${Date.now()}`,
                sender: 'user',
                file: fileData,
            };
            handleNewChat(initialMessage);
        }

        // Reset file input value to allow re-uploading the same file
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    
    const handleDeleteFileMessage = (chatId, messageId) => {
        const chatToUpdate = chats.find(c => c.id === chatId);
        if (!chatToUpdate) return;
    
        const originalChatState = JSON.parse(JSON.stringify(chatToUpdate)); // Deep copy for undo
        
        const newMessages = chatToUpdate.messages.filter(m => m.id !== messageId);
        
        setChats(chats.map(c => c.id === chatId ? { ...c, messages: newMessages } : c));
        setLastDeletedFile(originalChatState);
    
        showToast("File removed.", "success", {
            label: "Undo",
            onClick: handleUndoDeleteFile
        });
    };

    const handleUndoDeleteFile = () => {
        if (lastDeletedFile) {
            setChats(chats.map(chat => chat.id === lastDeletedFile.id ? lastDeletedFile : chat));
            setLastDeletedFile(null);
            showToast("File restored", "success");
        }
    };
    
    const handleStartRename = () => {
        if (!activeChat) return;
        setEditingTitle(activeChat.title);
        setIsEditingTitle(true);
    };

    const handleRenameChat = () => {
        if (!activeChat || !editingTitle.trim()) {
            setIsEditingTitle(false);
            return;
        }
        setChats(chats.map(chat =>
            chat.id === activeChatId ? { ...chat, title: editingTitle.trim() } : chat
        ));
        setIsEditingTitle(false);
    };

    const handleShareCode = async () => {
        if (!activeChatId) return showToast('Select a chat to share.', 'error');
        try {
            const res = await shareChatApi(activeChatId);
            const code = res.share_code || res.code;
            setShareCodeInfo({ isOpen: true, code });
        } catch(e){
            showToast('Share failed','error');
        }
    };
    
    const handleRequestDashboard = async (fileMsgId) => {
        const chat = chats.find(c => c.id === activeChatId);
        if (!chat) return;
        const fileEntry = chat.messages.find(m => m.id === fileMsgId && m.file);
        if (!fileEntry) return showToast('File not found','error');
        try {
            // Use file metadata columns to build a minimal dashboard_json placeholder
            const dashboardPayload = {
                dashboard_name: fileEntry.file.name.replace(/\.(csv|xlsx)$/i, '') + ' Dashboard',
                dashboard_json: []
            };
            const created = await dashboardApi.createDashboard(dashboardPayload.dashboard_json, dashboardPayload.dashboard_name);
            showToast(`Dashboard created (ID ${created.id})`, 'success');
            // Redirect to dashboard view with id param (assumes route handles ?id=)
            setTimeout(() => { window.location.href = `/dashboard?id=${created.id}`; }, 600);
        } catch(e){
            showToast('Dashboard creation failed','error');
        } finally {
            setShowFileDashboard(false);
        }
    };

    const handleViewSharedChat = async () => {
        if (!viewCode.trim()) return showToast('Please enter a code.', 'error');
        try {
            const chat = await getSharedChatApi(viewCode.trim());
            let messages = [];
            try { messages = await chatApi.getMessages(chat.id); } catch {}
            const merged = { ...chat, messages, files: [], loaded:true };
            setChats(prev => {
                // Deduplicate by id
                const allChats = [merged, ...prev];
                return Array.from(new Map(allChats.map(c => [c.id, c])).values());
            });
            setActiveChatId(chat.id);
            setViewCode('');
            showToast('Shared chat loaded','success');
        } catch(e){
            showToast('Invalid share code','error');
        }
    };

    return (
        <div className="font-sans antialiased text-gray-200 bg-[#212121] h-screen w-screen overflow-hidden flex relative">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[#0D7377] rounded-full opacity-20 filter blur-3xl animate-blob"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-[#14FFEC] rounded-full opacity-10 filter blur-3xl animate-blob animation-delay-4000"></div>
            </div>

            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.aside key="sidebar" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="bg-[#323232]/80 backdrop-blur-md h-full z-20 flex flex-col" style={{ width: isMobile ? '85%' : '260px' }}>
                        <Sidebar
                            chats={filteredChats} activeChatId={activeChatId} setActiveChatId={setActiveChatId}
                            onNewChat={handleNewChat}
                            onDeleteChat={() => requestDeleteChat(activeChatId)}
                            onToggleSidebar={() => setIsSidebarOpen(false)}
                            searchTerm={searchTerm} setSearchTerm={setSearchTerm} viewCode={viewCode} setViewCode={setViewCode} onViewSharedChat={handleViewSharedChat}
                            onShowAccount={() => setShowAccountModal(true)}
                            onShowContact={() => setShowContactModal(true)}
                            onShareCode={handleShareCode}
                            onClearHistory={requestDeleteHistory}
                            onLogout={requestLogout}
                            setShowRecycleBin={setShowRecycleBin}
                        />
                    </motion.aside>
                )}
            </AnimatePresence>

            <main className="flex-1 flex flex-col h-full z-10 relative">
                <header className="flex items-center justify-between p-4 border-b border-gray-700/50 bg-[#212121]/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {!isSidebarOpen && ( <button onClick={() => setIsSidebarOpen(true)} className="p-1.5 rounded-md hover:bg-gray-700/80 transition-colors focus:outline-none focus:ring-2 focus:ring-[#14FFEC]"> <Menu className="w-6 h-6 text-gray-300" /> </button> )}
                        {isEditingTitle ? (
                            <input
                                ref={titleInputRef}
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onBlur={handleRenameChat}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                className="text-xl font-semibold text-white bg-gray-700/80 rounded-md px-2 py-0.5 w-full focus:outline-none focus:ring-2 focus:ring-[#14FFEC]"
                            />
                        ) : (
                            <>
                                <h1 className="text-xl font-semibold text-white truncate">{activeChat?.title || 'Vizora Chat'}</h1>
                                {activeChat && (
                                    <button onClick={handleStartRename} className="p-1.5 rounded-full hover:bg-gray-700/80 transition-colors focus:outline-none focus:ring-2 focus:ring-[#14FFEC]">
                                        <Pencil className="w-4 h-4 text-gray-400" />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                                        <div className="flex items-center gap-2 relative">
                         <AnimatePresence>
                            {showDashboardHint && (
                                <motion.div
                                    initial={{ opacity: 0, x: 10, scale: 0.8 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: 10, scale: 0.8 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                    className="absolute right-full mr-2 top-1/2 -translate-y-1/2 w-max max-w-xs bg-[#14FFEC] text-black text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg"
                                >
                                    You can select a file to create a dashboard!
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <button onClick={() => setShowFileDashboard(true)} className="p-2 rounded-full hover:bg-gray-700/80 transition-colors focus:outline-none focus:ring-2 focus:ring-[#14FFEC] disabled:opacity-50 disabled:cursor-not-allowed" disabled={!activeChat || activeChat.messages.filter(m => m.file).length === 0}>
                           <LayoutDashboard className="w-6 h-6 text-gray-300" />
                        </button>
                                                {activeChat && activeChat.files && activeChat.files.length > 0 && (
                                                    <button onClick={() => setAiFilePickerOpen(o=>!o)} className="p-2 rounded-full hover:bg-gray-700/80 transition-colors focus:outline-none focus:ring-2 focus:ring-[#14FFEC]">
                                                        <HardDrive className="w-6 h-6 text-gray-300" />
                                                    </button>
                                                )}
                                                <AnimatePresence>
                                                    {aiFilePickerOpen && (
                                                        <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="absolute top-full right-0 mt-2 w-64 bg-[#323232] border border-gray-700 rounded-lg shadow-xl p-3 z-30">
                                                            <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">AI File Context</h4>
                                                            <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-2">
                                                                {activeChat.files.map(f => {
                                                                    const checked = selectedAIFileIds.includes(f.id);
                                                                    return (
                                                                        <label key={f.id} className={`flex items-start gap-2 text-xs p-2 rounded-md cursor-pointer border ${checked? 'border-[#14FFEC] bg-gray-700/40':'border-transparent hover:border-gray-600'}`}> 
                                                                            <input type="checkbox" className="mt-0.5" checked={checked} onChange={() => {
                                                                                setSelectedAIFileIds(prev => checked ? prev.filter(id=>id!==f.id) : [...prev, f.id]);
                                                                            }} />
                                                                            <span className="flex-1 text-gray-300 truncate">{f.file_name}</span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                            <div className="mt-3 flex justify-between gap-2">
                                                                <button onClick={() => setSelectedAIFileIds([])} className="text-[10px] px-2 py-1 rounded bg-gray-700/60 hover:bg-gray-600">Clear</button>
                                                                <button onClick={() => setAiFilePickerOpen(false)} className="text-[10px] px-2 py-1 rounded bg-[#14FFEC] text-black hover:bg-white">Done</button>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                    </div>
                </header>

                <ChatPanel messages={activeChat?.messages || []} onPreviewFile={(file) => setShowFilePreview(file)} onDeleteFile={handleDeleteFileMessage} activeChatId={activeChatId} userData={userData} />
                <ChatInput onSendMessage={handleSendMessage} onUploadClick={() => fileInputRef.current?.click()} isBotReplying={isBotReplying} isSendingMessage={isSendingMessage} />
            </main>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.csv" className="hidden" />

            <AnimatePresence>
                {showAccountModal && <AccountModal key="accountModal" userData={userData} onClose={() => setShowAccountModal(false)} onDeleteHistory={requestDeleteHistory} onShowPasswordChange={() => { setShowAccountModal(false); setShowPasswordModal(true); }} />}
                {showRecycleBin && <RecycleBinModal key="recycleBinModal" onClose={() => setShowRecycleBin(false)} deletedChats={deletedChats} onRestoreChat={handleRestoreChat} onDeleteChat={handleDeleteChatPermanent} />}
                {showPasswordModal && <PasswordChangeModal key="passwordModal" onClose={() => setShowPasswordModal(false)} showToast={showToast} />}
                {showFileDashboard && <FileDashboardModal key="fileDashboardModal" chat={activeChat} onClose={() => setShowFileDashboard(false)} onConfirm={handleRequestDashboard} />}
                {showContactModal && <ContactModal key="contactModal" onClose={() => setShowContactModal(false)} showToast={showToast} />}
                {showFilePreview && <FilePreviewModal key="filePreviewModal" file={showFilePreview} onClose={() => setShowFilePreview(null)} />}
                {toast.show && <Toast key="toast" {...toast} onClose={() => setToast({ ...toast, show: false })} />}
                {confirmationProps.isOpen && <ConfirmationModal {...confirmationProps} onClose={() => setConfirmationProps({ ...confirmationProps, isOpen: false })} />}
                {shareCodeInfo.isOpen && <ShareCodeModal isOpen={shareCodeInfo.isOpen} code={shareCodeInfo.code} onClose={() => setShareCodeInfo({ isOpen: false, code: null })} showToast={showToast} />}
            </AnimatePresence>
        </div>
    );
}

// --- Child Components ---
// (The rest of the child components remain unchanged as they did not contain syntax errors)

const SettingsItem = ({ icon: Icon, text, onClick, danger = false }) => {
    const [isAnimating, setIsAnimating] = useState(false);
    const [CurrentIcon, setCurrentIcon] = useState(() => Icon);

    const handleClick = () => {
        setIsAnimating(true);
        if (text === 'Contact Support') {
            setCurrentIcon(() => MailOpen);
            setTimeout(() => {
                setCurrentIcon(() => LifeBuoy);
            }, 500);
        }
        onClick();
    };

    const iconAnimation = useMemo(() => {
        switch (text) {
            case 'Manage Account':
                return { whileHover: { scale: 1.1, rotate: 5 }, whileTap: { scale: 0.9 } };
            case 'Contact Support':
                return {
                    initial: { opacity: 0, scale: 0.5 },
                    animate: { opacity: 1, scale: 1 },
                    transition: { duration: 0.3 }
                };
            case 'Logout':
                 return { whileHover: { scale: 1.1 }, whileTap: { scale: 0.9, x: 2 } };
            default:
                return { whileTap: { scale: 0.9 } };
        }
    }, [text]);

    const animationClass = useMemo(() => {
        if (!isAnimating) return '';
        if (text === 'Clear History') return 'animate-trash-shake';
        return '';
    }, [isAnimating, text]);

    const IconComponent = text === 'Contact Support' ? CurrentIcon : Icon;

    return (
        <li>
            <button
                onClick={handleClick}
                className={`w-full flex items-center gap-3 p-2 rounded-md transition-colors text-left text-sm ${danger ? 'text-red-400 hover:bg-red-500/20' : 'text-gray-300 hover:bg-gray-700/60'}`}
            >
                <motion.div
                    {...iconAnimation}
                    onAnimationComplete={() => setIsAnimating(false)}
                    className={animationClass}
                >
                    <IconComponent className="w-5 h-5" />
                </motion.div>
                <span>{text}</span>
            </button>
        </li>
    );
};

const SettingsDropdown = ({ onAction }) => (
    <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.15 }}
        className="absolute bottom-full left-0 mb-2 w-full bg-[#323232] border border-gray-700 rounded-lg shadow-xl z-50 p-2" >
        <ul>
            <SettingsItem icon={User} text="Manage Account" onClick={() => onAction('account')} />
            <SettingsItem icon={Trash2} text="Recycle Bin" onClick={() => onAction('recyclebin')} />
            <SettingsItem icon={Clipboard} text="Share Code" onClick={() => onAction('share')} />
            <SettingsItem icon={LifeBuoy} text="Contact Support" onClick={() => onAction('contact')} />
            <SettingsItem icon={Trash2} text="Clear History" onClick={() => onAction('clear')} danger={true} />
            <SettingsItem icon={LogOut} text="Logout" onClick={() => onAction('logout')} danger={true} />
        </ul>
        <div className="text-xs text-gray-500 text-center pt-2 mt-2 border-t border-gray-700/50"> Vizora can make mistakes. Please double-check important information. </div>
    </motion.div>
);

const Sidebar = ({ chats, activeChatId, setActiveChatId, onNewChat, onDeleteChat, onToggleSidebar, searchTerm, setSearchTerm, viewCode, setViewCode, onViewSharedChat, onShowAccount, onShowContact, onShareCode, onClearHistory, onLogout, setShowRecycleBin }) => {
    const [showSettings, setShowSettings] = useState(false);
    const [animatingButton, setAnimatingButton] = useState(null);
    const settingsRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setShowSettings(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [settingsRef]);

    return (
    <div className="flex flex-col h-full p-3">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"> <div className="w-8 h-8 bg-gradient-to-tr from-[#0D7377] to-[#14FFEC] rounded-lg"></div> <h1 className="text-2xl font-bold text-white">Vizora</h1> </div>
             <button onClick={onToggleSidebar} className="p-1.5 rounded-md hover:bg-gray-700/80 transition-colors focus:outline-none focus:ring-2 focus:ring-[#14FFEC]"> <ChevronsLeft className="w-5 h-5" /> </button>
        </div>

        <button onClick={onNewChat} className="group flex items-center justify-center gap-2 w-full bg-[#0D7377] text-white py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-[#14FFEC] hover:text-black transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#323232] focus:ring-[#14FFEC] mb-4"> <Plus className="w-5 h-5" /> New Chat </button>

        <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2">
                <input type="text" placeholder="Enter code..." value={viewCode} onChange={(e) => setViewCode(e.target.value)} className="flex-1 w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14FFEC]" />
                <button onClick={onViewSharedChat} className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"><Eye className="w-5 h-5 text-[#14FFEC]" /></button>
            </div>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Search chats..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14FFEC]" />
            </div>
        </div>

        <nav className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
            <ul className="space-y-1">
                <AnimatePresence>
                    {chats.map(chat => {
                        return (
                        <motion.li key={chat.id} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} >
                            <button type="button" onClick={() => setActiveChatId(chat.id)} className={`w-full text-left flex items-center justify-between p-2.5 rounded-lg text-sm font-medium transition-colors group ${ activeChatId === chat.id ? 'bg-[#14FFEC] text-black shadow-lg' : 'hover:bg-gray-700/60 text-gray-300' }`} >
                                <span className="truncate flex-1">{chat.title}</span>
                                {activeChatId === chat.id && <ChevronRight className="w-4 h-4 flex-shrink-0 ml-1" />}
                            </button>
                        </motion.li>
                    )})}
                </AnimatePresence>
            </ul>
        </nav>

        <div className="mt-auto pt-4 border-t border-gray-700/50 space-y-1">
            <SidebarButton icon={LayoutDashboard} text="New Dashboard" onClick={() => {}} disabled={true} />
            <SidebarButton icon={Trash2} text="Delete Chat" onClick={onDeleteChat} danger isAnimating={animatingButton === 'Delete Chat'} startAnimation={() => setAnimatingButton('Delete Chat')} onAnimationEnd={() => setAnimatingButton(null)} />
            <div className="relative" ref={settingsRef}>
                <SidebarButton icon={Settings} text="Settings" onClick={() => setShowSettings(s => !s)} isAnimating={animatingButton === 'Settings'} startAnimation={() => setAnimatingButton('Settings')} onAnimationEnd={() => setAnimatingButton(null)} />
                 <AnimatePresence>
                    {showSettings && <SettingsDropdown onAction={(action) => {
                        if (action === 'contact') onShowContact();
                        if (action === 'account') onShowAccount();
                        if (action === 'share') onShareCode();
                        if (action === 'clear') onClearHistory();
                        if (action === 'logout') onLogout();
                        if (action === 'recyclebin') setShowRecycleBin(true);
                        setShowSettings(false);
                    }} />}
                </AnimatePresence>
            </div>
        </div>
    </div>
)};

const SidebarButton = ({ icon: Icon, text, onClick, danger = false, disabled = false, isAnimating, startAnimation, onAnimationEnd }) => {
    const animationClass = useMemo(() => {
        if (!isAnimating) return '';
        if (text === 'Settings') return 'animate-gear-spin';
        if (text === 'Delete Chat') return 'animate-trash-shake';
        return '';
    }, [isAnimating, text]);

    return (
        <button
            onClick={() => {
                if(startAnimation) startAnimation();
                onClick();
            }}
            disabled={disabled}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-sm font-medium transition-colors ${danger ? 'text-red-400 hover:bg-red-500/20' : 'text-gray-300 hover:bg-gray-700/60'} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            <div onAnimationEnd={onAnimationEnd} className={animationClass}>
                <Icon className={`w-5 h-5 ${danger ? 'group-hover:text-red-300' : ''}`} />
            </div>
            {text}
        </button>
    );
};

const ChatPanel = ({ messages, onPreviewFile, onDeleteFile, activeChatId, userData }) => {
    const endOfMessagesRef = useRef(null);
    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                    <div className="w-16 h-16 mb-4 bg-gradient-to-tr from-[#0D7377] to-[#14FFEC] rounded-2xl"></div>
                    <h2 className="text-2xl font-bold text-gray-300">Welcome to Vizora Chat</h2>
                    <p>Start a conversation or upload a file to begin.</p>
                </div>
            )}
            {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} >
                    {msg.sender === 'user' ? (
                        <UserMessage message={msg} onPreviewFile={onPreviewFile} onDeleteFile={(messageId) => onDeleteFile(activeChatId, messageId)} userName={userData.name} />
                    ) : msg.table ? (
                        <BotTableMessage message={msg} />
                    ) : (
                        <BotMessage message={msg} />
                    )}
                </motion.div>
            ))}
            <div ref={endOfMessagesRef} />
        </div>
    );
};

const UserMessage = ({ message, onPreviewFile, onDeleteFile, userName }) => {
    const getInitials = (name) => {
        if (!name) return 'G';
        const nameParts = name.split(' ');
        if (nameParts.length > 1 && nameParts[1]) {
            return `${nameParts[0][0]}${nameParts[1][0]}`;
        }
        return name.charAt(0);
    };

    return (
        <div className="flex items-start gap-3 justify-end">
            <div className="bg-[#0D7377] rounded-xl rounded-br-none p-4 max-w-lg">
                {message.text && <p className="text-white text-base leading-relaxed whitespace-pre-wrap">{message.text}</p>}
                {message.file && <FileCard file={message.file} onPreview={() => onPreviewFile(message.file.raw)} onDelete={() => onDeleteFile(message.id)} />}
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-600 flex-shrink-0 flex items-center justify-center font-bold text-xs uppercase p-1">{getInitials(userName)}</div>
        </div>
    );
};

const BotMessage = ({ message }) => (
    <div className="flex items-start gap-3">
        <BotAvatar />
        <div className="bg-[#323232] rounded-xl rounded-bl-none p-4 max-w-lg">
            {message.typing ? <TypingIndicator /> : <p className="text-white text-base leading-relaxed whitespace-pre-wrap">{message.text}</p>}
        </div>
    </div>
);

// Table/SQL toggle bot message
const BotTableMessage = ({ message }) => {
    const { table } = message;
    const [view, setView] = useState(table.view || 'table');
    const [editingSql, setEditingSql] = useState(table.editingSql);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState(null);
    const [rows, setRows] = useState(table.rows);
    const [columns, setColumns] = useState(table.columns);

    const exportCsv = () => {
        try {
            const headerLine = columns.join(',');
            const bodyLines = rows.map(r => columns.map(c => {
                const val = r[c];
                if (val == null) return '';
                const s = String(val).replace(/"/g,'""');
                return /[,"]/.test(s) ? `"${s}"` : s;
            }).join(',')).join('\n');
            const blob = new Blob([headerLine + '\n' + bodyLines], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'query_result.csv';
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        } catch(err) { /* silent */ }
    };

    const rerun = async () => {
        setRunning(true); setError(null);
        try {
            // message.table.fileIds preserved
            const res = await tableQueryApi.run({ sql: editingSql, file_ids: table.fileIds });
            setColumns(res.columns || []); setRows(res.rows || []);
            setView('table');
        } catch(err){
            setError('Run failed');
        } finally { setRunning(false); }
    };

    return (
        <div className="flex items-start gap-3">
            <BotAvatar />
            <div className="bg-[#323232] rounded-xl rounded-bl-none p-4 max-w-full w-full md:max-w-3xl">
                <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setView('table')} className={`text-xs px-3 py-1.5 rounded-md font-semibold ${view==='table' ? 'bg-[#14FFEC] text-black':'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}>Table</button>
                    <button onClick={() => setView('sql')} className={`text-xs px-3 py-1.5 rounded-md font-semibold ${view==='sql' ? 'bg-[#14FFEC] text-black':'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}>SQL</button>
                    {view==='table' && <button onClick={exportCsv} className="ml-auto text-xs px-3 py-1.5 rounded-md font-semibold bg-gray-700 text-gray-200 hover:bg-gray-600">Export CSV</button>}
                    {view==='sql' && <button onClick={rerun} disabled={running} className="ml-auto text-xs px-3 py-1.5 rounded-md font-semibold bg-[#0D7377] text-white hover:bg-[#14FFEC] hover:text-black disabled:opacity-50">{running? 'Running...':'Run SQL'}</button>}
                </div>
                {view === 'sql' ? (
                    <div className="space-y-3">
                        <textarea value={editingSql} onChange={e=>setEditingSql(e.target.value)} className="w-full h-40 bg-black/30 border border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-[#14FFEC]" />
                        {error && <div className="text-xs text-red-400">{error}</div>}
                    </div>
                ) : (
                    <div className="overflow-auto max-h-96 border border-gray-700 rounded-lg custom-scrollbar">
                        <table className="w-full text-xs text-left text-gray-300">
                            <thead className="bg-gray-800 sticky top-0"><tr>{columns.map(c => <th key={c} className="px-3 py-2 font-semibold text-gray-200">{c}</th>)}</tr></thead>
                            <tbody>{rows.map((r,i) => <tr key={i} className="odd:bg-gray-800/40 hover:bg-gray-700/40">{columns.map(c => <td key={c} className="px-3 py-1.5 whitespace-nowrap max-w-xs truncate" title={r[c] != null ? String(r[c]) : ''}>{r[c] != null ? String(r[c]) : ''}</td>)}</tr>)}</tbody>
                        </table>
                        {rows.length === 0 && <div className="p-3 text-xs text-gray-400">No rows returned.</div>}
                    </div>
                )}
                {view==='table' && <details className="mt-3 text-xs text-gray-400"><summary className="cursor-pointer select-none text-gray-300">Show SQL</summary><pre className="mt-2 p-2 bg-black/30 rounded-md overflow-auto text-[10px] whitespace-pre-wrap">{editingSql}</pre></details>}
            </div>
        </div>
    );
};

const TypingIndicator = () => (
    <div className="flex items-center gap-1.5">
        <motion.div className="w-2 h-2 bg-gray-400 rounded-full" animate={{ scale: [1, 1.2, 1], y: [0, -2, 0] }} transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="w-2 h-2 bg-gray-400 rounded-full" animate={{ scale: [1, 1.2, 1], y: [0, -2, 0] }} transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} />
        <motion.div className="w-2 h-2 bg-gray-400 rounded-full" animate={{ scale: [1, 1.2, 1], y: [0, -2, 0] }} transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} />
    </div>
);

const FileCard = ({ file, onPreview, onDelete }) => (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-3 bg-black/30 rounded-lg p-3 flex items-center gap-3">
        <div className="p-2 bg-gray-600 rounded-md">
            {file.type === 'CSV' ? <FileText className="w-6 h-6 text-[#14FFEC]" /> : <HardDrive className="w-6 h-6 text-[#14FFEC]" />}
        </div>
        <div className="flex-1 text-sm min-w-0">
            <p className="font-semibold text-white truncate">{file.name}</p>
            <p className="text-gray-400">{file.size}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onDelete} className="text-gray-400 hover:text-red-400 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
            <button onClick={onPreview} className="bg-[#14FFEC] text-black px-3 py-1 rounded-md text-xs font-semibold hover:bg-white transition-colors"> Preview </button>
        </div>
    </motion.div>
);

const ChatInput = ({ onSendMessage, onUploadClick, isBotReplying, isSendingMessage }) => {
    const [input, setInput] = useState('');
    const textareaRef = useRef(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim() || isBotReplying || isSendingMessage) return;
        onSendMessage(input.trim());
        setInput('');
    };
    const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }

    useEffect(() => {
        const el = textareaRef.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        }
    }, [input]);

    return (
        <div className="p-4 bg-transparent">
            <form onSubmit={handleSubmit} className="flex items-center gap-3 bg-[#323232] rounded-xl p-2.5 shadow-2xl border border-gray-700/50 focus-within:ring-2 focus-within:ring-[#14FFEC] transition-all duration-300">
                <button type="button" onClick={onUploadClick} className="p-2 rounded-full hover:bg-gray-600/50 transition-colors" disabled={isBotReplying || isSendingMessage}><Plus className="w-6 h-6 text-gray-300" /></button>
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Vizora..."
                    rows="1"
                    className="flex-1 bg-transparent text-gray-200 text-base placeholder-gray-500 focus:outline-none resize-none max-h-40 custom-scrollbar"
                    disabled={isSendingMessage}
                />
                <button
                    type="submit"
                    className="p-2 rounded-full hover:bg-gray-600/50 transition-colors disabled:opacity-50"
                    disabled={!input.trim() || isBotReplying || isSendingMessage}
                >
                    <ArrowRight className="w-6 h-6 text-gray-300" />
                </button>
            </form>
        </div>
    );
};

const AccountModal = ({ userData, onClose, onDeleteHistory, onShowPasswordChange }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center" onClick={onClose}>
        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
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

const InfoDisplay = ({ label, value }) => ( <div> <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label> <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"> {value} </div> </div> );

const PasswordChangeModal = ({ onClose, showToast }) => {
    const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
    const handleChange = (e) => setPasswords({ ...passwords, [e.target.name]: e.target.value });
    const handleSubmit = () => {
        if (passwords.new.length < 8) { return showToast("New password must be at least 8 characters.", "error"); }
        if (passwords.new !== passwords.confirm) { return showToast("New passwords do not match.", "error"); }
        showToast("Password changed successfully!", "success");
        onClose();
    };
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
            <motion.div initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="bg-[#2a2a2a] rounded-xl w-full max-w-sm p-6 border border-gray-700/50 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-6 text-white">Change Password</h2>
                <div className="space-y-4">
                    <InputField label="Old Password" id="old" name="old" type="password" value={passwords.old} onChange={handleChange} />
                    <InputField label="New Password" id="new" name="new" type="password" value={passwords.new} onChange={handleChange} />
                    <InputField label="Confirm Password" id="confirm" name="confirm" type="password" value={passwords.confirm} onChange={handleChange} />
                </div>
                <div className="mt-6 flex gap-3">
                    <button onClick={onClose} className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-gray-300 bg-gray-700/60 hover:opacity-80 transition-opacity">Cancel</button>
                    <button onClick={handleSubmit} className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-black bg-[#14FFEC] hover:bg-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#2a2a2a] focus:ring-[#14FFEC] shadow-[0_0_15px_rgba(20,255,236,0)] hover:shadow-[0_0_15px_rgba(20,255,236,0.5)]">Submit</button>
                </div>
            </motion.div>
        </motion.div>
    );
};

const InputField = ({ label, id, ...props }) => ( <div> <label htmlFor={id} className="block text-sm font-medium text-gray-400 mb-1">{label}</label> <input id={id} className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14FFEC]" {...props} /> </div> );

const FilePreviewModal = ({ file, onClose }) => {
    const [data, setData] = useState(null); const [headers, setHeaders] = useState([]); const [error, setError] = useState(''); const [activeSheet, setActiveSheet] = useState(0); const [workbook, setWorkbook] = useState(null); const [currentPage, setCurrentPage] = useState(1); const [searchTerm, setSearchTerm] = useState(''); const rowsPerPage = 10;
    useEffect(() => {
        if (!window.Papa || !window.XLSX) { setError("File parsing libraries are loading..."); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (file.type === 'text/csv') {
                    const result = window.Papa.parse(e.target.result, { header: true, skipEmptyLines: true }); if(result.errors.length) throw new Error("Parsing error"); setHeaders(result.meta.fields); setData(result.data);
                } else {
                    const wb = window.XLSX.read(e.target.result, { type: 'binary' }); setWorkbook(wb); const sheetName = wb.SheetNames[activeSheet]; const ws = wb.Sheets[sheetName]; const jsonData = window.XLSX.utils.sheet_to_json(ws, { header: 1 }); setHeaders(jsonData[0] || []); setData(jsonData.slice(1).map(row => (jsonData[0] || []).reduce((obj, h, i) => ({...obj, [h]: row[i]}), {})));
                }
            } catch (err) { setError("Failed to parse file."); }
        };
        reader.onerror = () => setError("Failed to read the file.");
        if (file.type.includes('sheet')) { reader.readAsBinaryString(file); } else { reader.readAsText(file); }
    }, [file, activeSheet]);
    const handleSheetChange = (sheetIndex) => {
        if (!window.XLSX || !workbook) return; setActiveSheet(sheetIndex); const sheetName = workbook.SheetNames[sheetIndex]; const ws = workbook.Sheets[sheetName]; const jsonData = window.XLSX.utils.sheet_to_json(ws, { header: 1 }); setHeaders(jsonData[0] || []); setData(jsonData.slice(1).map(row => (jsonData[0] || []).reduce((obj, h, i) => ({...obj, [h]: row[i]}), {}))); setCurrentPage(1);
    }
    const filteredData = useMemo(() => { if (!data) return []; if (!searchTerm) return data; return data.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))); }, [data, searchTerm]);
    const paginatedData = useMemo(() => { const startIndex = (currentPage - 1) * rowsPerPage; return filteredData.slice(startIndex, startIndex + rowsPerPage); }, [filteredData, currentPage]);
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }} className="bg-[#212121] rounded-xl w-full max-w-4xl h-[90vh] flex flex-col border border-gray-700/50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <header className="p-4 flex items-center justify-between border-b border-gray-700/50 flex-shrink-0">
                    <h2 className="text-xl font-bold text-white truncate">{file.name}</h2> <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-700/80 transition-colors"><X className="w-5 h-5" /></button>
                </header>
                <div className="p-4 flex-shrink-0 flex flex-col md:flex-row gap-4 items-center">
                    {workbook && (<select value={activeSheet} onChange={(e) => handleSheetChange(parseInt(e.target.value))} className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14FFEC]">{workbook.SheetNames.map((name, index) => (<option key={name} value={index}>{name}</option>))}</select>)}
                    <div className="relative flex-grow w-full md:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /> <input type="text" placeholder="Search table..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14FFEC]"/>
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
}

const FileDashboardModal = ({ chat, onClose, onConfirm }) => {
    const [selectedFileId, setSelectedFileId] = useState(null);

    const uploadedFilesWithMsgId = useMemo(() => {
        return chat?.messages
            .filter(msg => msg.file)
            .map(msg => ({ file: msg.file, msgId: msg.id })) || [];
    }, [chat]);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="bg-[#323232] rounded-xl w-full max-w-md p-6 border border-gray-700/50 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-700/80 transition-colors"><X className="w-5 h-5" /></button>
                <h2 className="text-2xl font-bold mb-2 text-white">Select a File</h2>
                <p className="text-sm text-gray-400 mb-6">Choose a file to focus on from: <span className="font-medium text-gray-300 truncate">{chat?.title || 'this chat'}</span></p>

                <div className="max-h-80 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                    {uploadedFilesWithMsgId.length > 0 ? (
                        <fieldset className="space-y-3">
                             <legend className="sr-only">Uploaded Files</legend>
                            {uploadedFilesWithMsgId.map(({ file, msgId }) => (
                                <label key={msgId} htmlFor={msgId} className={`bg-gray-800/50 p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-all border-2 ${selectedFileId === msgId ? 'border-[#14FFEC]' : 'border-transparent hover:border-gray-600'}`}>
                                    <input
                                        type="radio"
                                        id={msgId}
                                        name="fileSelection"
                                        value={msgId}
                                        checked={selectedFileId === msgId}
                                        onChange={() => setSelectedFileId(msgId)}
                                        className="h-4 w-4 text-[#14FFEC] bg-gray-700 border-gray-600 focus:ring-[#14FFEC] focus:ring-2"
                                    />
                                    <div className="p-2 bg-gray-600 rounded-md">
                                        {file.type === 'CSV' ? <FileText className="w-5 h-5 text-[#14FFEC]" /> : <HardDrive className="w-5 h-5 text-[#14FFEC]" />}
                                    </div>
                                    <div className="flex-1 text-sm">
                                        <p className="font-semibold text-white truncate">{file.name}</p>
                                        <p className="text-gray-400">{file.size}</p>
                                    </div>
                                </label>
                            ))}
                        </fieldset>
                    ) : ( <div className="text-center py-8 text-gray-500"><FileX2 className="w-10 h-10 mx-auto mb-2" /><p>No files have been uploaded in this chat.</p></div> )}
                </div>
                 <div className="mt-6 flex justify-end">
                    <button onClick={() => { if(selectedFileId) onConfirm(selectedFileId)}} disabled={!selectedFileId} className="py-2 px-5 rounded-lg text-sm font-semibold text-black bg-[#14FFEC] hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Done</button>
                </div>
            </motion.div>
        </motion.div>
    );
};

const ContactModal = ({ onClose, showToast }) => {
    const [query, setQuery] = useState('');
    const [attachment, setAttachment] = useState(null);
    const contactFileInputRef = useRef(null);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setAttachment(file);
        }
    };

    const handleSubmit = () => {
        if (!query.trim()) {
            return showToast("Please enter your query before submitting.", "error");
        }
        // In a real app, you would handle the form submission here (e.g., API call)
        console.log("Submitting Query:", { query, attachment });
        showToast("Your query has been submitted successfully!", "success");
        onClose();
    };

    const removeAttachment = () => {
        setAttachment(null);
        if(contactFileInputRef.current) {
            contactFileInputRef.current.value = "";
        }
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="bg-[#323232] rounded-xl w-full max-w-lg p-6 border border-gray-700/50 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-700/80 transition-colors"><X className="w-5 h-5" /></button>
                <h2 className="text-2xl font-bold mb-4 text-white">Contact Support</h2>
                <div className="space-y-4">
                    <textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Tell us your queries..."
                        rows="6"
                        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14FFEC] custom-scrollbar resize-none"
                    />
                    <input type="file" accept="image/*" onChange={handleFileChange} ref={contactFileInputRef} className="hidden" id="contact-file-upload" />

                    {!attachment ? (
                        <button onClick={() => contactFileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 text-sm py-2.5 px-4 rounded-lg border border-dashed border-gray-600 hover:bg-gray-700/60 transition-colors text-gray-400">
                           <Paperclip className="w-4 h-4" /> Attach an image (optional)
                        </button>
                    ) : (
                        <div className="bg-gray-800/50 p-2.5 rounded-lg flex items-center justify-between text-sm">
                            <span className="truncate text-gray-300">{attachment.name}</span>
                            <button onClick={removeAttachment} className="p-1 rounded-full hover:bg-gray-700 transition-colors"><X className="w-4 h-4 text-gray-400"/></button>
                        </div>
                    )}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className="py-2 px-5 rounded-lg text-sm font-semibold text-gray-300 bg-gray-700/60 hover:opacity-80 transition-opacity">Cancel</button>
                    <button onClick={handleSubmit} className="flex items-center gap-2 py-2 px-5 rounded-lg text-sm font-semibold text-black bg-[#14FFEC] hover:bg-white transition-colors disabled:opacity-50" disabled={!query.trim()}>
                        Submit <Send className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", icon: Icon = AlertTriangle, iconColor = 'text-red-400', iconBgColor = 'bg-red-500/20', isLogout = false }) => {
    if (!isOpen) return null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="bg-[#323232] rounded-xl w-full max-w-sm p-6 border border-gray-700/50 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start gap-4">
                    <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${iconBgColor} sm:mx-0 sm:h-10 sm:w-10`}>
                        <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden="true" />
                    </div>
                    <div className="mt-0 text-left">
                        <h3 className="text-lg leading-6 font-bold text-white" id="modal-title">
                            {title}
                        </h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-400">
                                {isLogout ? (
                                    <>
                                        Oh! <motion.span animate={{ y: [0, -2, 0], scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }} className="inline-block">🥺</motion.span> We're going to miss you. Come back soon, I'll be here for you anytime!
                                    </>
                                ) : message}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="py-2 px-5 rounded-lg text-sm font-semibold text-gray-300 bg-gray-700/60 hover:opacity-80 transition-opacity">
                        {cancelText}
                    </button>
                    <button type="button" onClick={() => { onConfirm(); onClose(); }} className={`py-2 px-5 rounded-lg text-sm font-semibold text-white ${ (title.includes('Delete') || isLogout) ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0D7377] hover:bg-[#14FFEC]' } transition-colors`}>
                        {confirmText}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

const ShareCodeModal = ({ isOpen, onClose, code, showToast }) => {
    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(code)
            .then(() => showToast(`Code "${code}" copied to clipboard!`, "success"))
            .catch(() => showToast('Failed to copy code.', 'error'));
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="bg-[#323232] rounded-xl w-full max-w-sm p-6 border border-gray-700/50 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-2 text-white">Share Chat</h2>
                <p className="text-sm text-gray-400 mb-6">Share this code to let others view a copy of this conversation.</p>
                <div className="bg-gray-800/50 p-4 rounded-lg flex items-center justify-between gap-4">
                    <span className="font-mono text-2xl tracking-widest text-[#14FFEC]">{code}</span>
                    <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-gray-700/60 transition-colors flex-shrink-0">
                        <Clipboard className="w-5 h-5 text-gray-300" />
                    </button>
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="py-2 px-5 rounded-lg text-sm font-semibold text-black bg-[#14FFEC] hover:bg-white transition-colors">Done</button>
                </div>
            </motion.div>
        </motion.div>
    );
};

const Toast = ({ message, type, onClose, action }) => (
    <motion.div layout initial={{ opacity: 0, y: 50, scale: 0.3 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.5 }} className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 p-4 rounded-lg shadow-2xl border ${ type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-green-500/20 border-green-500/30 text-green-300' }`}>
        {type === 'error' ? <FileX2 className="w-6 h-6" /> : <Info className="w-6 h-6" />}
        <p className="font-semibold">{message}</p>
        {action && (
            <button
                onClick={() => { action.onClick(); onClose(); }}
                className="ml-2 font-bold uppercase text-sm tracking-wider bg-white/10 px-3 py-1 rounded-md hover:bg-white/20"
            >
                {action.label}
            </button>
        )}
        <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors ml-auto"><X className="w-4 h-4"/></button>
    </motion.div>
);