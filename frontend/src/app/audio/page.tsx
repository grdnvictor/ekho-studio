"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Send, Mic, Volume2, ArrowLeft, User, Bot, Trash2, CheckCircle, Clock, Target, Download, Play, Pause, Sparkles, Heart, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface Message {
    id: string;
    content: string;
    sender: 'user' | 'agent';
    timestamp: Date;
    needsMoreInfo?: boolean;
    missingInfo?: string[];
    suggestions?: string[];
    canProceed?: boolean;
    collectedInfo?: string[];
    conversationLength?: number;
    phase?: string;
    audioUrl?: string;
    audioGenerated?: boolean;
}

interface AudioContext {
    textContent?: string;
    voicePreference?: string;
    emotionStyle?: string;
    targetAudience?: string;
    projectType?: string;
    duration?: number;
    speed?: number;
}

const PHASE_CONFIG = {
    discovery: {
        name: 'Découverte',
        color: 'bg-blue-100 text-blue-800',
        borderColor: 'border-blue-300',
        icon: Sparkles,
        description: 'Dis-moi ton idée !',
        emoji: '✨'
    },
    clarification: {
        name: 'Discussion',
        color: 'bg-orange-100 text-orange-800',
        borderColor: 'border-orange-300',
        icon: Zap,
        description: 'On affine ensemble',
        emoji: '💬'
    },
    generation: {
        name: 'Prêt !',
        color: 'bg-green-100 text-green-800',
        borderColor: 'border-green-300',
        icon: Mic,
        description: 'C\'est parti !',
        emoji: '🚀'
    },
    complete: {
        name: 'Terminé',
        color: 'bg-purple-100 text-purple-800',
        borderColor: 'border-purple-300',
        icon: CheckCircle,
        description: 'Audio créé !',
        emoji: '🎉'
    }
};

// Suggestions de messages rapides
const QUICK_REPLIES = {
    discovery: [
        "Je veux créer une pub radio 📻",
        "J'ai besoin d'une narration pour un documentaire 🎬",
        "Je veux faire un podcast 🎙️",
        "C'est pour une formation en ligne 💻"
    ],
    clarification: [
        "C'est pour un public jeune 👦",
        "Je veux une voix chaleureuse 🤗",
        "Plutôt dynamique et énergique ⚡",
        "Style professionnel 👔"
    ],
    generation: [
        "Oui, lance la génération ! 🚀",
        "Parfait, go ! ✨",
        "C'est exactement ça 👍",
        "Je veux modifier quelque chose 🔧"
    ],
    complete: [
        "Je veux créer un autre audio 🎵",
        "Nouveau projet ! 🆕",
        "Super, merci ! 🙏",
        "J'adore le résultat ! ❤️"
    ]
};

export default function AudioPage() {
    const [isClient, setIsClient] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId] = useState(() => typeof window !== 'undefined' ? `session_${Date.now()}` : 'session_default');
    const [collectedInfo, setCollectedInfo] = useState<string[]>([]);
    const [currentPhase, setCurrentPhase] = useState<keyof typeof PHASE_CONFIG>('discovery');
    const [missingInfo, setMissingInfo] = useState<string[]>([]);
    const [currentContext, setCurrentContext] = useState<AudioContext>({});
    const [generatedAudios, setGeneratedAudios] = useState<string[]>([]);
    const [isPlaying, setIsPlaying] = useState<Record<string, boolean>>({});
    const [showQuickReplies, setShowQuickReplies] = useState(true);

    const [messages, setMessages] = useState<Message[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

    const API_BASE_URL = 'http://localhost:3333';

    // Suggestions de messages rapides dynamiques
    const getQuickReplies = (phase: keyof typeof PHASE_CONFIG, lastAgentMessage?: string) => {
        // Si on a un message de l'agent, analyser pour des suggestions contextuelles
        if (lastAgentMessage) {
            const lowerMessage = lastAgentMessage.toLowerCase();

            // Détection du texte demandé
            if (lowerMessage.includes('quel texte') || lowerMessage.includes('texte')) {
                return [
                    "\"Découvrez nos offres exceptionnelles ce week-end !\"",
                    "\"Bienvenue dans notre nouveau magasin\"",
                    "\"Formation professionnelle en ligne disponible\""
                ];
            }

            // Détection du style avec emojis
            if (lowerMessage.includes('style') && lowerMessage.includes('🎯')) {
                return ["Dynamique 🎯", "Calme 😌", "Pro 💼"];
            }

            // Détection du public avec emojis
            if (lowerMessage.includes('pour qui') && lowerMessage.includes('👦')) {
                return ["Jeunes 👦", "Familles 👨‍👩‍👧", "Pros 👔"];
            }

            // Détection de confirmation
            if (lowerMessage.includes('on génère') || lowerMessage.includes('lance')) {
                return ["Oui, go ! 🚀", "C'est parti ! ✨", "Lance ! 🎵"];
            }
        }

        // Fallback vers les suggestions par phase
        const QUICK_REPLIES = {
            discovery: [
                "Je veux créer une pub radio 📻",
                "\"Mon texte à transformer en audio\"",
                "J'ai un texte de formation 💻"
            ],
            clarification: [
                "Dynamique 🎯",
                "Calme 😌",
                "Pro 💼"
            ],
            generation: [
                "Oui, lance ! 🚀",
                "Go ! ✨",
                "C'est parti ! 🎵"
            ],
            complete: [
                "Nouveau projet ! 🆕",
                "Super, merci ! 🙏",
                "J'adore ! ❤️"
            ]
        };

        return QUICK_REPLIES[phase] || [];
    };

    // Initialisation côté client uniquement
    useEffect(() => {
        setIsClient(true);
        // Pas de message initial, l'agent enverra son message de bienvenue automatiquement
        setMessages([]);

        // Envoyer un message vide pour déclencher le message de bienvenue de l'agent
        setTimeout(() => {
            sendInitialMessage();
        }, 100);
    }, []);

    // Scroll automatique vers le bas
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isClient) {
            scrollToBottom();
        }
    }, [messages, isClient]);

    // Focus sur l'input
    useEffect(() => {
        if (isClient && inputRef.current && !isLoading) {
            inputRef.current.focus();
        }
    }, [isClient, isLoading]);

    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    };

    const handleQuickReply = (text: string) => {
        setTextInput(text);
        setTimeout(() => sendMessage(text), 100);
    };

    const sendInitialMessage = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/audio-agent/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: "",
                    sessionId: sessionId,
                })
            });

            const result = await response.json();
            console.log("📦 Réponse initiale API:", result); // Debug

            if (response.ok && result.success) {
                // Extraire le contenu du message
                let messageContent = '';

                if (result.response) {
                    messageContent = result.response;
                } else if (result.messages && result.messages.length > 0) {
                    messageContent = result.messages[0].content || result.messages[0];
                } else if (result.message) {
                    messageContent = result.message;
                }

                if (messageContent) {
                    const welcomeMessage: Message = {
                        id: Date.now().toString(),
                        content: messageContent,
                        sender: 'agent',
                        timestamp: new Date(),
                        phase: 'discovery'
                    };
                    setMessages([welcomeMessage]);
                }
            }
        } catch (error) {
            console.error('Erreur message initial:', error);
            // Message de fallback
            const fallbackMessage: Message = {
                id: Date.now().toString(),
                content: "🎙️ Salut ! Je suis ton assistant Ekho Studio. Dis-moi directement ton texte à transformer en audio, ou décris ton projet !",
                sender: 'agent',
                timestamp: new Date(),
                phase: 'discovery'
            };
            setMessages([fallbackMessage]);
        }
    };
    const clearConversation = async () => {
        try {
            await fetch(`${API_BASE_URL}/audio-agent/clear-history`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sessionId })
            });

            // Reset local state
            setMessages([{
                id: Date.now().toString(),
                content: "🎙️ Nouvelle conversation ! Qu'est-ce qu'on crée aujourd'hui ?",
                sender: 'agent',
                timestamp: new Date(),
                phase: 'discovery'
            }]);
            setCollectedInfo([]);
            setCurrentPhase('discovery');
            setMissingInfo([]);
            setCurrentContext({});
            setGeneratedAudios([]);
            setIsPlaying({});
            setTextInput('');
            setShowQuickReplies(true);
        } catch (error) {
            console.error('Erreur lors du reset:', error);
        }
    };

    const sendMessage = async (quickReplyText?: string) => {
        const text = quickReplyText || textInput.trim();
        if (!text || isLoading) return;

        // Ajouter le message utilisateur
        const userMessage: Message = {
            id: Date.now().toString(),
            content: text,
            sender: 'user',
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setTextInput('');
        setIsLoading(true);
        setShowQuickReplies(false);

        try {
            const response = await fetch(`${API_BASE_URL}/audio-agent/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: text,
                    sessionId: sessionId,
                })
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const result = await response.json();
            console.log("📦 Réponse API:", result); // Debug

            if (result.success) {
                // Extraire le contenu du message
                let messageContent = '';

                // Vérifier différents formats possibles
                if (result.response) {
                    messageContent = result.response;
                } else if (result.messages && result.messages.length > 0) {
                    // Si les messages sont dans un tableau
                    messageContent = result.messages[0].content || result.messages[0];
                } else if (result.message) {
                    messageContent = result.message;
                }

                if (!messageContent) {
                    console.error("❌ Pas de contenu dans la réponse:", result);
                    throw new Error("Réponse vide de l'API");
                }

                // Extraire l'URL audio si présente
                let audioUrl: string | null = null;

                if (result.audioGenerated) {
                    if (result.audioUrl) {
                        audioUrl = result.audioUrl;
                    } else if (result.audioData?.url) {
                        audioUrl = result.audioData.url;
                    } else if (messageContent) {
                        const urlMatch = messageContent.match(/https?:\/\/[^\s]+\.wav/);
                        if (urlMatch) {
                            audioUrl = urlMatch[0];
                        }
                    }

                    if (audioUrl) {
                        console.log("🎵 Audio URL détectée:", audioUrl);
                        setGeneratedAudios(prev => [...prev, audioUrl as string]);
                    }
                }

                // Ajouter la réponse de l'agent
                const agentMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    content: messageContent,
                    sender: 'agent',
                    timestamp: new Date(),
                    needsMoreInfo: result.needsMoreInfo,
                    missingInfo: result.missingInfo,
                    suggestions: result.suggestions,
                    canProceed: result.canProceed,
                    collectedInfo: result.collectedInfo,
                    conversationLength: result.conversationLength,
                    phase: result.phase,
                    audioUrl: audioUrl || undefined,
                    audioGenerated: result.audioGenerated
                };

                setMessages(prev => [...prev, agentMessage]);

                // Mettre à jour l'état global
                if (result.collectedInfo) {
                    setCollectedInfo(result.collectedInfo);
                }
                if (result.phase && result.phase in PHASE_CONFIG) {
                    setCurrentPhase(result.phase as keyof typeof PHASE_CONFIG);
                }
                if (result.missingInfo) {
                    setMissingInfo(result.missingInfo);
                }
                if (result.context) {
                    setCurrentContext(result.context);
                }

                // Réactiver les quick replies après un délai
                setTimeout(() => setShowQuickReplies(true), 1000);

            } else {
                throw new Error(result.error || 'Erreur inconnue');
            }

        } catch (error: any) {
            console.error('Erreur complète:', error);
            console.error('Message d\'erreur:', error.message);

            // Message d'erreur plus informatif
            const errorMessage: Message = {
                id: (Date.now() + 2).toString(),
                content: `😅 Oups ! J'ai eu un petit problème technique.\n\nDétails: ${error.message}\n\nEssaie de reformuler ta demande ou clique sur "Nouveau projet" pour recommencer.`,
                sender: 'agent',
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, errorMessage]);
            setShowQuickReplies(true);
        } finally {
            setIsLoading(false);
        }
    };
    const formatTime = (date: Date) => {
        if (!isClient) return '';
        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const toggleAudioPlayback = (audioUrl: string) => {
        if (!isClient) return;

        const audio = audioRefs.current[audioUrl];
        if (!audio) return;

        if (isPlaying[audioUrl]) {
            audio.pause();
            setIsPlaying(prev => ({ ...prev, [audioUrl]: false }));
        } else {
            // Pause tous les autres audios
            Object.keys(audioRefs.current).forEach(url => {
                if (url !== audioUrl && audioRefs.current[url]) {
                    audioRefs.current[url].pause();
                }
            });
            setIsPlaying(prev => Object.keys(prev).reduce((acc, key) => {
                acc[key] = key === audioUrl;
                return acc;
            }, {} as Record<string, boolean>));

            audio.play();
        }
    };

    const downloadAudio = async (audioUrl: string, customName?: string) => {
        if (!isClient) return;

        try {
            const finalName = customName || `ekho_audio_${Date.now()}.wav`;
            const link = document.createElement('a');
            link.href = audioUrl;
            link.download = finalName;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            console.log('📥 Téléchargement démarré:', finalName);
        } catch (error) {
            console.error('❌ Erreur lors du téléchargement:', error);
            window.open(audioUrl, '_blank');
        }
    };

    if (!isClient) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-4 flex items-center justify-center">
                <div className="text-white text-lg flex items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Chargement d&apos;Ekho Studio...
                </div>
            </div>
        );
    }

    const phaseConfig = PHASE_CONFIG[currentPhase];
    const PhaseIcon = phaseConfig.icon;

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-4">
            <div className="max-w-6xl mx-auto h-screen flex gap-4">
                {/* Sidebar avec infos collectées */}
                <div className="w-80 flex flex-col gap-4">
                    {/* Header */}
                    <Link href="/" passHref>
                        <Button
                            variant="ghost"
                            className="text-white hover:bg-white/10 w-fit"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Retour à EKHO Studio
                        </Button>
                    </Link>

                    {/* Phase actuelle avec animation */}
                    <Card className={`bg-white/95 backdrop-blur shadow-xl border-2 ${phaseConfig.borderColor} transition-all duration-300`}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <PhaseIcon className="w-5 h-5 animate-pulse" />
                                Étape actuelle
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${phaseConfig.color} transition-all duration-300 transform hover:scale-105`}>
                                <span className="text-lg">{phaseConfig.emoji}</span>
                                <span>{phaseConfig.name}</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-2 font-medium">{phaseConfig.description}</p>
                        </CardContent>
                    </Card>

                    {/* Progress bar */}
                    <div className="bg-white/95 backdrop-blur rounded-lg p-4 shadow-xl">
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="w-4 h-4 text-purple-600" />
                            <span className="text-sm font-semibold text-gray-700">Progression</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${(collectedInfo.length / 5) * 100}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {collectedInfo.length}/5 infos collectées
                        </p>
                    </div>

                    {/* Contexte avec emojis */}
                    {Object.keys(currentContext).length > 0 && (
                        <Card className="bg-white/95 backdrop-blur shadow-xl border-0">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Heart className="w-5 h-5 text-red-500 animate-pulse" />
                                    Ton projet
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {currentContext.projectType && (
                                    <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg transform hover:scale-105 transition-transform">
                                        <span className="text-lg">🎯</span>
                                        <div>
                                            <span className="text-xs font-medium text-blue-800">Type</span>
                                            <p className="text-sm text-blue-700 font-semibold">{currentContext.projectType}</p>
                                        </div>
                                    </div>
                                )}
                                {currentContext.voicePreference && (
                                    <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg transform hover:scale-105 transition-transform">
                                        <span className="text-lg">🎤</span>
                                        <div>
                                            <span className="text-xs font-medium text-purple-800">Voix</span>
                                            <p className="text-sm text-purple-700 font-semibold">{currentContext.voicePreference}</p>
                                        </div>
                                    </div>
                                )}
                                {currentContext.emotionStyle && (
                                    <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg transform hover:scale-105 transition-transform">
                                        <span className="text-lg">✨</span>
                                        <div>
                                            <span className="text-xs font-medium text-green-800">Style</span>
                                            <p className="text-sm text-green-700 font-semibold">{currentContext.emotionStyle}</p>
                                        </div>
                                    </div>
                                )}
                                {currentContext.targetAudience && (
                                    <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg transform hover:scale-105 transition-transform">
                                        <span className="text-lg">👥</span>
                                        <div>
                                            <span className="text-xs font-medium text-orange-800">Public</span>
                                            <p className="text-sm text-orange-700 font-semibold">{currentContext.targetAudience}</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Audios générés avec style amélioré */}
                    {isClient && generatedAudios.length > 0 && (
                        <Card className="bg-white/95 backdrop-blur shadow-xl border-0">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Volume2 className="w-5 h-5 text-purple-600 animate-pulse" />
                                    Tes créations ({generatedAudios.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {generatedAudios.map((audioUrl, index) => {
                                    const audioName = `Audio #${index + 1}`;
                                    return (
                                        <div key={`audio-${audioUrl}-${index}`} className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-2xl">🎵</span>
                                                    <div>
                                                        <span className="text-sm font-bold text-purple-800">
                                                            {audioName}
                                                        </span>
                                                        <p className="text-xs text-gray-600">
                                                            Prêt à écouter !
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => toggleAudioPlayback(audioUrl)}
                                                        className="h-8 px-3 border-purple-300 text-purple-700 hover:bg-purple-100"
                                                    >
                                                        {isPlaying[audioUrl] ? (
                                                            <Pause className="w-3 h-3" />
                                                        ) : (
                                                            <Play className="w-3 h-3" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => downloadAudio(audioUrl)}
                                                        className="h-8 px-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                                                    >
                                                        <Download className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Mini player */}
                                            <audio
                                                ref={el => {
                                                    if (el) audioRefs.current[audioUrl] = el;
                                                }}
                                                src={audioUrl}
                                                onEnded={() => setIsPlaying(prev => ({ ...prev, [audioUrl]: false }))}
                                                onPlay={() => setIsPlaying(prev => ({ ...prev, [audioUrl]: true }))}
                                                onPause={() => setIsPlaying(prev => ({ ...prev, [audioUrl]: false }))}
                                                className="hidden"
                                            />
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    {/* Actions avec style amélioré */}
                    <Card className="bg-white/95 backdrop-blur shadow-xl border-0">
                        <CardContent className="pt-6 space-y-3">
                            <Button
                                onClick={clearConversation}
                                variant="outline"
                                className="w-full text-red-600 border-red-300 hover:bg-red-50 transition-all transform hover:scale-105"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Nouveau projet
                            </Button>

                            {currentPhase === 'generation' && (
                                <Button
                                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg transform hover:scale-105 transition-all"
                                >
                                    <Zap className="w-4 h-4 mr-2 animate-pulse" />
                                    C&apos;est parti !
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Chat Container avec style amélioré */}
                <Card className="flex-1 bg-white/95 backdrop-blur shadow-2xl border-0 flex flex-col overflow-hidden">
                    <CardHeader className="text-center py-4 border-b bg-gradient-to-r from-purple-50 to-pink-50">
                        <div className="flex items-center justify-center gap-3">
                            <div className="p-3 bg-gradient-to-r from-[#667eea] to-[#f093fb] rounded-full shadow-lg animate-pulse">
                                <Mic className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold bg-gradient-to-r from-[#667eea] to-[#f093fb] bg-clip-text text-transparent">
                                    Assistant Audio Ekho Studio
                                </CardTitle>
                                <p className="text-sm text-gray-600">
                                    {messages.length - 1} échanges • Session {sessionId.slice(-6)}
                                </p>
                            </div>
                        </div>
                    </CardHeader>

                    {/* Messages Area */}
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                            >
                                <div className={`flex items-start gap-3 max-w-[80%] ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {/* Avatar avec animation */}
                                    <div className={`p-2 rounded-full shadow-md transform transition-transform hover:scale-110 ${
                                        message.sender === 'user'
                                            ? 'bg-gradient-to-r from-blue-500 to-purple-500'
                                            : 'bg-gradient-to-r from-purple-500 to-pink-500'
                                    }`}>
                                        {message.sender === 'user' ? (
                                            <User className="w-4 h-4 text-white" />
                                        ) : (
                                            <Bot className="w-4 h-4 text-white" />
                                        )}
                                    </div>

                                    {/* Message Bubble avec style amélioré */}
                                    <div className={`rounded-2xl px-4 py-3 shadow-sm transition-all hover:shadow-md ${
                                        message.sender === 'user'
                                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                                            : 'bg-white border border-gray-200 text-gray-800'
                                    }`}>
                                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                            {message.content}
                                        </div>

                                        {/* Audio intégré avec style fun */}
                                        {message.audioUrl && (
                                            <div className="mt-3 p-3 bg-white/20 rounded-lg backdrop-blur">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Volume2 className="w-4 h-4 animate-pulse" />
                                                    <span className="text-xs font-bold">🎉 Audio généré !</span>
                                                </div>
                                                <audio
                                                    controls
                                                    src={message.audioUrl}
                                                    className="w-full h-8"
                                                    style={{
                                                        colorScheme: message.sender === 'user' ? 'dark' : 'light',
                                                        accentColor: '#8b5cf6'
                                                    }}
                                                >
                                                    Votre navigateur ne supporte pas l&apos;audio HTML5.
                                                </audio>
                                            </div>
                                        )}

                                        {/* Timestamp */}
                                        <div className={`mt-2 text-xs ${
                                            message.sender === 'user' ? 'opacity-70' : 'text-gray-500'
                                        }`}>
                                            {formatTime(message.timestamp)}
                                            {message.conversationLength && ` • ${message.conversationLength} messages`}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex justify-start animate-fadeIn">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-md">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="text-sm">L&apos;assistant réfléchit...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </CardContent>

                    {/* Quick Replies */}
                    {showQuickReplies && !isLoading && isClient && (
                        <div className="px-4 py-2 border-t bg-gradient-to-r from-purple-50 to-pink-50">
                            <div className="flex flex-wrap gap-2">
                                {getQuickReplies(
                                    currentPhase,
                                    messages[messages.length - 1]?.sender === 'agent'
                                        ? messages[messages.length - 1]?.content
                                        : undefined
                                ).map((reply, index) => (
                                    <Button
                                        key={`quick-${currentPhase}-${index}`}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleQuickReply(reply)}
                                        className="text-xs border-purple-300 text-purple-700 hover:bg-purple-100 transition-all transform hover:scale-105"
                                    >
                                        {reply}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="p-4 border-t bg-white">
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <Input
                                    ref={inputRef}
                                    type="text"
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                                                        placeholder="Ex: Pub radio professionnelle pour entreprise, texte: 'Découvrez nos services...'"
                                    className="pr-12 h-12 text-base bg-white border-gray-300 focus:border-purple-500 focus:ring-purple-500 rounded-full transition-all"
                                    disabled={isLoading}
                                />
                            </div>
                            <Button
                                onClick={() => sendMessage()}
                                disabled={isLoading || !textInput.trim()}
                                size="icon"
                                className="h-12 w-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full flex-shrink-0 shadow-lg transform hover:scale-105 transition-all"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <Send className="h-5 w-5" />
                                )}
                            </Button>
                        </div>

                        <div className="mt-2 text-center">
                            <p className="text-xs text-gray-500">
                                {currentPhase === 'discovery' && "✨ Commence par me dire ton idée !"}
                                {currentPhase === 'clarification' && "💬 L'assistant collecte les infos..."}
                                {currentPhase === 'generation' && "🚀 Prêt pour la génération !"}
                                {currentPhase === 'complete' && "🎉 Ton audio est créé !"}
                                {" • Appuie sur Entrée pour envoyer"}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}