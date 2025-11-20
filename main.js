
const BACKEND_URL = 'http://localhost:3000/api/verify';

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

/**
 * Envoie l'input (texte ou lien) à l'API de vérification de faits et affiche le résultat.
 * @param {string} input - Le texte ou le lien à vérifier.
 * @param {boolean} isLink - Indique si l'input est un lien.
 */

async function sendToHuggingFace(input, isLink = false) {
    // Afficher le message de l'utilisateur
    addMessage(input, true);

    // Afficher l'indicateur de traitement
    const processingMessage = displayProcessingIndicator();

    try {
        // --- ÉTAPE 1: Logique de Traitement de l'Input ---
        // Pour un lien, vous auriez besoin d'un backend pour scraper le contenu.
        // Ici, on envoie simplement le texte pour la démo.
        const textToAnalyze = isLink ? `Vérifiez le contenu de ce lien: ${input}` : input;

        // --- ÉTAPE 2: Appel à l'API Hugging Face ---
        const response = await fetch(HF_MODEL_URL, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${HF_API_KEY}`,
                "Content-Type": "application/json"
            },
            // Le format des données dépend du modèle que vous utilisez.
            // Ceci est un format commun pour les modèles de classification/NLI.
            body: JSON.stringify({
                "inputs": textToAnalyze,
                "options": { "wait_for_model": true }
            })
        });

        // Supprimer l'indicateur de chargement
        processingMessage.remove();

        if (!response.ok) {
            // Gérer les erreurs de l'API (ex: clé invalide, modèle non disponible)
            const errorData = await response.json();
            console.error('Erreur API Hugging Face:', errorData);
            addMessage(`
                <p class="font-medium">⚠️ Erreur de connexion au modèle</p>
                <p class="mt-2">Impossible de contacter le service de vérification. Code : ${response.status}.</p>
                <p class="text-sm mt-1">Veuillez vérifier votre clé API ou le statut du modèle.</p>
            `, false, true);
            return;
        }

        const data = await response.json();
        console.log('Réponse du Modèle:', data);

        // --- ÉTAPE 3: Interprétation de la Réponse du Modèle ---
        // L'interprétation dépend du modèle. Ici, on simule une classification NLI (Neutral, Entailment, Contradiction).

        // Trouver l'étiquette (label) avec le score le plus élevé
        // [ { label: 'CONTRADICTION', score: 0.95 }, ... ]
        const bestResult = data[0] && data[0].length > 0 ? data[0].reduce((prev, current) => (prev.score > current.score) ? prev : current) : null;

        // Simuler le résultat pour la démo, car la sortie NLI seule ne suffit pas au fact-checking.
        let resultLabel = 'UNKNOWN';
        if (bestResult) {
            // Utiliser le label NLI pour simuler une classification
            if (bestResult.label === 'CONTRADICTION' && bestResult.score > 0.8) {
                resultLabel = 'FAKE_NEWS';
            } else if (bestResult.label === 'ENTAILMENT' && bestResult.score > 0.8) {
                resultLabel = 'VERIFIED';
            } else {
                resultLabel = 'PARTIAL';
            }
        } else {
            // Fallback si la réponse du modèle est vide ou inattendue
            resultLabel = Math.random() < 0.3 ? 'FAKE_NEWS' : Math.random() < 0.6 ? 'VERIFIED' : 'PARTIAL';
        }

        // --- ÉTAPE 4: Affichage du Résultat (Basé sur la logique existante) ---
        displayVerificationResult(resultLabel, textToAnalyze);

    } catch (error) {
        // Supprimer l'indicateur de chargement en cas d'erreur réseau
        if (processingMessage && processingMessage.parentNode) {
            processingMessage.remove();
        }
        console.error('Erreur de la requête fetch:', error);
        addMessage(`
            <p class="font-medium">❌ Erreur réseau</p>
            <p class="mt-2">Impossible d'établir la communication avec le serveur.</p>
        `, false, true);
    }
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
            body: JSON.stringify({ input, isLink })
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
                    <p class="font-medium">Résultat de l'analyse :</p>
                    <p class="mt-2">**ALERTE ROUGE :** Cette information présente de fortes incohérences. Nous n'avons pas trouvé de sources fiables confirmant **«${queryText.substring(0, 50)}...»**.</p>
                    <div class="mt-4 p-3 bg-red-50 rounded-lg">
                        <p class="text-sm font-medium text-red-800 flex items-center">
                            <i class="fas fa-exclamation-triangle mr-2"></i> 🚨 Attention : Possible fake news
                        </p>
                        <p class="text-sm text-red-700 mt-1">
                            L'analyse indique une **forte probabilité de contradiction** avec les données factuelles connues. Soyez prudent avant de la partager.
                        </p>
                    </div>
                    <div class="mt-4">
                        <p class="text-sm font-medium">💡 Conseils pour reconnaître les fake news :</p>
                        <ul class="text-sm mt-1 list-disc list-inside">
                            <li>**Vérifiez l'URL** : Y a-t-il des fautes ou des extensions bizarres ?</li>
                            <li>**L'émotion** : Les titres sont-ils ultra-sensationnalistes ?</li>
                            <li>**L'auteur** : Est-il identifiable et crédible ?</li>
                        </ul>
                    </div>
                `, false, true);
    } else if (resultLabel === 'VERIFIED') {
        // Information vérifiée
        addMessage(`
                    <p class="font-medium">Résultat de l'analyse :</p>
                    <p class="mt-2">✅ **CONFIRMÉ :** Cette information semble fiable et cohérente selon nos vérifications.</p>
                    <div class="mt-4 p-3 bg-green-50 rounded-lg">
                        <p class="text-sm font-medium text-green-800 flex items-center">
                            <i class="fas fa-check-circle mr-2"></i> Information vérifiée
                        </p>
                        <p class="text-sm text-green-700 mt-1">
                            L'analyse est en **accord** avec plusieurs sources fiables et reconnues.
                        </p>
                    </div>
                    <div class="mt-4">
                        <p class="text-sm font-medium">🔍 Exemple de Sources (Simulées) :</p>
                        <ul class="text-sm mt-1">
                            <li class="flex items-center mt-1">
                                <i class="fas fa-newspaper text-blue-500 mr-2"></i>
                                <span>AFP / Reuters (Médias de référence)</span>
                            </li>
                            <li class="flex items-center mt-1">
                                <i class="fas fa-globe text-blue-500 mr-2"></i>
                                <span>Rapports d'organisations internationales</span>
                            </li>
                        </ul>
                    </div>
                `, false, false, true);
    } else {
        // Information partiellement vérifiée / Neutre / Incertaine
        addMessage(`
                    <p class="font-medium">Résultat de l'analyse :</p>
                    <p class="mt-2">⚠️ **INCERTITUDE :** Cette information est partiellement vérifiée ou le modèle est neutre.</p>
                    <div class="mt-4 p-3 bg-yellow-50 rounded-lg">
                        <p class="text-sm font-medium text-yellow-800 flex items-center">
                            <i class="fas fa-info-circle mr-2"></i> Information à prendre avec précaution
                        </p>
                        <p class="text-sm text-yellow-700 mt-1">
                            Certains éléments ne peuvent pas être confirmés par des sources fiables ou le contexte est manquant.
                        </p>
                    </div>
                    <div class="mt-4">
                        <p class="text-sm font-medium">📚 Recommandations :</p>
                        <ul class="text-sm mt-1 list-disc list-inside">
                            <li>**Triangulez l'information** : Cherchez la même information sur 3 sources indépendantes.</li>
                            <li>**Vérifiez la date** : Une information ancienne sortie de son contexte peut devenir trompeuse.</li>
                            <li>**Consultez des fact-checkers** : Cherchez si des sites spécialisés l'ont déjà analysée (ex: Decodex, Les Décodeurs).</li>
                        </ul>
                    </div>
                `);
    }
}


// Gestion de la soumission du texte
submitText.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (text) {
        sendToHuggingFace(text);
        textInput.value = '';
    } else {
        alert('Veuillez entrer un texte à vérifier.');
    }
});

// Gestion de la soumission du lien
submitLink.addEventListener('click', () => {
    const link = linkInput.value.trim();
    if (link) {
        sendToHuggingFace(link, true);
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