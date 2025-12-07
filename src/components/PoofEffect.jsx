import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const PoofEffect = ({ onComplete }) => {
    // Generate a set of random particles
    const particles = useMemo(() => {
        return Array.from({ length: 12 }).map((_, i) => ({
            id: i,
            angle: (i * 30 * Math.PI) / 180, // Distribute in circle
            distance: Math.random() * 80 + 40, // Random distance
            size: Math.random() * 20 + 10,
            delay: Math.random() * 0.1,
        }));
    }, []);

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    className="absolute bg-white/30 rounded-full blur-md"
                    initial={{
                        x: 0,
                        y: 0,
                        scale: 0.5,
                        opacity: 1
                    }}
                    animate={{
                        x: Math.cos(p.angle) * p.distance,
                        y: Math.sin(p.angle) * p.distance,
                        scale: 0,
                        opacity: 0,
                    }}
                    transition={{
                        duration: 0.6,
                        ease: "easeOut",
                        delay: p.delay,
                    }}
                    onAnimationComplete={p.id === 0 ? onComplete : undefined} // Trigger cleanup when first particle finishes (rough approx)
                    style={{
                        width: p.size,
                        height: p.size,
                    }}
                />
            ))}
            <motion.div
                className="absolute bg-white/40 rounded-full blur-xl"
                initial={{ scale: 0.5, opacity: 0.8 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{ width: 100, height: 100 }}
            />
        </div>
    );
};

export default PoofEffect;
