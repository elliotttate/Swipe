import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Card from './Card';
import PoofEffect from './PoofEffect';
import { Check, X, RotateCcw } from 'lucide-react';

const CardStack = ({ notifications = [], onSwipe, onRefresh }) => {
    const visibleNotifications = (notifications || []).slice(0, 3);
    const [exitStates, setExitStates] = useState({});
    const [poofs, setPoofs] = useState([]);

    const handleVote = (id, result) => {
        // result: true = Right/Done (Poof), false = Left/Skip (Fly away)

        if (result) {
            // Swipe Right: Trigger Poof
            setExitStates(prev => ({ ...prev, [id]: 'poof' }));

            // Add a poof effect
            const newPoof = { id: Date.now(), key: id };
            setPoofs(prev => [...prev, newPoof]);

            // Delay removal slightly to allow state to set, but Framer Motion handles the exist animation based on the state change
            // Actually, we want to trigger the exit animation on the CARD, and then remove it.
            // If we call onSwipe immediately, the component unmounts. AnimatePresence handles the exit.
            // We just need to ensure the custom prop is set correctly before unmounting.

            // We'll use a tiny timeout to ensure the render cycle picks up the exitState change
            setTimeout(() => {
                onSwipe(id, result);
            }, 10);
        } else {
            // Swipe Left: Default fly away
            setExitStates(prev => ({ ...prev, [id]: 'default' }));
            setTimeout(() => {
                onSwipe(id, result);
            }, 10);
        }
    };

    const removePoof = (poofId) => {
        setPoofs(prev => prev.filter(p => p.id !== poofId));
    };

    return (
        <div className="relative w-full max-w-[400px] h-[600px] flex items-center justify-center">
            {/* Render Poof Effects independently on top */}
            {poofs.map(poof => (
                <PoofEffect key={poof.id} onComplete={() => removePoof(poof.id)} />
            ))}

            <AnimatePresence mode="popLayout">
                {visibleNotifications.map((notification, index) => {
                    const isPoof = exitStates[notification.id] === 'poof';

                    return (
                        <motion.div
                            key={notification.id}
                            custom={isPoof}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{
                                scale: 1 - index * 0.05,
                                y: index * 15, // Stack vertically
                                zIndex: 30 - index,
                                opacity: 1 - index * 0.1
                            }}
                            variants={{
                                exit: (isPoof) => isPoof ? {
                                    scale: 0.5,
                                    opacity: 0,
                                    transition: { duration: 0.2 }
                                } : {
                                    x: -300,
                                    opacity: 0,
                                    rotate: -20,
                                    transition: { duration: 0.3 }
                                }
                            }}
                            exit="exit"
                            className="absolute w-full h-full origin-top"
                            style={{
                                zIndex: 30 - index,
                            }}
                        >
                            <Card
                                notification={notification}
                                drag={index === 0}
                                index={index}
                                onVote={(result) => handleVote(notification.id, result)}
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
