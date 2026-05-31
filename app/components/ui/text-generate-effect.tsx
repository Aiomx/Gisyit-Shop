/**
 * Text Generate Effect Component
 * 
 * A component that displays text with a typewriter-like animation effect.
 * Adapted from Aceternity UI for streaming AI responses.
 * 
 * Requirements: 5.2
 */
"use client";
import { useEffect, useRef } from "react";
import { motion, stagger, useAnimate, useInView } from "motion/react";
import { cn } from "~/lib/utils";

interface TextGenerateEffectProps {
    /** The text to display with animation */
    words: string;
    /** Additional CSS classes */
    className?: string;
    /** Whether to apply blur filter animation */
    filter?: boolean;
    /** Animation duration for each word */
    duration?: number;
    /** Whether the text is still streaming */
    isStreaming?: boolean;
}

/**
 * TextGenerateEffect - Animated text display component
 * 
 * Features:
 * - Word-by-word animation with blur effect
 * - Supports streaming text updates
 * - Customizable animation duration
 * 
 * Requirements: 5.2
 */
export function TextGenerateEffect({
    words,
    className,
    filter = true,
    duration = 0.3,
    isStreaming = false,
}: TextGenerateEffectProps) {
    const [scope, animate] = useAnimate();
    const isInView = useInView(scope);
    const previousWordsRef = useRef<string>("");

    // Split words and track new words for animation
    const wordsArray = words.split(" ").filter(Boolean);

    useEffect(() => {
        if (!scope.current) return;

        // Animate all spans
        animate(
            "span",
            {
                opacity: 1,
                filter: filter ? "blur(0px)" : "none",
            },
            {
                duration: duration,
                delay: stagger(0.05),
            }
        );

        previousWordsRef.current = words;
    }, [words, animate, filter, duration]);

    const renderWords = () => {
        return (
            <motion.div ref={scope} className="inline">
                {wordsArray.map((word, idx) => (
                    <motion.span
                        key={`${word}-${idx}`}
                        className={cn(
                            "text-text-primary opacity-0",
                            isStreaming && idx === wordsArray.length - 1 && "animate-pulse"
                        )}
                        style={{
                            filter: filter ? "blur(4px)" : "none",
                        }}
                    >
                        {word}{" "}
                    </motion.span>
                ))}
                {isStreaming && (
                    <motion.span
                        className="inline-block w-2 h-4 bg-accent animate-pulse"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    />
                )}
            </motion.div>
        );
    };

    return (
        <div className={cn("text-base leading-relaxed", className)}>
            {renderWords()}
        </div>
    );
}

/**
 * StreamingText - Simpler streaming text component without heavy animations
 * 
 * A lighter alternative for streaming text that doesn't require motion library.
 * Better for long streaming responses.
 */
export function StreamingText({
    text,
    className,
    isStreaming = false,
}: {
    text: string;
    className?: string;
    isStreaming?: boolean;
}) {
    return (
        <div className={cn("text-base leading-relaxed whitespace-pre-wrap", className)}>
            {text}
            {isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-accent animate-pulse align-middle" />
            )}
        </div>
    );
}

export default TextGenerateEffect;
