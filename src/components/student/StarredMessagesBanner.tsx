import { useState, useEffect } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/safe-ui/alert';
import { Button } from '@/components/safe-ui/button';
import { Star, X } from 'lucide-react';
import { getMailbox, toggleMessageStar, canUserRemoveStar } from '@/lib/messages';
import { Message } from '@/lib/types';
import { MessageTypeBadge } from './MessageTypeBadge';

interface StarredMessagesBannerProps {
  studentId: string;
}

export default function StarredMessagesBanner({ studentId }: StarredMessagesBannerProps) {
  const [starredMessages, setStarredMessages] = useState<Message[]>([]);

  useEffect(() => {
    loadStarredMessages();
    // Refresh every 30 seconds
    const interval = setInterval(loadStarredMessages, 30000);
    return () => clearInterval(interval);
  }, [studentId]);

  const loadStarredMessages = () => {
    const mailbox = getMailbox(studentId);
    // Get starred messages that are not deleted, limited to 3
    setStarredMessages(mailbox.starred.slice(0, 3));
  };

  const handleRemoveStar = (messageId: string) => {
    toggleMessageStar(messageId, studentId);
    loadStarredMessages();
  };

  if (starredMessages.length === 0) return null;

  return (
    <div className="mb-4 space-y-2" dir="rtl">
      {starredMessages.map(message => (
        <Alert 
          key={message.id} 
          variant="default" 
          className="border-yellow-500 bg-gradient-to-br from-background to-yellow-100/50 shadow-lg dark:from-yellow-950/20 dark:to-yellow-900/30"
        >
          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
          <AlertTitle className="text-lg font-bold mb-2 flex items-center justify-between text-foreground">
            <div className="flex items-center gap-2">
              <span>{message.subject || '(ללא נושא)'}</span>
              <MessageTypeBadge message={message} />
            </div>
            {canUserRemoveStar(message, studentId) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveStar(message.id)}
                className="h-6 w-6"
                title="הסר כוכב"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </AlertTitle>
          <AlertDescription className="text-base text-foreground/80">
            <div className="mb-3 whitespace-pre-wrap line-clamp-3">
              {message.content}
            </div>
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>מאת: {message.senderName}</span>
              <span>{new Date(message.createdAt).toLocaleDateString('he-IL')}</span>
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
