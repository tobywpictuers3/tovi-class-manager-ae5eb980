import { useState } from "react";
import { Button } from "@/components/safe-ui/button";
import { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import EmojiPicker from "./EmojiPicker";
import { Plus } from "lucide-react";

interface ReactionBarProps {
  message: Message;
  currentUserId: string;
  onToggleReaction: (emoji: string) => void;
}

export default function ReactionBar({ 
  message, 
  currentUserId, 
  onToggleReaction 
}: ReactionBarProps) {
  const reactions = message.reactions || {};
  
  // Group reactions by emoji
  const reactionCounts: { [emoji: string]: { count: number; users: string[] } } = {};
  
  Object.entries(reactions).forEach(([userId, emoji]) => {
    if (!reactionCounts[emoji]) {
      reactionCounts[emoji] = { count: 0, users: [] };
    }
    reactionCounts[emoji].count++;
    reactionCounts[emoji].users.push(userId);
  });

  const userReaction = reactions[currentUserId];

  if (Object.keys(reactionCounts).length === 0) {
    return (
      <div className="flex items-center gap-2 mt-3">
        <EmojiPicker
          onSelect={onToggleReaction}
          trigger={
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3 mr-1" />
              הוסף תגובה
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-3 flex-wrap">
      {Object.entries(reactionCounts).map(([emoji, data]) => {
        const isCurrentUserReaction = data.users.includes(currentUserId);
        
        return (
          <button
            key={emoji}
            onClick={() => onToggleReaction(emoji)}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm border transition-colors",
              isCurrentUserReaction 
                ? "bg-primary/10 border-primary text-primary" 
                : "bg-muted border-transparent hover:border-border"
            )}
          >
            <span className="text-base">{emoji}</span>
            <span className="text-xs font-medium">{data.count}</span>
          </button>
        );
      })}
      
      <EmojiPicker
        onSelect={onToggleReaction}
        trigger={
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0 rounded-full"
          >
            <Plus className="h-3 w-3" />
          </Button>
        }
      />
    </div>
  );
}
