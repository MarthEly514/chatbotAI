
// Éléments DOM
const homePage = document.getElementById('homePage');
const chatPage = document.getElementById('chatPage');
const startBtn = document.getElementById('startBtn');
const backToHome = document.getElementById('backToHome');
const chatMessages = document.getElementById('chatMessages');
const textForm = document.getElementById('textForm');
const linkForm = document.getElementById('linkForm');
const textTab = document.getElementById('textTab');
const linkTab = document.getElementById('linkTab');
const textInput = document.getElementById('textInput');
const linkInput = document.getElementById('linkInput');
const submitText = document.getElementById('submitText');
const submitLink = document.getElementById('submitLink');

// Navigation entre les pages
// startBtn.addEventListener('click', () => {
//     homePage.classList.add('hidden');
//     chatPage.classList.remove('hidden');
// });

backToHome.addEventListener('click', () => {
    chatPage.classList.add('hidden');
    homePage.classList.remove('hidden');
});

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

// Simulation de la vérification
function simulateVerification(input, isLink = false) {
    // Afficher le message de l'utilisateur
    addMessage(input, true);

    // Simuler un temps de traitement
    setTimeout(() => {
        // Générer un résultat aléatoire pour la démonstration
        const randomResult = Math.random();

        if (randomResult < 0.4) {
            // Fake news détectée
            addMessage(`
                        <p class="font-medium">Résultat de l'analyse :</p>
                        <p class="mt-2">Nous n'avons pas trouvé de sources fiables confirmant cette information.</p>
                        <div class="mt-4 p-3 bg-red-50 rounded-lg">
                            <p class="text-sm font-medium text-red-800 flex items-center">
                                <i class="fas fa-exclamation-triangle mr-2"></i> Attention : Possible fake news
                            </p>
                            <p class="text-sm text-red-700 mt-1">
                                Cette information n'est pas vérifiée par des sources fiables. Soyez prudent avant de la partager.
                            </p>
                        </div>
                        <div class="mt-4">
                            <p class="text-sm font-medium">Conseils :</p>
                            <ul class="text-sm mt-1 list-disc list-inside">
                                <li>Vérifiez auprès de sources officielles</li>
                                <li>Recherchez des informations contradictoires</li>
                                <li>Évitez de partager sans vérification</li>
                            </ul>
                        </div>
                    `, false, true);
        } else if (randomResult < 0.7) {
            // Information vérifiée
            addMessage(`
                        <p class="font-medium">Résultat de l'analyse :</p>
                        <p class="mt-2">Cette information semble fiable selon nos vérifications.</p>
                        <div class="mt-4 p-3 bg-green-50 rounded-lg">
                            <p class="text-sm font-medium text-green-800 flex items-center">
                                <i class="fas fa-check-circle mr-2"></i> Information vérifiée
                            </p>
                            <p class="text-sm text-green-700 mt-1">
                                Nous avons trouvé plusieurs sources fiables qui confirment cette information.
                            </p>
                        </div>
                        <div class="mt-4">
                            <p class="text-sm font-medium">Sources consultées :</p>
                            <ul class="text-sm mt-1">
                                <li class="flex items-center mt-1">
                                    <i class="fas fa-newspaper text-blue-500 mr-2"></i>
                                    <span>Agence France-Presse (AFP)</span>
                                </li>
                                <li class="flex items-center mt-1">
                                    <i class="fas fa-globe text-blue-500 mr-2"></i>
                                    <span>Site officiel du gouvernement</span>
                                </li>
                                <li class="flex items-center mt-1">
                                    <i class="fas fa-university text-blue-500 mr-2"></i>
                                    <span>Média certifié</span>
                                </li>
                            </ul>
                        </div>
                    `, false, false, true);
        } else {
            // Information partiellement vérifiée
            addMessage(`
                        <p class="font-medium">Résultat de l'analyse :</p>
                        <p class="mt-2">Cette information est partiellement vérifiée.</p>
                        <div class="mt-4 p-3 bg-yellow-50 rounded-lg">
                            <p class="text-sm font-medium text-yellow-800 flex items-center">
                                <i class="fas fa-info-circle mr-2"></i> Information à prendre avec précaution
                            </p>
                            <p class="text-sm text-yellow-700 mt-1">
                                Certains éléments sont confirmés par des sources fiables, mais d'autres aspects nécessitent plus de vérifications.
                            </p>
                        </div>
                        <div class="mt-4">
                            <p class="text-sm font-medium">Recommandations :</p>
                            <ul class="text-sm mt-1 list-disc list-inside">
                                <li>Consultez plusieurs sources d'information</li>
                                <li>Vérifiez la date de publication</li>
                                <li>Attention aux informations sorties de leur contexte</li>
                            </ul>
                        </div>
                    `);
        }
    }, 1500);

    // Afficher un indicateur de traitement
    const processingDiv = document.createElement('div');
    processingDiv.className = 'message bot-message p-4';
    processingDiv.innerHTML = `
    <div class="flex items-start">
        <div class="w-8 h-8 rounded-full gradient-bg flex items-center justify-center mr-3 flex-shrink-0">
            <i class="fas fa-robot text-white text-xs"></i>
        </div>
        <div>
            <p>Analyse en cours...</p>
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
}

// Gestion de la soumission du texte
submitText.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (text) {
        simulateVerification(text);
        textInput.value = '';
    } else {
        alert('Veuillez entrer un texte à vérifier.');
    }
});

// Gestion de la soumission du lien
submitLink.addEventListener('click', () => {
    const link = linkInput.value.trim();
    if (link) {
        simulateVerification(link, true);
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