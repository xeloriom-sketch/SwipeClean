# SwipeClean 👋

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)  
[![Expo SDK](https://img.shields.io/badge/Expo-ReactNative-blue)](https://expo.dev)  
[![React Native](https://img.shields.io/badge/React_Native-0.83.0-blue)](https://reactnative.dev)  
[![Build](https://github.com/xeloriom-sketch/SwipeClean/actions/workflows/main.yml/badge.svg)](https://github.com/xeloriom-sketch/SwipeClean/actions)

**SwipeClean** est une **application mobile React Native** développée avec **Expo**, permettant de **parcourir et gérer rapidement vos photos** avec un système de **swipe inspiré de Tinder**.

Elle combine rapidité, intuitivité et puissance pour organiser vos albums photo et offre la possibilité de :
- Ajouter des photos aux favoris
- Envoyer des photos à la poubelle (temporaire ou suppression définitive)
- Filtrer par galerie
- Visualiser et gérer les favoris

---

## 🚀 Fonctionnalités principales

### Swipe et gestion de photos
- **Swipe rapide** :
    - **Droite** : Ajouter aux favoris
    - **Gauche** : Envoyer à la poubelle (temporaire)
- **Favoris** : Onglet dédié pour consulter vos photos préférées
- **Poubelle** : Stock temporaire avant suppression définitive
- **Suppression définitive** : Libérez de l’espace sur votre appareil

### Filtrage et organisation
- **Filtrage par galerie** : Sélection d’albums spécifiques
- **Tri** : Par date ou type de photo

### Interface et expérience utilisateur
- **Animations fluides** : Swipe et transitions avec **React Native Reanimated**
- **Navigation simple** : **Expo Router** + **React Navigation Bottom Tabs**
- **Mode sombre** : Support complet dark mode
- **Responsive** : Tablettes et mobiles

### Sécurité et stockage
- **AsyncStorage** : Stockage local des favoris
- **Expo Media Library** : Gestion des albums et photos
- **Expo Image Picker** : Sélection rapide de photos

---

## ⚡ Technologies utilisées

- **React Native** & **Expo SDK**
- **Expo Router** pour navigation basée sur les fichiers
- **React Navigation Bottom Tabs** pour barre de navigation
- **React Native Reanimated & Gesture Handler** pour les animations
- **AsyncStorage** pour stockage local
- **Expo Media Library** pour accès aux albums et photos
- **Expo Image Picker** pour sélectionner les photos
- **TypeScript** pour typage strict et maintenabilité
- **ESLint & Prettier** pour qualité et formatage du code
- **Jest + React Native Testing Library** pour tests unitaires

---

## 🧪 Tests unitaires

SwipeClean utilise **Jest** et **React Native Testing Library** pour garantir le bon fonctionnement du code.

### Lancer les tests :

```bash
yarn test
# ou
npm run test