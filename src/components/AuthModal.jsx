import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Key, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { getOAuthLoginUrl } from '../services/clickup';

const AuthModal = ({ onSave }) => {
    const [showManualToken, setShowManualToken] = useState(false);
    const [token, setToken] = useState('');

    const handleOAuthLogin = () => {
        // Redirect to OAuth flow
        window.location.href = getOAuthLoginUrl();
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (token.trim()) {
            onSave(token.trim());
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass-panel p-8 w-full max-w-md"
            >
                <div className="flex flex-col items-center mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7B68EE] to-[#49CCF9] flex items-center justify-center mb-4 shadow-lg">
                        <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white text-center">Connect to ClickUp</h2>
                    <p className="text-white/60 text-center mt-2">
                        Access your inbox notifications
                    </p>
                </div>

                {/* OAuth Login Button */}
                <button
                    onClick={handleOAuthLogin}
                    className="w-full bg-gradient-to-r from-[#7B68EE] to-[#49CCF9] text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-3 hover:opacity-90 transition-opacity mb-4 shadow-lg"
                >
                    <ExternalLink size={20} />
                    Login with ClickUp
                </button>

                <p className="text-white/40 text-xs text-center mb-4">
                    Recommended: Full access to inbox notifications
                </p>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-white/30 text-xs uppercase tracking-wider">or</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Manual Token Toggle */}
                <button
                    onClick={() => setShowManualToken(!showManualToken)}
                    className="w-full flex items-center justify-center gap-2 text-white/50 hover:text-white/70 transition-colors py-2"
                >
                    <Key size={16} />
                    <span className="text-sm">Use Personal API Token</span>
                    {showManualToken ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {/* Manual Token Form */}
                {showManualToken && (
                    <motion.form 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        onSubmit={handleManualSubmit} 
                        className="mt-4 space-y-4"
                    >
                        <div>
                            <input
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="pk_..."
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/40 transition-colors"
                                autoFocus
                            />
                            <p className="text-xs text-white/40 mt-2 text-center">
                                Settings → Apps → API Token
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={!token}
                            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Connect
                        </button>

                        <p className="text-white/30 text-xs text-center">
                            Note: Personal tokens only show assigned tasks, not full inbox
                        </p>
                    </motion.form>
                )}
            </motion.div>
        </div>
    );
};

export default AuthModal;
