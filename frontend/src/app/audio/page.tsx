"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Send, Mic, Volume2, ArrowLeft, User, Bot, Trash2, CheckCircle, Clock, Target } from 'lucide-react';
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
    phase?: 'discovery' | 'clarification' | 'generation' | 'complete';
}

const PHASE_CONFIG = {
    discovery: {
        name: 'Découverte',
        color: 'bg-blue-100 text-blue-800',
        icon: Target,
        description: 'Exploration du projet'
    },
    clarification: {
        name: 'Clarification',
        color: 'bg-orange-100 text-orange-800',
        icon: Clock,
        description: 'Collecte des détails'
    },
    generation: {
        name: 'Génération',
        color: 'bg-green-100 text-green-800',
        icon: Mic,
        description: 'Prêt à créer'
    },
    complete: {
        name: 'Terminé',
        color: 'bg-purple-100 text-purple-800',
        icon: CheckCircle,
        description: 'Toutes infos collectées'
    }
};

export default function AudioPage() {
    const [textInput, setTextInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            content: "🎙️ Bonjour ! Je suis votre assistant audio professionnel d'Ekho Studio.\n\nJe vais vous accompagner étape par étape pour créer un contenu audio parfaitement adapté à vos besoins.\n\nPour commencer, parlez-moi de votre projet : quel type de contenu audio souhaitez-vous créer ?",
            sender: 'agent',
            timestamp: new Date(),
            phase: 'discovery'
        }
    ]);
    const [sessionId] = useState(() => `session_${Date.now()}`);
    const [audioUrl, setAudioUrl] = useState('');
    const [showAudioControls, setShowAudioControls] = useState(false);
    const [collectedInfo, setCollectedInfo] = useState<string[]>([]);
    const [currentPhase, setCurrentPhase] = useState<'discovery' | 'clarification' | 'generation' | 'complete'>('discovery');
    const [missingInfo, setMissingInfo] = useState<string[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const API_BASE_URL = 'http://localhost:3333';

    // Scroll automatique vers le bas
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Focus sur l'input
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
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
                content: "🎙️ Nouvelle conversation démarrée ! Comment puis-je vous aider avec votre projet audio aujourd'hui ?",
                sender: 'agent',
                timestamp: new Date(),
                phase: 'discovery'
            }]);
            setCollectedInfo([]);
            setCurrentPhase('discovery');
            setMissingInfo([]);
            setShowAudioControls(false);
            setTextInput('');
        } catch (error) {
            console.error('Erreur lors du reset:', error);
        }
    };

    const sendMessage = async () => {
        const text = textInput.trim();
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
        setShowAudioControls(false);

        try {
            const response = await fetch(`${API_BASE_URL}/audio-agent/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: text,
                    sessionId: sessionId,
                    context: {
                        targetAudience: "général",
                        style: "narratif",
                        emotion: "neutre"
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                // Ajouter la réponse de l'agent
                const agentMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    content: result.response,
                    sender: 'agent',
                    timestamp: new Date(),
                    needsMoreInfo: result.needsMoreInfo,
                    missingInfo: result.missingInfo,
                    suggestions: result.suggestions,
                    canProceed: result.canProceed,
                    collectedInfo: result.collectedInfo,
                    conversationLength: result.conversationLength,
                    phase: result.phase
                };

                setMessages(prev => [...prev, agentMessage]);

                // Mettre à jour l'état global
                if (result.collectedInfo) {
                    setCollectedInfo(result.collectedInfo);
                }
                if (result.phase) {
                    setCurrentPhase(result.phase);
                }
                if (result.missingInfo) {
                    setMissingInfo(result.missingInfo);
                }

                // Vérifier si un fichier audio est généré
                if (result.canProceed && result.response.includes('http')) {
                    const audioUrlMatch = result.response.match(/https?:\/\/[^\s]+\.(wav|mp3|ogg)/);
                    if (audioUrlMatch) {
                        setAudioUrl(audioUrlMatch[0]);
                        setShowAudioControls(true);
                    }
                }
            } else {
                throw new Error(result.error || 'Erreur inconnue');
            }

        } catch (error: any) {
            console.error('Erreur:', error);

            // Ajouter un message d'erreur
            const errorMessage: Message = {
                id: (Date.now() + 2).toString(),
                content: `❌ Désolé, j'ai rencontré un problème technique. Pouvez-vous reformuler votre demande ?\n\nErreur: ${error.message}`,
                sender: 'agent',
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

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

                    {/* Phase actuelle */}
                    <Card className="bg-white/95 backdrop-blur shadow-xl border-0">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <PhaseIcon className="w-5 h-5" />
                                Phase actuelle
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium ${phaseConfig.color}`}>
                                <PhaseIcon className="w-4 h-4" />
                                <span>{phaseConfig.name}</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-2">{phaseConfig.description}</p>
                        </CardContent>
                    </Card>

                    {/* Infos collectées */}
                    <Card className="bg-white/95 backdrop-blur shadow-xl border-0">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                Informations collectées
                                <span className="text-sm font-normal text-gray-500">
                                    ({collectedInfo.length}/5)
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {collectedInfo.length > 0 ? (
                                collectedInfo.map((info, index) => (
                                    <div key={index} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border-l-4 border-green-400">
                                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                        <span className="text-sm text-green-800 font-medium">{info}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 text-gray-500">
                                    <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Aucune information collectée pour le moment</p>
                                </div>
                            )}

                            {/* Infos manquantes */}
                            {missingInfo.length > 0 && (
                                <div className="pt-3 border-t">
                                    <p className="text-sm font-semibold text-gray-700 mb-2">Encore nécessaire :</p>
                                    {missingInfo.map((info, index) => (
                                        <div key={index} className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg border-l-4 border-orange-400 mb-2">
                                            <Clock className="w-4 h-4 text-orange-600 flex-shrink-0" />
                                            <span className="text-sm text-orange-800">{info}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <Card className="bg-white/95 backdrop-blur shadow-xl border-0">
                        <CardContent className="pt-6 space-y-3">
                            <Button
                                onClick={clearConversation}
                                variant="outline"
                                className="w-full text-red-600 border-red-300 hover:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Nouvelle conversation
                            </Button>

                            {currentPhase === 'generation' && (
                                <Button
                                    className="w-full bg-gradient-to-r from-[#667eea] to-[#f093fb] hover:opacity-90 text-white"
                                >
                                    <Mic className="w-4 h-4 mr-2" />
                                    Prêt à générer !
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Chat Container */}
                <Card className="flex-1 bg-white/95 backdrop-blur shadow-2xl border-0 flex flex-col">
                    <CardHeader className="text-center py-4 border-b">
                        <div className="flex items-center justify-center gap-3">
                            <div className="p-2 bg-gradient-to-r from-[#667eea] to-[#f093fb] rounded-full">
                                <Mic className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold bg-gradient-to-r from-[#667eea] to-[#f093fb] bg-clip-text text-transparent">
                                    Assistant Audio Ekho Studio
                                </CardTitle>
                                <p className="text-sm text-gray-600">
                                    Session: {sessionId.slice(-8)}... • {messages.length - 1} messages
                                </p>
                            </div>
                        </div>
                    </CardHeader>

                    {/* Messages Area */}
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`flex items-start gap-3 max-w-[80%] ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {/* Avatar */}
                                    <div className={`p-2 rounded-full ${
                                        message.sender === 'user'
                                            ? 'bg-[#667eea]'
                                            : 'bg-gradient-to-r from-[#f093fb] to-[#667eea]'
                                    }`}>
                                        {message.sender === 'user' ? (
                                            <User className="w-4 h-4 text-white" />
                                        ) : (
                                            <Bot className="w-4 h-4 text-white" />
                                        )}
                                    </div>

                                    {/* Message Bubble */}
                                    <div className={`rounded-2xl px-4 py-3 ${
                                        message.sender === 'user'
                                            ? 'bg-[#667eea] text-white'
                                            : 'bg-gray-100 text-gray-800'
                                    }`}>
                                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                            {message.content}
                                        </div>

                                        {/* Phase indicator pour l'agent */}
                                        {message.sender === 'agent' && message.phase && (
                                            <div className="mt-3 flex items-center gap-2">
                                                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${PHASE_CONFIG[message.phase].color}`}>
                                                    {React.createElement(PHASE_CONFIG[message.phase].icon, { className: "w-3 h-3" })}
                                                    <span>{PHASE_CONFIG[message.phase].name}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Informations manquantes */}
                                        {message.sender === 'agent' && message.missingInfo && message.missingInfo.length > 0 && (
                                            <div className="mt-3 p-3 bg-orange-50 rounded-lg border-l-4 border-orange-400">
                                                <p className="text-xs font-semibold text-orange-800 mb-2">
                                                    📋 Encore besoin de :
                                                </p>
                                                <ul className="text-xs text-orange-700 space-y-1">
                                                    {message.missingInfo.map((info, index) => (
                                                        <li key={index}>• {info}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Suggestions */}
                                        {message.sender === 'agent' && message.suggestions && message.suggestions.length > 0 && (
                                            <div className="mt-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                                                <p className="text-xs font-semibold text-blue-800 mb-2">
                                                    💡 Conseils :
                                                </p>
                                                <ul className="text-xs text-blue-700 space-y-1">
                                                    {message.suggestions.map((suggestion, index) => (
                                                        <li key={index}>• {suggestion}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Infos sur la conversation */}
                                        {message.sender === 'agent' && message.conversationLength && (
                                            <div className="mt-2 text-xs text-gray-500">
                                                💾 {message.conversationLength} messages • {formatTime(message.timestamp)}
                                            </div>
                                        )}

                                        {message.sender === 'user' && (
                                            <div className="mt-2 text-xs opacity-70">
                                                {formatTime(message.timestamp)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-full bg-gradient-to-r from-[#f093fb] to-[#667eea]">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="bg-gray-100 rounded-2xl px-4 py-3">
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="text-sm">L'assistant analyse votre demande...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </CardContent>

                    {/* Audio Controls */}
                    {showAudioControls && (
                        <div className="px-4 py-3 border-t bg-gradient-to-r from-[#667eea]/10 to-[#f093fb]/10">
                            <div className="flex items-center gap-3">
                                <Volume2 className="h-5 w-5 text-[#667eea]" />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-700 mb-2">🎵 Audio généré avec succès !</p>
                                    <audio
                                        controls
                                        src={audioUrl}
                                        className="w-full h-8"
                                        style={{ colorScheme: 'light' }}
                                    >
                                        Votre navigateur ne supporte pas l'audio HTML5.
                                    </audio>
                                </div>
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
                                    placeholder={
                                        currentPhase === 'discovery'
                                            ? "Décrivez votre projet audio..."
                                            : currentPhase === 'clarification'
                                                ? "Répondez à la question de l'assistant..."
                                                : currentPhase === 'generation'
                                                    ? "Confirmez ou ajustez avant génération..."
                                                    : "Tapez votre message..."
                                    }
                                    className="pr-12 h-12 text-base bg-white border-gray-300 focus:border-[#667eea] focus:ring-[#667eea] rounded-full"
                                    disabled={isLoading}
                                />
                            </div>
                            <Button
                                onClick={sendMessage}
                                disabled={isLoading || !textInput.trim()}
                                size="icon"
                                className="h-12 w-12 bg-gradient-to-r from-[#667eea] to-[#f093fb] hover:opacity-90 text-white rounded-full flex-shrink-0"
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
                                {currentPhase === 'discovery' && "Commencez par décrire votre projet audio"}
                                {currentPhase === 'clarification' && "L'assistant collecte les informations nécessaires"}
                                {currentPhase === 'generation' && "Prêt pour la génération ! Confirmez ou ajustez"}
                                {currentPhase === 'complete' && "Toutes les informations sont collectées"}
                                {" • Appuyez sur Entrée pour envoyer"}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}