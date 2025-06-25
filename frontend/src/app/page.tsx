"use client"

import React, { useState } from 'react';
import { Mic, Play, Download, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

const VoiceoverGenerator = () => {
  const [prompt, setPrompt] = useState('');
  const [voiceType, setVoiceType] = useState('');
  const [tone, setTone] = useState('');
  const [audience, setAudience] = useState('');
  const [duration, setDuration] = useState('30');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    // Simuler la génération
    setTimeout(() => {
      setIsGenerating(false);
    }, 3000);
  };

  const handlePreset = (preset: string) => {
    switch(preset) {
      case 'radio':
        setVoiceType('masculine');
        setTone('dynamique');
        setAudience('radio');
        setDuration('30');
        setPrompt('Votre message publicitaire dynamique pour la radio...');
        break;
      case 'documentaire':
        setVoiceType('mature');
        setTone('narratif');
        setAudience('documentaire');
        setDuration('120');
        setPrompt('Narration documentaire captivante...');
        break;
      case 'elearning':
        setVoiceType('feminine');
        setTone('professionnel');
        setAudience('elearning');
        setDuration('60');
        setPrompt('Contenu pédagogique clair et accessible...');
        break;
    }
  };

  return (
      <div className="min-h-screen bg-white text-gray-900 p-2 sm:p-4">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="text-center space-y-3 sm:space-y-4 px-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-[#667eea] to-[#f093fb] bg-clip-text text-transparent">
              EKHO Studio #kiff
            </h1>
            <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto">
              Créez des voix off professionnelles en quelques clics
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {/* Configuration Card */}
            <Card className="bg-white border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 sm:gap-3 text-gray-900 text-lg sm:text-xl">
                  <Mic className="text-[#667eea]" size={20} />
                  Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-4">
                {/* Prompt Input */}
                <div className="space-y-2">
                  <Label htmlFor="prompt" className="text-gray-700 text-sm sm:text-base">
                    Texte à lire ou description
                  </Label>
                  <Textarea
                      id="prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Entrez votre texte ou décrivez le style de voix off souhaité..."
                      className="h-24 sm:h-32 bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#667eea] focus:ring-[#667eea] text-sm sm:text-base"
                  />
                </div>

                {/* Voice Type */}
                <div className="space-y-2">
                  <Label className="text-gray-700 text-sm sm:text-base">Type de voix</Label>
                  <Select value={voiceType} onValueChange={setVoiceType}>
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900 focus:border-[#667eea] focus:ring-[#667eea] text-sm sm:text-base h-10 sm:h-11">
                      <SelectValue placeholder="Choisir un type de voix" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300">
                      <SelectItem value="masculine">Masculine</SelectItem>
                      <SelectItem value="feminine">Féminine</SelectItem>
                      <SelectItem value="jeune">Jeune</SelectItem>
                      <SelectItem value="mature">Mature</SelectItem>
                      <SelectItem value="corporative">Corporative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tone */}
                <div className="space-y-2">
                  <Label className="text-gray-700 text-sm sm:text-base">Ton et style</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900 focus:border-[#667eea] focus:ring-[#667eea] text-sm sm:text-base h-10 sm:h-11">
                      <SelectValue placeholder="Sélectionner un ton" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300">
                      <SelectItem value="professionnel">Professionnel</SelectItem>
                      <SelectItem value="chaleureux">Chaleureux</SelectItem>
                      <SelectItem value="dynamique">Dynamique</SelectItem>
                      <SelectItem value="calme">Calme et posé</SelectItem>
                      <SelectItem value="enthousiaste">Enthousiaste</SelectItem>
                      <SelectItem value="narratif">Narratif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Audience */}
                <div className="space-y-2">
                  <Label className="text-gray-700 text-sm sm:text-base">Destination</Label>
                  <Select value={audience} onValueChange={setAudience}>
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900 focus:border-[#667eea] focus:ring-[#667eea] text-sm sm:text-base h-10 sm:h-11">
                      <SelectValue placeholder="Choisir la destination" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300">
                      <SelectItem value="radio">Radio</SelectItem>
                      <SelectItem value="television">Télévision</SelectItem>
                      <SelectItem value="publicite">Publicité</SelectItem>
                      <SelectItem value="podcast">Podcast</SelectItem>
                      <SelectItem value="documentaire">Documentaire</SelectItem>
                      <SelectItem value="elearning">E-learning</SelectItem>
                      <SelectItem value="presentation">Présentation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <Label htmlFor="duration" className="text-gray-700 text-sm sm:text-base">
                    Durée estimée (secondes)
                  </Label>
                  <Input
                      id="duration"
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      min="5"
                      max="300"
                      className="bg-white border-gray-300 text-gray-900 focus:border-[#667eea] focus:ring-[#667eea] text-sm sm:text-base h-10 sm:h-11"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Generation and Results */}
            <div className="space-y-3 sm:space-y-4">
              {/* Generate Card */}
              <Card className="bg-white border-gray-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-gray-900 text-lg sm:text-xl">Génération</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-3 sm:p-4">
                  <Button
                      onClick={handleGenerate}
                      disabled={!prompt || isGenerating}
                      className="w-full py-3 sm:py-4 bg-gradient-to-r from-[#667eea] to-[#f093fb] hover:opacity-90 text-white font-semibold cursor-pointer text-sm sm:text-base"
                      size="lg"
                  >
                    {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Génération en cours...
                        </>
                    ) : (
                        <>
                          <Mic className="mr-2 h-4 w-4" />
                          Générer la voix off
                        </>
                    )}
                  </Button>

                  <p className="text-xs sm:text-sm text-gray-500 text-center">
                    Temps estimé: 30-60 secondes
                  </p>
                </CardContent>
              </Card>

              {/* Upload Card */}
              <Card className="bg-white border-gray-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-gray-900 text-lg sm:text-xl">Ou importer un fichier</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4 text-center hover:border-[#667eea] transition-colors cursor-pointer">
                    <Upload className="mx-auto mb-2 sm:mb-3 text-gray-400" size={28} />
                    <p className="text-gray-600 mb-1 sm:mb-2 text-sm sm:text-base">Glissez votre script ici</p>
                    <p className="text-xs sm:text-sm text-gray-400">TXT, DOC, PDF (max 5MB)</p>
                  </div>
                </CardContent>
              </Card>

              {/* Results Card */}
              <Card className="bg-white border-gray-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-gray-900 text-lg sm:text-xl">Résultats générés</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4">
                  {isGenerating ? (
                      <div className="space-y-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                      </div>
                  ) : (
                      <div className="text-center py-4 sm:py-6 text-gray-500">
                        <Mic size={40} className="mx-auto mb-2 sm:mb-3 opacity-50" />
                        <p className="text-sm sm:text-base mb-1">Aucune voix off générée pour le moment</p>
                        <p className="text-xs sm:text-sm">Configurez vos paramètres et cliquez sur "Générer"</p>
                      </div>
                  )}

                  <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row gap-2">
                    <Button variant="secondary" className="flex-1 bg-[#667eea] hover:bg-[#5a6fd8] text-white cursor-pointer text-sm sm:text-base py-2 sm:py-3" disabled>
                      <Play className="mr-2 h-4 w-4" />
                      Écouter
                    </Button>
                    <Button variant="secondary" className="flex-1 bg-[#f093fb] hover:bg-[#e185f0] text-white cursor-pointer text-sm sm:text-base py-2 sm:py-3" disabled>
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Quick Presets */}
          <Card className="bg-white border-gray-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-gray-900 text-lg sm:text-xl">Presets rapides</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <Button
                    variant="outline"
                    className="h-auto p-2 sm:p-3 bg-white border-gray-300 hover:border-[#667eea] hover:bg-gray-50 text-left flex-col items-start space-y-1 cursor-pointer"
                    onClick={() => handlePreset('radio')}
                >
                  <h4 className="font-semibold text-[#667eea] text-sm sm:text-base">Publicité Radio</h4>
                  <p className="text-xs sm:text-sm text-gray-500">Ton dynamique, voix masculine, 30s</p>
                </Button>

                <Button
                    variant="outline"
                    className="h-auto p-2 sm:p-3 bg-white border-gray-300 hover:border-[#f093fb] hover:bg-gray-50 text-left flex-col items-start space-y-1 cursor-pointer"
                    onClick={() => handlePreset('documentaire')}
                >
                  <h4 className="font-semibold text-[#f093fb] text-sm sm:text-base">Documentaire</h4>
                  <p className="text-xs sm:text-sm text-gray-500">Ton narratif, voix posée, longue durée</p>
                </Button>

                <Button
                    variant="outline"
                    className="h-auto p-2 sm:p-3 bg-white border-gray-300 hover:border-[#667eea] hover:bg-gray-50 text-left flex-col items-start space-y-1 cursor-pointer sm:col-span-2 lg:col-span-1"
                    onClick={() => handlePreset('elearning')}
                >
                  <h4 className="font-semibold text-[#667eea] text-sm sm:text-base">E-learning</h4>
                  <p className="text-xs sm:text-sm text-gray-500">Ton professionnel, voix claire</p>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}

export default VoiceoverGenerator;