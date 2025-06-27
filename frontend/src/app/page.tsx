"use client"

import React from 'react';
import { Mic, MessageCircle, Sparkles, Zap, Heart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

const HomePage = () => {
  return (
      <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header Hero */}
          <div className="text-center space-y-6 py-12">
            <div className="flex justify-center mb-6">
              <div className="p-6 bg-white/10 backdrop-blur rounded-full shadow-2xl animate-pulse">
                <Mic className="w-16 h-16 text-white" />
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold">
              EKHO Studio
              <span className="text-2xl ml-2">✨</span>
            </h1>
            <p className="text-xl sm:text-2xl text-white/90 max-w-3xl mx-auto">
              Crée des voix off professionnelles en discutant simplement avec notre IA
            </p>
            <div className="flex items-center justify-center gap-2 text-lg">
              <Zap className="w-5 h-5 text-yellow-300" />
              <span>Rapide</span>
              <span className="mx-2">•</span>
              <Heart className="w-5 h-5 text-red-400" />
              <span>Intuitif</span>
              <span className="mx-2">•</span>
              <Sparkles className="w-5 h-5 text-blue-300" />
              <span>Magique</span>
            </div>
          </div>

          {/* Main Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Option 1: Assistant Conversationnel */}
            <Card className="bg-white/95 backdrop-blur shadow-2xl border-0 transform hover:scale-105 transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-gray-900 text-2xl">
                  <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-lg">
                    <MessageCircle className="text-white w-6 h-6" />
                  </div>
                  Assistant IA Conversationnel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-700 text-lg">
                  💬 <strong>La meilleure expérience !</strong> Discute naturellement avec notre IA qui te guide pas à pas.
                </p>

                <div className="space-y-3 bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-900">Comment ça marche ?</h4>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-lg">1️⃣</span>
                      <span>Dis simplement ce que tu veux créer</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-lg">2️⃣</span>
                      <span>L'IA te pose quelques questions fun</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-lg">3️⃣</span>
                      <span>Ton audio est généré en quelques secondes !</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    <strong>✨ Parfait pour :</strong> Publicités, podcasts, formations, documentaires, présentations...
                  </p>
                </div>

                <Link href="/audio" passHref>
                  <Button
                      size="lg"
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg transform hover:scale-105 transition-all group"
                  >
                    <MessageCircle className="mr-2 h-5 w-5" />
                    Commencer une conversation
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Option 2: Génération Classique */}
            <Card className="bg-white/95 backdrop-blur shadow-2xl border-0 transform hover:scale-105 transition-all duration-300 opacity-90">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-gray-900 text-2xl">
                  <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full shadow-lg">
                    <Mic className="text-white w-6 h-6" />
                  </div>
                  Interface Classique
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-700 text-lg">
                  🎙️ L'approche traditionnelle avec des formulaires et des options.
                </p>

                <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800">Fonctionnalités :</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <span>📝</span> Remplir des formulaires
                    </li>
                    <li className="flex items-center gap-2">
                      <span>🎚️</span> Choisir parmi des options prédéfinies
                    </li>
                    <li className="flex items-center gap-2">
                      <span>⚙️</span> Paramètres techniques avancés
                    </li>
                  </ul>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-sm text-orange-800">
                    <strong>⚡ Note :</strong> Plus technique, moins fun que l'assistant IA
                  </p>
                </div>

                <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                    disabled
                >
                  <Mic className="mr-2 h-5 w-5" />
                  Bientôt disponible
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Features Section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
            <Card className="bg-white/10 backdrop-blur border-white/20 text-white">
              <CardContent className="pt-6 text-center">
                <div className="p-3 bg-white/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Zap className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-lg mb-2">Ultra Rapide</h3>
                <p className="text-sm text-white/80">
                  Génération en moins de 30 secondes
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20 text-white">
              <CardContent className="pt-6 text-center">
                <div className="p-3 bg-white/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Heart className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-lg mb-2">Super Simple</h3>
                <p className="text-sm text-white/80">
                  Aucune compétence technique requise
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20 text-white">
              <CardContent className="pt-6 text-center">
                <div className="p-3 bg-white/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-lg mb-2">Qualité Pro</h3>
                <p className="text-sm text-white/80">
                  Voix naturelles et expressives
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Footer CTA */}
          <div className="text-center py-12">
            <p className="text-xl mb-6 text-white/90">
              Prêt(e) à créer quelque chose d'incroyable ? 🚀
            </p>
            <Link href="/audio" passHref>
              <Button
                  size="lg"
                  className="bg-white text-purple-700 hover:bg-white/90 shadow-xl transform hover:scale-110 transition-all px-8 py-6 text-lg font-bold"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Essayer maintenant
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
  );
}

export default HomePage;