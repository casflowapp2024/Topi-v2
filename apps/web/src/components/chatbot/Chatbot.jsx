
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PaperAirplaneIcon, XMarkIcon } from '@heroicons/react/24/solid';

import axios from 'axios';
import { connect } from 'react-redux';

const Chatbot = ({ token, user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, text: "Hola! Soy Topacio, tu asistente personal experto en finanzas. ¿En qué puedo asesorarte hoy?", sender: 'bot' }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    const toggleChat = () => setIsOpen(!isOpen);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const userMessage = { id: Date.now(), text: inputValue, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        setInputValue("");
        setIsTyping(true);

        try {
            const payload = {
                message: userMessage.text,
                token: token,
                sessionId: user?.id ? `user-${user.id}` : 'guest-session',
                baseUrl: process.env.REACT_APP_API_URL,
                now: new Date().toISOString()
            };

            const response = await axios.post(`${process.env.REACT_APP_N8N_CHAT_BOT_WEBHOOK_URL}`, payload);

            // Handle response: assume response.data.output or text
            const botText = response.data.output || response.data.text || response.data.message || (typeof response.data === 'string' ? response.data : "Respuesta recibida");

            const botResponse = { id: Date.now() + 1, text: botText, sender: 'bot' };
            setMessages(prev => [...prev, botResponse]);
        } catch (error) {
            console.error("Chatbot Error:", error);
            const errorResponse = { id: Date.now() + 1, text: "Lo siento, tuve un problema al conectar con el servidor. Por favor intenta más tarde.", sender: 'bot' };
            setMessages(prev => [...prev, errorResponse]);
        } finally {
            setIsTyping(false);
        }
    };

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isTyping]);

    useEffect(() => {
        const handleToggle = () => setIsOpen(prev => !prev);
        window.addEventListener('toggle-chatbot', handleToggle);
        return () => window.removeEventListener('toggle-chatbot', handleToggle);
    }, []);

    return (
        <div className="fixed bottom-24 lg:bottom-6 right-4 z-50 flex flex-col items-end transition-all duration-300">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className="mb-4 w-[350px] h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100"
                    >
                        {/* Header */}
                        <div className="bg-[#5266EB] p-2 flex items-center justify-between text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center overflow-hidden backdrop-blur-sm border border-white/30 text-2xl">
                                    🦊
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">Topacio</h3>
                                    <p className="text-xs text-blue-100 flex items-center gap-1">
                                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                        En línea
                                    </p>
                                </div>
                            </div>
                            <button onClick={toggleChat} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 space-y-4">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.sender === 'user'
                                            ? 'bg-[#5266EB] text-white rounded-br-none'
                                            : 'bg-white border border-gray-200 text-gray-700 rounded-bl-none shadow-sm'
                                            }`}
                                    >
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex w-full justify-start">
                                    <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-1">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-gray-100">
                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Escribe un mensaje..."
                                    className="flex-1 bg-gray-100 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#5266EB]/20 focus:bg-white transition-all outline-none"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim() || isTyping}
                                    className="bg-[#5266EB] text-white p-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#4053d5] transition-colors shadow-sm"
                                >
                                    <PaperAirplaneIcon className="w-5 h-5" />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleChat}
                className="hidden lg:flex w-14 h-14 bg-[#5266EB] rounded-full shadow-lg shadow-blue-500/30 items-center justify-center text-white border-2 border-white overflow-hidden relative group"
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-[#5266EB] to-[#7383eb]"></div>
                {isOpen ? (
                    <XMarkIcon className="w-7 h-7 relative z-10" />
                ) : (
                    <div className="relative z-10 w-full h-full flex items-center justify-center text-3xl pb-1">
                        🦊
                    </div>
                )}
            </motion.button>
        </div>
    );
};

const mapStateToProps = state => ({
    token: state.Auth.token,
    user: state.Auth.user
});

export default connect(mapStateToProps)(Chatbot);
