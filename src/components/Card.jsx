import React, { useMemo } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Clock, Tag, Calendar, User, Bell } from 'lucide-react';

const Card = ({ notification, drag, onVote, index }) => {
  // Guard against undefined notification
  if (!notification || !notification.id) {
    return null;
  }

  const x = useMotionValue(0);
  
  // Transform x position to overlay opacity
  const greenOpacity = useTransform(x, [0, 150], [0, 0.3]);
  const redOpacity = useTransform(x, [-150, 0], [0.3, 0]);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);

  // Generate a consistent gradient based on notification ID
  const gradient = useMemo(() => {
    const colors = [
      ['#4f46e5', '#c026d3'], // Indigo -> Fuchsia
      ['#2563eb', '#06b6d4'], // Blue -> Cyan
      ['#db2777', '#f97316'], // Pink -> Orange
      ['#7c3aed', '#2dd4bf'], // Violet -> Teal
      ['#ea580c', '#eab308'], // Orange -> Yellow
    ];
    const notifId = String(notification.id || '');
    const hash = notifId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const [c1, c2] = colors[hash % colors.length];
    return `linear-gradient(135deg, ${c1}, ${c2})`;
  }, [notification.id]);

  const priorityColor = useMemo(() => {
    const priorityId = notification.priority?.id || notification.priority?.priority;
    switch (priorityId) {
      case '1': 
      case 'urgent': return '#ef4444';
      case '2': 
      case 'high': return '#f59e0b';
      case '3': 
      case 'normal': return '#3b82f6';
      default: return '#9ca3af';
    }
  }, [notification.priority]);

  // Format the last updated date
  const formattedDate = useMemo(() => {
    const timestamp = notification.date_updated || notification.date;
    if (!timestamp) return '';
    const date = new Date(parseInt(timestamp));
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }, [notification.date_updated, notification.date]);

  return (
    <motion.div
      layout
      drag={drag ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      whileDrag={{ cursor: "grabbing", scale: 1.02 }}
      style={{ x, rotate }}
      onDragEnd={(e, { offset, velocity }) => {
        const swipeThreshold = 100;
        const velocityThreshold = 500;
        
        if (offset.x > swipeThreshold || velocity.x > velocityThreshold) {
          onVote(true); // Swipe right = mark as read
        } else if (offset.x < -swipeThreshold || velocity.x < -velocityThreshold) {
          onVote(false); // Swipe left = keep unread
        }
      }}
      className="absolute w-full h-full rounded-[32px] overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing bg-[#1e1e24] border border-white/10"
    >
      {/* Header with gradient */}
      <div
        className="h-[40%] w-full relative p-6 flex flex-col justify-between"
        style={{ background: gradient }}
      >
        <div className="flex justify-between items-start">
          {/* Priority Badge */}
          {notification.priority && (
            <div className="px-3 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: priorityColor }} />
              {notification.priority?.priority || 'Normal'}
            </div>
          )}
          
          {/* Status Badge */}
          {notification.status && (
            <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold text-white uppercase tracking-wider">
              {notification.status?.status || notification.status}
            </div>
          )}
        </div>

        {/* Time Badge */}
        <div className="flex items-center justify-between">
          <div className="text-white/80 font-medium flex items-center gap-2 text-sm">
            <Clock size={14} />
            {formattedDate}
          </div>
          {notification.due_date && (
            <div className="text-white/80 font-medium flex items-center gap-2 text-sm bg-black/20 px-3 py-1 rounded-full">
              <Calendar size={14} />
              Due: {new Date(parseInt(notification.due_date)).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Content Body */}
      <div className="h-[60%] p-6 flex flex-col relative bg-[#1e1e24]">
        {/* Glass Separator Line */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="flex-1 overflow-hidden">
          {/* Task Name */}
          <h2 className="text-2xl font-bold text-white mb-3 leading-tight tracking-tight line-clamp-2">
            {notification.name || 'Notification'}
          </h2>
          
          {/* Task Description */}
          {notification.description && (
            <p className="text-white/60 text-base leading-relaxed mb-4 line-clamp-3">
              {notification.description.replace(/<[^>]*>/g, '').substring(0, 200)}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/5 flex justify-between items-center">
          {/* Actor/Creator Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center text-sm font-bold text-white border border-white/10 overflow-hidden">
              {(notification.action_by?.profilePicture || notification.assignees?.[0]?.profilePicture) ? (
                <img 
                  src={notification.action_by?.profilePicture || notification.assignees?.[0]?.profilePicture} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
              ) : (
                notification.action_by?.username?.charAt(0)?.toUpperCase() ||
                notification.assignees?.[0]?.username?.charAt(0)?.toUpperCase() || 
                notification.creator?.username?.charAt(0)?.toUpperCase() || 
                '?'
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-white/40 uppercase tracking-wider">
                {notification.action_by ? 'From' : 'Assigned to'}
              </span>
              <span className="text-sm text-white/80">
                {notification.action_by?.username || notification.assignees?.[0]?.username || 'You'}
              </span>
            </div>
          </div>

          {/* List/Space Badge */}
          {notification.list && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-white/50 text-xs max-w-[140px] truncate">
              <Tag size={12} className="flex-shrink-0" />
              <span className="truncate">{notification.list.name}</span>
            </div>
          )}
        </div>

        {/* Swipe Hints */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-between px-6 pointer-events-none">
          <span className="text-xs text-white/30">← Skip</span>
          <span className="text-xs text-white/30">Done →</span>
        </div>
      </div>

      {/* Swipe Feedback Overlays */}
      <motion.div
        className="absolute inset-0 bg-green-500 pointer-events-none z-50 flex items-center justify-center"
        style={{ opacity: greenOpacity }}
      >
        <span className="text-white text-4xl font-bold">✓ DONE</span>
      </motion.div>
      
      <motion.div
        className="absolute inset-0 bg-amber-500 pointer-events-none z-50 flex items-center justify-center"
        style={{ opacity: redOpacity }}
      >
        <span className="text-white text-4xl font-bold">SKIP →</span>
      </motion.div>
    </motion.div>
  );
};

export default Card;
