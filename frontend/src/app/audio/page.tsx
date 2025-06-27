"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Send, Mic, Volume2, ArrowLeft, User, Bot, Trash2, CheckCircle, Clock, Target, Download, Play, Pause } from 'lucide-react';
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
        description: 'Audio généré'
    }
};

export default function AudioPage() {
    // État pour éviter l'hydratation mismatch
    const [isClient, setIsClient] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId] = useState(() => typeof window !== 'undefined' ? `session_${Date.now()}` : 'session_default');
    const [collectedInfo, setCollectedInfo] = useState<string[]>([]);
    const [currentPhase, setCurrentPhase] = useState<'discovery' | 'clarification' | 'generation' | 'complete'>('discovery');
    const [missingInfo, setMissingInfo] = useState<string[]>([]);
    const [currentContext, setCurrentContext] = useState<AudioContext>({});
    const [generatedAudios, setGeneratedAudios] = useState<string[]>([]);
    const [isPlaying, setIsPlaying] = useState<Record<string, boolean>>({});

    // Messages initialisés côté client seulement
    const [messages, setMessages] = useState<Message[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

    const API_BASE_URL = 'http://localhost:3333';

    // Fonction helper pour obtenir la config de phase de manière sécurisée
    const getPhaseConfig = (phase: string | undefined) => {
        if (!phase) return PHASE_CONFIG.discovery;

        const validPhases = ['discovery', 'clarification', 'generation', 'complete'] as const;
        const typedPhase = phase as keyof typeof PHASE_CONFIG;

        if (validPhases.includes(typedPhase)) {
            return PHASE_CONFIG[typedPhase];
        }

        console.warn(`Phase inconnue: ${phase}, utilisation de discovery par défaut`);
        return PHASE_CONFIG.discovery;
    };

    // Fonction helper pour valider et normaliser les phases
    const normalizePhase = (phase: string | undefined): 'discovery' | 'clarification' | 'generation' | 'complete' => {
        if (!phase) return 'discovery';

        const validPhases = ['discovery', 'clarification', 'generation', 'complete'] as const;
        const lowerPhase = phase.toLowerCase();

        // Mapping pour les variations courantes
        const phaseMapping: Record<string, typeof validPhases[number]> = {
            'step_1': 'discovery',
            'step_2': 'clarification',
            'step_3': 'clarification',
            'step_4': 'clarification',
            'step_5': 'generation',
            'error': 'clarification',
            'complete': 'complete',
            'discovery': 'discovery',
            'clarification': 'clarification',
            'generation': 'generation'
        };

        if (phaseMapping[lowerPhase]) {
            return phaseMapping[lowerPhase];
        }

        // Si ça commence par "step_", c'est probablement une phase de clarification
        if (lowerPhase.startsWith('step_')) {
            const stepNumber = parseInt(lowerPhase.replace('step_', ''));
            if (stepNumber === 1) return 'discovery';
            if (stepNumber >= 2 && stepNumber <= 4) return 'clarification';
            if (stepNumber >= 5) return 'generation';
        }

        console.warn(`Phase non reconnue: ${phase}, utilisation de discovery par défaut`);
        return 'discovery';
    };

    // Initialisation côté client uniquement
    useEffect(() => {
        setIsClient(true);
        setMessages([{
            id: '1',
            content: "🎙️ Bonjour ! Je suis votre assistant audio professionnel d'Ekho Studio.\n\nJe vais vous aider à créer votre audio professionnel en 5 étapes simples.\n\nPour commencer, parlez-moi de votre projet : quel type de contenu audio souhaitez-vous créer ?",
            sender: 'agent',
            timestamp: new Date(),
            phase: 'discovery'
        }]);
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
        if (isClient && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isClient]);

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
            setCurrentContext({});
            setGeneratedAudios([]);
            setIsPlaying({});
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

            if (result.success) {
                // Extraire l'URL audio de la réponse si présente
                let audioUrl = null;
                if (result.audioGenerated && result.audioUrl) {
                    audioUrl = result.audioUrl;
                    setGeneratedAudios(prev => [...prev, audioUrl]);
                } else if (result.response && typeof result.response === 'string') {
                    // Chercher une URL d'audio dans le texte de réponse
                    const audioUrlMatch = result.response.match(/https?:\/\/[^\s]+\/audio\/[^\s]+\.(wav|mp3|ogg)/);
                    if (audioUrlMatch) {
                        audioUrl = audioUrlMatch[0];
                        setGeneratedAudios(prev => [...prev, audioUrl]);
                    }
                }

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
                    phase: result.phase,
                    audioUrl: audioUrl,
                    audioGenerated: result.audioGenerated
                };

                setMessages(prev => [...prev, agentMessage]);

                // Mettre à jour l'état global avec validation robuste
                if (result.collectedInfo) {
                    setCollectedInfo(result.collectedInfo);
                }
                if (result.phase) {
                    const normalizedPhase = normalizePhase(result.phase);
                    setCurrentPhase(normalizedPhase);
                }
                if (result.missingInfo) {
                    setMissingInfo(result.missingInfo);
                }
                if (result.context) {
                    setCurrentContext(result.context);
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
            // Extraire le nom du fichier de l'URL
            const urlParts = audioUrl.split('/');
            const fileName = urlParts[urlParts.length - 1];
            const finalName = customName || `ekho_audio_${Date.now()}.wav`;

            // Créer un lien de téléchargement
            const link = document.createElement('a');
            link.href = audioUrl;
            link.download = finalName;
            link.target = '_blank';

            // Forcer le téléchargement
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log('📥 Téléchargement démarré:', finalName);
        } catch (error) {
            console.error('❌ Erreur lors du téléchargement:', error);
            // Fallback: ouvrir dans un nouvel onglet
            window.open(audioUrl, '_blank');
        }
    };

    // Ne pas rendre le contenu tant que l'hydratation n'est pas terminée
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

    const phaseConfig = getPhaseConfig(currentPhase);
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

                    {/* Contexte détecté */}
                    {Object.keys(currentContext).length > 0 && (
                        <Card className="bg-white/95 backdrop-blur shadow-xl border-0">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-blue-600" />
                                    Contexte détecté
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {currentContext.projectType && (
                                    <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                                        <span className="text-sm font-medium text-blue-800">Type:</span>
                                        <span className="text-sm text-blue-700">{currentContext.projectType}</span>
                                    </div>
                                )}
                                {currentContext.voicePreference && (
                                    <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                                        <span className="text-sm font-medium text-purple-800">Voix:</span>
                                        <span className="text-sm text-purple-700">{currentContext.voicePreference}</span>
                                    </div>
                                )}
                                {currentContext.emotionStyle && (
                                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                                        <span className="text-sm font-medium text-green-800">Style:</span>
                                        <span className="text-sm text-green-700">{currentContext.emotionStyle}</span>
                                    </div>
                                )}
                                {currentContext.targetAudience && (
                                    <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                                        <span className="text-sm font-medium text-orange-800">Public:</span>
                                        <span className="text-sm text-orange-700">{currentContext.targetAudience}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

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

                    {/* Audios générés */}
                    {isClient && generatedAudios.length > 0 && (
                        <Card className="bg-white/95 backdrop-blur shadow-xl border-0">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Volume2 className="w-5 h-5 text-purple-600" />
                                    Audios générés ({generatedAudios.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {generatedAudios.map((audioUrl, index) => {
                                    const audioName = `Audio #${index + 1}`;
                                    const timestamp = new Date().toLocaleString('fr-FR');

                                    return (
                                        <div key={`audio-${audioUrl}-${index}`} className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <span className="text-sm font-semibold text-purple-800">
                                                        {audioName}
                                                    </span>
                                                    <p className="text-xs text-gray-600 mt-1">
                                                        Créé le {timestamp}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => toggleAudioPlayback(audioUrl)}
                                                        className="h-8 px-3 border-purple-300 text-purple-700 hover:bg-purple-100"
                                                    >
                                                        {isPlaying[audioUrl] ? (
                                                            <>
                                                                <Pause className="w-3 h-3 mr-1" />
                                                                Pause
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Play className="w-3 h-3 mr-1" />
                                                                Lire
                                                            </>
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => downloadAudio(audioUrl, `ekho_${audioName.toLowerCase().replace(/\s/g, '_')}_${Date.now()}.wav`)}
                                                        className="h-8 px-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                                                    >
                                                        <Download className="w-3 h-3 mr-1" />
                                                        Télécharger
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Lecteur audio */}
                                            <div className="bg-white rounded-lg p-3 border border-purple-200">
                                                <audio
                                                    ref={el => {
                                                        if (el) audioRefs.current[audioUrl] = el;
                                                    }}
                                                    src={audioUrl}
                                                    onEnded={() => setIsPlaying(prev => ({ ...prev, [audioUrl]: false }))}
                                                    onPlay={() => setIsPlaying(prev => ({ ...prev, [audioUrl]: true }))}
                                                    onPause={() => setIsPlaying(prev => ({ ...prev, [audioUrl]: false }))}
                                                    className="w-full h-8"
                                                    controls
                                                    controlsList="nodownload noplaybackrate"
                                                    style={{
                                                        colorScheme: 'light',
                                                        accentColor: '#9333ea'
                                                    }}
                                                >
                                                    Votre navigateur ne supporte pas l&apos;audio HTML5.
                                                </audio>

                                                {/* Métadonnées de l'audio */}
                                                <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                                                    <div className="flex items-center gap-4">
                                                        <span>📁 Format: WAV</span>
                                                        <span>🎵 Qualité: Haute</span>
                                                        <span>🔊 Prêt à télécharger</span>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => downloadAudio(audioUrl, `ekho_${audioName.toLowerCase().replace(/\s/g, '_')}_${Date.now()}.wav`)}
                                                        className="h-6 px-2 text-purple-600 hover:text-purple-800 hover:bg-purple-100"
                                                    >
                                                        <Download className="w-3 h-3 mr-1" />
                                                        WAV
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Bouton pour télécharger tous les audios */}
                                {generatedAudios.length > 1 && (
                                    <div className="pt-3 border-t border-purple-200">
                                        <Button
                                            onClick={() => {
                                                generatedAudios.forEach((audioUrl, index) => {
                                                    setTimeout(() => {
                                                        downloadAudio(audioUrl, `ekho_audio_${index + 1}_${Date.now()}.wav`);
                                                    }, index * 500);
                                                });
                                            }}
                                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            Télécharger tous les audios ({generatedAudios.length})
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

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

                                        {/* Audio intégré dans le message */}
                                        {message.audioUrl && (
                                            <div className="mt-3 p-3 bg-white/20 rounded-lg">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Volume2 className="w-4 h-4" />
                                                    <span className="text-xs font-medium">Audio généré</span>
                                                </div>
                                                <audio
                                                    controls
                                                    src={message.audioUrl}
                                                    className="w-full h-8"
                                                    style={{ colorScheme: message.sender === 'user' ? 'dark' : 'light' }}
                                                >
                                                    Votre navigateur ne supporte pas l&apos;audio HTML5.
                                                </audio>
                                            </div>
                                        )}

                                        {/* Phase indicator pour l'agent */}
                                        {message.sender === 'agent' && message.phase && (
                                            <div className="mt-3 flex items-center gap-2">
                                                {(() => {
                                                    const phase = message.phase as keyof typeof PHASE_CONFIG;
                                                    const config = PHASE_CONFIG[phase] || PHASE_CONFIG.discovery;

                                                    return (
                                                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                                                            {React.createElement(config.icon, { className: "w-3 h-3" })}
                                                            <span>{config.name}</span>
                                                        </div>
                                                    );
                                                })()}
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
                            <div className="flex justify-start">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-full bg-gradient-to-r from-[#f093fb] to-[#667eea]">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="bg-gray-100 rounded-2xl px-4 py-3">
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="text-sm">L&apos;assistant analyse votre demande...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </CardContent>

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