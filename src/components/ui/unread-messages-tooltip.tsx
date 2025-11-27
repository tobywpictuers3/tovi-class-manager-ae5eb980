import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/safe-ui/tooltip";
import { getMessagesForStudent, getMessagesForAdmin, formatRecipients } from "@/lib/messages";
import { getStudents } from "@/lib/storage";
import { Message, Student } from "@/lib/types";

interface UnreadMessagesTooltipProps {
  userId: string;
  children: React.ReactNode;
}

export function UnreadMessagesTooltip({ userId, children }: UnreadMessagesTooltipProps) {
  const [unreadMessages, setUnreadMessages] = useState<Message[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const updateMessages = () => {
      const messages = userId === 'admin' 
        ? getMessagesForAdmin(false)
        : getMessagesForStudent(userId, false);
      
      const unread = messages
        .filter(m => !m.isRead?.[userId] && !m.isDraft)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      
      setUnreadMessages(unread);
      setStudents(getStudents());
    };

    updateMessages();
    const interval = setInterval(updateMessages, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  if (unreadMessages.length === 0) {
    return <>{children}</>;
  }

  const formatTime = (createdAt: string): string => {
    const date = new Date(createdAt);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs p-3">
          <div className="space-y-2">
            <p className="font-semibold text-sm mb-3 border-b pb-2">הודעות שלא נקראו:</p>
            {unreadMessages.map((msg) => (
              <div key={msg.id} className="text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0">
                <div className="flex justify-between gap-2 mb-1">
                  <span className="font-medium truncate flex-1">
                    {msg.subject?.trim() || '(ללא נושא)'}
                  </span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {userId === 'admin' 
                    ? `מאת: ${msg.senderName}`
                    : `אל: ${formatRecipients(msg.recipientIds, students)}`
                  }
                </div>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
