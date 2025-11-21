
// const BACKEND_URL = 'http://localhost:3000/api/verify';// dev mode
const BACKEND_URL = '/.netlify/functions/verify'; // prod mode


// Éléments DOM
const homePage = document.getElementById('homePage');
const startBtn = document.getElementById('startBtn');
const backToHome = document.getElementById('backToHome');
const textForm = document.getElementById('textForm');
const linkForm = document.getElementById('linkForm');
const textTab = document.getElementById('textTab');
const linkTab = document.getElementById('linkTab');


// Navigation entre les onglets
textTab.addEventListener('click', () => {
    textTab.classList.add('active', 'bg-blue-100', 'text-blue-700');
    textTab.classList.remove('bg-gray-100', 'text-gray-700');
    linkTab.classList.add('bg-gray-100', 'text-gray-700');
    linkTab.classList.remove('active', 'bg-blue-100', 'text-blue-700');
    textForm.classList.remove('hidden');
    linkForm.classList.add('hidden');
});

linkTab.addEventListener('click', () => {
    linkTab.classList.add('active', 'bg-blue-100', 'text-blue-700');
    linkTab.classList.remove('bg-gray-100', 'text-gray-700');
    textTab.classList.add('bg-gray-100', 'text-gray-700');
    textTab.classList.remove('active', 'bg-blue-100', 'text-blue-700');
    linkForm.classList.remove('hidden');
    textForm.classList.add('hidden');
});

// Fonction pour ajouter un message dans le chat
function addMessage(content, isUser = false, isWarning = false, isVerified = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'} p-4`;

    if (isWarning) {
        messageDiv.classList.add('fake-news-warning');
    } else if (isVerified) {
        messageDiv.classList.add('verified-news');
    }

    const messageContent = `
    <div class="flex items-start">
        <div class="w-8 h-8 rounded-full ${isUser ? 'bg-blue-500' : 'gradient-bg'} flex items-center justify-center mr-3 flex-shrink-0">
            <i class="fas ${isUser ? 'fa-user' : 'fa-robot'} text-white text-xs"></i>
        </div>
        <div class="flex-1">
            ${content}
        </div>
    </div>
    `;

    messageDiv.innerHTML = messageContent;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Fonction utilitaire pour afficher l'indicateur de traitement
function displayProcessingIndicator() {
    const processingDiv = document.createElement('div');
    processingDiv.className = 'message bot-message p-4';
    processingDiv.id = 'processing-indicator'; // Ajout d'un ID pour la suppression
    processingDiv.innerHTML = `
    <div class="flex items-start">
        <div class="w-8 h-8 rounded-full gradient-bg flex items-center justify-center mr-3 flex-shrink-0">
            <i class="fas fa-robot text-white text-xs"></i>
        </div>
        <div>
            <p>Analyse en cours sur le serveur...</p>
            <div class="flex space-x-1 mt-2">
                <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
            </div>
        </div>
    </div>
    `;
    chatMessages.appendChild(processingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return processingDiv;
}


/**
 * Envoie l'input au serveur backend sécurisé pour vérification.
 * @param {string} input - Le texte ou le lien à vérifier.
 * @param {boolean} isLink - Indique si l'input est un lien.
 */
async function sendToBackendForVerification(input, isLink = false) {
    // 1. Afficher le message de l'utilisateur
    addMessage(input, true);

    // 2. Afficher l'indicateur de traitement
    const processingMessage = displayProcessingIndicator();

    try {
        // 3. Appel au backend
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                input, isLink,
                parameters: {
                    candidate_labels: ["CONTRADICTION", "ENTAILMENT", "NEUTRAL"],
                    multi_label: false
                }
            })
        });

        // Supprimer l'indicateur de chargement
        processingMessage.remove();

        if (!response.ok) {
            // Gérer les erreurs de communication avec le backend ou les erreurs du backend
            const errorData = await response.json();
            console.error('Erreur Backend:', errorData);
            addMessage(`
                <p class="font-medium">⚠️ Erreur de vérification</p>
                <p class="mt-2">Impossible de finaliser l'analyse. Erreur: **${errorData.error || 'Erreur inconnue'}**</p>
                <p class="text-sm mt-1">Veuillez vérifier que le serveur backend est bien lancé (port 3000).</p>
            `, false, true);
            return;
        }

        const verificationResult = await response.json();
        console.log('Résultat Backend:', verificationResult);

        // 4. Affichage du résultat basé sur le statut renvoyé par le serveur
        displayVerificationResult(verificationResult.status, input, verificationResult.explanation);

    } catch (error) {
        // Gérer les erreurs réseau (ex: le serveur n'est pas lancé)
        if (processingMessage && processingMessage.parentNode) {
            processingMessage.remove();
        }
        console.error('Erreur réseau / Backend non atteint:', error);
        addMessage(`
            <p class="font-medium">❌ Erreur de connexion</p>
            <p class="mt-2">Impossible de contacter le serveur de vérification.</p>
            <p class="text-sm mt-1">Assurez-vous que le serveur Node.js est en cours d'exécution.</p>
        `, false, true);
    }
}

// Fonction utilitaire pour afficher le résultat de la vérification (Mise à jour pour utiliser l'explication du backend)
function displayVerificationResult(statusLabel, queryText, explanation) {
    let content = '';

    if (statusLabel === 'FAKE_NEWS') {
        content = `
            <p class="font-medium">Résultat de l'analyse :</p>
            <p class="mt-2">${explanation}</p>
            <div class="mt-4 p-3 bg-red-50 rounded-lg">
                <p class="text-sm font-medium text-red-800 flex items-center">
                    <i class="fas fa-exclamation-triangle mr-2"></i> 🚨 Attention : Possible fake news
                </p>
                <p class="text-sm text-red-700 mt-1">
                    L'information semble contredire les données factuelles connues.
                </p>
            </div>
            <div class="mt-4">
                <p class="text-sm font-medium">💡 Conseils pour reconnaître les fake news :</p>
                <ul class="text-sm mt-1 list-disc list-inside">
                    <li>**Source inconnue ?** Si le média n'est pas fiable, soyez prudent.</li>
                    <li>**Recherche Inversée :** Vérifiez si les images ou vidéos sont utilisées hors contexte.</li>
                </ul>
            </div>
        `;
        addMessage(content, false, true);
    } else if (statusLabel === 'VERIFIED') {
        content = `
            <p class="font-medium">Résultat de l'analyse :</p>
            <p class="mt-2">${explanation}</p>
            <div class="mt-4 p-3 bg-green-50 rounded-lg">
                <p class="text-sm font-medium text-green-800 flex items-center">
                    <i class="fas fa-check-circle mr-2"></i> Information vérifiée
                </p>
                <p class="text-sm text-green-700 mt-1">
                    L'information est confirmée par des sources fiables.
                </p>
            </div>
            <div class="mt-4">
                <p class="text-sm font-medium">🔍 Exemple de Sources :</p>
                <ul class="text-sm mt-1">
                    <li class="flex items-center mt-1">
                        <i class="fas fa-newspaper text-blue-500 mr-2"></i>
                        <span>Sources officielles/médias de référence (via recherche fact-checking).</span>
                    </li>
                </ul>
            </div>
        `;
        addMessage(content, false, false, true);
    } else {
        // PARTIAL ou UNKNOWN
        content = `
            <p class="font-medium">Résultat de l'analyse :</p>
            <p class="mt-2">${explanation}</p>
            <div class="mt-4 p-3 bg-yellow-50 rounded-lg">
                <p class="text-sm font-medium text-yellow-800 flex items-center">
                    <i class="fas fa-info-circle mr-2"></i> Information à prendre avec précaution
                </p>
                <p class="text-sm text-yellow-700 mt-1">
                    Le modèle n'a pas pu confirmer ou contredire avec une haute certitude.
                </p>
            </div>
            <div class="mt-4">
                <p class="text-sm font-medium">📚 Recommandations :</p>
                <ul class="text-sm mt-1 list-disc list-inside">
                    <li>**Recherchez le contexte :** Une citation est-elle complète ou tronquée ?</li>
                    <li>**Consultez des fact-checkers :** Des sites comme l'AFP Factuel, CrossCheck, etc.</li>
                </ul>
            </div>
        `;
        addMessage(content);
    }
}

// // Simulation de la vérification
// function simulateVerification(input, isLink = false) {
//     // Afficher le message de l'utilisateur
//     addMessage(input, true);

//     // Simuler un temps de traitement
//     setTimeout(() => {
//         // Générer un résultat aléatoire pour la démonstration
//         const randomResult = Math.random();

//         if (randomResult < 0.4) {
//             // Fake news détectée
//             addMessage(`
//                         <p class="font-medium">Résultat de l'analyse :</p>
//                         <p class="mt-2">Nous n'avons pas trouvé de sources fiables confirmant cette information.</p>
//                         <div class="mt-4 p-3 bg-red-50 rounded-lg">
//                             <p class="text-sm font-medium text-red-800 flex items-center">
//                                 <i class="fas fa-exclamation-triangle mr-2"></i> Attention : Possible fake news
//                             </p>
//                             <p class="text-sm text-red-700 mt-1">
//                                 Cette information n'est pas vérifiée par des sources fiables. Soyez prudent avant de la partager.
//                             </p>
//                         </div>
//                         <div class="mt-4">
//                             <p class="text-sm font-medium">Conseils :</p>
//                             <ul class="text-sm mt-1 list-disc list-inside">
//                                 <li>Vérifiez auprès de sources officielles</li>
//                                 <li>Recherchez des informations contradictoires</li>
//                                 <li>Évitez de partager sans vérification</li>
//                             </ul>
//                         </div>
//                     `, false, true);
//         } else if (randomResult < 0.7) {
//             // Information vérifiée
//             addMessage(`
//                         <p class="font-medium">Résultat de l'analyse :</p>
//                         <p class="mt-2">Cette information semble fiable selon nos vérifications.</p>
//                         <div class="mt-4 p-3 bg-green-50 rounded-lg">
//                             <p class="text-sm font-medium text-green-800 flex items-center">
//                                 <i class="fas fa-check-circle mr-2"></i> Information vérifiée
//                             </p>
//                             <p class="text-sm text-green-700 mt-1">
//                                 Nous avons trouvé plusieurs sources fiables qui confirment cette information.
//                             </p>
//                         </div>
//                         <div class="mt-4">
//                             <p class="text-sm font-medium">Sources consultées :</p>
//                             <ul class="text-sm mt-1">
//                                 <li class="flex items-center mt-1">
//                                     <i class="fas fa-newspaper text-blue-500 mr-2"></i>
//                                     <span>Agence France-Presse (AFP)</span>
//                                 </li>
//                                 <li class="flex items-center mt-1">
//                                     <i class="fas fa-globe text-blue-500 mr-2"></i>
//                                     <span>Site officiel du gouvernement</span>
//                                 </li>
//                                 <li class="flex items-center mt-1">
//                                     <i class="fas fa-university text-blue-500 mr-2"></i>
//                                     <span>Média certifié</span>
//                                 </li>
//                             </ul>
//                         </div>
//                     `, false, false, true);
//         } else {
//             // Information partiellement vérifiée
//             addMessage(`
//                         <p class="font-medium">Résultat de l'analyse :</p>
//                         <p class="mt-2">Cette information est partiellement vérifiée.</p>
//                         <div class="mt-4 p-3 bg-yellow-50 rounded-lg">
//                             <p class="text-sm font-medium text-yellow-800 flex items-center">
//                                 <i class="fas fa-info-circle mr-2"></i> Information à prendre avec précaution
//                             </p>
//                             <p class="text-sm text-yellow-700 mt-1">
//                                 Certains éléments sont confirmés par des sources fiables, mais d'autres aspects nécessitent plus de vérifications.
//                             </p>
//                         </div>
//                         <div class="mt-4">
//                             <p class="text-sm font-medium">Recommandations :</p>
//                             <ul class="text-sm mt-1 list-disc list-inside">
//                                 <li>Consultez plusieurs sources d'information</li>
//                                 <li>Vérifiez la date de publication</li>
//                                 <li>Attention aux informations sorties de leur contexte</li>
//                             </ul>
//                         </div>
//                     `);
//         }
//     }, 1500);

//     // Afficher un indicateur de traitement
//     const processingDiv = document.createElement('div');
//     processingDiv.className = 'message bot-message p-4';
//     processingDiv.innerHTML = `
//     <div class="flex items-start">
//         <div class="w-8 h-8 rounded-full gradient-bg flex items-center justify-center mr-3 flex-shrink-0">
//             <i class="fas fa-robot text-white text-xs"></i>
//         </div>
//         <div>
//             <p>Analyse en cours...</p>
//             <div class="flex space-x-1 mt-2">
//                 <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
//                 <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
//                 <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
//             </div>
//         </div>
//     </div>
//     `;
//     chatMessages.appendChild(processingDiv);
//     chatMessages.scrollTop = chatMessages.scrollHeight;
// }

// Gestion de la soumission du texte
submitText.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (text) {
        sendToBackendForVerification(text);
        textInput.value = '';
    } else {
        alert('Veuillez entrer un texte à vérifier.');
    }
});

// Gestion de la soumission du lien
submitLink.addEventListener('click', () => {
    const link = linkInput.value.trim();
    if (link) {
        sendToBackendForVerification(link, true);
        linkInput.value = '';
    } else {
        alert('Veuillez entrer un lien à vérifier.');
    }
});

// Permettre l'envoi avec la touche Entrée
textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitText.click();
    }
});

linkInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitLink.click();
    }
});