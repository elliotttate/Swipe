import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Card from './Card';
import { Check, X, RotateCcw } from 'lucide-react';

const CardStack = ({ notifications = [], onSwipe, onRefresh }) => {
    const visibleNotifications = (notifications || []).slice(0, 3);

    return (
        <div className="relative w-full max-w-[400px] h-[600px] flex items-center justify-center">
            <AnimatePresence mode="popLayout">
                {visibleNotifications.map((notification, index) => {
                    return (
                        <motion.div
                            key={notification.id}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{
                                scale: 1 - index * 0.05,
                                y: index * 15, // Stack vertically
                                zIndex: 30 - index,
                                opacity: 1 - index * 0.1
                            }}
                            exit={{ x: 300, opacity: 0, rotate: 20 }}
                            transition={{ type: "spring", stiffness: 200, damping: 20 }}
                            className="absolute w-full h-full origin-top"
                            style={{
                                zIndex: 30 - index,
                            }}
                        >
                            <Card
                                notification={notification}
                                drag={index === 0}
                                index={index}
                                onVote={(result) => onSwipe(notification.id, result)}
                            />
                        </motion.div>
                    );
                })}
            </AnimatePresence>

            {(!notifications || notifications.length === 0) && (
                <div className="text-center flex flex-col items-center z-50">
                    <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4 backdrop-blur-md">
                        <Check size={40} className="text-green-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">All Caught Up</h3>
                    <button
                        onClick={onRefresh}
                        className="px-6 py-3 rounded-full bg-white text-black font-bold hover:scale-105 transition-transform"
                    >
                        Refresh
                    </button>
                </div>
            )}
        </div>
    );
};

export default CardStack;
