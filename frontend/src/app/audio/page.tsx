"use client"

import React, { useState } from 'react';
import { Loader2, Send, Mic, Volume2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function AudioPage() {
    const [textInput, setTextInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });
    const [audioUrl, setAudioUrl] = useState('');
    const [showAudioControls, setShowAudioControls] = useState(false);

    const API_BASE_URL = 'http://localhost:3333';

    const showStatus = (message: string, type: string) => {
        setStatus({ message, type });

        if (type !== 'loading') {
            setTimeout(() => {
                setStatus({ message: '', type: '' });
            }, 5000);
        }
    };

    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            sendRequest();
        }
    };

    const sendRequest = async () => {
        const text = textInput.trim();

        if (!text) {
            showStatus('Écris quelque chose d\'abord !', 'error');
            return;
        }

        setIsLoading(true);
        showStatus('Traitement en cours...', 'loading');
        setShowAudioControls(false);

        try {
            const response = await fetch(`${API_BASE_URL}/audio-agent/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: text,
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
                if (result.canProceed && result.response.includes('http')) {
                    const audioUrlMatch = result.response.match(/https?:\/\/[^\s]+\.(wav|mp3|ogg)/);
                    if (audioUrlMatch) {
                        const extractedAudioUrl = audioUrlMatch[0];
                        setAudioUrl(extractedAudioUrl);
                        setShowAudioControls(true);
                        showStatus('Audio généré avec succès ! 🎉', 'success');
                    } else {
                        showStatus(result.response, 'success');
                    }
                } else {
                    showStatus(result.response, 'success');
                    if (result.suggestions && result.suggestions.length > 0) {
                        showStatus('Suggestions: ' + result.suggestions.join(', '), 'success');
                    }
                }
            } else {
                throw new Error(result.error || 'Erreur inconnue');
            }

            setTextInput('');

        } catch (error: any) {
            console.error('Erreur:', error);
            showStatus(`Erreur: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-4 sm:p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header avec navigation */}
                <div className="mb-6">
                    <Link href="/" passHref>
                        <Button
                            variant="ghost"
                            className="text-white hover:bg-white/10 mb-4"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Retour à EKHO Studio
                        </Button>
                    </Link>
                </div>

                {/* Carte principale */}
                <Card className="w-full bg-white/95 backdrop-blur shadow-2xl border-0">
                    <CardHeader className="text-center space-y-2">
                        <div className="flex justify-center mb-4">
                            <div className="p-4 bg-gradient-to-r from-[#667eea] to-[#f093fb] rounded-full">
                                <Mic className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        <CardTitle className="text-3xl font-bold bg-gradient-to-r from-[#667eea] to-[#f093fb] bg-clip-text text-transparent">
                            🎵 Interface Audio
                        </CardTitle>
                        <p className="text-gray-600">Créez des voix off professionnelles instantanément</p>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="relative">
                                <Input
                                    type="text"
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Tape ta demande ici..."
                                    className="pr-12 h-12 text-base bg-white border-gray-300 focus:border-[#667eea] focus:ring-[#667eea]"
                                    disabled={isLoading}
                                />
                                <Button
                                    onClick={sendRequest}
                                    disabled={isLoading}
                                    size="icon"
                                    className="absolute right-1 top-1 h-10 w-10 bg-gradient-to-r from-[#667eea] to-[#f093fb] hover:opacity-90 text-white"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        {status.message && (
                            <div
                                className={`p-4 rounded-lg text-center font-medium transition-all duration-300 ${
                                    status.type === 'success'
                                        ? 'bg-green-50 text-green-700 border border-green-200'
                                        : status.type === 'error'
                                            ? 'bg-red-50 text-red-700 border border-red-200'
                                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                            >
                                {status.type === 'loading' && (
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>{status.message}</span>
                                    </div>
                                )}
                                {status.type !== 'loading' && status.message}
                            </div>
                        )}

                        {showAudioControls && (
                            <div className="space-y-4">
                                <div className="p-4 bg-gradient-to-r from-[#667eea]/10 to-[#f093fb]/10 rounded-lg border border-[#667eea]/20">
                                    <div className="flex items-center gap-3 mb-3">
                                        <Volume2 className="h-5 w-5 text-[#667eea]" />
                                        <span className="font-semibold text-gray-700">Audio généré</span>
                                    </div>
                                    <audio
                                        controls
                                        src={audioUrl}
                                        className="w-full"
                                        style={{ colorScheme: 'light' }}
                                    >
                                        Ton navigateur ne supporte pas l'audio HTML5.
                                    </audio>
                                </div>
                            </div>
                        )}

                        <div className="text-center text-sm text-gray-500 pt-2">
                            <p>Astuce: Appuie sur Entrée pour envoyer ta demande rapidement</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}